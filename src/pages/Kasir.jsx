import { useState } from 'react';
import { Plus, Minus, Trash2, ShoppingCart, User, X, AlertCircle as AlertCircle, Search, Store } from 'lucide-react';
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

        if (paymentData.status === 'HUTANG') {
          const debtToAdd = subtotal - returnUsed;
          customerUpdates.remainingDebt = (selectedCustomer.remainingDebt || 0) + debtToAdd;
        } else if (paymentData.status === 'LUNAS') {
          if (paymentData.collectDebt && debtPaid > 0) {
            customerUpdates.remainingDebt = Math.max(0, (selectedCustomer.remainingDebt || 0) - debtPaid);
          }
        }

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
    <div className="pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* BAGIAN KIRI: DAFTAR PRODUK */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white p-4 rounded-2xl border flex items-center shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama atau kategori produk..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-[32px] shadow-sm border p-6 min-h-[500px]">
            <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2 mb-6">
              <Store className="w-5 h-5 text-teal-600"/> Etalase Produk
            </h3>

            {filteredProducts.length === 0 ? (
              <div className="mt-10">
                <EmptyState
                  title="Produk tidak ditemukan"
                  description="Coba kata kunci lain untuk mencari produk"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={product.stockPcs < 1}
                    className={`text-left border rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col ${
                      product.stockPcs < 1
                        ? 'opacity-50 cursor-not-allowed border-gray-200 grayscale'
                        : 'hover:border-teal-400 border-gray-200 bg-white'
                    }`}
                  >
                    {/* LOGIKA GAMBAR: Jika ada URL gambar, tampilkan. Jika tidak, tidak dirender sama sekali */}
                    {product.image && (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-32 object-cover border-b border-gray-100"
                      />
                    )}
                    
                    <div className="p-4 flex-1 flex flex-col">
                      <h4 className="font-black text-gray-800 text-sm mb-1 uppercase tracking-tight line-clamp-2 leading-snug">
                        {product.name}
                      </h4>
                      <p className="text-[9px] font-bold text-teal-600 uppercase tracking-widest mb-3 bg-teal-50 inline-block px-2 py-1 rounded-md self-start">
                        {product.category}
                      </p>
                      
                      <div className="mt-auto flex justify-between items-end border-t border-dashed border-gray-100 pt-3">
                        <div>
                          <span className="text-sm font-black text-teal-600 block">
                            Rp {product.price.toLocaleString('id-ID')}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-widest block mt-1 ${product.stockPcs < 10 ? 'text-red-500' : 'text-gray-400'}`}>
                            Stok: {product.stockPcs}
                          </span>
                        </div>
                        <span className="text-[9px] font-black bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">
                          {product.unitType}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BAGIAN KANAN: KERANJANG */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-[32px] shadow-sm border p-6 sticky top-28">
            <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Keranjang</h3>
              <div className="bg-teal-50 p-2 rounded-xl">
                <ShoppingCart className="w-5 h-5 text-teal-600" />
              </div>
            </div>

            {/* PEMBELI SECTION */}
            {selectedCustomer ? (
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                      <User className="w-4 h-4 text-teal-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-gray-800 uppercase tracking-tight truncate">{selectedCustomer.name}</p>
                      <p className="text-[10px] font-bold text-gray-500 tracking-widest">{selectedCustomer.phone || 'Tidak ada no HP'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCustomerModal(true)}
                    className="text-[10px] font-black uppercase tracking-widest bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded hover:bg-teal-50 hover:text-teal-600 hover:border-teal-200 transition-colors"
                  >
                    Ubah
                  </button>
                </div>

                {(selectedCustomer.returnAmount > 0 || selectedCustomer.remainingDebt > 0) && (
                  <div className="mt-3 pt-3 border-t border-dashed border-gray-200 space-y-1.5">
                    {selectedCustomer.returnAmount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Saldo Retur</span>
                        <span className="text-xs font-black text-green-600">Rp {selectedCustomer.returnAmount.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {selectedCustomer.remainingDebt > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sisa Hutang</span>
                        <span className="text-xs font-black text-orange-600">Rp {selectedCustomer.remainingDebt.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowCustomerModal(true)}
                className="w-full bg-teal-50 border border-teal-100 text-teal-700 px-4 py-4 rounded-2xl mb-6 hover:bg-teal-100 transition-colors text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Pilih / Tambah Pembeli
              </button>
            )}

            {/* DAFTAR ITEM KERANJANG */}
            <div className="space-y-3 mb-6 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
              {cart.length === 0 ? (
                <div className="text-center py-10">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Keranjang Kosong</p>
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

            {/* TOTAL & CHECKOUT */}
            <div className="border-t border-gray-100 pt-6 space-y-4">
              <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subtotal</span>
                <span className="font-bold text-gray-600">
                  Rp {subtotal.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="bg-teal-50 border border-teal-100 p-4 rounded-2xl">
                <div className="flex justify-between items-center">
                  <span className="font-black text-teal-800 uppercase tracking-tight">Total Akhir</span>
                  <span className="text-xl font-black text-teal-600">
                    Rp {subtotal.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || !selectedCustomer}
                className="w-full bg-teal-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-teal-700 transition-all shadow-xl shadow-teal-100 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed text-sm"
              >
                Proses Pembayaran
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL PILIH PEMBELI */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full max-h-[85vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                <User className="w-5 h-5 text-teal-600"/> Pilih Pembeli
              </h3>
              <button
                onClick={() => {
                  setShowCustomerModal(false);
                  setSearchCustomer('');
                }}
                className="bg-gray-50 p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau no HP..."
                  value={searchCustomer}
                  onChange={(e) => setSearchCustomer(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <button
                onClick={() => {
                  setShowCustomerModal(false);
                  setShowAddCustomerModal(true);
                  setSearchCustomer('');
                }}
                className="bg-teal-600 text-white px-4 py-3 rounded-2xl hover:bg-teal-700 transition-colors shadow-md shadow-teal-100 flex items-center justify-center"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {filteredCustomers.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <User className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 mb-4 text-xs font-bold">Pembeli tidak ditemukan</p>
                <button
                  onClick={() => {
                    setShowCustomerModal(false);
                    setShowAddCustomerModal(true);
                    setSearchCustomer('');
                  }}
                  className="bg-white border border-teal-200 text-teal-600 px-4 py-2 rounded-xl hover:bg-teal-50 transition-colors flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest mx-auto shadow-sm"
                >
                  <Plus className="w-3 h-3" /> Tambah Pembeli Baru
                </button>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setShowCustomerModal(false);
                      setSearchCustomer('');
                    }}
                    className={`w-full text-left p-4 border rounded-2xl transition-all duration-300 ${
                      selectedCustomer?.id === customer.id 
                        ? 'border-teal-500 bg-teal-50 shadow-sm' 
                        : 'border-gray-200 hover:border-teal-300 bg-white hover:shadow-md'
                    }`}
                  >
                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">{customer.name}</h4>
                    <p className="text-[10px] font-bold text-gray-500 tracking-widest mt-0.5">{customer.phone || 'Tanpa No HP'}</p>
                    
                    {customer.address && (
                      <p className="text-[10px] text-gray-500 mt-2 line-clamp-2 bg-gray-50 p-2 rounded-lg leading-relaxed">{customer.address}</p>
                    )}
                    
                    {(customer.returnAmount > 0 || customer.remainingDebt > 0) && (
                      <div className="text-[10px] font-black uppercase tracking-widest mt-3 pt-3 border-t border-dashed border-gray-200 space-y-1.5">
                        {customer.returnAmount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Retur</span>
                            <span className="text-green-600">Rp {customer.returnAmount.toLocaleString('id-ID')}</span>
                          </div>
                        )}
                        {customer.remainingDebt > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Hutang</span>
                            <span className="text-orange-600">Rp {customer.remainingDebt.toLocaleString('id-ID')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
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