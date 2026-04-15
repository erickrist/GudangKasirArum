import { useState, useRef, useEffect } from 'react';
import { X, Search, Plus, Minus, Trash2, Package, User, ChevronDown, Edit3, Database, Store } from 'lucide-react';
import { useCollection, addDocument, updateDocument } from '../hooks/useFirestore';
import { usePricing } from '../hooks/usePricing'; 

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
  
  const { data: stores, loading: loadingStores } = useCollection('stores');
  const { activeStoreId, handleStoreChange, getProductPrice } = usePricing(stores);

  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  
  const [refundAction, setRefundAction] = useState('deposit_rusak');
  
  const [reason, setReason] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  
  const [inputMode, setInputMode] = useState('auto'); 
  const [manualItem, setManualItem] = useState({ name: '', price: '', qty: 1 });

  if (!isOpen) return null;

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.category.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const addToCartAuto = (product, isEceran = false) => {
    const resolvedPrice = getProductPrice(product);
    const cartItemId = isEceran ? `${product.id}_PCS` : product.id;

    const existing = cart.find(item => item.cartItemId === cartItemId);
    
    if (existing) {
      setCart(cart.map(item => item.cartItemId === cartItemId ? { ...item, qty: Number(item.qty) + 1 } : item));
    } else {
      setCart([...cart, {
        cartItemId: cartItemId,     
        productId: product.id,      
        name: product.name,
        unitType: product.unitType,
        pcsPerCarton: product.pcsPerCarton || 1,
        price: resolvedPrice, 
        hpp: product.hpp || 0,
        qty: 1,
        returnUnit: isEceran ? 'pcs' : 'pack', 
        isManual: false
      }]);
    }
  };

  const addManualToCart = (e) => {
    e.preventDefault();
    if (!manualItem.name || !manualItem.price || manualItem.qty <= 0) return onShowToast('Isi data barang manual dengan benar', 'error');
    
    const newItemId = `manual-${Date.now()}`;
    setCart([...cart, {
      cartItemId: newItemId,
      productId: newItemId,
      name: manualItem.name,
      unitType: 'Item',
      pcsPerCarton: 1,
      price: Number(manualItem.price),
      hpp: Number(manualItem.price), 
      qty: Number(manualItem.qty),
      returnUnit: 'pack', 
      isManual: true
    }]);
    
    setManualItem({ name: '', price: '', qty: 1 }); 
    onShowToast('Barang manual ditambahkan', 'success');
  };

  const updateQty = (cartItemId, newQty) => {
    if (newQty === '' || isNaN(newQty)) {
        setCart(cart.map(item => item.cartItemId === cartItemId ? { ...item, qty: '' } : item));
        return;
    }

    const qty = Number(newQty);
    if (qty <= 0) {
      setCart(cart.filter(item => item.cartItemId !== cartItemId));
      return;
    }
    setCart(cart.map(item => item.cartItemId === cartItemId ? { ...item, qty: qty } : item));
  };

  const getItemPrice = (item) => {
    if (item.returnUnit === 'pcs' && item.pcsPerCarton > 1) {
      return Math.round(item.price / item.pcsPerCarton);
    }
    return item.price;
  };

  const getItemHpp = (item) => {
    if (item.returnUnit === 'pcs' && item.pcsPerCarton > 1) {
      return Math.round(item.hpp / item.pcsPerCarton);
    }
    return item.hpp;
  };

  const totalReturnAmount = cart.reduce((sum, item) => sum + (getItemPrice(item) * (Number(item.qty) || 0)), 0);
  const totalReturnHpp = cart.reduce((sum, item) => sum + (getItemHpp(item) * (Number(item.qty) || 0)), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return onShowToast('Pilih pembeli terlebih dahulu!', 'error');
    if (cart.length === 0) return onShowToast('Keranjang retur masih kosong!', 'error');
    if (!reason) return onShowToast('Masukkan alasan retur!', 'error');

    if (cart.some(i => !i.qty || Number(i.qty) <= 0)) {
        return onShowToast('Pastikan semua Qty barang diisi dengan angka valid!', 'error');
    }

    const cust = customers.find(c => c.id === selectedCustomer);
    if (!cust) return;

    const itemDetails = cart.map(item => {
      const unitLabel = item.returnUnit === 'pcs' ? 'Pcs' : item.unitType;
      return `${item.qty} ${unitLabel} ${item.name}`;
    }).join(', ');
    
    const finalReason = `${reason} (${itemDetails})`;
    
    const finalStoreId = activeStoreId || 'pusat';
    const activeStoreName = stores.find(s => s.id === finalStoreId)?.name || 'Cabang Pusat / Utama';

    let updateRes;
    const isDeposit = refundAction.startsWith('deposit');
    const labaKotorBatal = Math.max(0, totalReturnAmount - totalReturnHpp); 

    if (isDeposit) {
      updateRes = await updateDocument('customers', cust.id, {
        returnAmount: (Number(cust.returnAmount) || 0) + totalReturnAmount
      });
      
      if (updateRes.success || updateRes.id) {
         if (refundAction === 'deposit_rusak') {
            await addDocument('expenses', {
              title: `Retur (Deposit & Barang Dibuang) - ${cust.name}: ${reason}`,
              amount: totalReturnAmount,
              category: 'Barang Rusak', 
              storeId: finalStoreId,        
              storeName: activeStoreName,   
              createdAt: new Date()
            });
         } else if (refundAction === 'deposit_supplier') {
            if (labaKotorBatal > 0) {
                await addDocument('expenses', {
                  title: `Batal Laba (Retur Deposit & Tukar Pabrik) - ${cust.name}: ${reason}`,
                  amount: labaKotorBatal,
                  category: 'Barang Rusak', 
                  storeId: finalStoreId,        
                  storeName: activeStoreName,   
                  createdAt: new Date()
                });
            }
         }
      }
    } else {
      if (refundAction === 'cash_rusak') {
         updateRes = await addDocument('expenses', {
            title: `Retur Dana Kas & Barang Dibuang (${cust.name}): ${reason}`,
            amount: totalReturnAmount,
            category: 'Retur',
            storeId: finalStoreId,        
            storeName: activeStoreName,   
            createdAt: new Date()
         });
      } else if (refundAction === 'cash_supplier') {
         updateRes = await addDocument('expenses', {
            title: `Retur Kas & Tukar Pabrik (${cust.name}): ${reason}`,
            amount: totalReturnAmount,
            category: 'Retur Tukar Pabrik', 
            storeId: finalStoreId,        
            storeName: activeStoreName,   
            createdAt: new Date()
         });
      }
    }

    if (updateRes.success || updateRes.id) {
      await addDocument('returns', {
        customerName: cust.name,
        customerId: cust.id,
        amount: totalReturnAmount,
        reason: finalReason,
        refundType: isDeposit ? 'deposit' : 'cash', 
        items: cart.map(i => ({ 
            productId: i.productId, 
            name: i.name,
            qty: i.qty,
            unitType: i.unitType,
            pcsPerCarton: i.pcsPerCarton,
            price: i.price,
            hpp: i.hpp,
            returnUnit: i.returnUnit,
            finalPrice: getItemPrice(i) 
        })), 
        storeId: finalStoreId,        
        storeName: activeStoreName,   
        createdAt: new Date()
      });
      
      onShowToast('Retur berhasil diproses (Laba sudah disesuaikan)', 'success');
      setCart([]);
      setReason('');
      setSelectedCustomer('');
      setRefundAction('deposit_rusak');
      onClose();
    } else {
      onShowToast('Gagal memproses retur', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-2 md:p-4">
      <div className="bg-white rounded-[24px] md:rounded-[32px] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        
        <div className="p-4 md:p-6 border-b flex justify-between items-center bg-purple-50">
          <h3 className="text-base md:text-xl font-black text-purple-800 flex items-center gap-2">
            <Package className="w-5 h-5 md:w-6 md:h-6" /> Proses Retur Barang
          </h3>
          <button onClick={onClose} className="p-1.5 md:p-2 bg-white rounded-xl md:rounded-full text-gray-500 hover:text-red-500 shadow-sm"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          <div className="w-full lg:w-1/2 p-4 md:p-6 border-b lg:border-b-0 lg:border-r flex flex-col bg-gray-50/50 max-h-[45vh] lg:max-h-none">
            
            <div className="flex bg-gray-200/50 p-1 rounded-xl mb-4 flex-shrink-0">
              <button onClick={() => setInputMode('auto')} className={`flex-1 py-2 text-[10px] md:text-xs font-black rounded-lg transition-all flex justify-center items-center gap-1.5 ${inputMode === 'auto' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200/50'}`}>
                <Database className="w-3.5 h-3.5" /> Data Barang
              </button>
              <button onClick={() => setInputMode('manual')} className={`flex-1 py-2 text-[10px] md:text-xs font-black rounded-lg transition-all flex justify-center items-center gap-1.5 ${inputMode === 'manual' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200/50'}`}>
                <Edit3 className="w-3.5 h-3.5" /> Ketik Manual
              </button>
            </div>

            {inputMode === 'auto' && (
              <>
                <div className="relative mb-3 flex-shrink-0">
                  <Search className="absolute left-3.5 md:left-4 top-3 md:top-3.5 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Cari barang yang diretur..." value={searchProduct} onChange={e => setSearchProduct(e.target.value)} className="w-full pl-10 md:pl-11 pr-4 py-2.5 md:py-3 bg-white border border-gray-200 rounded-xl text-xs md:text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 md:space-y-3 custom-scrollbar pr-1 md:pr-2">
                  {loadingProducts ? <p className="text-center text-gray-400 font-bold text-xs py-10">Memuat produk...</p> : 
                    filteredProducts.length === 0 ? <p className="text-center text-gray-400 font-bold text-xs py-10">Barang tidak ditemukan</p> :
                    filteredProducts.map(p => {
                      const dynamicPrice = getProductPrice(p);
                      return (
                        <div key={p.id} className="w-full flex flex-col p-3 md:p-4 bg-white border border-gray-200 rounded-xl hover:border-purple-500 hover:shadow-md transition-all text-left">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 pr-2">
                              <p className="font-black text-gray-800 text-xs md:text-sm uppercase truncate">{p.name}</p>
                              <p className="text-[10px] md:text-xs text-gray-500 font-bold">Rp {dynamicPrice.toLocaleString()} {p.pcsPerCarton > 1 && <span className="text-purple-400"> (Isi {p.pcsPerCarton} Pcs / {p.unitType})</span>}</p>
                            </div>
                            <span className="bg-purple-100 text-purple-700 text-[9px] md:text-[10px] font-black px-2 py-1 rounded-lg">{p.unitType}</span>
                          </div>
                          
                          <div className="flex gap-2 border-t border-dashed border-gray-100 pt-2 mt-auto">
                            <button onClick={() => addToCartAuto(p, false)} className="flex-1 bg-purple-50 text-purple-700 py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase hover:bg-purple-100 transition-colors shadow-sm active:scale-95">
                              + 1 {p.unitType}
                            </button>
                            {p.pcsPerCarton > 1 && !['PCS', 'KG'].includes(p.unitType) && (
                              <button onClick={() => addToCartAuto(p, true)} className="flex-1 bg-orange-50 text-orange-700 py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase hover:bg-orange-100 transition-colors shadow-sm active:scale-95">
                                + 1 PCS
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}

            {inputMode === 'manual' && (
              <form onSubmit={addManualToCart} className="flex-1 bg-white p-4 rounded-xl border border-gray-200 flex flex-col space-y-4">
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nama Barang Manual</label><input type="text" required placeholder="Contoh: Indomie Goreng Eceran" value={manualItem.name} onChange={e => setManualItem({...manualItem, name: e.target.value})} className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-purple-500" /></div>
                <div className="flex gap-3">
                  <div className="space-y-1 flex-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Harga Satuan</label><input type="number" required placeholder="0" value={manualItem.price} onChange={e => setManualItem({...manualItem, price: e.target.value})} className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-purple-500" /></div>
                  <div className="space-y-1 w-24">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Qty</label>
                    <input type="number" min="0.01" step="any" required value={manualItem.qty} onChange={e => setManualItem({...manualItem, qty: e.target.value})} className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                </div>
                <div className="pt-2 mt-auto"><button type="submit" className="w-full bg-purple-100 hover:bg-purple-200 text-purple-700 py-3 rounded-xl font-black text-xs uppercase transition-colors">+ Tambah ke Keranjang Retur</button></div>
              </form>
            )}
          </div>

          <div className="w-full lg:w-1/2 p-4 md:p-6 flex flex-col bg-white overflow-y-auto custom-scrollbar">
            <form id="return-form" onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1 md:ml-2">Lokasi Cabang Retur</label>
                <div className="relative">
                   <Store className="absolute left-3 md:left-4 top-3 md:top-3.5 w-4 h-4 text-teal-600 z-10 pointer-events-none" />
                   <select value={activeStoreId} onChange={(e) => { handleStoreChange(e.target.value, () => { if (cart.length > 0) { setCart([]); onShowToast('Daftar retur dikosongkan karena ganti cabang', 'error'); } }); }} className="w-full pl-10 md:pl-11 pr-4 py-2.5 md:py-3 bg-teal-50 border border-teal-100 rounded-xl text-xs md:text-sm font-bold text-teal-800 outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer"><option value="pusat">🏢 CABANG PUSAT / UTAMA</option>{stores && stores.map(s => <option key={s.id} value={s.id}>🏪 {s.name.toUpperCase()}</option>)}</select>
                   <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-teal-600 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1 md:ml-2">Pembeli yang Meretur</label>
                <div className="relative"><User className="absolute left-3 md:left-4 top-3 md:top-3.5 w-4 h-4 text-gray-400 z-10 pointer-events-none" /><CustomerSearchSelect customers={customers} value={selectedCustomer} onChange={(id) => setSelectedCustomer(id)} placeholder="-- Ketik Cari Pembeli --" /></div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1 md:ml-2">Daftar Retur & Konversi Satuan</label>
                <div className="bg-gray-50 p-2 md:p-4 rounded-xl md:rounded-2xl border border-gray-100 min-h-[150px] max-h-[250px] overflow-y-auto space-y-2 custom-scrollbar">
                  {cart.length === 0 ? (
                     <p className="text-center text-gray-400 font-bold text-[10px] md:text-xs py-10">Belum ada barang dipilih</p>
                  ) : (
                    cart.map(item => {
                      const finalPrice = getItemPrice(item);
                      const isPcsMode = item.returnUnit === 'pcs';

                      return (
                        <div key={item.cartItemId} className={`flex flex-col gap-2.5 p-3 md:p-4 bg-white border-2 rounded-xl transition-colors ${isPcsMode ? 'border-orange-200 bg-orange-50/50' : 'border-gray-100'}`}>
                          <div className="flex justify-between items-start">
                            <div className="pr-2 flex-1"><p className="font-black text-xs md:text-sm text-gray-800 uppercase line-clamp-1">{item.name} {item.isManual && <span className="text-[8px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded ml-1">Manual</span>}</p><p className="text-[9px] md:text-[10px] text-gray-500 font-bold mt-0.5 whitespace-nowrap">{isPcsMode ? 'Eceran (Pcs)' : `Utuh (${item.unitType})`}: Rp {finalPrice.toLocaleString()} / {isPcsMode ? 'Pcs' : item.unitType}</p></div>
                            <button type="button" onClick={() => updateQty(item.cartItemId, 0)} className="text-gray-400 p-1 hover:bg-red-50 hover:text-red-500 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1.5 bg-gray-100/70 p-1 rounded-lg border border-gray-200/50">
                                <button type="button" onClick={() => updateQty(item.cartItemId, (Number(item.qty) || 1) - 1)} className="w-6 h-6 bg-white border border-gray-300 rounded flex items-center justify-center hover:bg-gray-100 text-gray-600 shadow-sm"><Minus className="w-3.5 h-3.5" /></button>
                                {/* INPUT MANUAL NOMINAL: Tinggal klik dan ketik angka bebas di sini */}
                                <input type="number" min="0.01" step="any" value={item.qty} onChange={(e) => updateQty(item.cartItemId, e.target.value)} className="w-12 h-7 text-center font-black text-sm text-purple-700 bg-white border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-purple-500 outline-none p-0" />
                                <button type="button" onClick={() => updateQty(item.cartItemId, (Number(item.qty) || 0) + 1)} className="w-6 h-6 bg-purple-600 text-white rounded flex items-center justify-center hover:bg-purple-700 shadow-md shadow-purple-100"><Plus className="w-3.5 h-3.5" /></button>
                            </div>
                            <div className="flex items-center gap-1.5"><span className="font-bold text-gray-400 text-xs">x</span><span className="font-black text-sm text-gray-800">Rp {finalPrice.toLocaleString()}</span></div>
                            <span className="font-black text-sm text-purple-700 ml-auto text-right">Rp {(finalPrice * (Number(item.qty) || 0)).toLocaleString()}</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1 md:ml-2">Alasan Retur</label><input type="text" required placeholder="Contoh: Kemasan Rusak, Bisa Ditukar, dll" value={reason} onChange={e => setReason(e.target.value)} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 rounded-xl text-xs md:text-sm font-bold border-none outline-none focus:ring-2 focus:ring-purple-500" /></div>
              
              {/* 4 OPSI KEPUTUSAN RETUR CERDAS */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1 md:ml-2">Tujuan Pengembalian Dana & Kondisi Barang</label>
                <div className="relative">
                  <select value={refundAction} onChange={e => setRefundAction(e.target.value)} className="w-full bg-purple-50 text-purple-800 rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-[10px] md:text-xs font-black border border-purple-100 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer appearance-none">
                    <option value="deposit_rusak">📦 DEPOSIT & Barang Dibuang (Toko Rugi Modal)</option>
                    <option value="deposit_supplier">📦 DEPOSIT & Tukar Pabrik (Toko Batal Untung - IMPAS)</option>
                    <option value="cash_rusak">💸 TUNAI & Barang Dibuang (Toko Rugi Modal)</option>
                    <option value="cash_supplier">💸 TUNAI & Tukar Pabrik (Toko Batal Untung - IMPAS)</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-3 w-4 h-4 text-purple-600 pointer-events-none" />
                </div>
              </div>

            </form>
          </div>
        </div>

        <div className="p-4 md:p-6 border-t bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-0">
          <div className="w-full sm:w-auto text-left"><p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Pengembalian</p><p className="text-xl md:text-2xl font-black text-purple-700">Rp {totalReturnAmount.toLocaleString()}</p></div>
          <button form="return-form" type="submit" className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs md:text-sm shadow-xl shadow-purple-200 transition-all uppercase tracking-widest active:scale-95 text-center">Konfirmasi Retur</button>
        </div>

      </div>
    </div>
  );
};

export default FormRetur;