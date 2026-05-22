import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Minus, Plus, Trash2, ArrowLeft, Search } from 'lucide-react';
import { updateDocument } from '../hooks/useFirestore';

const EditDraftModal = ({ isOpen, onClose, transaction, products = [], customers = [], onShowToast }) => {
  const [items, setItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  const [paymentData, setPaymentData] = useState({
    status: 'LUNAS',
    method: 'TUNAI',
    useReturn: false,
    returnAmount: 0,
    collectDebt: false,
    debtAmount: 0,
  });

  const currentCustomer = customers.find(c => c.id === transaction?.customerId);
  const currentStoreId = transaction?.storeId;

  useEffect(() => {
    if (transaction && isOpen) {
      setItems(JSON.parse(JSON.stringify(transaction.items || [])));
      setSearchQuery('');
      setShowDropdown(false);
      
      setPaymentData({
        status: transaction.paymentStatus || 'LUNAS',
        method: transaction.paymentMethod || 'TUNAI',
        useReturn: (transaction.returnUsed || 0) > 0,
        returnAmount: transaction.returnUsed || 0,
        collectDebt: (transaction.debtPaid || 0) > 0,
        debtAmount: transaction.debtPaid || 0,
      });
    }
  }, [transaction, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen || !transaction || !currentCustomer) return null;

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const getBranchPrice = (product) => {
    if (currentStoreId && product.storePrices && product.storePrices[currentStoreId]) {
      return Number(product.storePrices[currentStoreId]);
    }
    return Number(product.defaultPrice || product.price || 0);
  };

  const handleAddProduct = (product, type = 'WHOLESALE') => {
    const baseUnitStr = product.baseUnit || 'PCS';
    const isEceran = type === 'PCS' && product.pcsPerCarton > 1;
    const targetId = isEceran ? `${product.id}_PCS` : product.id;

    const existingIndex = items.findIndex(i => i.productId === targetId);
    if (existingIndex >= 0) {
      handleQtyClickAdjustment(existingIndex, 1);
    } else {
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

      setItems([...items, {
        productId: targetId,
        originalId: product.id,
        name: finalName,
        price: finalPrice,
        capitalPrice: finalHpp,
        qty: 1,
        unitType: finalUnitType,
        baseUnit: baseUnitStr,
        pcsPerCarton: isEceran ? 1 : (product.pcsPerCarton || 1),
        discount: 0,
        subtotal: finalPrice
      }]);
    }
    setSearchQuery('');
    setShowDropdown(false);
    onShowToast(`${product.name} ${isEceran ? '(Eceran)' : ''} ditambahkan`, 'success');
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

  const handleRemoveItem = (index) => setItems(items.filter((_, i) => i !== index));

  const calculateNewTotals = () => {
    const getValidQty = (qty) => (qty === '' || isNaN(parseFloat(qty))) ? 0 : parseFloat(qty);
    const newSubtotal = items.reduce((sum, item) => sum + ((item.price * getValidQty(item.qty)) - (item.discount || 0)), 0);
    let total = newSubtotal;
    if (paymentData.useReturn && paymentData.returnAmount > 0) total -= paymentData.returnAmount;
    if (paymentData.collectDebt && paymentData.debtAmount > 0) total += paymentData.debtAmount;
    
    let displayTotal = Math.max(0, total);
    let newTotal = paymentData.status === 'HUTANG' ? 0 : displayTotal;
    
    return { newSubtotal, displayTotal, newTotal };
  };

  const { newSubtotal, displayTotal, newTotal } = calculateNewTotals();

  const handleSave = async () => {
    if (items.some(i => i.qty === '' || isNaN(parseFloat(i.qty)) || parseFloat(i.qty) <= 0)) {
        return onShowToast('Pastikan semua jumlah barang terisi angka yang valid.', 'error');
    }
    if (items.length === 0) return onShowToast('Transaksi kosong.', 'error');
    if (paymentData.useReturn && paymentData.returnAmount > currentCustomer.returnAmount) return onShowToast('Saldo retur tidak cukup', 'error');
    if (paymentData.collectDebt && paymentData.debtAmount > currentCustomer.remainingDebt) return onShowToast('Hutang yang ditagih melebihi sisa hutang', 'error');

    setIsSaving(true);
    try {
      await updateDocument('transactions', transaction.id, {
        items: items.map(i => ({...i, qty: parseFloat(i.qty)})), 
        subtotal: newSubtotal, 
        total: newTotal,
        paymentStatus: paymentData.status,
        paymentMethod: paymentData.status === 'LUNAS' ? paymentData.method : null,
        returnUsed: paymentData.useReturn ? paymentData.returnAmount : 0,
        debtPaid: paymentData.collectDebt ? paymentData.debtAmount : 0
      });
      onShowToast('Draft berhasil direvisi!', 'success');
      onClose();
    } catch (error) {
      onShowToast('Terjadi kesalahan saat menyimpan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] md:p-4">
      <div className="bg-white md:rounded-[24px] w-full h-full md:h-auto md:max-w-5xl shadow-2xl relative border-t-8 border-orange-500 md:max-h-[95vh] flex flex-col overflow-hidden transition-all duration-300">
        
        <div className="flex justify-between items-center p-4 md:p-6 border-b shrink-0 bg-white z-20 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={onClose} disabled={isSaving} className="md:hidden text-gray-600 p-2 bg-gray-100 rounded-xl">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <h3 className="text-lg md:text-xl font-black text-gray-800 uppercase tracking-tighter">Edit Draft</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500 font-bold">#{transaction.id?.substring(0,8).toUpperCase()}</span>
                  <span className="text-xs text-gray-300">|</span>
                  <span className="text-xs text-orange-600 font-extrabold">{transaction.customerName}</span>
                </div>
            </div>
          </div>
          <button onClick={onClose} disabled={isSaving} className="hidden md:block text-gray-400 hover:text-gray-600 bg-gray-100 p-2 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-6 bg-gray-50/50">
          
          <div className="mb-5 relative" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-orange-400" />
              <input type="text" placeholder="Ketik nama barang untuk ditambahkan..." className="w-full bg-white border border-orange-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-black text-gray-800 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 shadow-sm transition-all" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} />
            </div>
            
            {showDropdown && (
               <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-72 overflow-y-auto custom-scrollbar">
                 {filteredProducts.map(p => (
                   <div key={p.id} className="p-4 border-b border-gray-100 hover:bg-orange-50 flex justify-between items-center">
                     <div>
                       <p className="font-black text-sm text-gray-800 uppercase">{p.name}</p>
                       <div className="flex items-center gap-2 mt-1.5">
                         <span className="text-[10px] md:text-xs text-blue-600 font-black bg-blue-50 px-2 py-0.5 rounded-md">Sisa: {p.stockPcs}</span>
                         <span className="text-[10px] md:text-xs text-orange-600 font-black">Rp {getBranchPrice(p).toLocaleString('id-ID')}</span>
                       </div>
                     </div>
                     <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); handleAddProduct(p, 'WHOLESALE'); }} className="bg-orange-600 text-white py-2 px-3 rounded-xl text-[10px] font-black uppercase hover:bg-orange-700">+ 1 {p.unitType}</button>
                        {p.pcsPerCarton > 1 && !['PCS', 'KG'].includes(p.unitType) && (
                           <button onClick={(e) => { e.stopPropagation(); handleAddProduct(p, 'PCS'); }} className="bg-blue-100 text-blue-700 py-2 px-3 rounded-xl text-[10px] font-black uppercase hover:bg-blue-200">+ 1 {p.baseUnit || 'PCS'}</button>
                        )}
                     </div>
                   </div>
                 ))}
               </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h4 className="text-sm font-black text-gray-700 uppercase tracking-widest">Detail Keranjang Draft</h4>
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
                    <tr key={index} className="hover:bg-orange-50/30 transition-colors flex flex-col md:table-row p-4 md:p-0 border-b md:border-b-0">
                      <td className="p-1 md:p-4 font-bold text-gray-800 md:table-cell flex flex-col">
                        <span className="text-sm md:text-base font-black uppercase mb-1">{item.name}</span>
                        <div className="text-[11px] text-gray-500 font-bold bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 w-max">
                            @ Rp {Number(item.price).toLocaleString('id-ID')} | {item.unitType}
                        </div>
                      </td>
                      <td className="p-1 md:p-4 md:table-cell">
                        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl p-1.5 w-full md:w-36">
                          <button onClick={() => handleQtyClickAdjustment(index, -1)} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg bg-white border border-gray-100"><Minus className="w-4 h-4" /></button>
                          <input type="number" min="0.01" step="any" value={item.qty} onChange={(e) => handleQtyInputChange(index, e.target.value)} className="w-16 text-center font-black text-base bg-transparent outline-none focus:border-orange-400 rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                          <button onClick={() => handleQtyClickAdjustment(index, 1)} className="p-2 text-gray-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg bg-white border border-gray-100"><Plus className="w-4 h-4" /></button>
                        </div>
                      </td>
                      <td className="p-1 md:p-4 font-black text-right text-orange-700 text-base md:text-lg">Rp {item.subtotal.toLocaleString('id-ID')}</td>
                      <td className="p-1 md:p-4 text-center">
                        <button onClick={() => handleRemoveItem(index)} className="p-2.5 text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl"><Trash2 className="w-5 h-5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-4">
                {currentCustomer.returnAmount > 0 && (
                  <div className="border border-green-200 bg-green-50 p-4 rounded-2xl">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <p className="font-black text-green-800 text-sm">Saldo Retur (Deposit)</p>
                        <p className="text-xs font-bold text-green-600">Tersedia: Rp {currentCustomer.returnAmount.toLocaleString('id-ID')}</p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-green-200">
                        <input type="checkbox" checked={paymentData.useReturn} onChange={(e) => setPaymentData({...paymentData, useReturn: e.target.checked, returnAmount: e.target.checked ? Math.min(currentCustomer.returnAmount, newSubtotal) : 0})} className="w-4 h-4 accent-green-600 rounded" />
                        <span className="text-xs font-black text-green-700">Gunakan</span>
                      </label>
                    </div>
                    {paymentData.useReturn && (
                      <input type="number" min="0" max={Math.min(currentCustomer.returnAmount, newSubtotal)} value={paymentData.returnAmount} onChange={(e) => setPaymentData({...paymentData, returnAmount: parseFloat(e.target.value) || 0})} className="w-full px-4 py-2 border-none bg-white rounded-xl text-sm font-black focus:ring-2 focus:ring-green-500 outline-none text-green-700" />
                    )}
                  </div>
                )}
                {currentCustomer.remainingDebt > 0 && (
                  <div className="border border-orange-200 bg-orange-50 p-4 rounded-2xl">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <p className="font-black text-orange-800 text-sm">Tagih Sisa Hutang</p>
                        <p className="text-xs font-bold text-orange-600">Total: Rp {currentCustomer.remainingDebt.toLocaleString('id-ID')}</p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-orange-200">
                        <input type="checkbox" checked={paymentData.collectDebt} onChange={(e) => setPaymentData({...paymentData, collectDebt: e.target.checked, debtAmount: e.target.checked ? currentCustomer.remainingDebt : 0})} className="w-4 h-4 accent-orange-600 rounded" />
                        <span className="text-xs font-black text-orange-700">Tagih</span>
                      </label>
                    </div>
                    {paymentData.collectDebt && (
                      <input type="number" min="0" max={currentCustomer.remainingDebt} value={paymentData.debtAmount} onChange={(e) => setPaymentData({...paymentData, debtAmount: parseFloat(e.target.value) || 0})} className="w-full px-4 py-2 border-none bg-white rounded-xl text-sm font-black focus:ring-2 focus:ring-orange-500 outline-none text-orange-700" />
                    )}
                  </div>
                )}

                <div className="border border-gray-200 bg-white p-4 rounded-2xl">
                  <p className="font-black text-gray-800 mb-2 uppercase tracking-tighter text-sm">Status Pembayaran</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`flex items-center justify-center p-3 rounded-xl cursor-pointer font-black ${paymentData.status === 'LUNAS' ? 'bg-teal-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-500'}`}>
                      <input type="radio" name="status" value="LUNAS" checked={paymentData.status === 'LUNAS'} onChange={(e) => setPaymentData({ ...paymentData, status: e.target.value })} className="hidden" />LUNAS
                    </label>
                    <label className={`flex items-center justify-center p-3 rounded-xl cursor-pointer font-black ${paymentData.status === 'HUTANG' ? 'bg-orange-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-500'}`}>
                      <input type="radio" name="status" value="HUTANG" checked={paymentData.status === 'HUTANG'} onChange={(e) => setPaymentData({ ...paymentData, status: e.target.value })} className="hidden" />HUTANG
                    </label>
                  </div>
                  {paymentData.status === 'LUNAS' && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {['TUNAI', 'TRANSFER', 'QRIS'].map((m) => (
                        <button key={m} onClick={() => setPaymentData({ ...paymentData, method: m })} className={`py-2 rounded-xl text-[10px] font-black uppercase ${paymentData.method === m ? 'bg-teal-100 text-teal-700 border border-teal-300' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>{m}</button>
                      ))}
                    </div>
                  )}
                </div>
             </div>

             <div className="bg-orange-600 text-white p-6 rounded-3xl shadow-lg shadow-orange-200 flex flex-col justify-center space-y-3">
               <div className="flex justify-between items-center text-sm text-orange-100">
                 <span className="font-medium">Subtotal Baru</span> 
                 <span className="font-bold">Rp {newSubtotal.toLocaleString('id-ID')}</span>
               </div>
               {paymentData.useReturn && paymentData.returnAmount > 0 && (
                 <div className="flex justify-between items-center text-sm text-white bg-orange-700/50 px-3 py-1.5 rounded-xl">
                    <span className="font-medium">Potong Deposit</span> 
                    <span className="font-bold">- Rp {paymentData.returnAmount.toLocaleString('id-ID')}</span>
                 </div>
               )}
               {paymentData.collectDebt && paymentData.debtAmount > 0 && (
                 <div className="flex justify-between items-center text-sm text-white bg-red-600/50 px-3 py-1.5 rounded-xl">
                    <span className="font-medium">Hutang Ditagih</span> 
                    <span className="font-bold">+ Rp {paymentData.debtAmount.toLocaleString('id-ID')}</span>
                 </div>
               )}
               <div className="flex justify-between items-center border-t border-orange-500/50 pt-3 mt-1">
                 <span className="font-black tracking-widest uppercase text-xs text-orange-200">Total Akhir Draft</span> 
                 <span className="font-black text-2xl md:text-3xl">Rp {displayTotal.toLocaleString('id-ID')}</span>
               </div>
             </div>
          </div>
        </div>

        <div className="p-4 md:p-6 border-t border-gray-200 bg-white shrink-0 z-20 sticky bottom-0">
           <button onClick={handleSave} disabled={isSaving || items.length === 0} className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-sm md:text-base hover:bg-orange-700 uppercase active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
             {isSaving ? 'Menyimpan...' : <><Save className="w-5 h-5" /> Simpan Draft</>}
           </button>
        </div>

      </div>
    </div>
  );
};

export default EditDraftModal;
