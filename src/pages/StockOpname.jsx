import { useState, useRef, useMemo } from 'react';
import { 
  Plus, CreditCard as Edit2, Trash2, Package, CircleArrowUp as ArrowUpCircle, 
  CircleArrowDown as ArrowDownCircle, Upload, Download, Search, 
  History, Calendar, Table as TableIcon, FileText, ChevronLeft, ChevronRight, ListFilter
} from 'lucide-react';
import { useCollection, addDocument, updateDocument, deleteDocument } from '../hooks/useFirestore';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const StockOpname = ({ onShowToast }) => {
  // --- DATA FETCHING ---
  const { data: products, loading: loadingProducts } = useCollection('products');
  const { data: transactions, loading: loadingTrans } = useCollection('transactions', 'createdAt');
  const { data: stockLogs, loading: loadingStockLogs } = useCollection('stock_logs', 'createdAt');

  // --- UI STATES ---
  const [activeTab, setActiveTab] = useState('products'); // 'products' atau 'history'
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const [modalMode, setModalMode] = useState('add');
  const [stockMode, setStockMode] = useState('in');
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // --- FILTER & PAGINATION STATES ---
  // Untuk Tab Produk
  const [searchProduct, setSearchProduct] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productsPerPage, setProductsPerPage] = useState(12);

  // Untuk Tab Histori
  const [searchHistory, setSearchHistory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPerPage, setHistoryPerPage] = useState(15);

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

  const WHOLESALE_TYPES = ['KARTON', 'BALL', 'IKAT'];

  // --- DATE HELPERS ---
  const getSafeDate = (dateSource) => {
    if (!dateSource) return new Date();
    try {
      if (typeof dateSource.toDate === 'function') return dateSource.toDate();
      if (dateSource.seconds) return new Date(dateSource.seconds * 1000);
      const date = new Date(dateSource);
      return isNaN(date.getTime()) ? new Date() : date;
    } catch (e) { return new Date(); }
  };

  const formatDisplayDate = (dateSource) => {
    const date = getSafeDate(dateSource);
    return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // --- LOGIKA MENGGABUNGKAN HISTORI STOK (MANUAL & PENJUALAN) ---
  const allStockHistory = useMemo(() => {
    let combinedLogs = [];

    // 1. Ambil dari Log Manual (Masuk / Keluar)
    stockLogs.forEach(log => {
      combinedLogs.push({
        id: log.id,
        createdAt: log.createdAt,
        productId: log.productId,
        productName: log.productName,
        type: log.type === 'in' ? 'MASUK' : 'KELUAR',
        amount: log.amount,
        unitType: log.unitType,
        totalPcs: log.totalPcs,
        note: log.note || `Update Manual`,
      });
    });

    // 2. Ambil dari Transaksi Kasir (Terjual)
    transactions.forEach(t => {
      t.items?.forEach(item => {
        combinedLogs.push({
          id: `${t.id}-${item.productId}`,
          createdAt: t.createdAt,
          productId: item.productId,
          productName: item.name,
          type: 'TERJUAL',
          amount: item.qty,
          unitType: item.unitType,
          totalPcs: item.qty * (item.pcsPerCarton || 1),
          note: `Terjual (Nota: #${t.id?.substring(0,6)}) - Pembeli: ${t.customerName}`,
        });
      });
    });

    return combinedLogs.sort((a, b) => getSafeDate(b.createdAt) - getSafeDate(a.createdAt));
  }, [stockLogs, transactions]);

  // --- FILTERING ---
  // Filter Produk
  const filteredProducts = useMemo(() => {
    return products.filter(product => 
      product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
      product.category.toLowerCase().includes(searchProduct.toLowerCase())
    );
  }, [products, searchProduct]);

  // Filter Histori
  const filteredHistory = useMemo(() => {
    return allStockHistory.filter(log => {
      const date = getSafeDate(log.createdAt);
      const matchesSearch = (log.productName || log.note || '').toLowerCase().includes(searchHistory.toLowerCase());
      let matchesDate = true;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59);
        matchesDate = date >= start && date <= end;
      }
      return matchesSearch && matchesDate;
    });
  }, [allStockHistory, searchHistory, startDate, endDate]);

  // --- ACTIONS ---
  const resetForm = () => {
    setFormData({ name: '', category: '', unitType: 'PCS', price: '', pcsPerCarton: '', stockPcs: '', image: '' });
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
      pcsPerCarton: isWholesale ? parseInt(formData.pcsPerCarton) || 1 : 1,
    };

    let result;
    if (modalMode === 'add') result = await addDocument('products', productData);
    else result = await updateDocument('products', selectedProduct.id, productData);

    if (result.success) {
      onShowToast(modalMode === 'add' ? 'Produk berhasil ditambahkan' : 'Produk berhasil diperbarui', 'success');
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

  // UPDATE: Mencatat log ke database saat update stok manual
  const handleStockUpdate = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !stockAmount) return;

    const amount = parseInt(stockAmount);
    let newStockPcs = selectedProduct.stockPcs;
    const isWholesale = WHOLESALE_TYPES.includes(selectedProduct.unitType);
    const multiplier = isWholesale ? (selectedProduct.pcsPerCarton || 1) : 1;
    const totalPcsAddedOrRemoved = amount * multiplier;

    if (stockMode === 'in') newStockPcs += totalPcsAddedOrRemoved;
    else newStockPcs -= totalPcsAddedOrRemoved;

    if (newStockPcs < 0) {
      onShowToast('Stok tidak mencukupi', 'error');
      return;
    }

    const result = await updateDocument('products', selectedProduct.id, { stockPcs: newStockPcs });

    if (result.success) {
      // SIMPAN LOG HISTORI
      await addDocument('stock_logs', {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: stockMode, // 'in' or 'out'
        amount: amount,
        unitType: selectedProduct.unitType,
        totalPcs: totalPcsAddedOrRemoved,
        note: `Stok Manual ${stockMode === 'in' ? 'Ditambah' : 'Dikurangi'}`,
        createdAt: new Date()
      });

      onShowToast(`Stok berhasil ${stockMode === 'in' ? 'ditambah' : 'dikurangi'}`, 'success');
      setShowStockModal(false);
      setStockAmount('');
      setSelectedProduct(null);
    } else {
      onShowToast('Gagal memperbarui stok', 'error');
    }
  };

  // --- IMPORT / EXPORT TEMPLATE ---
  const handleDownloadTemplate = () => {
    const templateData = [
      { Nama: 'Susu UHT 1L (Contoh KARTON)', Kategori: 'Minuman', TipeSatuan: 'KARTON', IsiPerUnit: 12, Harga: 150000, StokPcs: 120, UrlGambar: '' },
      { Nama: 'Kerupuk Kaleng (Contoh BALL)', Kategori: 'Makanan', TipeSatuan: 'BALL', IsiPerUnit: 20, Harga: 100000, StokPcs: 100, UrlGambar: '' },
      { Nama: 'Sawi Hijau (Contoh IKAT)', Kategori: 'Sayur', TipeSatuan: 'IKAT', IsiPerUnit: 5, Harga: 5000, StokPcs: 50, UrlGambar: '' },
      { Nama: 'Sabun Mandi (Contoh PCS)', Kategori: 'Kebersihan', TipeSatuan: 'PCS', IsiPerUnit: '', Harga: 5000, StokPcs: 10, UrlGambar: '' }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 35 }];
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
        const excelData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        if (excelData.length === 0) return onShowToast('File Excel kosong', 'error');

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
          
          if (result.success) {
            successCount++;
            // Log import stok awal
            if (productData.stockPcs > 0) {
              await addDocument('stock_logs', {
                productId: result.id,
                productName: productData.name,
                type: 'in',
                amount: productData.stockPcs,
                unitType: 'PCS',
                totalPcs: productData.stockPcs,
                note: `Import Excel (Stok Awal)`,
                createdAt: new Date()
              });
            }
          }
        }
        onShowToast(`${successCount} produk berhasil diimpor`, 'success');
      } catch (error) {
        onShowToast('Gagal memproses file Excel', 'error');
      }
      e.target.value = null;
    };
    reader.readAsArrayBuffer(file);
  };

  // --- EXPORT LAPORAN HISTORI STOK ---
  const handleDownloadHistoryExcel = () => {
    if (filteredHistory.length === 0) return onShowToast('Tidak ada data untuk diexport', 'error');
    
    const reportData = filteredHistory.map(log => ({
      'Tanggal & Jam': formatDisplayDate(log.createdAt),
      'Nama Barang': log.productName,
      'Status': log.type,
      'Jumlah': `${log.amount} ${log.unitType}`,
      'Total Keluar/Masuk (PCS)': log.totalPcs,
      'Keterangan Detail': log.note
    }));

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan_Histori_Stok");
    XLSX.writeFile(wb, `Laporan_Stok_${startDate||'Awal'}_sd_${endDate||'Sekarang'}.xlsx`);
  };

  const handleDownloadHistoryPDF = () => {
    if (filteredHistory.length === 0) return onShowToast('Tidak ada data untuk diexport', 'error');

    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Laporan Histori Keluar Masuk Barang`, 14, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${startDate || 'Semua Data'} s/d ${endDate || 'Sekarang'}`, 14, 21);

    const body = filteredHistory.map(log => [
      formatDisplayDate(log.createdAt),
      log.productName,
      log.type,
      `${log.amount} ${log.unitType}`,
      `${log.totalPcs} Pcs`,
      log.note
    ]);

    autoTable(doc, { 
      head: [['Tanggal & Jam', 'Nama Barang', 'Status', 'Jumlah', 'Total (PCS)', 'Keterangan']], 
      body, 
      startY: 28,
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 2) {
          if (data.cell.raw === 'MASUK') data.cell.styles.textColor = [0, 128, 0];
          if (data.cell.raw === 'KELUAR') data.cell.styles.textColor = [200, 100, 0];
          if (data.cell.raw === 'TERJUAL') data.cell.styles.textColor = [200, 0, 0];
        }
      }
    });
    doc.save(`Laporan_Stok_${Date.now()}.pdf`);
  };

  // --- PAGINATION COMPONENT ---
  const renderPagination = (listLength, currentPage, setPage, itemsPerPage, setItemsPerPage) => {
    const totalPages = Math.ceil(listLength / itemsPerPage);
    return (
      <div className="flex flex-col md:flex-row justify-between items-center p-4 bg-gray-50/50 border-t gap-4 rounded-b-3xl">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tampilkan:</span>
          <select 
            value={itemsPerPage} 
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
            className="bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-lg focus:ring-teal-500 focus:border-teal-500 px-3 py-2 outline-none shadow-sm cursor-pointer"
          >
            <option value={12}>12 Baris</option>
            <option value={24}>24 Baris</option>
            <option value={50}>50 Baris</option>
            <option value={100}>100 Baris</option>
            <option value={1000000}>Semua Data</option>
          </select>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-gray-500">
            Halaman <span className="text-teal-600 font-black">{currentPage}</span> dari <span className="text-gray-800 font-black">{totalPages || 1}</span>
            <span className="ml-2 text-[10px] uppercase tracking-widest">({listLength} Total Data)</span>
          </span>
          <div className="flex gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              disabled={currentPage === 1}
              className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 disabled:opacity-30 hover:bg-gray-50 hover:text-teal-600 transition-all shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 disabled:opacity-30 hover:bg-gray-50 hover:text-teal-600 transition-all shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loadingProducts || loadingTrans || loadingStockLogs) return <Loading />;

  // Slices for pagination
  const paginatedProducts = filteredProducts.slice((productPage - 1) * productsPerPage, productPage * productsPerPage);
  const paginatedHistory = filteredHistory.slice((historyPage - 1) * historyPerPage, historyPage * historyPerPage);

  return (
    <div className="pb-10 min-h-screen">
      
      {/* TABS NAVIGATION */}
      <div className="flex flex-wrap gap-2 mb-6 bg-white p-2 rounded-xl shadow-sm border overflow-x-auto custom-scrollbar">
        {[
          { id: 'products', label: 'Daftar Produk & Stok', icon: Package }, 
          { id: 'history', label: 'Laporan Histori Stok', icon: History }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)} 
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === tab.id ? 'bg-teal-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* --- TAB 1: DAFTAR PRODUK --- */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border shadow-sm gap-4">
            <div>
              <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2"><Package className="w-5 h-5 text-teal-600"/> Manajemen Produk</h3>
              <p className="text-xs text-gray-500 mt-1 font-bold">Kelola data dan jumlah stok fisik (PCS, Karton, Ball, Ikat)</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <button onClick={handleDownloadTemplate} className="flex-1 md:flex-none justify-center items-center gap-2 bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-100 transition-colors text-xs font-black shadow-sm">
                <Download className="w-4 h-4" /> Template Excel
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="flex-1 md:flex-none justify-center items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2.5 rounded-xl hover:bg-blue-100 transition-colors text-xs font-black shadow-sm">
                <Upload className="w-4 h-4" /> Import Data
              </button>
              <button onClick={() => handleOpenModal('add')} className="flex-1 md:flex-none justify-center items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl hover:bg-teal-700 transition-colors text-xs font-black shadow-md">
                <Plus className="w-4 h-4" /> Tambah Baru
              </button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border flex items-center shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Ketik nama atau kategori produk untuk mencari..."
                value={searchProduct}
                onChange={(e) => { setSearchProduct(e.target.value); setProductPage(1); }}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {products.length === 0 ? (
            <div className="bg-white rounded-3xl border shadow-sm p-10"><EmptyState title="Belum Ada Produk" description="Mulai tambahkan produk untuk mengelola stok" /></div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-3xl border shadow-sm p-10 text-center"><Package className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-bold">Produk tidak ditemukan</p></div>
          ) : (
            <div className="bg-white rounded-[32px] border shadow-sm flex flex-col">
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginatedProducts.map((product) => (
                  <div key={product.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-teal-300 transition-all duration-300 flex flex-col">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-40 object-cover border-b border-gray-100" />
                    ) : (
                      <div className="w-full h-40 bg-gray-50 flex flex-col items-center justify-center border-b border-gray-100">
                         <Package className="w-10 h-10 text-gray-300 mb-2"/>
                         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tanpa Gambar</span>
                      </div>
                    )}
                    <div className="p-5 flex-1 flex flex-col">
                      <h4 className="font-black text-gray-800 text-base mb-1 uppercase tracking-tight line-clamp-2">{product.name}</h4>
                      <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-4 bg-teal-50 inline-block px-2 py-1 rounded-md self-start">{product.category}</p>
                      
                      <div className="space-y-2 mb-6 mt-auto">
                        <div className="flex justify-between items-center border-b border-dashed border-gray-100 pb-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Satuan Beli</span>
                          <span className="text-xs font-black text-gray-800 bg-gray-100 px-2 py-0.5 rounded">{product.unitType}</span>
                        </div>
                        {WHOLESALE_TYPES.includes(product.unitType) && (
                          <div className="flex justify-between items-center border-b border-dashed border-gray-100 pb-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Isi per {product.unitType}</span>
                            <span className="text-xs font-black text-gray-800">{product.pcsPerCarton} Pcs</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center border-b border-dashed border-gray-100 pb-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Harga Jual</span>
                          <span className="text-sm font-black text-teal-600">Rp {product.price.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total Stok Tersedia</span>
                          <span className={`text-lg font-black ${product.stockPcs < 10 ? 'text-red-600' : 'text-gray-800'}`}>
                            {product.stockPcs} <span className="text-[10px] text-gray-500 uppercase tracking-widest">Pcs</span>
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 mt-auto">
                        <button onClick={() => { setSelectedProduct(product); setStockMode('in'); setShowStockModal(true); }} className="col-span-2 flex items-center justify-center gap-1 bg-green-50 text-green-700 border border-green-200 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-green-600 hover:text-white transition-all shadow-sm">
                          <ArrowUpCircle className="w-3.5 h-3.5" /> Masuk
                        </button>
                        <button onClick={() => { setSelectedProduct(product); setStockMode('out'); setShowStockModal(true); }} className="col-span-2 flex items-center justify-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-orange-600 hover:text-white transition-all shadow-sm">
                          <ArrowDownCircle className="w-3.5 h-3.5" /> Keluar
                        </button>
                        <button onClick={() => handleOpenModal('edit', product)} className="col-span-2 flex items-center justify-center gap-1 bg-white border border-gray-200 text-gray-600 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-teal-50 hover:text-teal-600 hover:border-teal-200 transition-all shadow-sm mt-1">
                          <Edit2 className="w-3.5 h-3.5" /> Edit Data
                        </button>
                        <button onClick={() => { setSelectedProduct(product); setShowDeleteModal(true); }} className="col-span-2 flex items-center justify-center gap-1 bg-white border border-gray-200 text-gray-600 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all shadow-sm mt-1">
                          <Trash2 className="w-3.5 h-3.5" /> Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {renderPagination(filteredProducts.length, productPage, setProductPage, productsPerPage, setProductsPerPage)}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: LAPORAN HISTORI STOK --- */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-3xl border flex flex-col md:flex-row flex-wrap gap-4 items-center justify-between shadow-sm">
             <div>
                <h4 className="text-sm font-black text-gray-800">Cetak Laporan Pergerakan Stok</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Mencakup Barang Masuk, Keluar Manual, dan Terjual di Kasir</p>
             </div>
             <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200 flex-1 md:flex-none">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <input type="date" className="bg-transparent text-xs font-black outline-none w-full" value={startDate} onChange={e => {setStartDate(e.target.value); setHistoryPage(1);}} />
                  <span className="text-gray-300">-</span>
                  <input type="date" className="bg-transparent text-xs font-black outline-none w-full" value={endDate} onChange={e => {setEndDate(e.target.value); setHistoryPage(1);}} />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={handleDownloadHistoryExcel} className="flex-1 md:flex-none justify-center p-3 bg-green-50 text-green-700 rounded-xl border border-green-200 hover:bg-green-100 flex items-center gap-2 text-xs font-black shadow-sm"><TableIcon className="w-4 h-4" /> Excel</button>
                    <button onClick={handleDownloadHistoryPDF} className="flex-1 md:flex-none justify-center p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-200 hover:bg-blue-100 flex items-center gap-2 text-xs font-black shadow-sm"><FileText className="w-4 h-4" /> PDF</button>
                </div>
             </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border flex items-center shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Ketik nama barang atau keterangan untuk mencari log..."
                value={searchHistory}
                onChange={(e) => { setSearchHistory(e.target.value); setHistoryPage(1); }}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-[32px] border overflow-hidden shadow-sm flex flex-col">
            <div className="p-6 bg-gray-50/50 border-b"><h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2"><ListFilter className="text-teal-500 w-5 h-5"/> Data Detail Pergerakan Barang</h3></div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-white">
                  <th className="p-5 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th>
                  <th className="p-5 font-black text-gray-400 uppercase text-[10px]">Nama Barang</th>
                  <th className="p-5 font-black text-gray-400 uppercase text-[10px]">Kategori Log</th>
                  <th className="p-5 font-black text-gray-400 uppercase text-[10px] text-center">Jumlah Satuan</th>
                  <th className="p-5 font-black text-gray-400 uppercase text-[10px] text-right">Keterangan Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedHistory.length === 0 ? (
                  <tr><td colSpan="5" className="p-10 text-center text-gray-400 font-bold">Tidak ada histori ditemukan.</td></tr>
                ) : (
                  paginatedHistory.map(log => {
                    let badgeColor = '';
                    let symbol = '';
                    if (log.type === 'MASUK') { badgeColor = 'bg-green-100 text-green-700 border-green-200'; symbol = '+'; }
                    else if (log.type === 'KELUAR') { badgeColor = 'bg-orange-100 text-orange-700 border-orange-200'; symbol = '-'; }
                    else if (log.type === 'TERJUAL') { badgeColor = 'bg-red-100 text-red-700 border-red-200'; symbol = '-'; }

                    return (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-5 font-bold text-gray-500">{formatDisplayDate(log.createdAt)}</td>
                        <td className="p-5">
                          <p className="font-black text-gray-800 uppercase leading-tight max-w-[200px] truncate">{log.productName}</p>
                        </td>
                        <td className="p-5">
                          <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border shadow-sm ${badgeColor}`}>
                            {log.type}
                          </span>
                        </td>
                        <td className="p-5 text-center">
                          <p className="font-black text-gray-800 text-base">{symbol} {log.amount} <span className="text-[10px] text-gray-500 uppercase bg-gray-100 px-1.5 py-0.5 rounded">{log.unitType}</span></p>
                          {log.unitType !== 'PCS' && <p className="text-[9px] font-bold text-gray-400 mt-1">({symbol} {log.totalPcs} Pcs)</p>}
                        </td>
                        <td className="p-5 text-right max-w-xs">
                          <p className="font-bold text-gray-600 text-xs leading-relaxed truncate">{log.note}</p>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {renderPagination(filteredHistory.length, historyPage, setHistoryPage, historyPerPage, setHistoryPerPage)}
          </div>
        </div>
      )}

      {/* --- MODALS (ADD/EDIT/DELETE/STOCK) --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
            <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
              {modalMode === 'add' ? <><Plus className="w-5 h-5 text-teal-600"/> Tambah Produk Baru</> : <><Edit2 className="w-5 h-5 text-teal-600"/> Edit Data Produk</>}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Nama Produk</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Kategori</label>
                <input type="text" required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Tipe Satuan Jual</label>
                <select value={formData.unitType} onChange={(e) => setFormData({ ...formData, unitType: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl font-black text-sm outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer appearance-none">
                  <option value="PCS">Satuan (PCS)</option>
                  <option value="KARTON">Grosir (KARTON)</option>
                  <option value="BALL">Grosir (BALL)</option>
                  <option value="IKAT">Grosir (IKAT)</option>
                </select>
              </div>
              {WHOLESALE_TYPES.includes(formData.unitType) && (
                <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100">
                  <label className="block text-[10px] font-black text-teal-700 uppercase tracking-widest mb-2">Total Isi (Pcs) per 1 {formData.unitType}</label>
                  <input type="number" required min="1" value={formData.pcsPerCarton} onChange={(e) => setFormData({ ...formData, pcsPerCarton: e.target.value })} className="w-full px-4 py-3 bg-white border-none rounded-xl font-black text-teal-800 text-sm outline-none focus:ring-2 focus:ring-teal-500 shadow-sm" placeholder="Contoh: 24" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Harga Jual (Rp)</label>
                  <input type="number" required min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl font-black text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Stok Awal (PCS)</label>
                  <input type="number" required min="0" disabled={modalMode === 'edit'} value={formData.stockPcs} onChange={(e) => setFormData({ ...formData, stockPcs: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl font-black text-sm outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">URL Gambar Boleh Kosong</label>
                <input type="url" placeholder="https://..." value={formData.image} onChange={(e) => setFormData({ ...formData, image: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-4 rounded-2xl font-black text-gray-400 hover:bg-gray-100 transition-colors text-sm">Batal</button>
                <button type="submit" className="flex-1 px-4 py-4 bg-teal-600 text-white rounded-2xl font-black hover:bg-teal-700 transition-all shadow-xl shadow-teal-100 text-sm uppercase tracking-widest">{modalMode === 'add' ? 'Simpan Baru' : 'Update Data'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStockModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl">
            <h3 className={`text-xl font-black mb-6 flex items-center gap-2 border-b pb-4 ${stockMode === 'in' ? 'text-green-700' : 'text-orange-700'}`}>
              {stockMode === 'in' ? <><ArrowUpCircle className="w-6 h-6"/> Stok Masuk</> : <><ArrowDownCircle className="w-6 h-6"/> Stok Keluar / Buang</>}
            </h3>
            <form onSubmit={handleStockUpdate} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Nama Produk</label>
                <input type="text" value={selectedProduct.name} disabled className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl font-black text-gray-600 text-sm" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Sisa di Gudang</label>
                  <input type="text" value={`${selectedProduct.stockPcs} Pcs`} disabled className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl font-black text-gray-600 text-sm" />
                </div>
                <div className="flex-1">
                  <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ml-2 ${stockMode === 'in' ? 'text-green-600' : 'text-orange-600'}`}>Jumlah {stockMode==='in'?'Ditambah':'Ditarik'}</label>
                  <div className="relative">
                    <input type="number" required min="1" value={stockAmount} onChange={(e) => setStockAmount(e.target.value)} className={`w-full px-4 py-3 bg-white border-2 rounded-xl font-black text-sm outline-none pr-16 ${stockMode === 'in' ? 'border-green-200 focus:border-green-500 focus:ring-4 focus:ring-green-100 text-green-700' : 'border-orange-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 text-orange-700'}`} placeholder="0" autoFocus />
                    <span className="absolute right-4 top-3.5 text-xs font-black text-gray-400 bg-gray-100 px-1 rounded">{selectedProduct.unitType}</span>
                  </div>
                </div>
              </div>
              {WHOLESALE_TYPES.includes(selectedProduct.unitType) && stockAmount && (
                <div className={`p-4 rounded-2xl border text-sm font-black flex items-center justify-between ${stockMode === 'in' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-orange-50 border-orange-100 text-orange-800'}`}>
                  <span className="text-[10px] uppercase tracking-widest opacity-70">Konversi ke Pcs:</span>
                  <span>{stockMode==='in'?'+':'-'} {parseInt(stockAmount) * selectedProduct.pcsPerCarton} Pcs Total</span>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowStockModal(false); setStockAmount(''); }} className="flex-1 py-4 font-black text-gray-400 hover:bg-gray-100 rounded-2xl transition-colors text-sm">Batal</button>
                <button type="submit" className={`flex-1 py-4 text-white rounded-2xl font-black shadow-xl text-sm uppercase tracking-widest transition-all ${stockMode === 'in' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-orange-600 hover:bg-orange-700 shadow-orange-200'}`}>
                  {stockMode === 'in' ? 'Simpan' : 'Tarik'} Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-xl font-black text-gray-800 mb-2">Hapus Produk Ini?</h3>
            <p className="text-sm text-gray-500 mb-8 font-bold leading-relaxed">Menghapus <strong>{selectedProduct?.name}</strong> akan menghilangkannya dari daftar selamanya.</p>
            <div className="flex flex-col gap-2">
              <button onClick={handleDelete} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-red-100 uppercase tracking-widest">Ya, Hapus Permanen</button>
              <button onClick={() => setShowDeleteModal(false)} className="w-full py-4 font-black text-gray-400 text-sm hover:bg-gray-50 rounded-2xl transition-colors">Batal</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StockOpname;