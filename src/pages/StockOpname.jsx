import { useState, useRef, useMemo } from 'react';
import { 
  Plus, CreditCard as Edit2, Trash2, Package, CircleArrowUp as ArrowUpCircle, 
  CircleArrowDown as ArrowDownCircle, Upload, Download, Search, 
  History, Calendar, Table as TableIcon, FileText, ChevronLeft, ChevronRight, ListFilter, AlertTriangle, X, TrendingUp
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
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
  const [activeTab, setActiveTab] = useState('products'); 
  const [chartPeriod, setChartPeriod] = useState('daily');
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
  const [showClearProductsModal, setShowClearProductsModal] = useState(false);
  
  const [modalMode, setModalMode] = useState('add');
  const [stockMode, setStockMode] = useState('in');
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // --- FILTER & PAGINATION STATES ---
  const [searchProduct, setSearchProduct] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productsPerPage, setProductsPerPage] = useState(12);

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

  // --- LOGIKA MENGGABUNGKAN HISTORI STOK ---
  const allStockHistory = useMemo(() => {
    let combinedLogs = [];

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

  // --- DATA UNTUK GRAFIK ---
  const stockChartData = useMemo(() => {
    const dataMap = {};
    allStockHistory.forEach(log => {
      const date = getSafeDate(log.createdAt);
      let key = chartPeriod === 'daily' ? date.toLocaleDateString('id-ID', { weekday: 'short' }) :
                chartPeriod === 'weekly' ? `Mgg ${Math.ceil(((date - new Date(date.getFullYear(), 0, 1)) / 86400000 + date.getDay() + 1) / 7)}` :
                chartPeriod === 'monthly' ? date.toLocaleDateString('id-ID', { month: 'short' }) :
                date.getFullYear().toString();

      if (!dataMap[key]) dataMap[key] = { label: key, masuk: 0, keluar: 0 };
      
      if (log.type === 'MASUK') {
         dataMap[key].masuk += (Number(log.totalPcs) || 0);
      } else {
         dataMap[key].keluar += (Number(log.totalPcs) || 0);
      }
    });
    return Object.values(dataMap).slice(-12);
  }, [allStockHistory, chartPeriod]);

  // --- FILTERING ---
  const filteredProducts = useMemo(() => {
    return products.filter(product => 
      product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
      product.category.toLowerCase().includes(searchProduct.toLowerCase())
    );
  }, [products, searchProduct]);

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
    if (modalMode === 'add') {
      result = await addDocument('products', productData);
    } else {
      result = await updateDocument('products', selectedProduct.id, productData);
      
      if (result.success && productData.stockPcs !== selectedProduct.stockPcs) {
        const diff = productData.stockPcs - selectedProduct.stockPcs;
        await addDocument('stock_logs', {
          productId: selectedProduct.id,
          productName: productData.name,
          type: diff > 0 ? 'in' : 'out',
          amount: Math.abs(diff),
          unitType: 'PCS',
          totalPcs: Math.abs(diff),
          note: 'Edit Barang (Penyesuaian Stok Manual)',
          createdAt: new Date()
        });
      }
    }

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

  const handleClearAllHistory = async () => {
    try {
      for (const log of stockLogs) {
        await deleteDocument('stock_logs', log.id);
      }
      onShowToast('Seluruh histori stok manual berhasil dihapus', 'success');
      setShowClearHistoryModal(false);
    } catch (error) {
      onShowToast('Gagal menghapus histori', 'error');
    }
  };

  const handleClearAllProducts = async () => {
    try {
      for (const p of products) {
        await deleteDocument('products', p.id);
      }
      for (const log of stockLogs) {
        await deleteDocument('stock_logs', log.id);
      }
      onShowToast('Semua data barang dan stok berhasil dibersihkan', 'success');
      setShowClearProductsModal(false);
    } catch (error) {
      onShowToast('Gagal membersihkan data barang', 'error');
    }
  };

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
      await addDocument('stock_logs', {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: stockMode,
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

  // --- IMPORT / EXPORT ---
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
      <div className="flex flex-col md:flex-row justify-between items-center p-4 bg-gray-50/50 border-t gap-4 rounded-b-2xl md:rounded-b-3xl">
        <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-start">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tampilkan:</span>
          <select 
            value={itemsPerPage} 
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
            className="bg-white border border-gray-200 text-gray-700 text-[10px] md:text-xs font-bold rounded-lg focus:ring-teal-500 focus:border-teal-500 px-2 py-1.5 md:px-3 md:py-2 outline-none shadow-sm cursor-pointer"
          >
            <option value={12}>12 Baris</option>
            <option value={24}>24 Baris</option>
            <option value={50}>50 Baris</option>
            <option value={100}>100 Baris</option>
            <option value={1000000}>Semua Data</option>
          </select>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <span className="text-[10px] md:text-xs font-bold text-gray-500">
            Hal <span className="text-teal-600 font-black">{currentPage}</span> / <span className="text-gray-800 font-black">{totalPages || 1}</span>
            <span className="ml-1 text-[9px] uppercase tracking-widest hidden md:inline">({listLength} Total)</span>
          </span>
          <div className="flex gap-1 md:gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              disabled={currentPage === 1}
              className="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-white border border-gray-200 text-gray-600 disabled:opacity-30 hover:bg-gray-50 hover:text-teal-600 transition-all shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-white border border-gray-200 text-gray-600 disabled:opacity-30 hover:bg-gray-50 hover:text-teal-600 transition-all shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loadingProducts || loadingTrans || loadingStockLogs) return <Loading />;

  const paginatedProducts = filteredProducts.slice((productPage - 1) * productsPerPage, productPage * productsPerPage);
  const paginatedHistory = filteredHistory.slice((historyPage - 1) * historyPerPage, historyPage * historyPerPage);

  return (
    <div className="pb-10 min-h-screen">
      
      {/* TABS NAVIGATION */}
      <div className="flex gap-2 mb-4 md:mb-6 bg-white p-2 rounded-xl shadow-sm border overflow-x-auto custom-scrollbar whitespace-nowrap">
        {[
          { id: 'products', label: 'Daftar Produk & Stok', icon: Package }, 
          { id: 'history', label: 'Laporan Histori Stok', icon: History }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)} 
            className={`flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap ${activeTab === tab.id ? 'bg-teal-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* --- TAB 1: DAFTAR PRODUK --- */}
      {activeTab === 'products' && (
        <div className="space-y-4 md:space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border shadow-sm gap-4">
            <div>
              <h3 className="text-base md:text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2"><Package className="w-5 h-5 text-teal-600"/> Manajemen Produk</h3>
              <p className="text-[10px] md:text-xs text-gray-500 mt-1 font-bold">Kelola data dan jumlah stok fisik barang</p>
            </div>
            
            <div className="grid grid-cols-2 md:flex gap-2 w-full md:w-auto">
              <button onClick={handleDownloadTemplate} className="col-span-1 md:col-auto flex justify-center items-center gap-1.5 md:gap-2 bg-gray-50 text-gray-700 border border-gray-200 px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl hover:bg-gray-100 transition-colors text-[10px] md:text-xs font-black shadow-sm">
                <Download className="w-3.5 h-3.5" /> Template
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="col-span-1 md:col-auto flex justify-center items-center gap-1.5 md:gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl hover:bg-blue-100 transition-colors text-[10px] md:text-xs font-black shadow-sm">
                <Upload className="w-3.5 h-3.5" /> Import
              </button>
              <button onClick={() => handleOpenModal('add')} className="col-span-2 md:col-auto flex justify-center items-center gap-1.5 md:gap-2 bg-teal-600 text-white px-3 md:px-4 py-2.5 rounded-lg md:rounded-xl hover:bg-teal-700 transition-colors text-[10px] md:text-xs font-black shadow-md mt-1 md:mt-0">
                <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" /> Tambah Baru
              </button>
            </div>
          </div>

          <div className="bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border flex items-center shadow-sm">
            <div className="relative w-full">
              <Search className="absolute left-3 md:left-4 top-2.5 md:top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Ketik nama atau kategori produk..."
                value={searchProduct}
                onChange={(e) => { setSearchProduct(e.target.value); setProductPage(1); }}
                className="w-full pl-9 md:pl-11 pr-3 md:pr-4 py-2 md:py-2.5 bg-gray-50 border-none rounded-lg md:rounded-xl text-xs md:text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {products.length === 0 ? (
            <div className="bg-white rounded-2xl md:rounded-3xl border shadow-sm p-6 md:p-10"><EmptyState title="Belum Ada Produk" description="Mulai tambahkan produk untuk mengelola stok" /></div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl md:rounded-3xl border shadow-sm p-6 md:p-10 text-center"><Package className="w-10 h-10 md:w-12 md:h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-bold text-xs md:text-sm">Produk tidak ditemukan</p></div>
          ) : (
            <div className="bg-white rounded-[24px] md:rounded-[32px] border shadow-sm flex flex-col">
              <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {paginatedProducts.map((product) => (
                  <div key={product.id} className="bg-white border border-gray-200 rounded-xl md:rounded-2xl overflow-hidden hover:shadow-lg hover:border-teal-300 transition-all duration-300 flex flex-col">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-32 md:h-40 object-cover border-b border-gray-100" />
                    ) : (
                      <div className="w-full h-24 md:h-40 bg-gray-50 flex flex-col items-center justify-center border-b border-gray-100">
                         <Package className="w-8 h-8 md:w-10 md:h-10 text-gray-300 mb-1 md:mb-2"/>
                         <span className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Tanpa Gambar</span>
                      </div>
                    )}
                    <div className="p-3 md:p-5 flex-1 flex flex-col">
                      <h4 className="font-black text-gray-800 text-sm md:text-base mb-1 uppercase tracking-tight line-clamp-2">{product.name}</h4>
                      <p className="text-[8px] md:text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-3 md:mb-4 bg-teal-50 inline-block px-1.5 md:px-2 py-0.5 md:py-1 rounded-md self-start">{product.category}</p>
                      
                      <div className="space-y-1.5 md:space-y-2 mb-4 md:mb-6 mt-auto">
                        <div className="flex justify-between items-center border-b border-dashed border-gray-100 pb-1.5 md:pb-2">
                          <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-wider">Satuan Beli</span>
                          <span className="text-[10px] md:text-xs font-black text-gray-800 bg-gray-100 px-1.5 md:px-2 py-0.5 rounded">{product.unitType}</span>
                        </div>
                        {WHOLESALE_TYPES.includes(product.unitType) && (
                          <div className="flex justify-between items-center border-b border-dashed border-gray-100 pb-1.5 md:pb-2">
                            <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-wider">Isi per {product.unitType}</span>
                            <span className="text-[10px] md:text-xs font-black text-gray-800">{product.pcsPerCarton} Pcs</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center border-b border-dashed border-gray-100 pb-1.5 md:pb-2">
                          <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-wider">Harga Jual</span>
                          <span className="text-xs md:text-sm font-black text-teal-600">Rp {product.price.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 md:pt-1.5">
                          <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-wider">Total Stok Tersedia</span>
                          <span className={`text-base md:text-lg font-black ${product.stockPcs < 10 ? 'text-red-600' : 'text-gray-800'}`}>
                            {product.stockPcs} <span className="text-[8px] md:text-[10px] text-gray-500 uppercase tracking-widest">Pcs</span>
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 md:gap-2 mt-auto">
                        <button onClick={() => { setSelectedProduct(product); setStockMode('in'); setShowStockModal(true); }} className="col-span-2 flex items-center justify-center gap-1 bg-green-50 text-green-700 border border-green-200 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase hover:bg-green-600 hover:text-white transition-all shadow-sm active:scale-95">
                          <ArrowUpCircle className="w-3 h-3 md:w-3.5 md:h-3.5" /> Masuk
                        </button>
                        <button onClick={() => { setSelectedProduct(product); setStockMode('out'); setShowStockModal(true); }} className="col-span-2 flex items-center justify-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase hover:bg-orange-600 hover:text-white transition-all shadow-sm active:scale-95">
                          <ArrowDownCircle className="w-3 h-3 md:w-3.5 md:h-3.5" /> Keluar
                        </button>
                        <button onClick={() => handleOpenModal('edit', product)} className="col-span-2 flex items-center justify-center gap-1 bg-white border border-gray-200 text-gray-600 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase hover:bg-teal-50 hover:text-teal-600 hover:border-teal-200 transition-all shadow-sm mt-0.5 md:mt-1 active:scale-95">
                          <Edit2 className="w-3 h-3 md:w-3.5 md:h-3.5" /> Edit
                        </button>
                        <button onClick={() => { setSelectedProduct(product); setShowDeleteModal(true); }} className="col-span-2 flex items-center justify-center gap-1 bg-white border border-gray-200 text-gray-600 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all shadow-sm mt-0.5 md:mt-1 active:scale-95">
                          <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" /> Hapus
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
        <div className="space-y-4 md:space-y-6">
          
          {/* GRAFIK PERGERAKAN STOK */}
          <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[32px] border shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <h3 className="font-black text-gray-800 flex items-center gap-2 text-sm md:text-base"><TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-teal-600"/> Grafik Pergerakan Barang (Pcs)</h3>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                {['daily', 'weekly', 'monthly', 'yearly'].map(p => (
                  <button key={p} onClick={() => setChartPeriod(p)} className={`px-2 py-1 text-[9px] md:text-[10px] font-black rounded-md uppercase transition-all whitespace-nowrap ${chartPeriod === p ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'}`}>
                    {p === 'daily' ? 'Hari' : p === 'weekly' ? 'Minggu' : p === 'monthly' ? 'Bulan' : 'Tahun'}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[200px] md:h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="label" style={{fontSize: '9px'}} />
                  <YAxis style={{fontSize: '9px'}} width={35} />
                  <Tooltip cursor={{fill: '#f9fafb'}} />
                  <Bar name="Masuk" dataKey="masuk" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar name="Keluar" dataKey="keluar" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* HEADER EXPORT (Desain Sesuai Foto Referensi HP) */}
          <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[32px] border shadow-sm flex flex-col lg:flex-row gap-4 lg:gap-6 items-start lg:items-center justify-between">
             <div className="w-full lg:w-auto">
                <h4 className="text-sm md:text-base font-black text-gray-800">Cetak Laporan Histori Stok</h4>
                <p className="text-[10px] md:text-[11px] text-gray-400 font-bold uppercase tracking-wider mt-1">Mencakup Barang Masuk, Keluar Manual, & Terjual di Kasir</p>
             </div>
             
             <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-3">
                {/* Date Picker Block */}
                <div className="flex items-center justify-between bg-gray-50 px-4 py-3 md:py-2.5 rounded-xl border border-gray-200 w-full sm:w-auto">
                  <div className="flex items-center gap-2 flex-1 sm:flex-none">
                    <input type="date" className="bg-transparent text-xs md:text-sm font-black outline-none w-full uppercase text-gray-700" value={startDate} onChange={e => {setStartDate(e.target.value); setHistoryPage(1);}} />
                  </div>
                  <span className="text-gray-300 font-black mx-2">-</span>
                  <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end sm:justify-start">
                    <input type="date" className="bg-transparent text-xs md:text-sm font-black outline-none w-full uppercase text-right sm:text-left text-gray-700" value={endDate} onChange={e => {setEndDate(e.target.value); setHistoryPage(1);}} />
                  </div>
                </div>
                
                {/* Buttons Block */}
                <div className="grid grid-cols-2 sm:flex gap-3 w-full sm:w-auto">
                  <button onClick={handleDownloadHistoryExcel} title="Download Excel" className="flex items-center justify-center py-3 sm:px-5 bg-green-50 text-green-600 rounded-xl border border-green-200 hover:bg-green-100 transition-colors shadow-sm">
                     <TableIcon className="w-5 h-5" />
                  </button>
                  <button onClick={handleDownloadHistoryPDF} title="Download PDF" className="flex items-center justify-center py-3 sm:px-5 bg-blue-50 text-blue-600 rounded-xl border border-blue-200 hover:bg-blue-100 transition-colors shadow-sm">
                     <FileText className="w-5 h-5" />
                  </button>
                </div>
             </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="bg-white p-2.5 md:p-3 rounded-xl md:rounded-2xl border flex items-center shadow-sm w-full sm:w-auto flex-1">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2 md:top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Ketik nama barang atau keterangan log..."
                  value={searchHistory}
                  onChange={(e) => { setSearchHistory(e.target.value); setHistoryPage(1); }}
                  className="w-full pl-9 md:pl-10 pr-3 py-1.5 md:py-2 bg-gray-50 border-none rounded-lg md:rounded-xl text-xs md:text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            
            {/* Action Buttons with Delete Functions (Moved aside search bar) */}
            {/* <div className="flex gap-2 w-full sm:w-auto">
               <button onClick={() => setShowClearHistoryModal(true)} className="flex-1 sm:flex-none justify-center px-4 py-3 sm:py-0 bg-red-50 text-red-600 rounded-xl md:rounded-2xl border border-red-200 hover:bg-red-100 flex items-center gap-1.5 text-[10px] md:text-xs font-black transition-colors shadow-sm whitespace-nowrap">
                  <Trash2 className="w-3.5 h-3.5" /> Bersihkan Histori
               </button>
               <button onClick={() => setShowClearProductsModal(true)} className="flex-1 sm:flex-none justify-center px-4 py-3 sm:py-0 bg-red-50 text-red-600 rounded-xl md:rounded-2xl border border-red-200 hover:bg-red-100 flex items-center gap-1.5 text-[10px] md:text-xs font-black transition-colors shadow-sm whitespace-nowrap">
                  <Trash2 className="w-3.5 h-3.5" /> Hapus Semua Barang
               </button>
            </div> */}
          </div>

          <div className="bg-white rounded-[24px] md:rounded-[32px] border overflow-hidden shadow-sm flex flex-col">
            <div className="p-4 md:p-6 bg-gray-50/50 border-b"><h3 className="text-base md:text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2"><ListFilter className="text-teal-500 w-4 h-4 md:w-5 md:h-5"/> Data Detail Pergerakan Barang</h3></div>
            
            <div className="overflow-x-auto w-full custom-scrollbar">
              <table className="w-full min-w-[700px] text-left text-xs md:text-sm">
                <thead>
                  <tr className="border-b bg-white">
                    <th className="p-4 md:p-5 font-black text-gray-400 uppercase text-[9px] md:text-[10px] whitespace-nowrap">Tgl & Jam</th>
                    <th className="p-4 md:p-5 font-black text-gray-400 uppercase text-[9px] md:text-[10px]">Nama Barang</th>
                    <th className="p-4 md:p-5 font-black text-gray-400 uppercase text-[9px] md:text-[10px]">Kategori Log</th>
                    <th className="p-4 md:p-5 font-black text-gray-400 uppercase text-[9px] md:text-[10px] text-center">Jumlah Satuan</th>
                    <th className="p-4 md:p-5 font-black text-gray-400 uppercase text-[9px] md:text-[10px] text-right">Keterangan Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedHistory.length === 0 ? (
                    <tr><td colSpan="5" className="p-6 md:p-10 text-center text-gray-400 font-bold text-xs md:text-sm">Tidak ada histori ditemukan.</td></tr>
                  ) : (
                    paginatedHistory.map(log => {
                      let badgeColor = '';
                      let symbol = '';
                      if (log.type === 'MASUK' || log.type === 'in') { badgeColor = 'bg-green-100 text-green-700 border-green-200'; symbol = '+'; }
                      else if (log.type === 'KELUAR' || log.type === 'out') { badgeColor = 'bg-orange-100 text-orange-700 border-orange-200'; symbol = '-'; }
                      else if (log.type === 'TERJUAL') { badgeColor = 'bg-red-100 text-red-700 border-red-200'; symbol = '-'; }

                      return (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 md:p-5 font-bold text-gray-500 whitespace-nowrap">{formatDisplayDate(log.createdAt)}</td>
                          <td className="p-4 md:p-5">
                            <p className="font-black text-gray-800 uppercase leading-tight max-w-[150px] md:max-w-[200px] truncate">{log.productName}</p>
                          </td>
                          <td className="p-4 md:p-5">
                            <span className={`px-2 py-1 md:px-3 rounded-lg text-[8px] md:text-[9px] font-black uppercase border shadow-sm ${badgeColor}`}>
                              {log.type === 'in' ? 'MASUK' : log.type === 'out' ? 'KELUAR' : log.type}
                            </span>
                          </td>
                          <td className="p-4 md:p-5 text-center whitespace-nowrap">
                            <p className="font-black text-gray-800 text-sm md:text-base">{symbol} {log.amount} <span className="text-[9px] md:text-[10px] text-gray-500 uppercase bg-gray-100 px-1 md:px-1.5 py-0.5 rounded">{log.unitType}</span></p>
                            {log.unitType !== 'PCS' && <p className="text-[8px] md:text-[9px] font-bold text-gray-400 mt-0.5 md:mt-1">({symbol} {log.totalPcs} Pcs)</p>}
                          </td>
                          <td className="p-4 md:p-5 text-right max-w-[200px] md:max-w-xs">
                            <p className="font-bold text-gray-600 text-[10px] md:text-xs leading-relaxed truncate">{log.note}</p>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {renderPagination(filteredHistory.length, historyPage, setHistoryPage, historyPerPage, setHistoryPerPage)}
          </div>
        </div>
      )}

      {/* --- MODALS TAMBAH & EDIT PRODUK (STICKY HEADER) --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[24px] md:rounded-[32px] w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Header Sticky */}
            <div className="px-5 py-4 md:px-6 md:py-5 border-b border-gray-100 flex justify-between items-center bg-white z-10 shrink-0">
              <h3 className="text-lg md:text-xl font-black text-gray-800 flex items-center gap-2">
                {modalMode === 'add' ? <><Plus className="w-4 h-4 md:w-5 md:h-5 text-teal-600"/> Tambah Produk Baru</> : <><Edit2 className="w-4 h-4 md:w-5 md:h-5 text-teal-600"/> Edit Data Produk</>}
              </h3>
              <button 
                type="button" 
                onClick={() => { setShowModal(false); resetForm(); }} 
                className="p-2 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar flex-1">
              <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
                <div>
                  <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Nama Produk</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Kategori</label>
                  <input type="text" required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Tipe Satuan Jual</label>
                  <select value={formData.unitType} onChange={(e) => setFormData({ ...formData, unitType: e.target.value })} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl font-black text-xs md:text-sm outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer appearance-none">
                    <option value="PCS">Satuan (PCS)</option>
                    <option value="KARTON">Grosir (KARTON)</option>
                    <option value="BALL">Grosir (BALL)</option>
                    <option value="IKAT">Grosir (IKAT)</option>
                  </select>
                </div>
                
                {WHOLESALE_TYPES.includes(formData.unitType) && (
                  <div className="bg-teal-50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-teal-100">
                    <label className="block text-[9px] md:text-[10px] font-black text-teal-700 uppercase tracking-widest mb-1 md:mb-2">Total Isi (Pcs) per 1 {formData.unitType}</label>
                    <input type="number" required min="1" value={formData.pcsPerCarton} onChange={(e) => setFormData({ ...formData, pcsPerCarton: e.target.value })} className="w-full px-3 md:px-4 py-2 md:py-3 bg-white border-none rounded-xl font-black text-teal-800 text-xs md:text-sm outline-none focus:ring-2 focus:ring-teal-500 shadow-sm" placeholder="Contoh: 24" />
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Harga Jual (Rp)</label>
                    <input type="number" required min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl font-black text-xs md:text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  {!WHOLESALE_TYPES.includes(formData.unitType) && (
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">
                        {modalMode === 'add' ? 'Stok Awal (PCS)' : 'Stok Fisik (PCS)'}
                      </label>
                      <input 
                        type="number" 
                        required 
                        min="0" 
                        value={formData.stockPcs} 
                        onChange={(e) => setFormData({ ...formData, stockPcs: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })} 
                        className={`w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl font-black text-xs md:text-sm outline-none focus:ring-2 focus:ring-teal-500 ${modalMode === 'edit' ? 'border-2 border-orange-200 focus:border-orange-500 focus:ring-orange-100 bg-orange-50' : ''}`} 
                      />
                    </div>
                  )}
                </div>

                {WHOLESALE_TYPES.includes(formData.unitType) && (
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">
                        {modalMode === 'add' ? `Stok Awal (${formData.unitType})` : `Stok Fisik (${formData.unitType})`}
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        step="any"
                        value={formData.stockPcs === '' ? '' : (formData.stockPcs / (formData.pcsPerCarton || 1))} 
                        onChange={(e) => {
                          if (e.target.value === '') {
                            setFormData({ ...formData, stockPcs: '' });
                          } else {
                            const bulk = parseFloat(e.target.value) || 0;
                            setFormData({ ...formData, stockPcs: Math.round(bulk * (formData.pcsPerCarton || 1)) });
                          }
                        }} 
                        className={`w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl font-black text-xs md:text-sm outline-none focus:ring-2 focus:ring-teal-500 ${modalMode === 'edit' ? 'border-2 border-orange-200 focus:border-orange-500 focus:ring-orange-100 bg-orange-50' : ''}`} 
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">
                        Total {modalMode === 'add' ? 'Awal' : 'Fisik'} (PCS)
                      </label>
                      <input 
                        type="number" 
                        required 
                        min="0" 
                        value={formData.stockPcs} 
                        onChange={(e) => setFormData({ ...formData, stockPcs: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })} 
                        className={`w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl font-black text-xs md:text-sm outline-none focus:ring-2 focus:ring-teal-500 ${modalMode === 'edit' ? 'border-2 border-orange-200 focus:border-orange-500 focus:ring-orange-100 bg-orange-50' : ''}`} 
                      />
                    </div>
                  </div>
                )}

                {/* Pesan Peringatan Saat Edit */}
                {modalMode === 'edit' && (
                  <div className="bg-orange-50 px-3 py-2 rounded-lg border border-orange-100 flex gap-2 items-start mt-1">
                    <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                    <p className="text-[9px] md:text-[10px] text-orange-700 font-bold leading-relaxed">
                      Peringatan: Mengubah angka stok di sini akan tercatat sebagai <span className="font-black uppercase tracking-widest">"Edit Barang"</span> di Laporan Histori.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">URL Gambar Boleh Kosong</label>
                  <input type="url" placeholder="https://..." value={formData.image} onChange={(e) => setFormData({ ...formData, image: e.target.value })} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </div>

                <div className="flex gap-2 md:gap-3 pt-4 md:pt-6">
                  <button type="submit" className="w-full px-3 md:px-4 py-3.5 md:py-4 bg-teal-600 text-white rounded-xl md:rounded-2xl font-black hover:bg-teal-700 transition-all shadow-lg shadow-teal-100 text-xs md:text-sm uppercase tracking-widest active:scale-95">{modalMode === 'add' ? 'Simpan Data' : 'Update Data'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL UPDATE STOK MANUAL (+/-) */}
      {showStockModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 max-w-sm w-full shadow-2xl">
            <h3 className={`text-lg md:text-xl font-black mb-4 md:mb-6 flex items-center gap-2 border-b pb-3 md:pb-4 ${stockMode === 'in' ? 'text-green-700' : 'text-orange-700'}`}>
              {stockMode === 'in' ? <><ArrowUpCircle className="w-5 h-5 md:w-6 md:h-6"/> Stok Masuk</> : <><ArrowDownCircle className="w-5 h-5 md:w-6 md:h-6"/> Stok Keluar / Buang</>}
            </h3>
            <form onSubmit={handleStockUpdate} className="space-y-4 md:space-y-5">
              <div>
                <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Nama Produk</label>
                <input type="text" value={selectedProduct.name} disabled className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl font-black text-gray-600 text-xs md:text-sm" />
              </div>
              <div className="flex gap-3 md:gap-4">
                <div className="flex-1">
                  <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Sisa di Gudang</label>
                  <input type="text" value={`${selectedProduct.stockPcs} Pcs`} disabled className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl font-black text-gray-600 text-xs md:text-sm" />
                </div>
                <div className="flex-1">
                  <label className={`block text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1 ml-2 ${stockMode === 'in' ? 'text-green-600' : 'text-orange-600'}`}>Jumlah {stockMode==='in'?'Ditambah':'Ditarik'}</label>
                  <div className="relative">
                    <input type="number" required min="1" value={stockAmount} onChange={(e) => setStockAmount(e.target.value)} className={`w-full px-3 md:px-4 py-2.5 md:py-3 bg-white border-2 rounded-xl font-black text-xs md:text-sm outline-none pr-12 md:pr-16 ${stockMode === 'in' ? 'border-green-200 focus:border-green-500 focus:ring-4 focus:ring-green-100 text-green-700' : 'border-orange-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 text-orange-700'}`} placeholder="0" autoFocus />
                    <span className="absolute right-3 md:right-4 top-3 md:top-3.5 text-[10px] md:text-xs font-black text-gray-400 bg-gray-100 px-1 rounded">{selectedProduct.unitType}</span>
                  </div>
                </div>
              </div>
              {WHOLESALE_TYPES.includes(selectedProduct.unitType) && stockAmount && (
                <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl border text-xs md:text-sm font-black flex items-center justify-between ${stockMode === 'in' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-orange-50 border-orange-100 text-orange-800'}`}>
                  <span className="text-[9px] md:text-[10px] uppercase tracking-widest opacity-70">Konversi ke Pcs:</span>
                  <span>{stockMode==='in'?'+':'-'} {parseInt(stockAmount) * selectedProduct.pcsPerCarton} Pcs Total</span>
                </div>
              )}
              <div className="flex gap-2 md:gap-3 pt-2 md:pt-4">
                <button type="button" onClick={() => { setShowStockModal(false); setStockAmount(''); }} className="flex-1 py-3 md:py-4 font-black text-gray-400 hover:bg-gray-100 rounded-xl md:rounded-2xl transition-colors text-xs md:text-sm">Batal</button>
                <button type="submit" className={`flex-1 py-3 md:py-4 text-white rounded-xl md:rounded-2xl font-black shadow-xl text-xs md:text-sm uppercase tracking-widest transition-all active:scale-95 ${stockMode === 'in' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-orange-600 hover:bg-orange-700 shadow-orange-200'}`}>
                  {stockMode === 'in' ? 'Simpan' : 'Tarik'} Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HAPUS SATU PRODUK */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-2">Hapus Produk Ini?</h3>
            <p className="text-xs md:text-sm text-gray-500 mb-6 md:mb-8 font-bold leading-relaxed">Menghapus <strong>{selectedProduct?.name}</strong> akan menghilangkannya dari daftar selamanya.</p>
            <div className="flex flex-col gap-2">
              <button onClick={handleDelete} className="w-full bg-red-600 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs md:text-sm shadow-md shadow-red-100 uppercase tracking-widest active:scale-95">Ya, Hapus Permanen</button>
              <button onClick={() => setShowDeleteModal(false)} className="w-full py-3 md:py-4 font-black text-gray-400 text-xs md:text-sm hover:bg-gray-50 rounded-xl md:rounded-2xl transition-colors">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BERSIHKAN HISTORI */}
      {showClearHistoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 max-w-sm w-full shadow-2xl text-center border-t-8 border-red-600">
            <div className="mx-auto bg-red-50 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mb-4 border border-red-100 shadow-inner">
              <AlertTriangle className="w-8 h-8 md:w-10 md:h-10 text-red-600" />
            </div>
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-2">Hapus Seluruh Histori?</h3>
            <p className="text-[10px] md:text-xs text-gray-500 mb-6 font-bold leading-relaxed">
              Ini akan menghapus riwayat masuk/keluar stok secara permanen. (Riwayat penjualan dari kasir akan tetap aman).
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={handleClearAllHistory} className="w-full bg-red-600 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs md:text-sm shadow-md hover:bg-red-700 transition-all uppercase tracking-widest">Ya, Hapus Semua</button>
              <button onClick={() => setShowClearHistoryModal(false)} className="w-full py-3 md:py-4 font-black text-gray-400 hover:bg-gray-50 rounded-xl md:rounded-2xl transition-all text-xs md:text-sm">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BERSIHKAN SEMUA BARANG */}
      {showClearProductsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 max-w-sm w-full shadow-2xl text-center border-t-8 border-red-600">
            <div className="mx-auto bg-red-50 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mb-4 border border-red-100 shadow-inner">
              <AlertTriangle className="w-8 h-8 md:w-10 md:h-10 text-red-600" />
            </div>
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-2">Bersihkan Semua Barang?</h3>
            <p className="text-[10px] md:text-xs text-gray-500 mb-6 font-bold leading-relaxed">
              Perhatian! Seluruh data produk dan stok Anda di etalase akan dihapus secara permanen. Tindakan ini tidak bisa dibatalkan!
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={handleClearAllProducts} className="w-full bg-red-600 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs md:text-sm shadow-md hover:bg-red-700 transition-all uppercase tracking-widest">Ya, Bersihkan Etalase</button>
              <button onClick={() => setShowClearProductsModal(false)} className="w-full py-3 md:py-4 font-black text-gray-400 hover:bg-gray-50 rounded-xl md:rounded-2xl transition-all text-xs md:text-sm">Batal</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StockOpname;