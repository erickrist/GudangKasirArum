import React from 'react';
import { X, Printer } from 'lucide-react';

const terbilang = (angka) => {
  if (angka === 0) return "";
  const huruf = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let hasil = "";
  if (angka < 12) {
    hasil = huruf[angka];
  } else if (angka < 20) {
    hasil = terbilang(angka - 10) + " Belas";
  } else if (angka < 100) {
    hasil = terbilang(Math.floor(angka / 10)) + " Puluh " + terbilang(angka % 10);
  } else if (angka < 200) {
    hasil = "Seratus " + terbilang(angka - 100);
  } else if (angka < 1000) {
    hasil = terbilang(Math.floor(angka / 100)) + " Ratus " + terbilang(angka % 100);
  } else if (angka < 2000) {
    hasil = "Seribu " + terbilang(angka - 1000);
  } else if (angka < 1000000) {
    hasil = terbilang(Math.floor(angka / 1000)) + " Ribu " + terbilang(angka % 1000);
  } else if (angka < 1000000000) {
    hasil = terbilang(Math.floor(angka / 1000000)) + " Juta " + terbilang(angka % 1000000);
  } else if (angka < 1000000000000) {
    hasil = terbilang(Math.floor(angka / 1000000000)) + " Milyar " + terbilang(angka % 1000000000);
  }
  return hasil.replace(/\s+/g, ' ').trim();
};

const formatTerbilang = (angka) => {
  if (angka === 0) return "Nol Rupiah";
  return terbilang(angka) + " Rupiah";
};

