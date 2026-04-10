import { Search, History, Eye, Trash2, Edit3, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

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
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.phone && c.phone.includes(search))
  );

  const selected = customers.find(c => c.id === value);

  return (
    <div className="relative flex-1 w-full" ref={wrapperRef}>
      <div 
        className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold text-gray-800 cursor-pointer flex justify-between items-center border border-transparent hover:border-teal-300 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selected ? 'text-gray-800' : 'text-gray-400'}>
          {selected ? `${selected.name} ${selected.phone ? `(${selected.phone})` : ''}` : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar overflow-hidden">
          <div className="p-2 sticky top-0 bg-white border-b border-gray-100 shadow-sm z-10">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Ketik nama pembeli..." className="w-full bg-gray-50 rounded-lg pl-9 pr-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500" value={search} onChange={e => setSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus />
            </div>
          </div>
          <div className="py-1">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-4 font-bold">Tidak ditemukan</p>
            ) : (
              filtered.map(c => (
                <div key={c.id} className="px-4 py-2.5 hover:bg-teal-50 cursor-pointer border-b border-gray-50 last:border-0" onClick={() => { onChange(c.id); setIsOpen(false); setSearch(''); }}>
                  <p className="font-black text-sm text-gray-800 uppercase">{c.name}</p>
                  {c.phone && <p className="text-[10px] text-gray-500 font-bold">{c.phone}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const TabDebt = ({
  customers,
  activeStoreCustomersDebt,
  totalUnpaidDebtDisplay,
  isGlobal,
  paginatedItems,
  formatDisplayDate,
  newManualDebt,
  setNewManualDebt,
  handleAddManualDebt,
  onPayDebt,
  onEditDebt,
  onDeleteCustomerDebt,
  onViewHistoryDetail,
  onDeleteHistory,
  paginationComponent
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white p-4 md:p-6 rounded-3xl border shadow-sm relative z-10">
        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 md:mb-4">Penambahan Hutang Manual</h4>
        <form onSubmit={handleAddManualDebt} className="flex flex-col md:flex-row gap-3">
          <CustomerSearchSelect customers={customers} value={newManualDebt.customerId} onChange={(id) => setNewManualDebt({...newManualDebt, customerId: id})} placeholder="-- Cari Pembeli --" />
          <input type="text" placeholder="Keterangan" required className="w-full md:flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-orange-500" value={newManualDebt.note} onChange={e => setNewManualDebt({...newManualDebt, note: e.target.value})} />
          <input type="number" placeholder="Rp" required className="w-full md:w-44 bg-gray-50 rounded-xl px-4 py-3 text-sm font-black border-none outline-none focus:ring-2 focus:ring-orange-500" value={newManualDebt.amount} onChange={e => setNewManualDebt({...newManualDebt, amount: e.target.value})} />
          <button className="w-full md:w-auto px-8 py-3 rounded-xl font-black text-sm text-white bg-orange-600 shadow-md hover:bg-orange-700 transition-colors">Simpan</button>
        </form>
      </div>

      <div className="bg-white rounded-3xl border shadow-sm mb-6 flex flex-col">
        <div className="p-4 md:p-6 bg-gray-50/50 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
           {/* NAMA JUDUL TABEL DINAMIS */}
           <h3 className="text-base md:text-lg font-black text-gray-800 uppercase tracking-tighter">Daftar Piutang {isGlobal ? 'Global' : 'Cabang'}</h3>
           <div className="px-4 py-1.5 rounded-xl font-black text-xs uppercase bg-orange-100 text-orange-600">Total: Rp {totalUnpaidDebtDisplay.toLocaleString('id-ID')}</div>
        </div>
        <div className="overflow-x-auto w-full custom-scrollbar">
           <table className="w-full min-w-[500px] text-left text-xs md:text-sm">
             <thead><tr className="border-b"><th className="p-4 font-black text-gray-400 uppercase text-[10px]">Pelanggan</th><th className="p-4 font-black text-gray-400 uppercase text-[10px]">Saldo</th><th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th></tr></thead>
             <tbody className="divide-y">
               {activeStoreCustomersDebt && activeStoreCustomersDebt.map(c => (
                 <tr key={c.id} className="hover:bg-gray-50 transition-all">
                   <td className="p-4"><div><p className="font-black text-gray-800 uppercase">{c.name}</p><p className="text-[10px] text-gray-400 font-bold">{c.phone || '-'}</p></div></td>
                   <td className="p-4 font-black italic text-sm md:text-lg whitespace-nowrap text-red-600">Rp {(c.displayDebt || 0).toLocaleString('id-ID')}</td>
                   <td className="p-4 text-right">
                     <div className="flex justify-end items-center gap-2">
                       <button onClick={() => onPayDebt(c)} className="bg-teal-600 text-white px-4 py-2 rounded-xl text-[10px] md:text-xs font-black shadow-md uppercase whitespace-nowrap hover:bg-teal-700 transition-colors">Bayar</button>
                       <button onClick={() => onEditDebt(c)} className="bg-white border text-gray-600 p-2 rounded-xl hover:bg-gray-50 hover:text-teal-600 transition-colors"><Edit3 className="w-4 h-4 inline-block"/></button>
                       {isGlobal && <button onClick={() => onDeleteCustomerDebt(c)} className="bg-red-50 text-red-600 p-2 rounded-xl hover:bg-red-100 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                     </div>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden flex flex-col">
         <div className="p-4 md:p-6 bg-gray-50/50 border-b"><h3 className="text-base md:text-lg font-black text-gray-800 uppercase flex items-center gap-2"><History className="text-gray-500 w-5 h-5"/> Histori Hutang</h3></div>
         <div className="overflow-x-auto w-full custom-scrollbar">
            <table className="w-full min-w-[700px] text-left text-xs md:text-sm">
               <thead><tr className="bg-gray-50/50 border-b"><th className="p-4 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th><th className="p-4 font-black text-gray-400 uppercase text-[10px]">Pelanggan</th><th className="p-4 font-black text-gray-400 uppercase text-[10px]">Keterangan</th><th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Nominal</th><th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th></tr></thead>
               <tbody className="divide-y">
                 {paginatedItems.map(item => {
                   const isIn = item.debtType === 'in'; 
                   return (
                     <tr key={item.id + (item.debtType || '')} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-bold text-gray-500 whitespace-nowrap">{formatDisplayDate(item.createdAt)}</td>
                        <td className="p-4 font-black text-gray-800 uppercase">{item.customerName}</td>
                        <td className="p-4 font-bold text-gray-600">{item.note}</td>
                        <td className={`p-4 font-black text-right whitespace-nowrap ${isIn ? 'text-red-600' : 'text-teal-600'}`}>{isIn ? '(+)' : '(-)'} Rp {(Number(item.nominal)||0).toLocaleString('id-ID')}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => onViewHistoryDetail(item)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Eye className="w-4 h-4"/></button>
                            <button onClick={() => onDeleteHistory(item)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </td>
                     </tr>
                   );
                 })}
               </tbody>
            </table>
         </div>
         {paginationComponent}
      </div>
    </div>
  );
};

export default TabDebt;