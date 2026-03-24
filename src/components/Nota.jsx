import React, { useRef } from 'react';
import { X, Printer } from 'lucide-react';

const Nota = ({ transaction, onClose }) => {
  const printRef = useRef();

  // Helper untuk menangani tanggal agar tidak "Invalid Date"
  const getFormattedDate = (dateSource) => {
    if (!dateSource) return '-';
    try {
      // Jika dari Firestore Timestamp
      if (dateSource.toDate && typeof dateSource.toDate === 'function') {
        return dateSource.toDate().toLocaleString('id-ID');
      }
      // Jika objek Date atau string
      const date = new Date(dateSource);
      return isNaN(date.getTime()) ? '-' : date.toLocaleString('id-ID');
    } catch (e) {
      return '-';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!transaction) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        {/* Header Modal (Tidak Ikut Terprint) */}
        <div className="flex justify-between items-center p-4 border-b no-print">
          <h3 className="font-bold text-gray-800">Detail Nota</h3>
          <div className="flex gap-2">
            <button 
              onClick={handlePrint}
              className="p-2 bg-teal-600 text-white rounded-full hover:bg-teal-700 transition-colors"
              title="Cetak Nota"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Konten Nota (Area yang akan di-print) */}
        <div id="printable-nota" className="p-8 text-sm leading-relaxed text-gray-800" ref={printRef}>
          {/* Judul Toko */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold uppercase tracking-widest">TOKO SAYA</h2>
            <p className="text-xs text-gray-500">Jl. Contoh Alamat No. 123, Kota Anda</p>
            <p className="text-xs text-gray-500">Telp: 0812-3456-7890</p>
          </div>

          <hr className="border-dashed border-gray-300 my-4" />

          {/* Info Transaksi */}
          <div className="grid grid-cols-2 gap-2 text-xs mb-6">
            <div>
              <p><span className="font-semibold">No. Nota:</span> #{transaction.id?.slice(-6).toUpperCase() || '-'}</p>
              <p><span className="font-semibold">Tanggal:</span> {getFormattedDate(transaction.createdAt)}</p>
            </div>
            <div className="text-right">
              <p><span className="font-semibold">Pembeli:</span> {transaction.customerName || '-'}</p>
              <p><span className="font-semibold">Status:</span> {transaction.paymentStatus || 'LUNAS'}</p>
            </div>
          </div>

          {/* Tabel Barang */}
          <table className="w-full text-xs mb-6">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="text-left py-2">Item</th>
                <th className="text-center py-2">Qty</th>
                <th className="text-right py-2">Harga</th>
                <th className="text-right py-2">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transaction.items?.map((item, index) => (
                <tr key={index}>
                  <td className="py-2">
                    <p className="font-medium">{item.name}</p>
                    {item.discount > 0 && <p className="text-[10px] text-red-500">Disc: -Rp {item.discount.toLocaleString('id-ID')}</p>}
                  </td>
                  <td className="text-center py-2">{item.qty} {item.unitType || 'Pcs'}</td>
                  <td className="text-right py-2">{item.price?.toLocaleString('id-ID')}</td>
                  <td className="text-right py-2 font-semibold">
                    {((item.price * item.qty) - (item.discount || 0)).toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Ringkasan Biaya */}
          <div className="space-y-1 text-sm border-t border-gray-800 pt-4">
            <div className="flex justify-between">
              <span>Total Penjualan:</span>
              <span>Rp {transaction.subtotal?.toLocaleString('id-ID')}</span>
            </div>
            {transaction.returnUsed > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Potongan Retur:</span>
                <span>-Rp {transaction.returnUsed.toLocaleString('id-ID')}</span>
              </div>
            )}
            {transaction.debtPaid > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>Bayar Hutang:</span>
                <span>+Rp {transaction.debtPaid.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t-2 border-double border-gray-800 mt-2 pt-1">
              <span>TOTAL AKHIR:</span>
              <span>Rp {transaction.total?.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Footer Nota */}
          <div className="mt-10 text-center text-xs space-y-1 italic text-gray-500">
            <p>Terima kasih telah berbelanja!</p>
            <p>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.</p>
          </div>
        </div>
      </div>

      {/* CSS Khusus Print (Inline) */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #printable-nota, #printable-nota * { visibility: visible; }
          #printable-nota { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%;
            padding: 0;
            margin: 0;
          }
          .no-print { display: none !important; }
        }
      `}} />
    </div>
  );
};

export default Nota;