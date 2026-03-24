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
  const change = paymentData.status === 'LUNAS' ? Math.max(0, finalTotal - transaction.total) : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-semibold text-gray-800">Proses Pembayaran</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Pembeli</p>
            <p className="font-semibold text-gray-800">{customer.name}</p>
          </div>
          <div className="bg-teal-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Belanja</p>
            <p className="font-semibold text-teal-600">Rp {transaction.total.toLocaleString('id-ID')}</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {customer.returnAmount > 0 && (
            <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-800">Saldo Retur</p>
                  <p className="text-sm text-gray-600">Rp {customer.returnAmount.toLocaleString('id-ID')}</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
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
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Gunakan</span>
                </label>
              </div>
              {paymentData.useReturn && (
                <div className="flex gap-2">
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
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleUseAllReturn}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition-colors"
                  >
                    Semua
                  </button>
                </div>
              )}
            </div>
          )}

          {customer.remainingDebt > 0 && (
            <div className="border-l-4 border-orange-500 bg-orange-50 p-4 rounded">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-800">Sisa Hutang</p>
                  <p className="text-sm text-gray-600">Rp {customer.remainingDebt.toLocaleString('id-ID')}</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
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
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Tagih</span>
                </label>
              </div>
              {paymentData.collectDebt && (
                <div className="flex gap-2">
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
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleCollectAllDebt}
                    className="px-3 py-2 bg-orange-100 text-orange-700 rounded text-sm hover:bg-orange-200 transition-colors"
                  >
                    Semua
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="border-l-4 border-teal-500 bg-teal-50 p-4 rounded">
            <p className="font-semibold text-gray-800 mb-3">Status Pembayaran</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="LUNAS"
                  checked={paymentData.status === 'LUNAS'}
                  onChange={(e) => setPaymentData({ ...paymentData, status: e.target.value })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Lunas</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="HUTANG"
                  checked={paymentData.status === 'HUTANG'}
                  onChange={(e) => setPaymentData({ ...paymentData, status: e.target.value })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Hutang</span>
              </label>
            </div>

            {paymentData.status === 'LUNAS' && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">Metode Pembayaran</p>
                <div className="grid grid-cols-3 gap-2">
                  {['TUNAI', 'TRANSFER', 'QRIS'].map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentData({ ...paymentData, method })}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                        paymentData.method === method
                          ? 'bg-teal-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:border-teal-500'
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

        <div className="bg-gray-50 p-4 rounded-lg mb-6 space-y-2 border border-gray-200">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Belanja:</span>
            <span className="font-semibold">Rp {transaction.total.toLocaleString('id-ID')}</span>
          </div>

          {paymentData.useReturn && paymentData.returnAmount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Kurang (Retur):</span>
              <span>-Rp {paymentData.returnAmount.toLocaleString('id-ID')}</span>
            </div>
          )}

          {paymentData.collectDebt && paymentData.debtAmount > 0 && (
            <div className="flex justify-between text-sm text-orange-600">
              <span>Tambah (Tagih Hutang):</span>
              <span>+Rp {paymentData.debtAmount.toLocaleString('id-ID')}</span>
            </div>
          )}

          <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
            <span>Total Pembayaran:</span>
            <span className="text-teal-600 text-lg">Rp {finalTotal.toLocaleString('id-ID')}</span>
          </div>

          {paymentData.status === 'HUTANG' && (
            <div className="mt-2 p-2 bg-orange-100 border border-orange-200 rounded">
              <p className="text-sm text-orange-800">
                {/* //**<span className="font-semibold">Hutang yang Ditambahkan:</span> Rp {calculateDebtChange().toLocaleString('id-ID')} */}
              </p>
              <p className="text-xs text-orange-700 mt-1">
                Total Sisa Nota Pembeli: Rp {(customer.remainingDebt + calculateDebtChange()).toLocaleString('id-ID')}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-semibold flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Proses Pembayaran
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
