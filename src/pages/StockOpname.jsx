import { useState, useRef, useMemo } from 'react';
import { 
  Plus, CreditCard as Edit2, Trash2, Package, CircleArrowUp as ArrowUpCircle, 
  CircleArrowDown as ArrowDownCircle, Upload, Download, Search, 
  History, Calendar, Table as TableIcon, FileText, ChevronLeft, ChevronRight, ListFilter, AlertTriangle, X, TrendingUp, Store
} from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useCollection, addDocument, updateDocument, deleteDocument } from '../hooks/useFirestore';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';

import * as XLSX from 'xlsx';

import { exportTemplateProduk, exportDataProduk, exportHistoriStokExcel, exportKeuntunganExcel } from '../utils/exportExcel';
import { exportHistoriStokPDF, exportKeuntunganPDF } from '../utils/exportPdf';

const StockOpname = ({ onShowToast }) => {
  const { data: products, loading: loadingProducts } = useCollection('products');
  const { data: transactions, loading: loadingTrans } = useCollection('transactions', 'createdAt');
  const { data: stockLogs, loading: loadingStockLogs } = useCollection('stock_logs', 'createdAt');
  const { data: returnsData = [], loading: loadingRet } = useCollection('returns', 'createdAt');
  const { data: stores, loading: loadingStores } = useCollection('stores');

  const [activeTab, setActiveTab] = useState('products'); 
  const [chartPeriod, setChartPeriod] = useState('daily');
  
  const [selectedStoreFilter, setSelectedStoreFilter] = useState('ALL');
  
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false); 
  const [showDeleteHistoryModal, setShowDeleteHistoryModal] = useState(false);
  
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [modalMode, setModalMode] = useState('add');
  const [stockMode, setStockMode] = useState('in'); 
  const [selectedProduct, setSelectedProduct] = useState(null);
  
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
    name: '', category: '', unitType: 'PCS', hpp: '', 
    defaultPrice: '', storePrices: {}, pcsPerCarton: '', stockPcs: '', image: '',
  });
  
  const [stockAmount, setStockAmount] = useState('');
  const [stockUnit, setStockUnit] = useState('PCS'); 
  const [damageStoreId, setDamageStoreId] = useState('pusat'); 

  const WHOLESALE_TYPES = ['KARTON', 'BALL', 'IKAT', 'RENCENG', 'BOX'];

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

  const activeTransactions = useMemo(() => {
    if (selectedStoreFilter === 'ALL') return transactions;
    return transactions.filter(t => t.storeId === selectedStoreFilter || (!t.storeId && selectedStoreFilter === 'pusat'));
  }, [transactions, selectedStoreFilter]);

  const activeStockLogs = useMemo(() => {
    if (selectedStoreFilter === 'ALL' || selectedStoreFilter === 'pusat') return stockLogs;
    return []; 
  }, [stockLogs, selectedStoreFilter]);

  const activeReturns = useMemo(() => {
    if (selectedStoreFilter === 'ALL') return returnsData;
    return returnsData.filter(r => r.storeId === selectedStoreFilter || (!r.storeId && selectedStoreFilter === 'pusat'));
  }, [returnsData, selectedStoreFilter]);

  const allStockHistory = useMemo(() => {
    let combinedLogs = [];
    activeStockLogs.forEach(log => {
      combinedLogs.push({
        id: log.id, uniqueKey: log.id, sourceCollection: 'stock_logs', createdAt: log.createdAt,
        productId: log.productId, productName: log.productName, type: log.type === 'in' ? 'MASUK' : 'KELUAR',
        amount: log.amount, unitType: log.unitType, totalPcs: log.totalPcs, note: log.note || `Update Manual`,
        storeName: 'Pusat (Gudang)' 
      });
    });
    activeTransactions.forEach(t => {
      t.items?.forEach(item => {
        combinedLogs.push({
          id: t.id, uniqueKey: `${t.id}-${item.productId}`, sourceCollection: 'transactions', createdAt: t.createdAt,
          productId: item.productId, productName: item.name, type: 'TERJUAL', amount: item.qty,
          unitType: item.unitType, totalPcs: item.qty * (item.pcsPerCarton || 1), 
          note: `Nota: #${t.id?.substring(0,6)} - Pembeli: ${t.customerName}`,
          storeName: t.storeName || 'Pusat' 
        });
      });
    });
    return combinedLogs.sort((a, b) => getSafeDate(b.createdAt) - getSafeDate(a.createdAt));
  }, [activeStockLogs, activeTransactions]);

  const stockChartData = useMemo(() => {
    const dataMap = {};
    allStockHistory.forEach(log => {
      const date = getSafeDate(log.createdAt);
      let key = chartPeriod === 'daily' ? date.toLocaleDateString('id-ID', { weekday: 'short' }) :
                chartPeriod === 'weekly' ? `Mgg ${Math.ceil(((date - new Date(date.getFullYear(), 0, 1)) / 86400000 + date.getDay() + 1) / 7)}` :
                chartPeriod === 'monthly' ? date.toLocaleDateString('id-ID', { month: 'short' }) : date.getFullYear().toString();

      if (!dataMap[key]) dataMap[key] = { label: key, masuk: 0, keluar: 0 };
      if (log.type === 'MASUK') dataMap[key].masuk += (Number(log.totalPcs) || 0);
      else dataMap[key].keluar += (Number(log.totalPcs) || 0);
    });
    return Object.values(dataMap).slice(-12);
  }, [allStockHistory, chartPeriod]);

  const profitChartData = useMemo(() => {
    const dataMap = {};
    activeTransactions.forEach(t => {
      const date = getSafeDate(t.createdAt);
      let key = chartPeriod === 'daily' ? date.toLocaleDateString('id-ID', { weekday: 'short' }) :
                chartPeriod === 'weekly' ? `Mgg ${Math.ceil(((date - new Date(date.getFullYear(), 0, 1)) / 86400000 + date.getDay() + 1) / 7)}` :
                chartPeriod === 'monthly' ? date.toLocaleDateString('id-ID', { month: 'short' }) : date.getFullYear().toString();

      if (!dataMap[key]) dataMap[key] = { label: key, pendapatan: 0, profit: 0 };
      t.items?.forEach(item => {
        const currentProduct = products.find(p => p.id === item.productId);
        const hpp = currentProduct ? (currentProduct.hpp || 0) : 0;
        dataMap[key].pendapatan += item.subtotal;
        dataMap[key].profit += (item.subtotal - (hpp * item.qty));
      });
    });
    return Object.values(dataMap).slice(-12);
  }, [activeTransactions, products, chartPeriod]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => product.name.toLowerCase().includes(searchProduct.toLowerCase()) || product.category.toLowerCase().includes(searchProduct.toLowerCase()));
  }, [products, searchProduct]);

  const filteredHistory = useMemo(() => {
    return allStockHistory.filter(log => {
      const date = getSafeDate(log.createdAt);
      const matchesSearch = (log.productName || log.note || '').toLowerCase().includes(searchHistory.toLowerCase());
      let matchesDate = true;
      if (startDate && endDate) {
        const start = new Date(startDate); const end = new Date(endDate); end.setHours(23, 59, 59);
        matchesDate = date >= start && date <= end;
      }
      return matchesSearch && matchesDate;
    });
  }, [allStockHistory, searchHistory, startDate, endDate]);

  const getProfitData = () => {
    const salesMap = {};
    activeTransactions.forEach(t => {
      const date = getSafeDate(t.createdAt);
      let matchesDate = true;
      if (startDate && endDate) {
        const start = new Date(startDate); const end = new Date(endDate); end.setHours(23, 59, 59);
        matchesDate = date >= start && date <= end;
      }
      if (matchesDate && t.items) {
        t.items.forEach(item => {
          if (!salesMap[item.productId]) {
            const currentProduct = products.find(p => p.id === item.productId);
            salesMap[item.productId] = { name: item.name, unitType: item.unitType, qtySold: 0, qtyReturned: 0, hpp: currentProduct ? (currentProduct.hpp || 0) : 0, totalSalesValue: 0, totalReturnValue: 0 };
          }
          salesMap[item.productId].qtySold += Number(item.qty);
          salesMap[item.productId].totalSalesValue += Number(item.subtotal || (item.qty * item.price));
        });
      }
    });

    activeReturns.forEach(r => {
      const date = getSafeDate(r.createdAt);
      let matchesDate = true;
      if (startDate && endDate) {
        const start = new Date(startDate); const end = new Date(endDate); end.setHours(23, 59, 59);
        matchesDate = date >= start && date <= end;
      }
      if (matchesDate && r.items) {
        r.items.forEach(item => {
          if (salesMap[item.productId]) {
            salesMap[item.productId].qtyReturned += Number(item.qty);
            salesMap[item.productId].totalReturnValue += Number(item.qty * (item.finalPrice || item.price));
          }
        });
      }
    });

    return Object.values(salesMap).map(data => {
      const totalHpp = data.hpp * (data.qtySold - data.qtyReturned);
      const netSales = data.totalSalesValue - data.totalReturnValue; 
      return { ...data, netSales, totalHpp, profit: netSales - totalHpp };
    }).sort((a, b) => b.qtySold - a.qtySold); 
  };

  const resetForm = () => {
    const initialStorePrices = {};
    stores.forEach(store => { initialStorePrices[store.id] = ''; });
    
    setFormData({ 
      name: '', category: '', unitType: 'PCS', hpp: '', 
      defaultPrice: '', storePrices: initialStorePrices, 
      pcsPerCarton: '', stockPcs: '', image: '' 
    });
  };

  const handleOpenModal = (mode, product = null) => {
    setModalMode(mode);
    if (mode === 'edit' && product) { 
      const productData = { ...product };
      if (!productData.defaultPrice && productData.price) productData.defaultPrice = productData.price;
      
      const currentStorePrices = productData.storePrices || {};
      const newStorePrices = {};
      stores.forEach(store => { newStorePrices[store.id] = currentStorePrices[store.id] || ''; });
      productData.storePrices = newStorePrices;
      
      setFormData(productData); 
      setSelectedProduct(productData); 
    } 
    else resetForm();
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isWholesale = WHOLESALE_TYPES.includes(formData.unitType);
    
    const cleanedStorePrices = {};
    Object.entries(formData.storePrices).forEach(([storeId, price]) => {
      cleanedStorePrices[storeId] = parseFloat(price) || parseFloat(formData.defaultPrice) || 0;
    });

    const productData = {
      name: formData.name, category: formData.category, unitType: formData.unitType,
      hpp: parseFloat(formData.hpp) || 0, price: parseFloat(formData.defaultPrice) || 0, 
      defaultPrice: parseFloat(formData.defaultPrice) || 0, storePrices: cleanedStorePrices,
      stockPcs: Number(formData.stockPcs) || 0, pcsPerCarton: isWholesale ? parseInt(formData.pcsPerCarton) || 1 : 1,
      image: formData.image || ''
    };

    let result;
    if (modalMode === 'add') result = await addDocument('products', productData);
    else {
      result = await updateDocument('products', selectedProduct.id, productData);
      if (result.success && productData.stockPcs !== selectedProduct.stockPcs) {
        const diff = productData.stockPcs - selectedProduct.stockPcs;
        await addDocument('stock_logs', { productId: selectedProduct.id, productName: productData.name, type: diff > 0 ? 'in' : 'out', amount: Math.abs(diff), unitType: 'PCS', totalPcs: Math.abs(diff), note: 'Edit Barang Manual', createdAt: new Date() });
      }
    }

    if (result.success) {
      onShowToast(modalMode === 'add' ? 'Produk ditambahkan' : 'Produk diperbarui', 'success');
      setShowModal(false); resetForm();
    } else onShowToast('Gagal menyimpan', 'error');
  };

  const handleDelete = async () => {
    const result = await deleteDocument('products', selectedProduct.id);
    if (result.success) { onShowToast('Produk dihapus', 'success'); setShowDeleteModal(false); }
  };

  // --- LOGIKA UPDATE STOK (MASUK, KELUAR, DAN RUSAK) ---
  const handleStockUpdate = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !stockAmount) return;

    const amount = Number(stockAmount);
    const isPcsMode = stockUnit === 'PCS';
    const pcsPerCarton = WHOLESALE_TYPES.includes(selectedProduct.unitType) ? (selectedProduct.pcsPerCarton || 1) : 1;
    
    // Hitung total Pcs yang terpengaruh
    const totalPcs = isPcsMode ? amount : amount * pcsPerCarton;
    let newStockPcs = selectedProduct.stockPcs;

    if (stockMode === 'rusak') {
      const storeObj = stores.find(s => s.id === damageStoreId);
      const storeName = storeObj ? storeObj.name : 'Pusat (Gudang)';
      
      // Jika modal per Karton, bagi dulu biar ketemu harga per Pcs
      const hppPerPcs = (selectedProduct.hpp || 0) / pcsPerCarton;
      const lossAmount = totalPcs * hppPerPcs;

      newStockPcs -= totalPcs;
      if (newStockPcs < 0) return onShowToast('Stok tidak mencukupi untuk dikurangi', 'error');

      const result = await updateDocument('products', selectedProduct.id, { stockPcs: newStockPcs });
      if (result.success) {
        await addDocument('stock_logs', { productId: selectedProduct.id, productName: selectedProduct.name, type: 'out', amount, unitType: stockUnit, totalPcs, note: `Barang Basi/Rusak di ${storeName}`, createdAt: new Date() });
        
        await addDocument('expenses', {
          title: `Rugi Barang Basi/Rusak: ${amount} ${stockUnit} ${selectedProduct.name}`,
          amount: lossAmount,
          category: 'Barang Rusak',
          storeId: damageStoreId,
          storeName: storeName,
          createdAt: new Date()
        });

        onShowToast(`Dicatat! Kerugian Rp ${lossAmount.toLocaleString('id-ID')} dibebankan ke ${storeName}`, 'success');
        setShowStockModal(false); setStockAmount(''); setDamageStoreId('pusat');
      }
      return; 
    }

    if (stockMode === 'in') newStockPcs += totalPcs; else newStockPcs -= totalPcs;
    if (newStockPcs < 0) return onShowToast('Stok tidak mencukupi', 'error');

    const result = await updateDocument('products', selectedProduct.id, { stockPcs: newStockPcs });
    if (result.success) {
      await addDocument('stock_logs', { productId: selectedProduct.id, productName: selectedProduct.name, type: stockMode, amount, unitType: stockUnit, totalPcs, note: `Stok Manual ${stockMode==='in'?'Ditambah':'Dikurangi'}`, createdAt: new Date() });
      onShowToast(`Stok ${stockMode === 'in' ? 'ditambah' : 'dikurangi'}`, 'success');
      setShowStockModal(false); setStockAmount('');
    }
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
        if (excelData.length === 0) return onShowToast('File kosong', 'error');

        let successCount = 0; let updateCount = 0; 
        for (const row of excelData) {
          const rawName = row["Nama Barang"] || row.Nama;
          if (!rawName) continue;
          
          const unit = (row["Satuan (Karton/Ball/Pcs/dll)"] || row.TipeSatuan || 'PCS').toUpperCase();
          const isWholesale = WHOLESALE_TYPES.includes(unit);
          const isiPerSatuan = Number(row["Isi per Satuan (Pcs)"] || row.IsiPerUnit) || 1;
          const stokSatuan = Number(row["Stok Saat Ini (Satuan)"] || row.StokPcs) || 0;
          
          const defaultPrice = parseFloat(row["Harga Jual Default (Satuan)"] || row["Harga Jual (Satuan)"] || row.HargaJual || row.Harga) || 0;

          const dynamicStorePrices = {};
          stores.forEach(store => {
            const colName = `Harga Jual (${store.name})`;
            if (row[colName] !== undefined && row[colName] !== '') {
               dynamicStorePrices[store.id] = parseFloat(row[colName]) || defaultPrice;
            } else {
               dynamicStorePrices[store.id] = defaultPrice;
            }
          });

          const productData = {
            name: rawName, category: row["Kategori"] || row.Kategori || 'Umum', unitType: unit,
            hpp: parseFloat(row["Harga Beli Modal (Satuan)"] || row.HargaBeli) || 0,
            price: defaultPrice, defaultPrice: defaultPrice, storePrices: dynamicStorePrices,
            pcsPerCarton: isWholesale ? isiPerSatuan : 1, stockPcs: stokSatuan * (isWholesale ? isiPerSatuan : 1),
            image: row["Url Gambar"] || row.UrlGambar || '',
          };

          const existingProduct = products.find(p => p.name.toLowerCase() === productData.name.toLowerCase());
          if (existingProduct) {
             await updateDocument('products', existingProduct.id, productData); updateCount++;
             if (productData.stockPcs !== existingProduct.stockPcs) {
                const diff = productData.stockPcs - existingProduct.stockPcs;
                await addDocument('stock_logs', { productId: existingProduct.id, productName: productData.name, type: diff > 0 ? 'in' : 'out', amount: Math.abs(diff), unitType: 'PCS', totalPcs: Math.abs(diff), note: 'Import Excel', createdAt: new Date() });
             }
          } else {
             const result = await addDocument('products', productData);
             if (result.success) {
               successCount++;
               if (productData.stockPcs > 0) await addDocument('stock_logs', { productId: result.id, productName: productData.name, type: 'in', amount: productData.stockPcs, unitType: 'PCS', totalPcs: productData.stockPcs, note: `Import Excel`, createdAt: new Date() });
             }
          }
        }
        onShowToast(`${successCount} baru, ${updateCount} diupdate`, 'success');
      } catch (error) { onShowToast('Gagal import', 'error'); }
      e.target.value = null; 
    };
    reader.readAsArrayBuffer(file);
  };

  const renderPagination = (listLength, currentPage, setPage, itemsPerPage, setItemsPerPage) => {
    const totalPages = Math.ceil(listLength / itemsPerPage);
    return (
      <div className="flex flex-col md:flex-row justify-between items-center p-4 bg-gray-50/50 border-t gap-4 rounded-b-2xl">
        <div className="flex items-center gap-2"><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tampilkan:</span><select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setPage(1); }} className="bg-white border rounded-lg text-xs font-bold px-3 py-2 outline-none shadow-sm cursor-pointer"><option value={12}>12 Baris</option><option value={50}>50 Baris</option><option value={100}>100 Baris</option><option value={1000000}>Semua Data</option></select></div>
        <div className="flex items-center gap-4"><span className="text-xs font-bold text-gray-500">Hal <span className="text-teal-600 font-black">{currentPage}</span> / <span className="text-gray-800 font-black">{totalPages || 1}</span></span><div className="flex gap-2"><button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-xl bg-white border"><ChevronLeft className="w-4 h-4" /></button><button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-2 rounded-xl bg-white border"><ChevronRight className="w-4 h-4" /></button></div></div>
      </div>
    );
  };

  if (loadingProducts || loadingTrans || loadingStockLogs || loadingStores) return <Loading />;

  const paginatedProducts = filteredProducts.slice((productPage - 1) * productsPerPage, productPage * productsPerPage);
  const paginatedHistory = filteredHistory.slice((historyPage - 1) * historyPerPage, historyPage * historyPerPage);

  const selectedStoreName = selectedStoreFilter === 'ALL' ? 'Semua Cabang' : selectedStoreFilter === 'pusat' ? 'Pusat' : stores.find(s => s.id === selectedStoreFilter)?.name;

  return (
    <div className="pb-10 min-h-screen">
      
      <div className="flex gap-2 mb-4 md:mb-6 bg-white p-2 rounded-xl shadow-sm border overflow-x-auto custom-scrollbar whitespace-nowrap">
        {[ { id: 'products', label: 'Daftar Produk & Stok', icon: Package }, { id: 'history', label: 'Laporan & Histori', icon: History } ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap ${activeTab === tab.id ? 'bg-teal-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}><tab.icon className="w-4 h-4" /> {tab.label}</button>
        ))}
      </div>

      {activeTab === 'products' && (
        <div className="space-y-4 md:space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border shadow-sm gap-4">
            <div><h3 className="text-base md:text-lg font-black text-gray-800 uppercase flex items-center gap-2"><Package className="w-5 h-5 text-teal-600"/> Manajemen Produk</h3></div>
            <div className="grid grid-cols-2 md:flex gap-2 w-full md:w-auto">
              <button onClick={() => exportTemplateProduk(stores, onShowToast)} className="flex items-center gap-1.5 bg-gray-50 text-gray-700 border px-3 py-2 rounded-xl text-xs font-black shadow-sm"><Download className="w-3.5 h-3.5" /> Template</button>
              <button onClick={() => exportDataProduk(products, stores, onShowToast)} className="flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 px-3 py-2 rounded-xl text-xs font-black shadow-sm"><Upload className="w-3.5 h-3.5 rotate-180" /> Export</button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded-xl text-xs font-black shadow-sm"><Upload className="w-3.5 h-3.5" /> Import</button>
              <button onClick={() => handleOpenModal('add')} className="col-span-2 md:col-auto flex items-center justify-center gap-1.5 bg-teal-600 text-white px-3 py-2 rounded-xl text-xs font-black shadow-md"><Plus className="w-4 h-4" /> Tambah Baru</button>
            </div>
          </div>

          <div className="bg-white p-3 md:p-4 rounded-xl border flex items-center shadow-sm">
            <div className="relative w-full"><Search className="absolute left-4 top-3 w-4 h-4 text-gray-400" /><input type="text" placeholder="Ketik nama produk..." value={searchProduct} onChange={(e) => { setSearchProduct(e.target.value); setProductPage(1); }} className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm font-bold outline-none" /></div>
          </div>

          {products.length === 0 ? (
            <div className="bg-white rounded-3xl border shadow-sm p-10"><EmptyState title="Belum Ada Produk" /></div>
          ) : (
            <div className="bg-white rounded-[32px] border shadow-sm flex flex-col">
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginatedProducts.map((product) => (
                  <div key={product.id} className="border rounded-2xl overflow-hidden hover:shadow-lg flex flex-col">
                    {product.image ? (<img src={product.image} className="w-full h-40 object-cover border-b" />) : (<div className="h-32 bg-gray-50 flex items-center justify-center"><Package className="w-10 h-10 text-gray-300"/></div>)}
                    <div className="p-4 flex-1 flex flex-col">
                      <h4 className="font-black text-gray-800 text-sm mb-1 uppercase">{product.name}</h4>
                      <p className="text-[10px] font-bold text-teal-600 uppercase mb-3 bg-teal-50 inline-block px-2 py-0.5 rounded-md self-start">{product.category}</p>
                      <div className="space-y-2 mb-4 mt-auto">
                        <div className="flex justify-between items-center"><span className="text-[10px] font-black text-gray-400 uppercase">Satuan</span><span className="text-xs font-black text-gray-800 bg-gray-100 px-2 rounded">{product.unitType}</span></div>
                        <div className="flex justify-between items-center"><span className="text-[10px] font-black text-gray-400 uppercase">Modal</span><span className="text-sm font-black text-orange-600">Rp {(product.hpp||0).toLocaleString('id-ID')}</span></div>
                        <div className="flex justify-between items-center"><span className="text-[10px] font-black text-gray-400 uppercase">Jual Default</span><span className="text-sm font-black text-blue-600">Rp {(product.defaultPrice||product.price||0).toLocaleString('id-ID')}</span></div>
                        <div className="flex justify-between items-center pt-2 border-t border-dashed"><span className="text-[10px] font-black text-gray-400 uppercase">Stok Pusat</span><span className={`text-lg font-black ${product.stockPcs < 10 ? 'text-red-600' : 'text-green-700'}`}>{product.stockPcs} {product.unitType !== 'PCS' && product.unitType !== 'KG' ? 'Pcs' : product.unitType}</span></div>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2 mt-auto">
                        <button onClick={() => { setSelectedProduct(product); setStockMode('in'); setStockUnit(product.unitType); setShowStockModal(true); }} className="col-span-2 bg-green-50 text-green-700 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm">Masuk</button>
                        <button onClick={() => { setSelectedProduct(product); setStockMode('out'); setStockUnit(product.unitType); setShowStockModal(true); }} className="col-span-2 bg-orange-50 text-orange-700 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm">Keluar</button>
                        <button onClick={() => handleOpenModal('edit', product)} className="col-span-2 border text-gray-600 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm flex items-center justify-center gap-1"><Edit2 className="w-3 h-3"/> Edit</button>
                        <button onClick={() => { setSelectedProduct(product); setShowDeleteModal(true); }} className="col-span-2 border text-gray-600 hover:text-red-600 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm">Hapus</button>
                      </div>
                      <button onClick={() => { setSelectedProduct(product); setStockMode('rusak'); setStockUnit(product.unitType); setShowStockModal(true); }} className="mt-2 w-full bg-red-50 text-red-700 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm border border-red-100 hover:bg-red-100 flex justify-center items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Lapor Rusak / Basi</button>
                    </div>
                  </div>
                ))}
              </div>
              {renderPagination(filteredProducts.length, productPage, setProductPage, productsPerPage, setProductsPerPage)}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[32px] border shadow-sm">
              <h3 className="font-black mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-teal-600"/> Grafik Stok (Pcs)</h3>
              <div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={stockChartData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" style={{fontSize: '9px'}}/><YAxis style={{fontSize: '9px'}} width={35}/><Tooltip/><Bar name="Masuk" dataKey="masuk" fill="#10b981" radius={[4, 4, 0, 0]}/><Bar name="Keluar" dataKey="keluar" fill="#f59e0b" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div>
            </div>
            <div className="bg-white p-6 rounded-[32px] border shadow-sm">
              <h3 className="font-black mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-600"/> Grafik Laba (Rp)</h3>
              <div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={profitChartData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" style={{fontSize: '9px'}}/><YAxis style={{fontSize: '9px'}} width={45}/><Tooltip/><Bar name="Pendapatan" dataKey="pendapatan" fill="#3b82f6" radius={[4, 4, 0, 0]}/><Bar name="Laba" dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[32px] border shadow-sm flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center">
             <div>
                <h4 className="text-base font-black text-gray-800 flex items-center gap-2"><FileText className="w-5 h-5 text-teal-600"/> Filter Laporan Cabang</h4>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Pilih cabang dan tanggal untuk mengunduh laporan</p>
             </div>
             <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
                <select value={selectedStoreFilter} onChange={e => { setSelectedStoreFilter(e.target.value); setHistoryPage(1); }} className="bg-gray-50 border border-gray-200 text-gray-800 px-4 py-2.5 rounded-xl font-black text-sm outline-none w-full md:w-auto">
                  <option value="ALL">🌐 SEMUA CABANG</option><option value="pusat">🏢 PUSAT (Gudang)</option>
                  {stores.map(s => <option key={s.id} value={s.id}>🏪 {s.name.toUpperCase()}</option>)}
                </select>
                <div className="flex bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200 w-full md:w-auto justify-between"><input type="date" className="bg-transparent text-sm font-black outline-none w-full" value={startDate} onChange={e => {setStartDate(e.target.value); setHistoryPage(1);}} /><span className="mx-2">-</span><input type="date" className="bg-transparent text-sm font-black outline-none w-full" value={endDate} onChange={e => {setEndDate(e.target.value); setHistoryPage(1);}} /></div>
                <button onClick={() => setShowExportModal(true)} className="px-5 py-3 md:py-0 bg-teal-600 text-white rounded-xl font-black text-sm uppercase flex items-center justify-center gap-2 w-full md:w-auto"><Download className="w-4 h-4" /> Download</button>
             </div>
          </div>

          <div className="bg-white rounded-[32px] border shadow-sm flex flex-col">
            <div className="p-6 bg-gray-50/50 border-b flex justify-between items-center"><h3 className="text-lg font-black uppercase flex items-center gap-2"><ListFilter className="text-teal-500 w-5 h-5"/> Pergerakan Barang</h3></div>
            <div className="overflow-x-auto w-full custom-scrollbar">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead><tr className="border-b bg-white"><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Cabang</th><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Nama Barang</th><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Status</th><th className="p-5 font-black text-gray-400 uppercase text-[10px] text-center">Jumlah</th><th className="p-5 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedHistory.map(log => (
                    <tr key={log.uniqueKey} className="hover:bg-gray-50">
                      <td className="p-5 font-bold text-gray-500 whitespace-nowrap">{formatDisplayDate(log.createdAt)}</td>
                      <td className="p-5 font-black text-gray-600 uppercase text-[10px]">{log.storeName || 'Pusat'}</td>
                      <td className="p-5 font-black text-gray-800 uppercase">{log.productName}</td>
                      <td className="p-5"><span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase border">{log.type}</span></td>
                      <td className="p-5 text-center font-black whitespace-nowrap">{log.amount} <span className="text-[10px] text-gray-400 font-bold">{log.unitType}</span></td>
                      <td className="p-5 text-right"><button onClick={() => { setSelectedHistoryItem(log); setShowDeleteHistoryModal(true); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination(filteredHistory.length, historyPage, setHistoryPage, historyPerPage, setHistoryPerPage)}
          </div>
        </div>
      )}

      {/* MODAL EXPORT MENGGUNAKAN UTILS */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center">
              <div><h3 className="text-xl font-black uppercase">Pilih Laporan</h3><p className="text-[10px] font-bold text-gray-500 uppercase mt-1 tracking-widest">Filter: {selectedStoreName}</p></div>
              <button onClick={() => setShowExportModal(false)}><X/></button>
            </div>
            <div className="p-6 space-y-3">
              <button onClick={() => { exportHistoriStokExcel(filteredHistory, startDate, endDate, selectedStoreName, formatDisplayDate, onShowToast); setShowExportModal(false); }} className="w-full text-left p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-4"><TableIcon className="w-6 h-6 text-green-600"/><span className="font-black text-green-800">Excel Laporan Stok</span></button>
              <button onClick={() => { exportKeuntunganExcel(getProfitData(), startDate, endDate, selectedStoreName, onShowToast); setShowExportModal(false); }} className="w-full text-left p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-4"><TableIcon className="w-6 h-6 text-green-600"/><span className="font-black text-green-800">Excel Laba Penjualan</span></button>
              <div className="h-px w-full bg-gray-100 my-2"></div>
              <button onClick={() => { exportHistoriStokPDF(filteredHistory, startDate, endDate, selectedStoreName, formatDisplayDate, onShowToast); setShowExportModal(false); }} className="w-full text-left p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-4"><FileText className="w-6 h-6 text-blue-600"/><span className="font-black text-blue-800">PDF Laporan Stok</span></button>
              <button onClick={() => { exportKeuntunganPDF(getProfitData(), startDate, endDate, selectedStoreName, onShowToast); setShowExportModal(false); }} className="w-full text-left p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-4"><FileText className="w-6 h-6 text-blue-600"/><span className="font-black text-blue-800">PDF Laba Penjualan</span></button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH/EDIT PRODUK */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] w-full max-w-lg p-6 md:p-8 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="text-xl font-black">{modalMode === 'add' ? 'Tambah Produk' : 'Edit Produk'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 bg-gray-50 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500"><X/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
              <div><label className="text-[10px] font-black uppercase text-gray-500 ml-1">Nama Barang</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-3 bg-gray-50 rounded-xl font-bold mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-black uppercase text-gray-500 ml-1">Kategori</label><input type="text" required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full p-3 bg-gray-50 rounded-xl font-bold mt-1" /></div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Satuan Utama</label>
                  <select value={formData.unitType} onChange={(e) => setFormData({ ...formData, unitType: e.target.value })} className="w-full p-3 bg-gray-50 rounded-xl font-bold mt-1">
                    <option value="PCS">PCS</option>
                    <option value="KG">KG</option>
                    <option value="KARTON">KARTON</option>
                    <option value="BALL">BALL</option>
                    <option value="BOX">BOX</option>
                    <option value="IKAT">IKAT</option>
                    <option value="RENCENG">RENCENG</option>
                  </select>
                </div>
              </div>

              {WHOLESALE_TYPES.includes(formData.unitType) && (
                 <div><label className="text-[10px] font-black uppercase text-gray-500 ml-1">Isi per {formData.unitType} (Pcs)</label><input type="number" required min="1" value={formData.pcsPerCarton} onChange={(e) => setFormData({ ...formData, pcsPerCarton: e.target.value })} className="w-full p-3 bg-gray-50 rounded-xl font-bold mt-1" /></div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div><label className="text-[10px] font-black uppercase text-orange-600 ml-1">Modal Beli (HPP)</label><input type="number" required min="0" value={formData.hpp} onChange={(e) => setFormData({ ...formData, hpp: e.target.value })} className="w-full p-3 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl font-black mt-1" placeholder="Rp" /></div>
                <div><label className="text-[10px] font-black uppercase text-blue-600 ml-1">Harga Jual Default</label><input type="number" required min="0" value={formData.defaultPrice} onChange={(e) => setFormData({ ...formData, defaultPrice: e.target.value })} className="w-full p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl font-black mt-1" placeholder="Rp" /></div>
              </div>

              {stores.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mt-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2"><Store className="w-4 h-4 text-gray-400" /><span className="text-[10px] font-black uppercase text-gray-600 tracking-wider">Harga Khusus Cabang (Opsional)</span></div>
                  {stores.map(store => (
                    <div key={store.id} className="flex items-center justify-between gap-3">
                       <span className="text-xs font-bold text-gray-700 w-1/3 truncate" title={store.name}>{store.name}</span>
                       <input type="number" placeholder="Ikut Default" value={formData.storePrices[store.id] || ''} onChange={(e) => setFormData({...formData, storePrices: { ...formData.storePrices, [store.id]: e.target.value }})} className="w-2/3 p-2 bg-white border border-gray-200 rounded-lg font-black text-sm text-teal-700 outline-none focus:border-teal-500" />
                    </div>
                  ))}
                </div>
              )}

              {!WHOLESALE_TYPES.includes(formData.unitType) && (
                 <div className="pt-2"><label className="text-[10px] font-black uppercase text-green-600 ml-1">Stok Gudang Pusat ({formData.unitType})</label><input type="number" step="any" required min="0" value={formData.stockPcs} onChange={(e) => setFormData({ ...formData, stockPcs: e.target.value === '' ? '' : Number(e.target.value) || 0 })} className="w-full p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl font-black mt-1" /></div>
              )}
              {WHOLESALE_TYPES.includes(formData.unitType) && (
                 <div className="grid grid-cols-2 gap-3 pt-2">
                   <div><label className="text-[10px] font-black uppercase text-purple-600 ml-1">Stok Pusat ({formData.unitType})</label><input type="number" min="0" step="any" value={formData.stockPcs === '' ? '' : (formData.stockPcs / (formData.pcsPerCarton || 1))} onChange={(e) => { if (e.target.value === '') setFormData({ ...formData, stockPcs: '' }); else setFormData({ ...formData, stockPcs: Number(parseFloat(e.target.value) * (formData.pcsPerCarton || 1)) || 0 }); }} className="w-full p-3 bg-purple-50 border border-purple-200 text-purple-800 rounded-xl font-black mt-1" /></div>
                   <div><label className="text-[10px] font-black uppercase text-green-600 ml-1">Total Pcs</label><input type="number" step="any" required min="0" value={formData.stockPcs} onChange={(e) => setFormData({ ...formData, stockPcs: e.target.value === '' ? '' : Number(e.target.value) || 0 })} className="w-full p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl font-black mt-1" /></div>
                 </div>
              )}

              <div className="pt-4 mt-4 border-t border-gray-100 flex gap-2 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 p-3.5 bg-gray-100 text-gray-600 rounded-xl font-black uppercase text-xs hover:bg-gray-200">Batal</button>
                <button type="submit" className="flex-1 p-3.5 bg-teal-600 text-white rounded-xl font-black uppercase text-xs shadow-md hover:bg-teal-700">Simpan Data</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {showStockModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className={`bg-white rounded-[32px] w-full max-w-sm p-6 md:p-8 border-t-8 ${stockMode === 'rusak' ? 'border-red-600' : 'border-teal-500'}`}>
            <h3 className="text-xl font-black mb-6 text-center text-gray-800">
              {stockMode === 'in' ? 'Barang Masuk Pusat' : stockMode === 'out' ? 'Barang Keluar Pusat' : 'Lapor Barang Basi / Rusak'}
            </h3>
            <form onSubmit={handleStockUpdate}>
              <p className="text-xs text-center font-bold text-gray-500 mb-4">{selectedProduct.name} - Sisa: {selectedProduct.stockPcs} {selectedProduct.unitType === 'PCS' ? '' : 'Pcs'}</p>
              
              {stockMode === 'rusak' && (
                <div className="mb-4">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Lokasi Barang Rusak</label>
                  <select value={damageStoreId} onChange={e => setDamageStoreId(e.target.value)} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-red-500 cursor-pointer">
                    <option value="pusat">🏢 Pusat (Gudang Utama)</option>
                    {stores.map(s => <option key={s.id} value={s.id}>🏪 {s.name}</option>)}
                  </select>
                </div>
              )}

              {/* FITUR BARU: TOMBOL TOGGLE SATUAN YANG LEBIH MODERN & RAPI */}
              <div className="mb-6 space-y-3">
                <input 
                  type="number" 
                  step="any" 
                  required 
                  min="0.01" 
                  value={stockAmount} 
                  onChange={e => setStockAmount(e.target.value)} 
                  className={`w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-black text-center text-2xl outline-none transition-all ${stockMode === 'rusak' ? 'focus:border-red-500 focus:ring-2 focus:ring-red-200' : 'focus:border-teal-500 focus:ring-2 focus:ring-teal-200'}`} 
                  placeholder="Ketik Jumlah..."
                />
                
                {WHOLESALE_TYPES.includes(selectedProduct.unitType) && (
                  <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200">
                    <button 
                      type="button" 
                      onClick={() => setStockUnit(selectedProduct.unitType)} 
                      className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${stockUnit === selectedProduct.unitType ? (stockMode === 'rusak' ? 'bg-white shadow-sm text-red-600' : 'bg-white shadow-sm text-teal-600') : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      {selectedProduct.unitType} (Utuh)
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setStockUnit('PCS')} 
                      className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${stockUnit === 'PCS' ? (stockMode === 'rusak' ? 'bg-white shadow-sm text-red-600' : 'bg-white shadow-sm text-teal-600') : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      PCS (Eceran)
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setShowStockModal(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-black text-gray-500 hover:bg-gray-200">Batal</button>
                <button type="submit" className={`flex-1 py-3 text-white rounded-xl font-black shadow-md ${stockMode === 'in' ? 'bg-green-600 hover:bg-green-700' : stockMode === 'rusak' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}`}>Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteHistoryModal && selectedHistoryItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4"><div className="bg-white rounded-[32px] w-full max-w-sm p-6 md:p-8 text-center border-t-8 border-red-600"><h3 className="text-xl font-black mb-2">Hapus Log Ini?</h3><p className="text-xs text-gray-500 mb-6 font-bold">Log histori ini akan dihapus secara permanen.</p><div className="flex flex-col gap-2"><button onClick={async () => { await deleteDocument(selectedHistoryItem.sourceCollection, selectedHistoryItem.id); onShowToast('Log dihapus', 'success'); setShowDeleteHistoryModal(false); }} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black">Ya, Hapus</button><button onClick={() => setShowDeleteHistoryModal(false)} className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-black">Batal</button></div></div></div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4"><div className="bg-white rounded-[32px] w-full max-w-sm p-6 text-center"><h3 className="text-xl font-black mb-6">Hapus Produk Ini?</h3><button onClick={handleDelete} className="w-full py-4 bg-red-600 text-white rounded-xl font-black mb-2 shadow-md">Hapus Permanen</button><button onClick={() => setShowDeleteModal(false)} className="w-full py-4 bg-gray-100 rounded-xl font-black text-gray-500">Batal</button></div></div>
      )}

    </div>
  );
};

export default StockOpname;