import { X, Printer } from 'lucide-react';

const Nota = ({ transaction, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const formatDate = (date) => {
    if (!date) return '-';

    try {
      let parsedDate;

      if (typeof date === 'object' && date.seconds) {
        parsedDate = new Date(date.seconds * 1000);
      } else {
        parsedDate = new Date(date);
      }

      if (isNaN(parsedDate.getTime())) return '-';

      return parsedDate.toLocaleString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (err) {
      return '-';
    }
  };

  const finalTotal = transaction.subtotal - transaction.returnUsed + transaction.debtPaid;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        
        {/* HEADER MODAL */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center print:hidden">
          <h3 className="text-lg font-semibold text-gray-800">Struk Transaksi</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors text-sm"
            >
              <Printer className="w-4 h-4" />
              Cetak
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* CONTENT NOTA */}
        <div
          className="p-8"
          id="nota-content"
          style={{ fontFamily: 'monospace', fontSize: '14px' }}
        >
          {/* KOP SURAT */}
          <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
            <h1 className="text-2xl font-bold text-teal-600 mb-1">ARSEN FROZEN FOOD</h1>
            <p className="text-sm text-gray-600 mt-2">Ciampea, Bogor 16620</p>
            <p className="text-sm text-gray-600">081410503012</p>
          </div>

          <div className="flex justify-between items-start border-b border-gray-800 mb-4 pb-4 text-sm">
            <div className="space-y-1">
              <p>
                <span className="inline-block w-20 font-semibold">No. Struk</span>
                <span>: #{transaction.id?.substring(0, 8).toUpperCase()}</span>
              </p>
              <p>
                <span className="inline-block w-20 font-semibold">Tanggal</span>
                <span>: {formatDate(transaction.createdAt)}</span>
              </p>
              <p>
                <span className="inline-block w-20 font-semibold">Cabang</span>
                <span className="font-bold uppercase">: {transaction.storeName || 'CABANG PUSAT / UTAMA'}</span>
              </p>
            </div>

            <div className="space-y-1 text-right max-w-[50%]">
              <p className="font-semibold text-gray-800 uppercase">
                Pelanggan: {transaction.customerName}
              </p>
              {transaction.customerPhone && <p>Nomor HP :{transaction.customerPhone}</p>}
              {transaction.customerAddress && (
                <p className="break-words text-xs text-gray-800">
                  Alamat :{transaction.customerAddress}
                </p>
              )}
            </div>
          </div>

          {/* DAFTAR ITEM BARANG */}
          <div className="mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-1 px-1">Produk</th>
                  <th className="text-center py-1 px-1 w-10">Qty</th>
                  <th className="text-center py-1 px-1 w-16">Satuan</th>
                  <th className="text-center py-1 px-1 w-16">Isi</th>
                  <th className="text-right py-1 px-1 w-20">Harga</th>
                  <th className="text-right py-1 px-1 w-16">Diskon</th>
                  <th className="text-right py-1 px-1 w-24">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {transaction.items.map((item, index) => {
                  // FIX: Menangkap Satuan Dasar KG atau PCS dari Database
                  const displayBaseUnit = item.baseUnit || 'PCS';
                  
                  return (
                    <tr key={index} className="border-b border-gray-200">
                      <td className="py-1 px-1">{item.name}</td>
                      <td className="text-center py-1 px-1">{item.qty}</td>
                      <td className="text-center py-1 px-1">{item.unitType}</td>
                      
                      <td className="text-center py-1 px-1 text-gray-600 uppercase">
                        {['KARTON', 'BALL', 'IKAT', 'RENCENG', 'BOX'].includes(item.unitType?.toUpperCase()) 
                          ? `(${item.pcsPerCarton} ${displayBaseUnit})` 
                          : '-'}
                      </td>
                      
                      <td className="text-right py-1 px-1">
                        {item.price.toLocaleString('id-ID')}
                      </td>
                      <td className="text-right py-1 px-1">
                        {(item.discount || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="text-right py-1 px-1 font-semibold">
                        {item.subtotal.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* TOTAL & SUMMARY */}
          <div className="border-t-2 border-gray-800 pt-4 space-y-1 text-sm w-full md:w-1/2 ml-auto">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold">{transaction.subtotal.toLocaleString('id-ID')}</span>
            </div>

            {transaction.returnUsed > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Retur Digunakan</span>
                <span>-{transaction.returnUsed.toLocaleString('id-ID')}</span>
              </div>
            )}

            {transaction.debtPaid > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>Hutang Dibayar</span>
                <span>+{transaction.debtPaid.toLocaleString('id-ID')}</span>
              </div>
            )}

            <div className="border-t border-gray-800 pt-2 mt-2 flex justify-between font-bold items-center">
              <span>TOTAL BAYAR</span>
              <span className="text-xl">
                Rp {finalTotal.toLocaleString('id-ID')}
              </span>
            </div>

            {transaction.paymentStatus === 'LUNAS' && (
              <div className="flex justify-between text-xs text-gray-600 mt-2">
                <span>Metode Pembayaran</span>
                <span>{transaction.paymentMethod || 'TUNAI'}</span>
              </div>
            )}

            {transaction.paymentStatus === 'HUTANG' && (
              <div className="flex justify-between text-orange-600 font-semibold mt-2">
                <span>STATUS</span>
                <span>HUTANG</span>
              </div>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-gray-300 text-center space-y-1 text-xs">
            <p className="font-bold text-sm">Terima kasih atas pembelian Anda!</p>
            <p className="text-gray-500">
              Barang yang sudah dibeli tidak dapat dikembalikan kecuali ada kesalahan dari pihak kami.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0;
          }

          html, body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          body * {
            visibility: hidden;
          }

          #nota-content, #nota-content * {
            visibility: visible;
          }

          #nota-content {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            padding: 10mm; 
          }

          .flex-col-reverse {
            display: none !important;
          }

          .fixed {
            position: static !important;
          }

          .max-h-\\[90vh\\],
          .overflow-y-auto {
            max-height: none !important;
            overflow: visible !important;
          }

          .print\\:hidden {
            display: none !important;
          }

          tr {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
};

export default Nota;