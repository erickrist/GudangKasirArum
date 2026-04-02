import React, { useState, useEffect, useRef } from 'react';
import { X, Save, AlertTriangle, Minus, Plus, Trash2, ArrowLeft, Search, PlusCircle } from 'lucide-react';
import { updateDocument, addDocument } from '../hooks/useFirestore';

const EditTransactionModal = ({ isOpen, onClose, transaction, products = [], customers = [], onShowToast }) => {
  const [items, setItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // State untuk fitur pencarian tambah produk
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  // Cari data pelanggan untuk referensi
  const currentCustomer = customers.find(c => c.id === transaction?.customerId);

  // Load data saat modal dibuka
  useEffect(() => {
    if (transaction && isOpen) {
      setItems(JSON.parse(JSON.stringify(transaction.items || [])));
      setSearchQuery('');
      setShowDropdown(false);
    }
  }, [transaction, isOpen]);

  // Handle klik di luar dropdown pencarian untuk menutupnya
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen || !transaction) return null;

  // --- FILTER PRODUK UNTUK PENCARIAN ---
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- HANDLER TAMBAH PRODUK BARU ---
  const handleAddProduct = (product) => {
    const existingIndex = items.findIndex(i => i.productId === product.id);
    
    if (existingIndex >= 0) {
      // Jika barang sudah ada di list, tambah Qty saja
      handleQtyClickAdjustment(existingIndex, 1);
    } else {
      // Jika barang belum ada, tambahkan sebagai baris baru
      const price = Number(product.sellPrice || product.price || 0);
      const newItem = {
        productId: product.id,
        name: product.name,
        price: price,
        qty: 1,
        unitType: product.unit || product.unitType || 'PCS',
        pcsPerCarton: product.pcsPerCarton || 1,
        discount: 0,
        subtotal: price
      };
      setItems([...items, newItem]);
    }
    setSearchQuery('');
    setShowDropdown(false);
    onShowToast(`${product.name} ditambahkan`, 'success');
  };

  // Handler untuk tombol +/-
  const handleQtyClickAdjustment = (index, delta) => {
    const newItems = [...items];
    const currentQty = parseInt(newItems[index].qty) || 0;
    const newQty = currentQty + delta;
    
    if (newQty < 1) return;

    newItems[index].qty = newQty;
    newItems[index].subtotal = (newItems[index].price * newQty) - (newItems[index].discount || 0);
    setItems(newItems);
  };

  // Handler untuk mengetik langsung di input
  const handleQtyInputChange = (index, value) => {
    const newItems = [...items];
    
    // Biarkan string kosong agar user bisa hapus semua angka, tapi validasi saat save
    if (value === '') {
      newItems[index].qty = '';
      newItems[index].subtotal = 0; // Temp subtotal 0
      setItems(newItems);
      return;
    }

    let newQty = parseInt(value, 10);

    // Validasi dasar: jangan biarkan minus atau NaN
    if (isNaN(newQty) || newQty < 1) {
      newQty = 1;
    }

    newItems[index].qty = newQty;
    newItems[index].subtotal = (newItems[index].price * newQty) - (newItems[index].discount || 0);
    setItems(newItems);
  };

  const handleRemoveItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const calculateNewTotals = () => {
    // Gunakan 0 jika qty kosong saat perhitungan ringkasan
    const getValidQty = (qty) => (qty === '' || isNaN(parseInt(qty))) ? 0 : parseInt(qty);

    const newSubtotal = items.reduce((sum, item) => {
      const validQty = getValidQty(item.qty);
      const itemSubtotal = (item.price * validQty) - (item.discount || 0);
      return sum + itemSubtotal;
    }, 0);

    let newReturnUsed = transaction.returnUsed || 0;
    let returnToRefund = 0;
    
    if (newReturnUsed > newSubtotal) {
      returnToRefund = newReturnUsed - newSubtotal;
      newReturnUsed = newSubtotal;
    }

    const totalNota = newSubtotal - newReturnUsed;
    const parsedDebtPaid = Number(transaction.debtPaid) || 0;
    let newTotal = 0;

    if (transaction.paymentStatus === 'HUTANG') {
      newTotal = 0; 
    } else {
      newTotal = totalNota + parsedDebtPaid; 
    }

    return { newSubtotal, newReturnUsed, returnToRefund, newTotal, parsedDebtPaid, totalNota };
  };

  const { newSubtotal, newTotal, newReturnUsed, returnToRefund, totalNota, parsedDebtPaid } = calculateNewTotals();

  const handleSave = async () => {
    // Validasi: pastikan tidak ada qty yang kosong atau < 1
    if (items.some(i => i.qty === '' || isNaN(parseInt(i.qty)) || parseInt(i.qty) < 1)) {
        return onShowToast('Pastikan semua jumlah barang terisi minimal 1.', 'error');
    }

    if (items.length === 0) return onShowToast('Transaksi kosong. Gunakan tombol hapus (tong sampah) di Dashboard jika dibatalkan.', 'error');
    
    setIsSaving(true);
    try {
      // 1. UPDATE STOK BARANG
      const oldItemsMap = {};
      transaction.items.forEach(i => oldItemsMap[i.productId] = i);

      for (const newItem of items) {
        const oldItem = oldItemsMap[newItem.productId] || { qty: 0 };
        const qtyDiff = newItem.qty - oldItem.qty; 

        // qtyDiff > 0 artinya barang ditambah/baru masuk ke nota -> kurangi stok
        // qtyDiff < 0 artinya barang dikurangi dari nota -> kembalikan stok
        if (qtyDiff !== 0) {
          const product = products.find(p => p.id === newItem.productId);
          if (product) {
            const multiplier = ['KARTON', 'BALL', 'IKAT', 'RENCENG', 'BOX'].includes(newItem.unitType) ? (newItem.pcsPerCarton || 1) : 1;
            const pcsDiff = qtyDiff * multiplier;
            await updateDocument('products', product.id, { stockPcs: product.stockPcs - pcsDiff });
            await addDocument('stock_logs', {
              productId: product.id, productName: product.name, type: qtyDiff > 0 ? 'out' : 'in', 
              amount: Math.abs(qtyDiff), unitType: newItem.unitType, totalPcs: Math.abs(pcsDiff),
              note: `Revisi Nota #${transaction.id.substring(0,6)}`, createdAt: new Date()
            });
          }
        }
        delete oldItemsMap[newItem.productId]; 
      }

      // Barang yang dihapus dari list sepenuhnya -> kembalikan stok utuh
      for (const oldItem of Object.values(oldItemsMap)) {
        const product = products.find(p => p.id === oldItem.productId);
        if (product) {
          const multiplier = ['KARTON', 'BALL', 'IKAT', 'RENCENG', 'BOX'].includes(oldItem.unitType) ? (oldItem.pcsPerCarton || 1) : 1;
          await updateDocument('products', product.id, { stockPcs: product.stockPcs + (oldItem.qty * multiplier) });
          await addDocument('stock_logs', {
            productId: product.id, productName: product.name, type: 'in', 
            amount: oldItem.qty, unitType: oldItem.unitType, totalPcs: oldItem.qty * multiplier,
            note: `Hapus dr Nota #${transaction.id.substring(0,6)}`, createdAt: new Date()
          });
        }
      }

      // 2. UPDATE HUTANG/DEPOSIT CUSTOMER
      if (transaction.customerId) {
        const customer = customers.find(c => c.id === transaction.customerId);
        if (customer) {
          let customerUpdates = {};
          let currentDebt = customer.remainingDebt || 0;
          
          if (returnToRefund > 0) {
            customerUpdates.returnAmount = (customer.returnAmount || 0) + returnToRefund;
          }

          const oldDebtAdded = transaction.paymentStatus === 'HUTANG' ? (transaction.subtotal - (transaction.returnUsed || 0)) : 0;
          const newDebtAdded = transaction.paymentStatus === 'HUTANG' ? (newSubtotal - newReturnUsed) : 0;
          
          currentDebt += (newDebtAdded - oldDebtAdded); 

          if (currentDebt !== (customer.remainingDebt || 0)) {
             customerUpdates.remainingDebt = Math.max(0, currentDebt);
          }

          if (Object.keys(customerUpdates).length > 0) {
            await updateDocument('customers', customer.id, customerUpdates);
          }
        }
      }

      // 3. UPDATE DOKUMEN TRANSAKSI
      await updateDocument('transactions', transaction.id, {
        items: items, 
        subtotal: newSubtotal, 
        returnUsed: newReturnUsed,
        total: newTotal
      });

      onShowToast('Transaksi berhasil direvisi!', 'success');
      onClose();
    } catch (error) {
      onShowToast('Terjadi kesalahan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] md:p-4">
      
      {/* Container Modal */}
      <div className="bg-white md:rounded-[24px] w-full h-full md:h-auto md:max-w-4xl shadow-2xl relative border-t-8 border-blue-500 md:max-h-[95vh] flex flex-col overflow-hidden transition-all duration-300">
        
        {/* HEADER MODAL */}
        <div className="flex justify-between items-center p-4 md:p-6 border-b shrink-0 bg-white z-20 sticky top-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} disabled={isSaving} className="md:hidden text-gray-600 p-1.5 bg-gray-100 rounded-lg active:scale-95">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <h3 className="text-base md:text-xl font-black text-gray-800 uppercase tracking-tighter">Revisi Nota</h3>
                <p className="text-[11px] md:text-xs text-gray-500 font-bold mt-0.5">#{transaction.id?.substring(0,8).toUpperCase()} | <span className="text-blue-600 font-extrabold">{transaction.customerName}</span></p>
            </div>
          </div>
          <button onClick={onClose} disabled={isSaving} className="hidden md:block text-gray-400 hover:text-gray-600 bg-gray-100 p-2 rounded-xl active:scale-95 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AREA KONTEN (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-6 bg-gray-50/50">
          
          {/* FITUR PENCARIAN & TAMBAH BARANG */}
          <div className="mb-4 relative" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-5 h-5 text-blue-400" />
              <input
                type="text"
                placeholder="Ketik nama barang untuk ditambahkan ke nota..."
                className="w-full bg-white border border-blue-200 rounded-xl pl-11 pr-4 py-3 text-sm font-black text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm transition-all placeholder:font-bold placeholder:text-gray-300"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
              />
            </div>
            
            {/* DROPDOWN HASIL PENCARIAN */}
            {showDropdown && (
               <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                 {filteredProducts.length === 0 ? (
                   <div className="p-4 text-center text-sm text-gray-400 font-bold">Barang tidak ditemukan di stok</div>
                 ) : (
                   filteredProducts.map(p => (
                     <div
                       key={p.id}
                       className="p-3 md:p-4 border-b border-gray-50 hover:bg-blue-50 cursor-pointer flex justify-between items-center group transition-colors"
                       onClick={() => handleAddProduct(p)}
                     >
                       <div>
                         <p className="font-black text-sm text-gray-800 group-hover:text-blue-700 transition-colors">{p.name}</p>
                         <p className="text-[10px] md:text-xs text-gray-500 font-bold mt-0.5">
                           Sisa Stok: <span className="text-orange-500">{p.stockPcs}</span> | Rp {(p.sellPrice || p.price || 0).toLocaleString('id-ID')}
                         </p>
                       </div>
                       <button className="bg-blue-100 text-blue-600 p-1.5 md:p-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
                         <PlusCircle className="w-4 h-4 md:w-5 md:h-5" />
                       </button>
                     </div>
                   ))
                 )}
               </div>
            )}
          </div>

          {/* DAFTAR BARANG */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6 relative z-10">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 hidden md:block">
                <h4 className="text-sm font-bold text-gray-700">Detail Item Belanja</h4>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm min-w-[500px] md:min-w-full">
                <thead className="bg-gray-100/70 border-b border-gray-100 hidden md:table-header-group">
                  <tr>
                    <th className="p-4 font-black text-gray-500 uppercase text-[10px] tracking-wider">Nama Produk</th>
                    <th className="p-4 font-black text-gray-500 uppercase text-[10px] tracking-wider text-center w-40">Jumlah (Qty)</th>
                    <th className="p-4 font-black text-gray-500 uppercase text-[10px] tracking-wider text-right">Subtotal</th>
                    <th className="p-4 font-black text-gray-500 uppercase text-[10px] tracking-wider text-center w-16">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, index) => (
                    <tr key={index} className="hover:bg-blue-50/30 transition-colors flex flex-col md:table-row p-3 md:p-0 border-b md:border-b-0 last:border-0 mb-3 md:mb-0 bg-white md:bg-transparent rounded-xl md:rounded-none border md:border-0 shadow-sm md:shadow-none">
                      
                      {/* Kolom Produk */}
                      <td className="p-1 md:p-4 font-bold text-gray-800 md:table-cell flex flex-col mb-2 md:mb-0">
                        <span className="line-clamp-2 md:line-clamp-1 text-sm md:text-base">{item.name}</span>
                        <div className="text-[10px] md:text-xs text-gray-500 mt-1 font-medium bg-gray-100 md:bg-transparent px-2 md:px-0 py-0.5 md:py-0 rounded w-max">
                            Rp {Number(item.price).toLocaleString('id-ID')} / {item.unitType}
                            {item.pcsPerCarton > 1 && ` (${item.pcsPerCarton} pcs)`}
                        </div>
                      </td>
                      
                      {/* Kolom Qty (Typeable + Buttons) */}
                      <td className="p-1 md:p-4 md:table-cell mb-3 md:mb-0">
                        <div className="flex items-center gap-1.5 bg-gray-50 md:bg-white border border-gray-200 md:border-gray-100 rounded-xl p-1 shadow-inner md:shadow-sm w-full md:w-max md:mx-auto justify-between md:justify-center">
                          <button 
                            onClick={() => handleQtyClickAdjustment(index, -1)} 
                            className="p-2 md:p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg active:scale-90 transition-all"
                            title="Kurangi 1"
                          >
                            <Minus className="w-4 h-4 md:w-3.5 md:h-3.5" />
                          </button>
                          
                          <input 
                            type="number" 
                            value={item.qty}
                            onChange={(e) => handleQtyInputChange(index, e.target.value)}
                            min="1"
                            className="w-full md:w-16 text-center font-black text-base md:text-sm bg-transparent outline-none border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg p-1.5 md:p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="0"
                          />
                          
                          <button 
                            onClick={() => handleQtyClickAdjustment(index, 1)} 
                            className="p-2 md:p-1.5 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg active:scale-90 transition-all"
                            title="Tambah 1"
                          >
                            <Plus className="w-4 h-4 md:w-3.5 md:h-3.5" />
                          </button>
                          <span className="text-[10px] font-bold text-gray-400 md:hidden pr-2">{item.unitType}</span>
                        </div>
                      </td>
                      
                      {/* Kolom Subtotal */}
                      <td className="p-1 md:p-4 font-black text-right text-blue-700 md:table-cell flex justify-between items-center whitespace-nowrap mb-2 md:mb-0 border-t md:border-t-0 border-gray-100 pt-2 md:pt-4">
                        <span className="md:hidden text-xs font-bold text-gray-500">Subtotal:</span>
                        <span className="text-sm md:text-base">Rp {item.subtotal.toLocaleString('id-ID')}</span>
                      </td>
                      
                      {/* Kolom Hapus */}
                      <td className="p-1 md:p-4 text-center md:table-cell flex justify-end">
                        <button 
                            onClick={() => handleRemoveItem(index)} 
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg active:scale-95 transition-colors group"
                            title="Hapus Item"
                        >
                          <Trash2 className="w-5 h-5 md:w-4 md:h-4 group-hover:rotate-12 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length === 0 && (
                <div className="text-center py-10 text-gray-400 font-bold text-sm bg-white rounded-xl">
                    <Trash2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    Semua item dihapus. <br/> <span className="text-xs font-medium">Nota akan dikosongkan.</span>
                </div>
              )}
            </div>
          </div>

          {/* SUMMARY SECTION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
             
             {/* INFO STATUS & BAYAR HUTANG */}
             <div className="space-y-3.5 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
               <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                 <span className="text-xs font-black text-gray-500 uppercase tracking-wider">Status Nota</span>
                 <span className={`text-[10px] md:text-xs font-black px-2.5 py-1 rounded-lg uppercase tracking-tight ${transaction.paymentStatus === 'HUTANG' ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'}`}>
                   {transaction.paymentStatus || 'LUNAS'}
                 </span>
               </div>
               
               <div className="flex flex-col pt-1">
                 <div className="flex justify-between items-end mb-2">
                   <span className="text-xs font-bold text-gray-600">
                     {transaction.paymentStatus === 'HUTANG' ? 'Info Tagihan Hutang Lama' : 'Terima Cicilan Hutang Lama'}
                   </span>
                   {currentCustomer && (
                     <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                       Sisa: Rp {(currentCustomer.remainingDebt || 0).toLocaleString('id-ID')}
                     </span>
                   )}
                 </div>
                 <div className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 opacity-70">
                   <span className="text-xs text-gray-400 font-bold">Rp</span>
                   <input 
                     type="text" 
                     value={parsedDebtPaid.toLocaleString('id-ID')} 
                     disabled
                     className={`w-full text-right text-base font-black outline-none bg-transparent ${transaction.paymentStatus === 'HUTANG' ? 'text-orange-700' : 'text-gray-600'}`}
                   />
                 </div>
                 <p className={`text-[10px] mt-2 leading-relaxed ${transaction.paymentStatus === 'HUTANG' ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>
                   {transaction.paymentStatus === 'HUTANG' 
                     ? '*Nota HUTANG: Angka ini hanya info akumulasi tagihan, BUKAN uang kas masuk laci.' 
                     : '*Nilai historis (tidak bisa diedit di sini).'}
                 </p>
               </div>
             </div>

             {/* RINGKASAN PERHITUNGAN */}
             <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center space-y-3">
               <div className="flex justify-between items-center text-xs md:text-sm text-gray-600">
                 <span className="font-medium">Subtotal Barang Baru</span> 
                 <span className="font-bold">Rp {newSubtotal.toLocaleString('id-ID')}</span>
               </div>
               
               {newReturnUsed > 0 && (
                 <div className="flex justify-between items-center text-xs md:text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                    <span className="font-medium">Potongan Deposito (Retur)</span> 
                    <span className="font-bold">- Rp {newReturnUsed.toLocaleString('id-ID')}</span>
                 </div>
               )}
               
               <div className="flex justify-between items-center text-sm md:text-base text-gray-900 border-t border-dashed border-gray-200 pt-3 mt-1">
                 <span className="font-extrabold tracking-tight">Total Nilai Belanja</span> 
                 <span className="font-black text-lg md:text-xl text-blue-800">Rp {totalNota.toLocaleString('id-ID')}</span>
               </div>
             </div>
          </div>
        </div>

        {/* BOTTOM FIXED PANEL (KAS vs HUTANG + ACTIONS) */}
        <div className="p-4 md:p-6 border-t bg-white shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.03)] z-20 sticky bottom-0">
           
           {/* TOTAL KAS VS HUTANG CARD */}
           <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col items-center justify-center text-center relative overflow-hidden shadow-inner">
                <div className="absolute -right-2 -top-2 opacity-10"><Save className="w-10 h-10"/></div>
                <span className="text-[9px] md:text-[10px] uppercase font-black text-blue-800 mb-1 tracking-wider">Kas Masuk Laci (Tunai)</span>
                <span className="text-base md:text-xl font-black text-blue-600">Rp {newTotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="p-3.5 bg-orange-50 border border-orange-100 rounded-2xl flex flex-col items-center justify-center text-center relative overflow-hidden shadow-inner">
                <div className="absolute -left-2 -top-2 opacity-10"><AlertTriangle className="w-10 h-10"/></div>
                <span className="text-[9px] md:text-[10px] uppercase font-black text-orange-800 mb-1 tracking-wider">Hutang Baru Tercatat</span>
                <span className="text-base md:text-xl font-black text-orange-600">Rp {(transaction.paymentStatus === 'HUTANG' ? totalNota : 0).toLocaleString('id-ID')}</span>
              </div>
           </div>
           
           {/* TOMBOL AKSI */}
           <div className="flex gap-3 md:gap-4">
             <button onClick={onClose} disabled={isSaving} className="hidden md:block flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-black text-sm hover:bg-gray-200 transition-all active:scale-95">
                Batal
             </button>
             <button onClick={handleSave} disabled={isSaving || items.length === 0} className="flex-[2] md:flex-1 py-3.5 bg-blue-600 text-white rounded-xl font-black text-sm md:text-base hover:bg-blue-700 shadow-md shadow-blue-200 uppercase tracking-widest active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
               {isSaving ? (
                 <>
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   Menyimpan...
                 </>
               ) : (
                 <>
                   <Save className="w-5 h-5" />
                   Simpan Revisi
                 </>
               )}
             </button>
           </div>
        </div>

      </div>
    </div>
  );
};

export default EditTransactionModal;