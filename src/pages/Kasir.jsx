import { useState } from 'react';
import { Plus, Minus, Trash2, ShoppingCart, User, X, AlertCircle as AlertCircle } from 'lucide-react';
import { useCollection, addDocument, updateDocument, updateStockBatch } from '../hooks/useFirestore';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import Nota from '../components/Nota';
import CartItem from '../components/CartItem';
import QuickAddCustomer from '../components/QuickAddCustomer';
import PaymentModal from '../components/PaymentModal';

const Kasir = ({ onShowToast }) => {
  const { data: products, loading: loadingProducts } = useCollection('products');
  const { data: customers, loading: loadingCustomers } = useCollection('customers');
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showNota, setShowNota] = useState(false);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [searchProduct, setSearchProduct] = useState('');
  const [searchCustomer, setSearchCustomer] = useState('');
  const [addingCustomer, setAddingCustomer] = useState(false);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.category.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
    (c.phone && c.phone.includes(searchCustomer))
  );

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.productId === product.id);

    if (existingItem) {
      setCart(cart.map(item =>
        item.productId === product.id ? { ...item, qty: item.qty + 1 } : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        unitType: product.unitType,
        pcsPerCarton: product.pcsPerCarton || 1,
        price: product.price,
        qty: 1,
        discount: 0,
        stockPcs: product.stockPcs,
      }]);
    }
  };

  const updateQty = (productId, newQty) => {
    if (newQty < 1) {
      removeFromCart(productId);
      return;
    }

    setCart(cart.map(item =>
      item.productId === productId ? { ...item, qty: newQty } : item
    ));
  };

  const updateDiscount = (productId, discount) => {
    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, discount: Math.max(0, discount) }
        : item
    ));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const itemSubtotal = item.price * item.qty - (item.discount || 0);
      return sum + itemSubtotal;
    }, 0);
  };

  const handleAddNewCustomer = async (formData) => {
    setAddingCustomer(true);
    const result = await addDocument('customers', {
      ...formData,
      remainingDebt: 0,
      returnAmount: 0,
    });

    if (result.success) {
      onShowToast('Pembeli berhasil ditambahkan', 'success');
      const newCustomer = {
        id: result.id,
        ...formData,
        remainingDebt: 0,
        returnAmount: 0,
      };
      setSelectedCustomer(newCustomer);
      setShowAddCustomerModal(false);
      setShowCustomerModal(false);
      setSearchCustomer('');
    } else {
      onShowToast('Gagal menambahkan pembeli', 'error');
    }
    setAddingCustomer(false);
  };

  const handlePaymentConfirm = async (paymentData) => {
    if (!selectedCustomer) {
      onShowToast('Pilih pembeli terlebih dahulu', 'error');
      return;
    }

    const stockUpdates = [];
    for (const item of cart) {
      let pcsToReduce = item.qty;
      if (['KARTON', 'BALL', 'IKAT'].includes(item.unitType)) {
        pcsToReduce = item.qty * (item.pcsPerCarton || 1);
        }

      const newStock = item.stockPcs - pcsToReduce;

      if (newStock < 0) {
        onShowToast(`Stok ${item.name} tidak mencukupi`, 'error');
        return;
      }

      stockUpdates.push({
        productId: item.productId,
        newStock: newStock,
      });
    }

    let subtotal = calculateSubtotal();
    let finalTotal = subtotal;
    let returnUsed = 0;
    let debtPaid = 0;

    if (paymentData.useReturn && paymentData.returnAmount > 0) {
      returnUsed = paymentData.returnAmount;
      finalTotal -= returnUsed;
    }

    if (paymentData.collectDebt && paymentData.debtAmount > 0) {
      debtPaid = paymentData.debtAmount;
      finalTotal += debtPaid;
    }

    if (paymentData.status === 'LUNAS') {
      finalTotal = Math.max(0, finalTotal);
    } else if (paymentData.status === 'HUTANG') {
      finalTotal = 0;
    }

    const transactionData = {
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerPhone: selectedCustomer.phone || '',
      customerAddress: selectedCustomer.address || '',
      items: cart.map(item => ({
        productId: item.productId,
        name: item.name,
        qty: item.qty,
        unitType: item.unitType,
        pcsPerCarton: item.pcsPerCarton,
        price: item.price,
        discount: item.discount || 0,
        subtotal: item.price * item.qty - (item.discount || 0),
      })),
      subtotal: subtotal,
      total: finalTotal,
      returnUsed: returnUsed,
      debtPaid: debtPaid,
      paymentStatus: paymentData.status,
      paymentMethod: paymentData.status === 'LUNAS' ? paymentData.method : null,
    };

    const result = await addDocument('transactions', transactionData);

    if (result.success) {
      const stockResult = await updateStockBatch(stockUpdates);

      if (stockResult.success) {
        const customerUpdates = {};

        if (returnUsed > 0) {
          customerUpdates.returnAmount = Math.max(0, selectedCustomer.returnAmount - returnUsed);
        }

        // ==========================================
        // FIX LOGIKA HUTANG (Mencegah Timpa Menimpa)
        // ==========================================
        if (paymentData.status === 'HUTANG') {
          // Jika statusnya HUTANG: Belanjaan sekarang menambah saldo hutang lama.
          // Nilai "debtPaid" (dari centang Tagih) diabaikan ke database karena itu cuma visual untuk nota.
          const debtToAdd = subtotal - returnUsed;
          customerUpdates.remainingDebt = (selectedCustomer.remainingDebt || 0) + debtToAdd;
        } else if (paymentData.status === 'LUNAS') {
          // Jika statusnya LUNAS: Baru nilai "debtPaid" dipakai untuk MENGURANGI hutang lama.
          if (paymentData.collectDebt && debtPaid > 0) {
            customerUpdates.remainingDebt = Math.max(0, (selectedCustomer.remainingDebt || 0) - debtPaid);
          }
        }
        // ==========================================

        if (Object.keys(customerUpdates).length > 0) {
          const updateResult = await updateDocument('customers', selectedCustomer.id, customerUpdates);

          if (!updateResult.success) {
            console.error('Error updating customer:', updateResult.error);
            onShowToast('Transaksi berhasil tapi gagal update data pembeli', 'error');
            return;
          }
        }

        setLastTransaction({
          id: result.id,
          ...transactionData,
          createdAt: new Date(),
        });
        setShowNota(true);
        setCart([]);
        setSelectedCustomer(null);
        setShowPaymentModal(false);
        onShowToast('Transaksi berhasil', 'success');
      } else {
        onShowToast('Transaksi berhasil tapi gagal update stok', 'error');
      }
    } else {
      onShowToast('Gagal memproses transaksi', 'error');
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      onShowToast('Keranjang masih kosong', 'error');
      return;
    }

    if (!selectedCustomer) {
      onShowToast('Pilih pembeli terlebih dahulu', 'error');
      setShowCustomerModal(true);
      return;
    }

    setShowPaymentModal(true);
  };

  if (loadingProducts || loadingCustomers) return <Loading />;

  const subtotal = calculateSubtotal();

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Pilih Produk</h3>
              <input
                type="text"
                placeholder="Cari produk..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {filteredProducts.length === 0 ? (
              <EmptyState
                title="Produk tidak ditemukan"
                description="Coba kata kunci lain atau tambahkan produk baru"
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={product.stockPcs < 1}
                    className={`text-left p-4 border rounded-lg hover:shadow-md transition-shadow ${
                      product.stockPcs < 1
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-teal-500'
                    }`}
                  >
                    {product.image && (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-24 object-cover rounded mb-2"
                      />
                    )}
                    <h4 className="font-semibold text-sm text-gray-800 mb-1">{product.name}</h4>
                    <p className="text-xs text-gray-500 mb-2">{product.category}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-teal-600">
                        Rp {product.price.toLocaleString('id-ID')}
                      </span>
                      <span className="text-xs text-gray-500">Stok: {product.stockPcs}</span>
                    </div>
                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded mt-2 inline-block">
                      {product.unitType}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Keranjang</h3>
              <ShoppingCart className="w-5 h-5 text-teal-600" />
            </div>

            {selectedCustomer ? (
              <div className="bg-teal-50 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-teal-600" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{selectedCustomer.name}</p>
                      <p className="text-xs text-gray-600">{selectedCustomer.phone}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCustomerModal(true)}
                    className="text-xs text-teal-600 hover:text-teal-700 whitespace-nowrap ml-2"
                  >
                    Ubah
                  </button>
                </div>

                {(selectedCustomer.returnAmount > 0 || selectedCustomer.remainingDebt > 0) && (
                  <div className="mt-2 pt-2 border-t border-teal-200 space-y-1">
                    {selectedCustomer.returnAmount > 0 && (
                      <p className="text-xs text-green-600">
                        <span className="font-medium">Saldo Retur:</span> Rp {selectedCustomer.returnAmount.toLocaleString('id-ID')}
                      </p>
                    )}
                    {selectedCustomer.remainingDebt > 0 && (
                      <p className="text-xs text-orange-600">
                        <span className="font-medium">Sisa Hutang:</span> Rp {selectedCustomer.remainingDebt.toLocaleString('id-ID')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowCustomerModal(true)}
                className="w-full bg-teal-100 text-teal-700 px-4 py-3 rounded-lg mb-4 hover:bg-teal-200 transition-colors text-sm font-medium"
              >
                + Pilih Pembeli
              </button>
            )}

            <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto">
              {cart.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">Keranjang kosong</p>
                </div>
              ) : (
                cart.map((item) => (
                  <CartItem
                    key={item.productId}
                    item={item}
                    onUpdateQty={updateQty}
                    onRemove={removeFromCart}
                    onUpdateDiscount={updateDiscount}
                  />
                ))
              )}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Subtotal:</span>
                <span className="font-semibold text-gray-800">
                  Rp {subtotal.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="bg-teal-50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-800">Total</span>
                  <span className="text-xl font-bold text-teal-600">
                    Rp {subtotal.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || !selectedCustomer}
                className="w-full bg-teal-600 text-white py-3 rounded-lg font-semibold hover:bg-teal-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Proses Pembayaran
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Pilih Pembeli</h3>
              <button
                onClick={() => {
                  setShowCustomerModal(false);
                  setSearchCustomer('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Cari pembeli..."
                value={searchCustomer}
                onChange={(e) => setSearchCustomer(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
              />
              <button
                onClick={() => {
                  setShowCustomerModal(false);
                  setShowAddCustomerModal(true);
                  setSearchCustomer('');
                }}
                className="bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {filteredCustomers.length === 0 ? (
              <div className="text-center py-8">
                <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 mb-4 text-sm">Pembeli tidak ditemukan</p>
                <button
                  onClick={() => {
                    setShowCustomerModal(false);
                    setShowAddCustomerModal(true);
                    setSearchCustomer('');
                  }}
                  className="w-full bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Pembeli Baru
                </button>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setShowCustomerModal(false);
                      setSearchCustomer('');
                    }}
                    className={`w-full text-left p-3 border rounded-lg hover:border-teal-500 transition-colors text-sm ${
                      selectedCustomer?.id === customer.id ? 'border-teal-500 bg-teal-50' : ''
                    }`}
                  >
                    <h4 className="font-semibold text-gray-800">{customer.name}</h4>
                    <p className="text-xs text-gray-600">{customer.phone || '-'}</p>
                    {customer.address && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{customer.address}</p>
                    )}
                    {(customer.returnAmount > 0 || customer.remainingDebt > 0) && (
                      <div className="text-xs mt-2 space-y-1">
                        {customer.returnAmount > 0 && (
                          <p className="text-green-600">Retur: Rp {customer.returnAmount.toLocaleString('id-ID')}</p>
                        )}
                        {customer.remainingDebt > 0 && (
                          <p className="text-orange-600">Hutang: Rp {customer.remainingDebt.toLocaleString('id-ID')}</p>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => {
                setShowCustomerModal(false);
                setSearchCustomer('');
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      <QuickAddCustomer
        isOpen={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        onSubmit={handleAddNewCustomer}
        isLoading={addingCustomer}
      />

      {showPaymentModal && selectedCustomer && (
        <PaymentModal
          transaction={{ total: subtotal, items: cart }}
          customer={selectedCustomer}
          onConfirm={handlePaymentConfirm}
          onCancel={() => setShowPaymentModal(false)}
        />
      )}

      {showNota && lastTransaction && (
        <Nota
          transaction={lastTransaction}
          onClose={() => {
            setShowNota(false);
            setLastTransaction(null);
          }}
        />
      )}
    </div>
  );
};

export default Kasir;