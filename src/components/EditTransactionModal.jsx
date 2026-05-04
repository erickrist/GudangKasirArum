import React, { useState, useEffect, useRef } from 'react';
import { X, Save, AlertTriangle, Minus, Plus, Trash2, ArrowLeft, Search, PlusCircle, Store } from 'lucide-react';
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
  const currentStoreId = transaction?.storeId;

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

  // Fungsi pembantu untuk mendapatkan harga cabang yang benar
  const getBranchPrice = (product) => {
    if (currentStoreId && product.storePrices && product.storePrices[currentStoreId]) {
      return Number(product.storePrices[currentStoreId]);
    }
    return Number(product.defaultPrice || product.price || 0);
  };

  // =======================================================================
  // HANDLER TAMBAH BARANG (MENDUKUNG UTUH & ECERAN) + KUNCI HPP + HARGA CABANG
  // =======================================================================
  const handleAddProduct = (product, type = 'WHOLESALE') => {
    const baseUnitStr = product.baseUnit || 'PCS';
    const isEceran = type === 'PCS' && product.pcsPerCarton > 1;
    const targetId = isEceran ? `${product.id}_PCS` : product.id;

    const existingIndex = items.findIndex(i => i.productId === targetId);
    
    if (existingIndex >= 0) {
      handleQtyClickAdjustment(existingIndex, 1);
    } else {
      // FIX: Ambil harga berdasarkan cabang nota ini dibuat
      let finalPrice = getBranchPrice(product);
      let finalHpp = Number(product.hpp || 0);
      let finalUnitType = product.unit || product.unitType || 'PCS';
      let finalName = product.name;

      if (isEceran) {
          finalPrice = finalPrice / product.pcsPerCarton;
          finalHpp = finalHpp / product.pcsPerCarton;
          finalUnitType = baseUnitStr;
          finalName = `${product.name} (Eceran)`;
      }

      const newItem = {
        productId: targetId,
        originalId: product.id,
        name: finalName,
        price: finalPrice,
        capitalPrice: finalHpp, // Kunci Modal Beli
        qty: 1,
        unitType: finalUnitType,
        baseUnit: baseUnitStr,
        pcsPerCarton: isEceran ? 1 : (product.pcsPerCarton || 1),
        discount: 0,
        subtotal: finalPrice
      };
      setItems([...items, newItem]);
    }
    setSearchQuery('');
    setShowDropdown(false);
    onShowToast(`${product.name} ${isEceran ? '(Eceran)' : ''} ditambahkan ke revisi nota`, 'success');
  };

  const handleQtyClickAdjustment = (index, delta) => {
    const newItems = [...items];
    const currentQty = parseFloat(newItems[index].qty) || 0;
    const newQty = currentQty + delta;
    
    if (newQty <= 0) return;

    newItems[index].qty = newQty;
    newItems[index].subtotal = (newItems[index].price * newQty) - (newItems[index].discount || 0);
    setItems(newItems);
  };

  const handleQtyInputChange = (index, value) => {
    const newItems = [...items];
    
    if (value === '') {
      newItems[index].qty = '';
      newItems[index].subtotal = 0; 
      setItems(newItems);
      return;
    }

    newItems[index].qty = value;
    const calcQty = parseFloat(value) || 0;
    newItems[index].subtotal = (newItems[index].price * calcQty) - (newItems[index].discount || 0);
    setItems(newItems);
  };

  const handleRemoveItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const calculateNewTotals = () => {
    const getValidQty = (qty) => (qty === '' || isNaN(parseFloat(qty))) ? 0 : parseFloat(qty);

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
    if (items.some(i => i.qty === '' || isNaN(parseFloat(i.qty)) || parseFloat(i.qty) <= 0)) {
        return onShowToast('Pastikan semua jumlah barang terisi angka yang valid (minimal 0.01).', 'error');
    }
    if (items.length === 0) return onShowToast('Transaksi kosong. Gunakan tombol hapus di Dashboard jika ingin membatalkan total.', 'error');
    
    setIsSaving(true);
    
    const oldItemsMap = {};
    transaction.items.forEach(i => oldItemsMap[i.productId] = i);

    for (const newItem of items) {
      const oldItem = oldItemsMap[newItem.productId] || { qty: 0 };
      const qtyDiff = parseFloat(newItem.qty) - parseFloat(oldItem.qty); 

      if (qtyDiff > 0) { 
        let cleanId = newItem.productId;
        if (typeof cleanId === 'string' && cleanId.endsWith('_PCS')) {
            cleanId = cleanId.replace('_PCS', '');
        }

        const product = products.find(p => p.id === cleanId);
        if (product) {
          const isWholesale = ['KARTON', 'BALL', 'IKAT', 'RENCENG', 'BOX'].includes(newItem.unitType?.toUpperCase());
          const multiplier = isWholesale ? (newItem.pcsPerCarton || 1) : 1;
          const pcsDiff = qtyDiff * multiplier;
          
          if (product.stockPcs < pcsDiff) {
             setIsSaving(false);
             return onShowToast(`Gagal! Stok Gudang [${product.name}] tidak cukup. Sisa: ${product.stockPcs}, Butuh Tambahan: ${pcsDiff}`, 'error');
          }
        }
      }
    }

    try {
      for (const newItem of items) {
        const oldItem = oldItemsMap[newItem.productId] || { qty: 0 };
        const qtyDiff = parseFloat(newItem.qty) - parseFloat(oldItem.qty); 

        if (qtyDiff !== 0) {
          let cleanId = newItem.productId;
          if (typeof cleanId === 'string' && cleanId.endsWith('_PCS')) cleanId = cleanId.replace('_PCS', '');

          const product = products.find(p => p.id === cleanId);
          if (product) {
            const isWholesale = ['KARTON', 'BALL', 'IKAT', 'RENCENG', 'BOX'].includes(newItem.unitType?.toUpperCase());
            const multiplier = isWholesale ? (newItem.pcsPerCarton || 1) : 1;
            const pcsDiff = qtyDiff * multiplier;
            
            await updateDocument('products', product.id, { stockPcs: product.stockPcs - pcsDiff });
            await addDocument('stock_logs', {
              productId: product.id, productName: product.name, type: qtyDiff > 0 ? 'out' : 'in', 
              amount: Math.abs(qtyDiff), unitType: newItem.unitType, totalPcs: Math.abs(pcsDiff),
              note: `Revisi Edit Nota #${transaction.id.substring(0,6)}`, createdAt: new Date()
            });
          }
        }
        delete oldItemsMap[newItem.productId]; 
      }

      for (const oldItem of Object.values(oldItemsMap)) {
        let cleanId = oldItem.productId;
        if (typeof cleanId === 'string' && cleanId.endsWith('_PCS')) cleanId = cleanId.replace('_PCS', '');

        const product = products.find(p => p.id === cleanId);
        if (product) {
          const isWholesale = ['KARTON', 'BALL', 'IKAT', 'RENCENG', 'BOX'].includes(oldItem.unitType?.toUpperCase());
          const multiplier = isWholesale ? (oldItem.pcsPerCarton || 1) : 1;
          
          await updateDocument('products', product.id, { stockPcs: product.stockPcs + (parseFloat(oldItem.qty) * multiplier) });
          await addDocument('stock_logs', {
            productId: product.id, productName: product.name, type: 'in', 
            amount: parseFloat(oldItem.qty), unitType: oldItem.unitType, totalPcs: parseFloat(oldItem.qty) * multiplier,
            note: `Hapus item dr Nota #${transaction.id.substring(0,6)}`, createdAt: new Date()
          });
        }
      }

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

      await updateDocument('transactions', transaction.id, {
        items: items.map(i => ({...i, qty: parseFloat(i.qty)})), 
        subtotal: newSubtotal, 
        returnUsed: newReturnUsed,
        total: newTotal
      });

      onShowToast('Transaksi berhasil direvisi! Stok & Hutang Otomatis Disesuaikan.', 'success');
      onClose();
    } catch (error) {
      onShowToast('Terjadi kesalahan saat menyimpan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] md:p-4">
      <div className="bg-white md:rounded-[24px] w-full h-full md:h-auto md:max-w-4xl shadow-2xl relative border-t-8 border-blue-500 md:max-h-[95vh] flex flex-col overflow-hidden transition-all duration-300">
        
        {/* HEADER MODAL */}
        <div className="flex justify-between items-center p-4 md:p-6 border-b shrink-0 bg-white z-20 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={onClose} disabled={isSaving} className="md:hidden text-gray-600 p-2 bg-gray-100 rounded-xl active:scale-95">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <h3 className="text-lg md:text-xl font-black text-gray-800 uppercase tracking-tighter">Revisi Nota</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500 font-bold">#{transaction.id?.substring(0,8).toUpperCase()}</span>
                  <span className="text-xs text-gray-300">|</span>
                  <span className="text-xs text-blue-600 font-extrabold">{transaction.customerName}</span>
                </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentStoreId && (
              <span className="hidden md:flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-black uppercase">
                <Store className="w-3.5 h-3.5" /> Harga Cabang Diterapkan
              </span>
            )}
            <button onClick={onClose} disabled={isSaving} className="hidden md:block text-gray-400 hover:text-gray-600 bg-gray-100 p-2 rounded-xl active:scale-95 transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* AREA KONTEN (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-6 bg-gray-50/50">
          
          {/* FITUR PENCARIAN & TAMBAH BARANG */}
          <div className="mb-5 relative" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-blue-400" />
              <input
                type="text"
                placeholder="Ketik nama barang untuk ditambahkan..."
                className="w-full bg-white border border-blue-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-black text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm transition-all placeholder:font-bold placeholder:text-gray-400"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
              />
            </div>
            
            {showDropdown && (
               <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-72 overflow-y-auto custom-scrollbar">
                 {filteredProducts.length === 0 ? (
                   <div className="p-6 text-center text-sm text-gray-400 font-bold bg-gray-50">Barang tidak ditemukan di gudang stok.</div>
                 ) : (
                   filteredProducts.map(p => {
                     const displayPrice = getBranchPrice(p);
                     return (
                       <div
                         key={p.id}
                         className="p-4 border-b border-gray-100 hover:bg-blue-50 cursor-default flex flex-col gap-3 transition-colors"
                       >
                         <div className="flex justify-between items-start">
                           <div>
                             <p className="font-black text-sm text-gray-800 uppercase">{p.name}</p>
                             <div className="flex items-center gap-2 mt-1.5">
                               <span className="text-[10px] md:text-xs text-orange-600 font-black bg-orange-50 px-2 py-0.5 rounded-md">Sisa: {p.stockPcs}</span>
                               <span className="text-[10px] md:text-xs text-blue-600 font-black">Rp {displayPrice.toLocaleString('id-ID')}</span>
                             </div>
                           </div>
                           <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2.5 py-1 rounded-lg border border-blue-200">{p.unitType}</span>
                         </div>
                         
                         <div className="flex gap-2">
                            <button 
                               onClick={(e) => { e.stopPropagation(); handleAddProduct(p, 'WHOLESALE'); }} 
                               className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-[10px] md:text-xs font-black uppercase hover:bg-blue-700 transition-colors shadow-sm active:scale-95"
                            >
                               Tambah 1 {p.unitType}
                            </button>
                            {p.pcsPerCarton > 1 && !['PCS', 'KG'].includes(p.unitType) && (
                               <button 
                                 onClick={(e) => { e.stopPropagation(); handleAddProduct(p, 'PCS'); }} 
                                 className="flex-1 bg-orange-100 text-orange-700 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase hover:bg-orange-200 border border-orange-200 transition-colors shadow-sm active:scale-95"
                               >
                                 Tambah 1 {p.baseUnit || 'PCS'}
                               </button>
                            )}
                         </div>
                       </div>
                     )
                   })
                 )}
               </div>
            )}
          </div>

          {/* DAFTAR BARANG YANG MAU DIEDIT */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden mb-6 relative z-10">
            <div className="p-4 md:p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h4 className="text-sm font-black text-gray-700 uppercase tracking-widest">Detail Keranjang Nota</h4>
                <span className="text-xs font-bold text-gray-400 bg-white px-3 py-1 rounded-full shadow-sm border">{items.length} Item</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[600px] md:min-w-full">
                <thead className="bg-white border-b border-gray-100 hidden md:table-header-group">
                  <tr>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Nama Produk</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-center w-48">Kuantitas</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Subtotal</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-center w-16">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {items.map((item, index) => (
                    <tr key={index} className="hover:bg-blue-50/30 transition-colors flex flex-col md:table-row p-4 md:p-0 border-b md:border-b-0 last:border-0 mb-3 md:mb-0 bg-white rounded-xl md:rounded-none border md:border-0 shadow-sm md:shadow-none">
                      
                      <td className="p-1 md:p-4 font-bold text-gray-800 md:table-cell flex flex-col mb-3 md:mb-0">
                        <span className="text-sm md:text-base font-black uppercase mb-1">{item.name}</span>
                        <div className="text-[11px] text-gray-500 font-bold bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 w-max">
                            @ Rp {Number(item.price).toLocaleString('id-ID')} <span className="text-gray-400 mx-1">|</span> {item.unitType}
                        </div>
                      </td>
                      
                      <td className="p-1 md:p-4 md:table-cell mb-4 md:mb-0">
                        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl p-1.5 shadow-inner md:mx-auto justify-between md:justify-center w-full md:w-36">
                          <button onClick={() => handleQtyClickAdjustment(index, -1)} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg active:scale-90 transition-all bg-white shadow-sm border border-gray-100"><Minus className="w-4 h-4" /></button>
                          <input type="number" min="0.01" step="any" value={item.qty} onChange={(e) => handleQtyInputChange(index, e.target.value)} className="w-16 text-center font-black text-base bg-transparent outline-none focus:border-blue-400 rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" />
                          <button onClick={() => handleQtyClickAdjustment(index, 1)} className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg active:scale-90 transition-all bg-white shadow-sm border border-gray-100"><Plus className="w-4 h-4" /></button>
                        </div>
                      </td>
                      
                      <td className="p-1 md:p-4 font-black text-right text-blue-700 md:table-cell flex justify-between items-center whitespace-nowrap mb-2 md:mb-0 border-t md:border-t-0 border-gray-100 pt-3 md:pt-4">
                        <span className="md:hidden text-xs font-bold text-gray-400 uppercase">Total Baris:</span>
                        <span className="text-base md:text-lg">Rp {item.subtotal.toLocaleString('id-ID')}</span>
                      </td>
                      
                      <td className="p-1 md:p-4 text-center md:table-cell flex justify-end">
                        <button onClick={() => handleRemoveItem(index)} className="p-2.5 text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl active:scale-95 transition-colors group" title="Hapus Item">
                          <Trash2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SUMMARY SECTION BAWAH */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
             <div className="space-y-3 bg-white p-5 rounded-3xl border border-gray-200 shadow-sm">
               <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                 <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Status Pembayaran</span>
                 <span className={`text-[10px] md:text-xs font-black px-3 py-1.5 rounded-lg uppercase tracking-tight ${transaction.paymentStatus === 'HUTANG' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-teal-100 text-teal-700 border border-teal-200'}`}>
                   {transaction.paymentStatus || 'LUNAS'}
                 </span>
               </div>
               
               <div className="flex flex-col pt-1">
                 <div className="flex justify-between items-end mb-2">
                   <span className="text-xs font-bold text-gray-600">
                     {transaction.paymentStatus === 'HUTANG' ? 'Hutang Lama Tercatat' : 'DP / Cicilan Awal'}
                   </span>
                 </div>
                 <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 opacity-80 cursor-not-allowed">
                   <span className="text-sm text-gray-400 font-bold">Rp</span>
                   <input type="text" value={parsedDebtPaid.toLocaleString('id-ID')} disabled className={`w-full text-right text-lg font-black outline-none bg-transparent ${transaction.paymentStatus === 'HUTANG' ? 'text-orange-700' : 'text-gray-600'}`} />
                 </div>
               </div>
             </div>

             <div className="bg-blue-600 text-white p-6 rounded-3xl shadow-lg shadow-blue-200 flex flex-col justify-center space-y-3 relative overflow-hidden">
               {/* Hiasan Background */}
               <div className="absolute -right-6 -top-6 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl"></div>
               
               <div className="flex justify-between items-center text-sm text-blue-100">
                 <span className="font-medium">Subtotal Baru</span> 
                 <span className="font-bold">Rp {newSubtotal.toLocaleString('id-ID')}</span>
               </div>
               {newReturnUsed > 0 && (
                 <div className="flex justify-between items-center text-sm text-white bg-blue-700/50 px-3 py-1.5 rounded-xl border border-blue-500/50">
                    <span className="font-medium">Potongan Retur</span> 
                    <span className="font-bold">- Rp {newReturnUsed.toLocaleString('id-ID')}</span>
                 </div>
               )}
               <div className="flex justify-between items-center border-t border-blue-500/50 pt-3 mt-1">
                 <span className="font-black tracking-widest uppercase text-xs text-blue-200">Total Akhir Nota</span> 
                 <span className="font-black text-2xl md:text-3xl">Rp {totalNota.toLocaleString('id-ID')}</span>
               </div>
             </div>
          </div>
        </div>

        {/* BOTTOM FIXED PANEL (TOMBOL SIMPAN) */}
        <div className="p-4 md:p-6 border-t border-gray-200 bg-white shrink-0 z-20 sticky bottom-0">
           <div className="flex gap-3 md:gap-4">
             <button onClick={onClose} disabled={isSaving} className="hidden md:block flex-1 py-4 bg-gray-50 text-gray-600 border border-gray-200 rounded-2xl font-black text-sm hover:bg-gray-100 transition-all active:scale-95">
                Batalkan Perubahan
             </button>
             <button onClick={handleSave} disabled={isSaving || items.length === 0} className="flex-[2] md:flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm md:text-base hover:bg-blue-700 shadow-xl shadow-blue-200 uppercase tracking-widest active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
               {isSaving ? (
                 <>
                   <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   Sinkronisasi Data...
                 </>
               ) : (
                 <>
                   <Save className="w-5 h-5" /> Simpan Revisi Nota.
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