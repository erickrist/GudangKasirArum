import { Eye, Edit3, Trash2 } from 'lucide-react';

const TabSales = ({ 
  paginatedItems, 
  formatDisplayDate, 
  onViewNota, 
  onEditTransaction, 
  onDeleteTransaction,
  paginationComponent 
}) => {
  return (
    <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden">
      <div className="overflow-x-auto w-full custom-scrollbar">
        <table className="w-full min-w-[800px] text-left">
          <thead>
            <tr className="bg-gray-50/50 border-b">
              <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th>
              <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Nota / Cabang</th>
              <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Nama Pembeli</th>
              <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Status</th>
              <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Item Dibeli</th>
              <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Total Belanja</th>
              <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginatedItems.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors text-xs md:text-sm">
                <td className="p-4 font-bold text-gray-500 whitespace-nowrap">{formatDisplayDate(item.createdAt)}</td>
                <td className="p-4">
                  <p className="font-black text-teal-600 uppercase">#{item.id?.substring(0,6)}</p>
                  <p className="text-[9px] text-gray-500 font-bold uppercase truncate max-w-[120px]">{item.storeName || 'Pusat'}</p>
                </td>
                <td className="p-4 font-black text-gray-800 uppercase">{item.customerName || 'Umum'}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 text-[9px] font-black uppercase rounded-lg ${item.paymentStatus === 'HUTANG' ? 'bg-orange-100 text-orange-600' : 'bg-teal-100 text-teal-600'}`}>
                    {item.paymentStatus || 'LUNAS'}
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
                    <button onClick={() => onViewNota(item)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg" title="Lihat Nota"><Eye className="w-4 h-4"/></button>
                    <button onClick={() => onEditTransaction(item)} className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg" title="Edit Transaksi"><Edit3 className="w-4 h-4"/></button>
                    <button onClick={() => onDeleteTransaction(item)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Hapus Data"><Trash2 className="w-4 h-4"/></button>
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

export default TabSales;