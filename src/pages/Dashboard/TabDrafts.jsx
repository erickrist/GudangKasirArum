import { Eye, Edit3, Trash2, CheckCircle } from 'lucide-react';

const TabDrafts = ({ 
  paginatedItems, 
  formatDisplayDate, 
  onViewDraftNota,
  onEditDraft, 
  onDeleteDraft,
  onApproveDraft,
  paginationComponent 
}) => {
  return (
    <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden">
      <div className="overflow-x-auto w-full custom-scrollbar">
        <table className="w-full min-w-[800px] text-left">
          <thead>
            <tr className="bg-gray-50/50 border-b">
              <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th>
              <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Cabang</th>
              <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Nama Pembeli</th>
              <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Status</th>
              <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Item Dibeli</th>
              <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Total Estimasi</th>
              <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginatedItems.length === 0 ? (
               <tr><td colSpan="7" className="text-center p-8 text-gray-400 font-bold">Belum ada data Draft / Pesanan Pending</td></tr>
            ) : paginatedItems.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors text-xs md:text-sm">
                <td className="p-4 font-bold text-gray-500 whitespace-nowrap">{formatDisplayDate(item.createdAt)}</td>
                <td className="p-4">
                  <p className="text-[10px] text-gray-500 font-bold uppercase truncate max-w-[120px]">{item.storeName || 'Pusat'}</p>
                </td>
                <td className="p-4 font-black text-gray-800 uppercase">{item.customerName || 'Umum'}</td>
                <td className="p-4">
                  <span className="px-2 py-1 text-[9px] font-black uppercase rounded-lg bg-orange-100 text-orange-600">
                    {item.transactionStatus}
                  </span>
                </td>
                <td className="p-4 font-bold text-gray-600 max-w-[200px] truncate">
                  {item.items ? item.items.map(i => `${i.qty}x ${i.name}`).join(', ') : '-'}
                </td>
                <td className="p-4 font-black text-right text-gray-700 whitespace-nowrap">
                  Rp {(Number(item.subtotal) || Number(item.total) || 0).toLocaleString('id-ID')}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => onViewDraftNota(item)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg" title="Lihat Nota"><Eye className="w-4 h-4"/></button>
                    <button onClick={() => onApproveDraft(item)} className="p-2 text-green-500 hover:bg-green-50 rounded-lg" title="Setujui (ACC)"><CheckCircle className="w-4 h-4"/></button>
                    <button onClick={() => onEditDraft(item)} className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg" title="Edit Draft"><Edit3 className="w-4 h-4"/></button>
                    <button onClick={() => onDeleteDraft(item)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Hapus Draft"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginationComponent}
    </div>
  );
};

export default TabDrafts;