const Nota = ({ transaction, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const formatDateShort = (date) => {
    if (!date) return '-';
    try {
      let parsedDate;
      if (typeof date === 'object' && date.seconds) {
        parsedDate = new Date(date.seconds * 1000);
      } else {
        parsedDate = new Date(date);
      }
      if (isNaN(parsedDate.getTime())) return '-';
      return parsedDate.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (err) {
      return '-';
    }
  };

  const finalTotal = transaction.subtotal - (transaction.returnUsed || 0) + (transaction.debtPaid || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 print:static print:bg-transparent">
      <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl print:static print:overflow-visible print:max-h-none print:shadow-none">
        
        {/* HEADER MODAL */}
        <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center print:hidden z-20 shrink-0">
          <h3 className="text-xl font-bold text-gray-800">Cetak Struk Transaksi</h3>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-lg hover:bg-teal-700 transition-colors text-sm font-bold shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Cetak
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENT NOTA */}
        <div className="bg-gray-100 flex-1 relative print:bg-white overflow-y-auto p-6 print:p-0 print:static print:overflow-visible">
          <div 
            className="bg-white mx-auto shadow-md print:shadow-none transition-all duration-300 print-container print:w-full print:max-w-none print:absolute print:left-0 print:top-0 print:m-0"
            id="nota-container"
            style={{ 
              maxWidth: '9.5in',
            }}
          >
            <div
              className="p-4 w-full bg-white text-black"
              id="nota-content"
              style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12px' }}
            >
              {transaction.transactionStatus === 'DRAFT' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
                  <span className="text-6xl font-black text-gray-200 uppercase tracking-widest -rotate-12 opacity-50">DRAFT</span>
                </div>
              )}
              
              <div className="flex justify-between items-start mb-4">
                {/* Kiri - Header */}
                <div className="w-1/2 pr-4">
                  <h1 className="text-xl font-bold tracking-wide uppercase text-teal-600 mb-1">ARSEN FROZENFOOD</h1>
                  <p className="text-xs text-black">Jl. Raya Letnan Sukarna No.11<br/>CIAMPEA, BOGOR 16620<br/>081410503012</p>
                  
                  <div className="mt-4 border-b-2 border-black w-11/12"></div>
                  
                  <div className="mt-2 text-xs">
                    <p className="mb-1 text-black font-semibold">Kepada :</p>
                    <p className="font-bold uppercase text-black">{transaction.customerName}</p>
                    {transaction.customerAddress && <p className="uppercase text-black mt-1 leading-snug">{transaction.customerAddress}</p>}
                    {transaction.customerPhone && <p className="text-black mt-1">{transaction.customerPhone}</p>}
                  </div>
                </div>

                {/* Kanan - Header */}
                <div className="w-1/2 pl-4 flex flex-col items-end">
                  <h2 className="text-2xl font-extrabold mb-4 text-teal-700 tracking-tight uppercase">Invoice Penjualan</h2>
                  
                  <table className="w-full max-w-[340px] text-black border-[1.5px] border-black text-xs" style={{ borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr className="border-b-[1.5px] border-black border-dashed">
                        <td className="p-1.5 w-1/2 border-r-[1.5px] border-black border-dashed align-top">
                          <div className="text-xs mb-0.5">Tanggal</div>
                          <div className="font-bold">{formatDateShort(transaction.createdAt)}</div>
                        </td>
                        <td className="p-1.5 w-1/2 align-top pl-2">
                          <div className="text-xs mb-0.5">No Invoice</div>
                          <div className="font-bold">INV.{transaction.id?.substring(0, 8).toUpperCase()}</div>
                        </td>
                      </tr>
                      <tr className="border-b-[1.5px] border-black border-dashed">
                        <td className="p-1.5 w-1/2 border-r-[1.5px] border-black border-dashed align-top">
                          <div className="text-xs mb-0.5">Term</div>
                          <div className="font-bold">{transaction.paymentStatus === 'LUNAS' ? 'LUNAS' : 'HUTANG'}</div>
                        </td>
                        <td className="p-1.5 w-1/2 align-top pl-2">
                          <div className="text-xs mb-0.5">Jatuh Tempo</div>
                          <div className="font-bold">{transaction.paymentStatus === 'HUTANG' && transaction.dueDate ? formatDateShort(transaction.dueDate) : '-'}</div>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan="2" className="p-1.5 align-top">
                          <span className="text-xs">Driver</span> <span className="font-bold ml-1">{transaction.driverName || ''}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabel Barang */}
              <div className="mb-4 min-h-[300px]">
                <table className="w-full text-xs border-collapse border border-black text-black">
                  <thead>
                    <tr className="border-b-2 border-black text-center font-bold">
                      <th className="border border-black p-1 w-10">No</th>
                      <th className="border border-black p-1 text-left">Nama Barang</th>
                      <th className="border border-black p-1 w-20">Qty</th>
                      <th className="border border-black p-1 w-16">Isi</th>
                      <th className="border border-black p-1 w-24">@Harga</th>
                      <th className="border border-black p-1 w-20">Disc</th>
                      <th className="border border-black p-1 w-28">Total Harga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transaction.items.map((item, index) => {
                      const displayBaseUnit = item.baseUnit || 'PCS';
                      return (
                        <tr key={index} className="border-b border-black">
                          <td className="border-l border-r border-black p-1 text-center align-top">{index + 1}</td>
                          <td className="border-l border-r border-black p-1 align-top uppercase text-left">{item.name}</td>
                          <td className="border-l border-r border-black p-1 text-center align-top whitespace-nowrap">
                            {item.qty} {item.unitType}
                          </td>
                          <td className="border-l border-r border-black p-1 text-center align-top">
                            {['KARTON', 'BALL', 'IKAT', 'RENCENG', 'BOX'].includes(item.unitType?.toUpperCase()) 
                              ? `${item.pcsPerCarton || 1} ${displayBaseUnit}` 
                              : '-'}
                          </td>
                          <td className="border-l border-r border-black p-1 text-right align-top">
                            {item.price.toLocaleString('id-ID')}
                          </td>
                          <td className="border-l border-r border-black p-1 text-right align-top">
                            {(item.discount || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="border-l border-r border-black p-1 text-right align-top font-semibold">
                            {item.subtotal.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="flex justify-between items-start text-xs text-black">
                {/* Kiri - Terbilang, Keterangan, TTD */}
                <div className="w-[60%] pr-4">
                  <div className="flex border border-black mb-3 min-h-[32px] items-center">
                    <div className="p-1 px-2 border-r border-black whitespace-nowrap font-semibold">Terbilang :</div>
                    <div className="p-1 px-2 italic font-bold">{formatTerbilang(finalTotal)}</div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex-1 border border-black min-h-[100px] p-2 flex flex-col">
                      <span className="mb-1 font-semibold border-b border-black pb-1 inline-block w-fit">Keterangan :</span>
                      <span className="font-bold whitespace-pre-wrap">{transaction.note || ''}</span>
                    </div>
                    <div className="w-48 text-center flex flex-col justify-between pt-2">
                      <div className="font-bold">Disetujui Oleh</div>
                      <div className="mt-16 border-b border-black w-4/5 mx-auto"></div>
                    </div>
                  </div>
                </div>

                {/* Kanan - Rincian Total */}
                <div className="w-[40%]">
                  <div className="pt-2 space-y-1 w-full text-sm">
                    <div className="flex justify-between border-b border-dashed border-gray-400 pb-1">
                      <span>Subtotal</span>
                      <span className="font-bold">{transaction.subtotal.toLocaleString('id-ID')}</span>
                    </div>
                    
                    {transaction.returnUsed > 0 && (
                      <div className="flex justify-between text-black border-b border-dashed border-gray-400 pb-1">
                        <span>Retur Digunakan</span>
                        <span className="font-bold">-{transaction.returnUsed.toLocaleString('id-ID')}</span>
                      </div>
                    )}

                    {transaction.debtPaid > 0 && (
                      <div className="flex justify-between text-blue-600 border-b border-dashed border-gray-400 pb-1">
                        <span>Hutang Dibayar</span>
                        <span className="font-bold">+{transaction.debtPaid.toLocaleString('id-ID')}</span>
                      </div>
                    )}

                    <div className="pt-2 mt-2 flex justify-between font-bold items-center">
                      <span className="uppercase">Total Bayar</span>
                      <span className="text-lg">
                        Rp {finalTotal.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="flex justify-between font-bold mt-2 uppercase">
                      <span className="text-orange-600">Status</span>
                      <span className={transaction.paymentStatus === 'LUNAS' ? 'text-green-600' : 'text-orange-600'}>
                        {transaction.paymentStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Thank you note */}
              <div className="mt-8 pt-4 border-t border-gray-300 text-center space-y-1 text-xs">
                <p className="font-bold text-sm">Terima kasih atas pembelian Anda!</p>
                <p className="text-gray-500">
                  Barang yang sudah dibeli tidak dapat dikembalikan kecuali ada kesalahan dari pihak kami.
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            margin: 0;
          }

          html, body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }

          body * {
            visibility: hidden;
          }

          #nota-container, #nota-container * {
            visibility: visible;
          }

          #nota-container {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0.2in 0.5in !important;
            box-sizing: border-box !important;
          }

          #nota-content * {
            border-color: black !important;
            box-shadow: none !important;
            background-color: transparent !important;
          }

          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Nota;