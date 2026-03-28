import { Plus, Minus, Trash2, DollarSign } from 'lucide-react';
import { useState, useEffect } from 'react';

const CartItem = ({ item, onUpdateQty, onRemove, onUpdateDiscount }) => {
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountValue, setDiscountValue] = useState(item.discount || 0);
  
  // State lokal untuk menampung ketikan Qty sementara
  const [inputValue, setInputValue] = useState(item.qty.toString());

  // Sinkronisasi inputValue dengan item.qty dari parent (Kasir.jsx)
  useEffect(() => {
    setInputValue(item.qty.toString());
  }, [item.qty]);

  const subtotal = item.price * item.qty - (item.discount || 0);

  const handleSaveDiscount = () => {
    onUpdateDiscount(item.productId, parseFloat(discountValue) || 0);
    setShowDiscount(false);
  };

  // Fungsi untuk menangani perubahan saat pengguna mengetik di input
  const handleInputChange = (e) => {
    // Hanya perbolehkan angka. Membiarkan input kosong ('') agar pengguna bisa menghapus angka 1 dan mengetik angka 20
    const val = e.target.value;
    if (val === '' || /^\d+$/.test(val)) {
      setInputValue(val);
    }
  };

  // Fungsi untuk mengirim nilai Qty ke parent (Kasir.jsx) setelah selesai mengetik
  const handleInputBlur = () => {
    let newQty = parseInt(inputValue, 10);
    
    // Jika input kosong atau 0 saat blur, kembalikan ke 1 (Atau Anda bisa set onRemove jika ingin dihapus)
    if (isNaN(newQty) || newQty < 1) {
      newQty = 1;
      setInputValue('1');
    }
    
    onUpdateQty(item.productId, newQty);
  };

  // Menangani penekanan tombol Enter pada input Qty
  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleInputBlur();
      e.target.blur(); // Hilangkan fokus dari input
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h4 className="font-semibold text-sm text-gray-800">{item.name}</h4>
          <p className="text-xs text-gray-500">
            {['KARTON', 'BALL', 'IKAT', 'RENCENG', 'BOX'].includes(item.unitType) && 
              `(${item.pcsPerCarton} pcs/${item.unitType.toLowerCase()})`
            }
          </p>
        </div>
        <button onClick={() => onRemove(item.productId)} className="text-red-600 hover:text-red-700">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdateQty(item.productId, item.qty - 1)}
              className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300"
            >
              <Minus className="w-3 h-3" />
            </button>
            
            {/* Input Qty yang sudah diperbaiki */}
            <input
              type="text" // Menggunakan text agar lebih mudah mengontrol regex dan input kosong
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className="w-12 text-center border rounded font-bold text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            />

            <button
              onClick={() => onUpdateQty(item.productId, item.qty + 1)}
              className="w-6 h-6 bg-teal-600 text-white rounded flex items-center justify-center hover:bg-teal-700"
            >
              <Plus className="w-3 h-3" />
            </button>
            <span className="text-xs text-gray-500">{item.unitType}</span>
          </div>
          <span className="text-sm font-semibold text-teal-600">
            Rp {(item.price * item.qty).toLocaleString('id-ID')}
          </span>
        </div>

        {(item.discount || 0) > 0 && (
          <div className="bg-orange-50 px-2 py-1 rounded flex justify-between items-center">
            <span className="text-xs text-orange-700 font-medium">Diskon:</span>
            <span className="text-xs text-orange-700 font-semibold">
              -Rp {item.discount.toLocaleString('id-ID')}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded">
          <span className="text-xs text-gray-600">Subtotal:</span>
          <span className="text-sm font-semibold text-gray-800">
            Rp {subtotal.toLocaleString('id-ID')}
          </span>
        </div>

        <button
          onClick={() => {
            setShowDiscount(!showDiscount);
            setDiscountValue(item.discount || 0);
          }}
          className="w-full text-xs text-teal-600 hover:text-teal-700 font-medium py-1 flex items-center justify-center gap-1"
        >
          <DollarSign className="w-3 h-3" />
          {showDiscount ? 'Sembunyikan Diskon' : 'Tambah Diskon'}
        </button>

        {showDiscount && (
          <div className="border-t border-gray-200 pt-2 mt-2 space-y-2">
            <input
              type="number"
              min="0"
              value={discountValue}
              onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
              placeholder="Nominal diskon"
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowDiscount(false)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveDiscount}
                className="flex-1 px-2 py-1 bg-teal-600 text-white rounded text-xs hover:bg-teal-700 transition-colors"
              >
                Simpan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartItem;