import { X, Printer } from 'lucide-react';

const Nota = ({ transaction, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  // ✅ FIX INVALID DATE (support semua format)
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

  const totalDiscount = transaction.items.reduce(
    (sum, item) => sum + (item.discount || 0),
    0
  );

  const finalTotal =
    transaction.subtotal -
    totalDiscount -
    transaction.returnUsed +
    transaction.debtPaid;

  const change =
    transaction.paymentStatus === 'LUNAS'
      ? Math.max(0, transaction.total - transaction.subtotal)
      : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        
        {/* HEADER */}
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

        {/* CONTENT */}
        <div
          className="p-8"
          id="nota-content"
          style={{ fontFamily: 'monospace', fontSize: '14px' }}
        >
          <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
            <h1 className="text-2xl font-bold text-teal-600 mb-1">ARSEN FROZEN FOOD</h1>
            <p className="text-sm text-gray-600">Ciampea, Bogor 16620</p>
            <p className="text-sm text-gray-600"> 081410503012</p>
          </div>

          <div className="mb-4 space-y-1 text-sm">
            <p>
              <span className="inline-block w-24">No. Struk</span>
              <span>: #{transaction.id?.substring(0, 8).toUpperCase()}</span>
            </p>
            <p>
              <span className="inline-block w-24">Tanggal</span>
              <span>: {formatDate(transaction.createdAt)}</span>
            </p>
          </div>

          <div className="border-b border-gray-800 mb-4 pb-4 space-y-1 text-sm">
            <p className="font-semibold">PEMBELI</p>
            <p>{transaction.customerName}</p>
            {transaction.customerPhone && <p>Telp: {transaction.customerPhone}</p>}
            {transaction.customerAddress && (
              <p className="w-full break-words">
                Alamat: {transaction.customerAddress}
              </p>
            )}
          </div>

          <div className="mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 px-1">Produk</th>
                  <th className="text-center py-2 px-1 w-12">Qty</th>
                  <th className="text-center py-2 px-1 w-14">Satuan</th>
                  <th className="text-right py-2 px-1 w-20">Harga</th>
                  <th className="text-right py-2 px-1 w-20">Diskon</th>
                  <th className="text-right py-2 px-1 w-24">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {transaction.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-2 px-1">{item.name}</td>
                    <td className="text-center py-2 px-1">{item.qty}</td>
                    <td className="text-center py-2 px-1">
                      {item.unitType}
                      {['KARTON', 'BALL', 'IKAT'].includes(item.unitType) && (
                        <span className="text-sm block">
                          ({item.qty * item.pcsPerCarton}pcs)
                        </span>
                      )}
                    </td>
                    <td className="text-right py-2 px-1">
                      {item.price.toLocaleString('id-ID')}
                    </td>
                    <td className="text-right py-2 px-1">
                      {(item.discount || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="text-right py-2 px-1 font-semibold">
                      {item.subtotal.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t-2 border-gray-800 pt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{transaction.subtotal.toLocaleString('id-ID')}</span>
            </div>

            {totalDiscount > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Diskon Total</span>
                <span>-{totalDiscount.toLocaleString('id-ID')}</span>
              </div>
            )}

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

            <div className="border-t border-gray-800 pt-2 mt-2 flex justify-between font-bold">
              <span>TOTAL BAYAR</span>
              <span className="text-xl">
                Rp {finalTotal.toLocaleString('id-ID')}
              </span>
            </div>

            {transaction.paymentStatus === 'LUNAS' && (
              <div className="flex justify-between">
                <span>Metode</span>
                <span>{transaction.paymentMethod || 'TUNAI'}</span>
              </div>
            )}

            {transaction.paymentStatus === 'HUTANG' && (
              <div className="flex justify-between text-orange-600 font-semibold">
                <span>STATUS</span>
                <span>HUTANG</span>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-300 text-center space-y-1 text-sm">
            <p className="font-semibold">Terima kasih atas pembelian Anda!</p>
            <p className="text-gray-600">
              Barang yang sudah dibeli tidak dapat dikembalikan kecuali ada kesalahan dari pihak kami
            </p>
          </div>
        </div>
      </div>

      {/* ✅ PRINT FIX (tanpa ubah UI) */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0;
          }

          body {
            margin: 0;
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
          }

          .fixed {
            position: static !important;
          }

          .print\\:hidden {
            display: none !important;
          }

          .max-h-\\[90vh\\],
          .overflow-y-auto {
            max-height: none !important;
            overflow: visible !important;
          }

          tr {
            page-break-inside: avoid;
          }

          thead {
            display: table-header-group;
          }
        }
      `}</style>
    </div>
  );
};

export default Nota;