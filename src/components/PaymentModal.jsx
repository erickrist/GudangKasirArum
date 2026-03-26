import { useState } from 'react';
import { X, AlertCircle as AlertCircle, CheckCircle as CheckCircle } from 'lucide-react';

const PaymentModal = ({ transaction, customer, onConfirm, onCancel }) => {
  const [paymentData, setPaymentData] = useState({
    status: 'LUNAS',
    method: 'TUNAI',
    useReturn: false,
    returnAmount: 0,
    collectDebt: false,
    debtAmount: 0,
  });

  const calculateFinalTotal = () => {
    let total = transaction.total;

    if (paymentData.useReturn && paymentData.returnAmount > 0) {
      total -= paymentData.returnAmount;
    }

    if (paymentData.collectDebt && paymentData.debtAmount > 0) {
      total += paymentData.debtAmount;
    }

    if (paymentData.status === 'HUTANG') {
      total = Math.max(0, total);
    }

    return Math.max(0, total);
  };

  const calculateDebtChange = () => {
    const newDebtFromTransaction = transaction.total - (paymentData.useReturn ? paymentData.returnAmount : 0);
    const oldDebtCollected = paymentData.collectDebt ? paymentData.debtAmount : 0;
    return Math.max(0, newDebtFromTransaction - oldDebtCollected);
  };

  const handleConfirm = () => {
    if (paymentData.useReturn && paymentData.returnAmount > customer.returnAmount) {
      alert('Saldo retur tidak cukup');
      return;
    }

    if (paymentData.collectDebt && paymentData.debtAmount > customer.remainingDebt) {
      alert('Hutang yang ditagih melebihi sisa hutang');
      return;
    }

    const debtChange = paymentData.status === 'HUTANG' ? calculateDebtChange() : -(paymentData.collectDebt ? paymentData.debtAmount : 0);
    const returnUsed = paymentData.useReturn ? paymentData.returnAmount : 0;

    onConfirm({
      ...paymentData,
      debtChange,
      returnUsed,
    });
  };

  const handleUseAllReturn = () => {
    setPaymentData({
      ...paymentData,
      useReturn: true,
      returnAmount: Math.min(customer.returnAmount, transaction.total),
    });
  };

  const handleCollectAllDebt = () => {
    setPaymentData({
      ...paymentData,
      collectDebt: true,
      debtAmount: customer.remainingDebt,
    });
  };

  const finalTotal = calculateFinalTotal();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-[110] p-0 md:p-4">
      {/* Di HP modal muncul dari bawah dan border-radius diatur. Di PC modal di tengah */}
      <div className="bg-white rounded-t-[32px] md:rounded-[32px] p-5 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl animate-slide-up md:animate-none">
        
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
          <h3 className="text-xl md:text-2xl font-black text-gray-800 uppercase tracking-tighter">Proses Pembayaran</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 p-2 rounded-xl transition-colors">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {/* Di HP 1 kolom, di PC 2 kolom */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <p className="text-[10px] md:text-xs font-black text-blue-600 uppercase tracking-widest mb-1">Pembeli</p>
            <p className="font-black text-gray-800 uppercase">{customer.name}</p>
          </div>
          <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100">
            <p className="text-[10px] md:text-xs font-black text-teal-600 uppercase tracking-widest mb-1">Total Belanja</p>
            <p className="text-lg md:text-xl font-black text-teal-700">Rp {transaction.total.toLocaleString('id-ID')}</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {customer.returnAmount > 0 && (
            <div className="border border-green-200 bg-green-50 p-4 rounded-2xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2">
                <div>
                  <p className="font-black text-green-800 text-sm md:text-base uppercase">Saldo Retur (Deposit)</p>
                  <p className="text-xs font-bold text-green-600">Tersedia: Rp {customer.returnAmount.toLocaleString('id-ID')}</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-green-200 shadow-sm">
                  <input
                    type="checkbox"
                    checked={paymentData.useReturn}
                    onChange={(e) =>
                      setPaymentData({
                        ...paymentData,
                        useReturn: e.target.checked,
                        returnAmount: e.target.checked
                          ? Math.min(customer.returnAmount, transaction.total)
                          : 0,
                      })
                    }
                    className="w-4 h-4 accent-green-600 rounded"
                  />
                  <span className="text-xs font-black text-green-700 uppercase">Gunakan</span>
                </label>
              </div>
              {paymentData.useReturn && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="number"
                    min="0"
                    max={Math.min(customer.returnAmount, transaction.total)}
                    value={paymentData.returnAmount}
                    onChange={(e) =>
                      setPaymentData({
                        ...paymentData,
                        returnAmount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="flex-1 px-4 py-3 border-none bg-white rounded-xl text-sm font-black focus:ring-2 focus:ring-green-500 outline-none text-green-700 shadow-sm"
                  />
                  <button
                    onClick={handleUseAllReturn}
                    className="px-4 py-3 bg-green-600 text-white font-black uppercase text-xs rounded-xl hover:bg-green-700 transition-colors shadow-sm"
                  >
                    Maks
                  </button>
                </div>
              )}
            </div>
          )}

          {customer.remainingDebt > 0 && (
            <div className="border border-orange-200 bg-orange-50 p-4 rounded-2xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2">
                <div>
                  <p className="font-black text-orange-800 text-sm md:text-base uppercase">Tagih Sisa Hutang</p>
                  <p className="text-xs font-bold text-orange-600">Total Hutang: Rp {customer.remainingDebt.toLocaleString('id-ID')}</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-orange-200 shadow-sm">
                  <input
                    type="checkbox"
                    checked={paymentData.collectDebt}
                    onChange={(e) =>
                      setPaymentData({
                        ...paymentData,
                        collectDebt: e.target.checked,
                        debtAmount: e.target.checked ? customer.remainingDebt : 0,
                      })
                    }
                    className="w-4 h-4 accent-orange-600 rounded"
                  />
                  <span className="text-xs font-black text-orange-700 uppercase">Tagih</span>
                </label>
              </div>
              {paymentData.collectDebt && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="number"
                    min="0"
                    max={customer.remainingDebt}
                    value={paymentData.debtAmount}
                    onChange={(e) =>
                      setPaymentData({
                        ...paymentData,
                        debtAmount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="flex-1 px-4 py-3 border-none bg-white rounded-xl text-sm font-black focus:ring-2 focus:ring-orange-500 outline-none text-orange-700 shadow-sm"
                  />
                  <button
                    onClick={handleCollectAllDebt}
                    className="px-4 py-3 bg-orange-600 text-white font-black uppercase text-xs rounded-xl hover:bg-orange-700 transition-colors shadow-sm"
                  >
                    Semua
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="border border-gray-200 bg-gray-50 p-4 md:p-5 rounded-2xl shadow-sm">
            <p className="font-black text-gray-800 mb-3 uppercase tracking-tighter text-sm md:text-base">Status Pembayaran</p>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center justify-center p-3 md:p-4 rounded-xl cursor-pointer font-black transition-all ${paymentData.status === 'LUNAS' ? 'bg-teal-600 text-white shadow-lg shadow-teal-100' : 'bg-white border border-gray-200 text-gray-500'}`}>
                <input
                  type="radio"
                  name="status"
                  value="LUNAS"
                  checked={paymentData.status === 'LUNAS'}
                  onChange={(e) => setPaymentData({ ...paymentData, status: e.target.value })}
                  className="hidden"
                />
                LUNAS
              </label>
              <label className={`flex items-center justify-center p-3 md:p-4 rounded-xl cursor-pointer font-black transition-all ${paymentData.status === 'HUTANG' ? 'bg-orange-600 text-white shadow-lg shadow-orange-100' : 'bg-white border border-gray-200 text-gray-500'}`}>
                <input
                  type="radio"
                  name="status"
                  value="HUTANG"
                  checked={paymentData.status === 'HUTANG'}
                  onChange={(e) => setPaymentData({ ...paymentData, status: e.target.value })}
                  className="hidden"
                />
                HUTANG
              </label>
            </div>

            {paymentData.status === 'LUNAS' && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-[10px] md:text-xs font-black text-gray-400 uppercase mb-2 tracking-widest">Pilih Metode Transfer</p>
                <div className="grid grid-cols-3 gap-2">
                  {['TUNAI', 'TRANSFER', 'QRIS'].map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentData({ ...paymentData, method })}
                      className={`px-2 py-3 md:py-4 rounded-xl text-[10px] md:text-xs font-black transition-all uppercase tracking-widest ${
                        paymentData.method === method
                          ? 'bg-gray-800 text-white shadow-md'
                          : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-800'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-800 p-5 md:p-6 rounded-2xl mb-6 space-y-3 shadow-lg">
          <div className="flex justify-between text-xs md:text-sm font-bold text-gray-300">
            <span>Total Belanja:</span>
            <span>Rp {transaction.total.toLocaleString('id-ID')}</span>
          </div>

          {paymentData.useReturn && paymentData.returnAmount > 0 && (
            <div className="flex justify-between text-xs md:text-sm font-black text-green-400">
              <span>Kurang (Retur Deposit):</span>
              <span>- Rp {paymentData.returnAmount.toLocaleString('id-ID')}</span>
            </div>
          )}

          {paymentData.collectDebt && paymentData.debtAmount > 0 && (
            <div className="flex justify-between text-xs md:text-sm font-black text-orange-400">
              <span>Tambah (Bayar Hutang Lama):</span>
              <span>+ Rp {paymentData.debtAmount.toLocaleString('id-ID')}</span>
            </div>
          )}

          <div className="border-t border-gray-600 pt-3 flex justify-between items-center mt-2">
            <span className="font-black text-gray-400 uppercase tracking-widest text-[10px] md:text-xs">Uang yang harus dibayar</span>
            <span className="text-white text-2xl md:text-3xl font-black">Rp {finalTotal.toLocaleString('id-ID')}</span>
          </div>

          {paymentData.status === 'HUTANG' && (
             <div className="mt-3 bg-red-500/20 border border-red-500/50 p-3 rounded-xl text-center">
               <span className="text-red-200 font-bold text-xs">Nota ini akan masuk sebagai penambahan hutang.</span>
             </div>
          )}
        </div>

        {/* Tombol dirubah menjadi bertumpuk (flex-col) jika di HP agar tidak sempit */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onCancel}
            className="w-full sm:w-1/3 px-4 py-4 md:py-5 border border-gray-200 rounded-2xl hover:bg-gray-50 transition-colors font-black text-gray-500 uppercase tracking-widest text-xs md:text-sm"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            className="w-full sm:flex-1 px-4 py-4 md:py-5 bg-teal-600 text-white rounded-2xl hover:bg-teal-700 transition-colors font-black flex items-center justify-center gap-2 uppercase tracking-widest text-xs md:text-sm shadow-xl shadow-teal-100 active:scale-95"
          >
            <CheckCircle className="w-5 h-5" />
            Konfirmasi & Cetak Nota
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;