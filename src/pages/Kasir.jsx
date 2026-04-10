import { useState, useEffect} from 'react';
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
  const [cart, setCart] = useState(() => {
  const savedCart = localStorage.getItem('kasir_cart');
  return savedCart ? JSON.parse(savedCart) : [];
});

const [selectedCustomer, setSelectedCustomer] = useState(() => {
  const savedCustomer = localStorage.getItem('kasir_customer');
  return savedCustomer ? JSON.parse(savedCustomer) : null;
});
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showNota, setShowNota] = useState(false);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [searchProduct, setSearchProduct] = useState('');
  const [searchCustomer, setSearchCustomer] = useState('');
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const executeResetTransaction = () => {
  setCart([]);
  setSelectedCustomer(null);
  localStorage.removeItem('kasir_cart');
  localStorage.removeItem('kasir_customer');
  setShowResetModal(false); // Tutup modal setelah selesai
  onShowToast('Transaksi berhasil dibatalkan', 'success');
};
  useEffect(() => {
  localStorage.setItem('kasir_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
  localStorage.setItem('kasir_customer', JSON.stringify(selectedCustomer));
  }, [selectedCustomer]);

  const handleResetTransaction = () => {
  if (window.confirm('Apakah Anda yakin ingin membatalkan transaksi dan mengosongkan keranjang?')) {
    setCart([]);
    setSelectedCustomer(null);
    localStorage.removeItem('kasir_cart');
    localStorage.removeItem('kasir_customer');
    onShowToast('Transaksi berhasil dibatalkan', 'success');
  }
};
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
        capitalPrice: product.capitalPrice || 0,
        qty: 1,
        discount: 0,
        stockPcs: product.stockPcs,
      }]);
    }

    // FITUR AUTO SCROLL: Menggulir mulus ke item yang baru saja di-klik
    setTimeout(() => {
      const element = document.getElementById(`cart-item-${product.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
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
      if (['KARTON', 'BALL', 'IKAT', 'RENCENG', 'BOX'].includes(item.unitType)) {
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
        capitalPrice: item.capitalPrice,
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
    <div className="pb-24 lg:pb-10">
      
      <div className="flex flex-col-reverse lg:grid lg:grid-cols-3 gap-6">
        
        {/* BAGIAN KIRI: DAFTAR PRODUK */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          
          <div className="bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border flex items-center shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3 md:top-3.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama atau kategori produk..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl text-xs md:text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-[24px] md:rounded-[32px] shadow-sm border p-4 md:p-6 min-h-[400px] md:min-h-[500px]">
            <h3 className="text-base md:text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2 mb-4 md:mb-6">
              <Store className="w-4 h-4 md:w-5 md:h-5 text-teal-600"/> Etalase Produk
            </h3>

            {filteredProducts.length === 0 ? (
              <div className="mt-10">
                <EmptyState
                  title="Produk tidak ditemukan"
                  description="Coba kata kunci lain untuk mencari produk"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 max-h-[50vh] md:max-h-[600px] overflow-y-auto custom-scrollbar pr-1 md:pr-2">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={product.stockPcs < 1}
                    className={`text-left border rounded-xl md:rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col active:scale-95 ${
                      product.stockPcs < 1
                        ? 'opacity-50 cursor-not-allowed border-gray-200 grayscale'
                        : 'hover:border-teal-400 border-gray-200 bg-white'
                    }`}
                  >
                    {product.image && (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-24 md:h-32 object-cover border-b border-gray-100"
                      />
                    )}
                    
                    <div className="p-3 md:p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-black text-gray-800 text-xs md:text-sm mb-1 uppercase tracking-tight line-clamp-2 leading-snug">
                          {product.name}
                        </h4>
                        <p className="text-[8px] md:text-[9px] font-bold text-teal-600 uppercase tracking-widest mb-2 md:mb-3 bg-teal-50 inline-block px-1.5 md:px-2 py-1 rounded-md">
                          {product.category}
                        </p>
                      </div>
                      
                      <div className="mt-2 flex flex-col sm:flex-row justify-between items-start sm:items-end border-t border-dashed border-gray-100 pt-2 md:pt-3 gap-1 md:gap-0">
                        <div>
                          <span className="text-xs md:text-sm font-black text-teal-600 block">
                            Rp {product.price.toLocaleString('id-ID')}
                          </span>
                          <span className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest block mt-0.5 md:mt-1 ${product.stockPcs < 10 ? 'text-red-500' : 'text-gray-400'}`}>
                            Stok: {product.stockPcs}
                          </span>
                        </div>
                        <span className="text-[8px] md:text-[9px] font-black bg-gray-100 text-gray-600 px-1.5 py-1 md:px-2 rounded uppercase tracking-wider self-end sm:self-auto">
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
          <div className="bg-white rounded-[24px] md:rounded-[32px] shadow-sm border p-4 md:p-6 lg:sticky lg:top-4 z-10">
            <div className="flex items-center justify-between mb-4 md:mb-6 border-b border-gray-100 pb-3 md:pb-4">
              <h3 className="text-base md:text-lg font-black text-gray-800 uppercase tracking-tighter">Keranjang</h3>
              <div className="flex items-center gap-2">
                
                {/* TOMBOL RESET / HAPUS SEMUA */}
                {(cart.length > 0 || selectedCustomer) && (
                  <button
                    onClick={() => setShowResetModal(true)} // Ubah bagian ini
                    className="bg-red-50 p-2 rounded-xl text-red-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                    title="Batalkan Transaksi"
                  >
                    <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                )}

                {/* ICON KERANJANG BAWAAN */}
                <div className="bg-teal-50 p-2 rounded-xl relative">
                  <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 text-teal-600" />
                  {cart.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {cart.reduce((total, item) => total + item.qty, 0)}
                    </span>
                  )}
                </div>
                
              </div>
            </div>

            {/* PEMBELI SECTION */}
            {selectedCustomer ? (
              <div className="bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl p-3 md:p-4 mb-4 md:mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                    <div className="bg-white p-1.5 md:p-2 rounded-lg shadow-sm flex-shrink-0">
                      <User className="w-3 h-3 md:w-4 md:h-4 text-teal-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs md:text-sm font-black text-gray-800 uppercase tracking-tight truncate">{selectedCustomer.name}</p>
                      <p className="text-[9px] md:text-[10px] font-bold text-gray-500 tracking-widest truncate">{selectedCustomer.phone || 'Tidak ada no HP'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCustomerModal(true)}
                    className="text-[9px] md:text-[10px] font-black uppercase tracking-widest bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded hover:bg-teal-50 hover:text-teal-600 transition-colors flex-shrink-0 ml-2"
                  >
                    Ubah
                  </button>
                </div>

                {(selectedCustomer.returnAmount > 0 || selectedCustomer.remainingDebt > 0) && (
                  <div className="mt-2 md:mt-3 pt-2 md:pt-3 border-t border-dashed border-gray-200 space-y-1 md:space-y-1.5">
                    {selectedCustomer.returnAmount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Saldo Retur</span>
                        <span className="text-[10px] md:text-xs font-black text-green-600">Rp {selectedCustomer.returnAmount.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {selectedCustomer.remainingDebt > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Sisa Hutang</span>
                        <span className="text-[10px] md:text-xs font-black text-orange-600">Rp {selectedCustomer.remainingDebt.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowCustomerModal(true)}
                className="w-full bg-teal-50 border border-teal-100 text-teal-700 px-3 py-3 md:px-4 md:py-4 rounded-xl md:rounded-2xl mb-4 md:mb-6 hover:bg-teal-100 transition-colors text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Plus className="w-3 h-3 md:w-4 md:h-4" /> Pilih / Tambah Pembeli
              </button>
            )}

            {/* DAFTAR ITEM KERANJANG */}
            <div className="space-y-2 md:space-y-3 mb-4 md:mb-6 max-h-[35vh] md:max-h-[350px] overflow-y-auto custom-scrollbar pr-1 md:pr-2 scroll-smooth">
              {cart.length === 0 ? (
                <div className="text-center py-6 md:py-10 border-2 border-dashed border-gray-100 rounded-xl md:rounded-2xl">
                  <ShoppingCart className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-2 md:mb-3 text-gray-200" />
                  <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">Keranjang Kosong</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.productId} id={`cart-item-${item.productId}`}>
                    <CartItem
                      item={item}
                      onUpdateQty={updateQty}
                      onRemove={removeFromCart}
                      onUpdateDiscount={updateDiscount}
                    />
                  </div>
                ))
              )}
            </div>

            {/* TOTAL & CHECKOUT */}
            <div className="border-t border-gray-100 pt-4 md:pt-6 space-y-3 md:space-y-4">
              <div className="flex justify-between items-center px-1 md:px-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subtotal</span>
                <span className="text-xs md:text-sm font-bold text-gray-600">
                  Rp {subtotal.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="bg-teal-50 border border-teal-100 p-3 md:p-4 rounded-xl md:rounded-2xl">
                <div className="flex justify-between items-center">
                  <span className="text-xs md:text-sm font-black text-teal-800 uppercase tracking-tight">Total Akhir</span>
                  <span className="text-base md:text-xl font-black text-teal-600">
                    Rp {subtotal.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || !selectedCustomer}
                className="w-full bg-teal-600 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase tracking-widest hover:bg-teal-700 transition-all shadow-lg shadow-teal-100 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed text-[10px] md:text-sm active:scale-95"
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
          <div className="bg-white rounded-[24px] md:rounded-[32px] p-5 md:p-8 w-full max-w-md max-h-[85vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="flex justify-between items-center mb-4 md:mb-6 border-b border-gray-100 pb-3 md:pb-4">
              <h3 className="text-lg md:text-xl font-black text-gray-800 flex items-center gap-2">
                <User className="w-4 h-4 md:w-5 md:h-5 text-teal-600"/> Pilih Pembeli
              </h3>
              <button
                onClick={() => {
                  setShowCustomerModal(false);
                  setSearchCustomer('');
                }}
                className="bg-gray-50 p-1.5 md:p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4 md:mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 md:left-4 top-3 md:top-3.5 w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau no HP..."
                  value={searchCustomer}
                  onChange={(e) => setSearchCustomer(e.target.value)}
                  className="w-full pl-9 md:pl-11 pr-3 md:pr-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl md:rounded-2xl font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <button
                onClick={() => {
                  setShowCustomerModal(false);
                  setShowAddCustomerModal(true);
                  setSearchCustomer('');
                }}
                className="bg-teal-600 text-white px-3 md:px-4 py-2.5 md:py-3 rounded-xl md:rounded-2xl hover:bg-teal-700 transition-colors shadow-md shadow-teal-100 flex items-center justify-center"
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>

            {filteredCustomers.length === 0 ? (
              <div className="text-center py-8 md:py-10 bg-gray-50 rounded-xl md:rounded-2xl border border-dashed border-gray-200">
                <User className="w-8 h-8 md:w-10 md:h-10 mx-auto mb-2 md:mb-3 text-gray-300" />
                <p className="text-gray-500 mb-3 md:mb-4 text-[10px] md:text-xs font-bold">Pembeli tidak ditemukan</p>
                <button
                  onClick={() => {
                    setShowCustomerModal(false);
                    setShowAddCustomerModal(true);
                    setSearchCustomer('');
                  }}
                  className="bg-white border border-teal-200 text-teal-600 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl hover:bg-teal-50 transition-colors flex items-center justify-center gap-1 md:gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest mx-auto shadow-sm"
                >
                  <Plus className="w-3 h-3" /> Tambah Pembeli Baru
                </button>
              </div>
            ) : (
              <div className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setShowCustomerModal(false);
                      setSearchCustomer('');
                    }}
                    className={`w-full text-left p-3 md:p-4 border rounded-xl md:rounded-2xl transition-all duration-300 ${
                      selectedCustomer?.id === customer.id 
                        ? 'border-teal-500 bg-teal-50 shadow-sm' 
                        : 'border-gray-200 hover:border-teal-300 bg-white hover:shadow-md'
                    }`}
                  >
                    <h4 className="font-black text-gray-800 text-xs md:text-sm uppercase tracking-tight">{customer.name}</h4>
                    <p className="text-[9px] md:text-[10px] font-bold text-gray-500 tracking-widest mt-0.5">{customer.phone || 'Tanpa No HP'}</p>
                    
                    {customer.address && (
                      <p className="text-[9px] md:text-[10px] text-gray-500 mt-1.5 md:mt-2 line-clamp-2 bg-gray-50 p-1.5 md:p-2 rounded-lg leading-relaxed">{customer.address}</p>
                    )}
                    
                    {(customer.returnAmount > 0 || customer.remainingDebt > 0) && (
                      <div className="text-[9px] md:text-[10px] font-black uppercase tracking-widest mt-2 md:mt-3 pt-2 md:pt-3 border-t border-dashed border-gray-200 space-y-1 md:space-y-1.5">
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
      {/* MODAL KONFIRMASI RESET TRANSAKSI */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 w-full max-w-sm shadow-2xl text-center transform transition-all animate-in zoom-in-95 duration-200">
            
            <div className="bg-red-50 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-5">
              <Trash2 className="w-8 h-8 md:w-10 md:h-10 text-red-500" />
            </div>
            
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-2 uppercase tracking-tight">
              Kosongkan Keranjang?
            </h3>
            
            <p className="text-xs md:text-sm text-gray-500 mb-6 md:mb-8">
              Apakah Anda yakin ingin membatalkan transaksi ini? Semua barang dan pembeli yang sudah dipilih akan dihapus.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors text-xs md:text-sm"
              >
                Batal
              </button>
              <button
                onClick={executeResetTransaction}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200 transition-colors text-xs md:text-sm active:scale-95"
              >
                Ya, Kosongkan
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};

export default Kasir;