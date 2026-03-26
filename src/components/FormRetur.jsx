import { useState, useRef, useEffect } from 'react';
import { X, Search, Plus, Minus, Trash2, Package, User, ChevronDown } from 'lucide-react';
import { useCollection, addDocument, updateDocument } from '../hooks/useFirestore';

// --- KOMPONEN SMART DROPDOWN PENCARIAN PEMBELI ---
const CustomerSearchSelect = ({ customers, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter pelanggan berdasarkan ketikan
  const filtered = customers.filter(c => 
    (c.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (c.phone && c.phone.includes(search))
  );

  const selected = customers.find(c => c.id === value);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        className="w-full pl-10 md:pl-11 pr-4 py-2.5 md:py-3 bg-gray-50 rounded-xl text-xs md:text-sm font-bold text-gray-800 cursor-pointer flex justify-between items-center border border-transparent hover:border-purple-300 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selected ? 'text-gray-800 uppercase' : 'text-gray-400'}>
          {selected ? `${selected.name} ${selected.phone ? `(${selected.phone})` : ''}` : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar overflow-hidden">
          <div className="p-2 sticky top-0 bg-white border-b border-gray-100 shadow-sm z-10">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Ketik nama pembeli..." 
                className="w-full bg-gray-50 rounded-lg pl-9 pr-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
                autoFocus
              />
            </div>
          </div>
          <div className="py-1">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-4 font-bold">Tidak ditemukan</p>
            ) : (
              filtered.map(c => (
                <div 
                  key={c.id} 
                  className="px-4 py-2.5 hover:bg-purple-50 cursor-pointer border-b border-gray-50 last:border-0"
                  onClick={() => { onChange(c.id); setIsOpen(false); setSearch(''); }}
                >
                  <p className="font-black text-[10px] md:text-sm text-gray-800 uppercase">{c.name}</p>
                  {c.phone && <p className="text-[9px] md:text-[10px] text-gray-500 font-bold">{c.phone}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const FormRetur = ({ isOpen, onClose, onShowToast }) => {
  const { data: products, loading: loadingProducts } = useCollection('products');
  const { data: customers, loading: loadingCust } = useCollection('customers');

  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [refundType, setRefundType] = useState('deposit');
  const [reason, setReason] = useState('');
  const [searchProduct, setSearchProduct] = useState('');

  if (!isOpen) return null;

  // Filter produk berdasarkan pencarian
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.category.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const addToCart = (product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      setCart(cart.map(item => item.productId === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        unitType: product.unitType,
        pcsPerCarton: product.pcsPerCarton || 1,
        price: product.price,
        qty: 1
      }]);
    }
  };

  const updateQty = (productId, newQty) => {
    if (newQty < 1) {
      setCart(cart.filter(item => item.productId !== productId));
      return;
    }
    setCart(cart.map(item => item.productId === productId ? { ...item, qty: newQty } : item));
  };

  const totalReturnAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return onShowToast('Pilih pembeli terlebih dahulu!', 'error');
    if (cart.length === 0) return onShowToast('Keranjang retur masih kosong!', 'error');
    if (!reason) return onShowToast('Masukkan alasan retur!', 'error');

    const cust = customers.find(c => c.id === selectedCustomer);
    if (!cust) return;

    // Buat string rincian barang untuk ditampilkan di tabel Dashboard
    const itemDetails = cart.map(item => `${item.qty} ${item.unitType} ${item.name}`).join(', ');
    const finalReason = `${reason} (${itemDetails})`;

    let updateRes;
    if (refundType === 'deposit') {
      // Masuk ke saldo deposit pembeli
      updateRes = await updateDocument('customers', cust.id, {
        returnAmount: (Number(cust.returnAmount) || 0) + totalReturnAmount
      });
    } else {
      // Uang kembali tunai -> Memotong Kas Toko (Masuk Pengeluaran)
      updateRes = await addDocument('expenses', {
        title: `Retur Dana (${cust.name}): ${reason}`,
        amount: totalReturnAmount,
        category: 'Retur',
        createdAt: new Date()
      });
    }

    if (updateRes.success || updateRes.id) {
      await addDocument('returns', {
        customerName: cust.name,
        customerId: cust.id,
        amount: totalReturnAmount,
        reason: finalReason,
        refundType: refundType,
        items: cart, // Simpan detail array untuk riwayat database
        createdAt: new Date()
      });
      
      onShowToast('Retur berhasil diproses (Stok tidak dikembalikan ke gudang)', 'success');
      setCart([]);
      setReason('');
      setSelectedCustomer('');
      onClose();
    } else {
      onShowToast('Gagal memproses retur', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-2 md:p-4">
      <div className="bg-white rounded-[24px] md:rounded-[32px] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* HEADER */}
        <div className="p-4 md:p-6 border-b flex justify-between items-center bg-purple-50">
          <h3 className="text-base md:text-xl font-black text-purple-800 flex items-center gap-2">
            <Package className="w-5 h-5 md:w-6 md:h-6" /> Proses Retur Barang
          </h3>
          <button onClick={onClose} className="p-1.5 md:p-2 bg-white rounded-xl md:rounded-full text-gray-500 hover:text-red-500 shadow-sm"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* KOLOM KIRI: PILIH PRODUK (Dengan max-h di HP agar tidak memenuhi seluruh layar) */}
          <div className="w-full lg:w-1/2 p-4 md:p-6 border-b lg:border-b-0 lg:border-r flex flex-col bg-gray-50/50 max-h-[40vh] lg:max-h-none">
            <div className="relative mb-3 md:mb-4 flex-shrink-0">
              <Search className="absolute left-3.5 md:left-4 top-3 md:top-3.5 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Cari barang yang diretur..." 
                value={searchProduct}
                onChange={e => setSearchProduct(e.target.value)}
                className="w-full pl-10 md:pl-11 pr-4 py-2.5 md:py-3 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 md:space-y-3 custom-scrollbar pr-1 md:pr-2">
              {loadingProducts ? <p className="text-center text-gray-400 font-bold text-xs md:text-sm py-10">Memuat produk...</p> : 
                filteredProducts.length === 0 ? <p className="text-center text-gray-400 font-bold text-xs md:text-sm py-10">Barang tidak ditemukan</p> :
                filteredProducts.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => addToCart(p)}
                    className="w-full flex justify-between items-center p-3 md:p-4 bg-white border border-gray-200 rounded-xl md:rounded-2xl hover:border-purple-500 hover:shadow-md transition-all text-left active:scale-95"
                  >
                    <div className="flex-1 pr-2">
                      <p className="font-black text-gray-800 text-xs md:text-sm uppercase truncate">{p.name}</p>
                      <p className="text-[10px] md:text-xs text-gray-500 font-bold">Harga: Rp {p.price.toLocaleString()}</p>
                    </div>
                    <span className="bg-purple-100 text-purple-700 text-[9px] md:text-[10px] font-black px-2 py-1 rounded-lg">{p.unitType}</span>
                  </button>
              ))}
            </div>
          </div>

          {/* KOLOM KANAN: FORM & KERANJANG RETUR */}
          <div className="w-full lg:w-1/2 p-4 md:p-6 flex flex-col bg-white overflow-y-auto custom-scrollbar">
            <form id="return-form" onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
              
              {/* Pilihan Pelanggan Menggunakan Smart Dropdown */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1 md:ml-2">Pembeli yang Meretur</label>
                <div className="relative">
                  <User className="absolute left-3 md:left-4 top-3 md:top-3.5 w-4 h-4 text-gray-400 z-10 pointer-events-none" />
                  <CustomerSearchSelect 
                    customers={customers}
                    value={selectedCustomer}
                    onChange={(id) => setSelectedCustomer(id)}
                    placeholder="-- Ketik Cari Pembeli --"
                  />
                </div>
              </div>

              {/* Keranjang Barang Retur */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1 md:ml-2">Barang yang Dikembalikan</label>
                <div className="bg-gray-50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-gray-100 min-h-[120px] md:min-h-[150px] max-h-[250px] overflow-y-auto space-y-2 md:space-y-3 custom-scrollbar">
                  {cart.length === 0 ? (
                     <p className="text-center text-gray-400 font-bold text-[10px] md:text-xs py-8 md:py-10">Belum ada barang dipilih</p>
                  ) : (
                    cart.map(item => (
                      <div key={item.productId} className="flex flex-col gap-2 p-2.5 md:p-3 bg-white border border-gray-200 rounded-xl">
                        <div className="flex justify-between items-start">
                          <div className="pr-2 flex-1">
                            <p className="font-black text-xs md:text-sm text-gray-800 uppercase line-clamp-1">{item.name}</p>
                            <p className="text-[9px] md:text-[10px] text-gray-500 font-bold">{item.unitType} | Rp {item.price.toLocaleString()}</p>
                          </div>
                          <button type="button" onClick={() => updateQty(item.productId, 0)} className="text-red-500 p-1 md:p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <button type="button" onClick={() => updateQty(item.productId, item.qty - 1)} className="w-5 h-5 md:w-6 md:h-6 bg-gray-100 rounded flex items-center justify-center hover:bg-gray-200"><Minus className="w-3 h-3" /></button>
                            <span className="w-6 md:w-8 text-center font-black text-xs md:text-sm">{item.qty}</span>
                            <button type="button" onClick={() => updateQty(item.productId, item.qty + 1)} className="w-5 h-5 md:w-6 md:h-6 bg-purple-600 text-white rounded flex items-center justify-center hover:bg-purple-700"><Plus className="w-3 h-3" /></button>
                          </div>
                          <span className="font-black text-xs md:text-sm text-purple-700">Rp {(item.price * item.qty).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Alasan & Dana */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1 md:ml-2">Alasan Retur</label>
                <input type="text" required placeholder="Contoh: Kemasan Rusak, Barang Basi, dll" value={reason} onChange={e => setReason(e.target.value)} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 rounded-xl text-xs md:text-sm font-bold border-none outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1 md:ml-2">Tujuan Pengembalian Dana</label>
                <select value={refundType} onChange={e => setRefundType(e.target.value)} className="w-full bg-purple-50 text-purple-800 rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-[10px] md:text-sm font-black border border-purple-100 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer appearance-none">
                  <option value="deposit">Simpan sebagai SALDO DEPOSIT</option>
                  <option value="cash">Masuk pengeluaran (Potong Uang Toko)</option>
                </select>
              </div>

            </form>
          </div>
        </div>

        {/* FOOTER TOTAL */}
        <div className="p-4 md:p-6 border-t bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-0">
          <div className="w-full sm:w-auto text-left">
            <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Pengembalian</p>
            <p className="text-xl md:text-2xl font-black text-purple-700">Rp {totalReturnAmount.toLocaleString()}</p>
          </div>
          <button form="return-form" type="submit" className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs md:text-sm shadow-xl shadow-purple-200 transition-all uppercase tracking-widest active:scale-95 text-center">
            Konfirmasi Retur
          </button>
        </div>

      </div>
    </div>
  );
};

export default FormRetur;