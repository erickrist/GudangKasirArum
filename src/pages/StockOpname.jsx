import { useState, useRef } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Package, CircleArrowUp as ArrowUpCircle, CircleArrowDown as ArrowDownCircle, Upload, Download, Search } from 'lucide-react';
import { useCollection, addDocument, updateDocument, deleteDocument } from '../hooks/useFirestore';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import * as XLSX from 'xlsx';

const StockOpname = ({ onShowToast }) => {
  const { data: products, loading } = useCollection('products');
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [stockMode, setStockMode] = useState('in');
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // State untuk fitur pencarian
  const [searchTerm, setSearchTerm] = useState('');
  
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unitType: 'PCS',
    price: '',
    pcsPerCarton: '',
    stockPcs: '',
    image: '',
  });
  const [stockAmount, setStockAmount] = useState('');

  // Daftar tipe yang dianggap grosir (punya isi pcs)
  const WHOLESALE_TYPES = ['KARTON', 'BALL', 'IKAT'];

  // Logika filter produk berdasarkan nama atau kategori
  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      unitType: 'PCS',
      price: '',
      pcsPerCarton: '',
      stockPcs: '',
      image: '',
    });
  };

  const handleOpenModal = (mode, product = null) => {
    setModalMode(mode);
    if (mode === 'edit' && product) {
      setFormData(product);
      setSelectedProduct(product);
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isWholesale = WHOLESALE_TYPES.includes(formData.unitType);

    const productData = {
      ...formData,
      price: parseFloat(formData.price) || 0,
      stockPcs: parseInt(formData.stockPcs) || 0,
      // Jika tipe grosir gunakan pcsPerCarton, jika PCS paksa jadi 1
      pcsPerCarton: isWholesale ? parseInt(formData.pcsPerCarton) || 1 : 1,
    };

    let result;
    if (modalMode === 'add') {
      result = await addDocument('products', productData);
    } else {
      result = await updateDocument('products', selectedProduct.id, productData);
    }

    if (result.success) {
      onShowToast(
        modalMode === 'add' ? 'Produk berhasil ditambahkan' : 'Produk berhasil diperbarui',
        'success'
      );
      setShowModal(false);
      resetForm();
    } else {
      onShowToast('Gagal menyimpan produk', 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;

    const result = await deleteDocument('products', selectedProduct.id);
    if (result.success) {
      onShowToast('Produk berhasil dihapus', 'success');
      setShowDeleteModal(false);
      setSelectedProduct(null);
    } else {
      onShowToast('Gagal menghapus produk', 'error');
    }
  };

  const handleStockUpdate = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !stockAmount) return;

    const amount = parseInt(stockAmount);
    let newStockPcs = selectedProduct.stockPcs;
    
    // Cek apakah tipe produk saat ini adalah grosir
    const isWholesale = WHOLESALE_TYPES.includes(selectedProduct.unitType);
    const multiplier = isWholesale ? (selectedProduct.pcsPerCarton || 1) : 1;

    if (stockMode === 'in') {
      newStockPcs += amount * multiplier;
    } else {
      newStockPcs -= amount * multiplier;
    }

    if (newStockPcs < 0) {
      onShowToast('Stok tidak mencukupi', 'error');
      return;
    }

    const result = await updateDocument('products', selectedProduct.id, {
      stockPcs: newStockPcs,
    });

    if (result.success) {
      onShowToast(`Stok berhasil ${stockMode === 'in' ? 'ditambah' : 'dikurangi'}`, 'success');
      setShowStockModal(false);
      setStockAmount('');
      setSelectedProduct(null);
    } else {
      onShowToast('Gagal memperbarui stok', 'error');
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        Nama: 'Susu UHT 1L (Contoh KARTON)',
        Kategori: 'Minuman',
        TipeSatuan: 'KARTON',
        IsiPerUnit: 12,
        Harga: 150000,
        StokPcs: 120,
        UrlGambar: ''
      },
      {
        Nama: 'Kerupuk Kaleng (Contoh BALL)',
        Kategori: 'Makanan',
        TipeSatuan: 'BALL',
        IsiPerUnit: 20,
        Harga: 100000,
        StokPcs: 100,
        UrlGambar: ''
      },
      {
        Nama: 'Sawi Hijau (Contoh IKAT)',
        Kategori: 'Sayur',
        TipeSatuan: 'IKAT',
        IsiPerUnit: 5,
        Harga: 5000,
        StokPcs: 50,
        UrlGambar: ''
      },
      {
        Nama: 'Sabun Mandi (Contoh PCS)',
        Kategori: 'Kebersihan',
        TipeSatuan: 'PCS',
        IsiPerUnit: '',
        Harga: 5000,
        StokPcs: 10,
        UrlGambar: ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const colWidths = [{ wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 35 }];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template_Produk");
    XLSX.writeFile(workbook, "Template_Import_Produk.xlsx");
    onShowToast('Template Excel berhasil diunduh', 'success');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const excelData = XLSX.utils.sheet_to_json(worksheet);
        
        if (excelData.length === 0) {
          onShowToast('File Excel kosong', 'error');
          return;
        }

        let successCount = 0;
        for (const row of excelData) {
          if (!row.Nama) continue;
          const unit = row.TipeSatuan?.toUpperCase() || 'PCS';
          const isWholesale = WHOLESALE_TYPES.includes(unit);

          const productData = {
            name: row.Nama || '',
            category: row.Kategori || '',
            unitType: unit,
            price: parseFloat(row.Harga) || 0,
            pcsPerCarton: isWholesale ? (parseInt(row.IsiPerUnit) || 1) : 1,
            stockPcs: parseInt(row.StokPcs) || 0,
            image: row.UrlGambar || '',
          };

          const result = await addDocument('products', productData);
          if (result.success) successCount++;
        }
        onShowToast(`${successCount} produk berhasil diimpor`, 'success');
      } catch (error) {
        onShowToast('Gagal memproses file Excel', 'error');
      }
      e.target.value = null;
    };
    reader.readAsArrayBuffer(file);
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Daftar Produk</h3>
          <p className="text-sm text-gray-500 mt-1">Kelola data produk (PCS, Karton, Ball, Ikat)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleDownloadTemplate} className="flex items-center gap-2 bg-gray-100 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm">
            <Download className="w-4 h-4" /> Download Template
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm">
            <Upload className="w-4 h-4" /> Import Excel
          </button>
          <button onClick={() => handleOpenModal('add')} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors text-sm">
            <Plus className="w-4 h-4" /> Tambah Produk
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Cari nama atau kategori..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
          />
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <EmptyState title="Belum Ada Produk" description="Mulai tambahkan produk untuk mengelola stok" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">Produk "{searchTerm}" tidak ditemukan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              {product.image && <img src={product.image} alt={product.name} className="w-full h-48 object-cover" />}
              <div className="p-4">
                <h4 className="font-semibold text-gray-800 text-lg mb-1">{product.name}</h4>
                <p className="text-sm text-gray-500 mb-3">{product.category}</p>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Satuan</span>
                    <span className="text-sm font-semibold text-teal-600">{product.unitType}</span>
                  </div>
                  {WHOLESALE_TYPES.includes(product.unitType) && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Isi per {product.unitType}</span>
                      <span className="text-sm font-semibold">{product.pcsPerCarton} pcs</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Harga</span>
                    <span className="text-sm font-semibold">Rp {product.price.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Stok</span>
                    <span className={`text-sm font-semibold ${product.stockPcs < 10 ? 'text-red-600' : 'text-teal-600'}`}>
                      {product.stockPcs} pcs
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setSelectedProduct(product); setStockMode('in'); setShowStockModal(true); }} className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700">
                    <ArrowUpCircle className="w-4 h-4" /> Masuk
                  </button>
                  <button onClick={() => { setSelectedProduct(product); setStockMode('out'); setShowStockModal(true); }} className="flex-1 flex items-center justify-center gap-1 bg-orange-600 text-white px-3 py-2 rounded text-sm hover:bg-orange-700">
                    <ArrowDownCircle className="w-4 h-4" /> Keluar
                  </button>
                  <button onClick={() => handleOpenModal('edit', product)} className="bg-teal-600 text-white px-3 py-2 rounded text-sm hover:bg-teal-700">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setSelectedProduct(product); setShowDeleteModal(true); }} className="bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{modalMode === 'add' ? 'Tambah Produk' : 'Edit Produk'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <input type="text" required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Satuan</label>
                <select value={formData.unitType} onChange={(e) => setFormData({ ...formData, unitType: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="PCS">PCS</option>
                  <option value="KARTON">KARTON</option>
                  <option value="BALL">BALL</option>
                  <option value="IKAT">IKAT</option>
                </select>
              </div>
              {WHOLESALE_TYPES.includes(formData.unitType) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Isi PCS per {formData.unitType}</label>
                  <input type="number" required min="1" value={formData.pcsPerCarton} onChange={(e) => setFormData({ ...formData, pcsPerCarton: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Harga</label>
                <input type="number" required min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stok Awal (PCS)</label>
                <input type="number" required min="0" value={formData.stockPcs} onChange={(e) => setFormData({ ...formData, stockPcs: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Gambar (Opsional)</label>
                <input type="url" value={formData.image} onChange={(e) => setFormData({ ...formData, image: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Batal</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">{modalMode === 'add' ? 'Tambah' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStockModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">{stockMode === 'in' ? 'Barang Masuk' : 'Barang Keluar'}</h3>
            <form onSubmit={handleStockUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Produk</label>
                <input type="text" value={selectedProduct.name} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stok Saat Ini</label>
                <input type="text" value={`${selectedProduct.stockPcs} pcs`} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah ({selectedProduct.unitType})</label>
                <input type="number" required min="1" value={stockAmount} onChange={(e) => setStockAmount(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              {WHOLESALE_TYPES.includes(selectedProduct.unitType) && stockAmount && (
                <div className="bg-teal-50 p-3 rounded-lg text-sm text-teal-800">
                  = {parseInt(stockAmount) * selectedProduct.pcsPerCarton} pcs
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowStockModal(false); setStockAmount(''); }} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">Batal</button>
                <button type="submit" className={`flex-1 px-4 py-2 text-white rounded-lg ${stockMode === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                  {stockMode === 'in' ? 'Tambah Stok' : 'Kurangi Stok'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full text-center">
            <h3 className="text-lg font-semibold mb-2">Hapus Produk?</h3>
            <p className="text-gray-600 mb-6">Yakin ingin menghapus <strong>{selectedProduct?.name}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">Batal</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockOpname;