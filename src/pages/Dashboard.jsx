import { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { 
  TrendingUp, Trash2, Eye, FileText, Table as TableIcon, Search, Calendar, Wallet, 
  CreditCard, ArrowDownCircle, ArrowUpCircle, History, Clock, ListFilter, X, RotateCcw, PackagePlus, ChevronDown, ChevronLeft, ChevronRight, AlertTriangle, Edit3, Download, ShoppingCart, Landmark, Store
} from 'lucide-react';
import { useCollection, deleteDocument, addDocument, updateDocument } from '../hooks/useFirestore';
import Loading from '../components/common/Loading';
import Nota from '../components/Nota';
import FormRetur from '../components/FormRetur';
import EditTransactionModal from '../components/EditTransactionModals';

import { exportMasterExcel, exportNeracaExcel, exportLabaRugiExcel } from '../utils/exportExcel';
import { exportMasterPDF, exportNeracaPDF, exportLabaRugiPDF } from '../utils/exportPdf';

import TabSales from './Dashboard/TabSales';
import TabDebt from './Dashboard/TabDebt';

const Dashboard = ({ onShowToast }) => {
  const { data: transactions, loading: loadingTrans } = useCollection('transactions', 'createdAt');
  const { data: expenses, loading: loadingExp } = useCollection('expenses', 'createdAt');
  const { data: customers, loading: loadingCust } = useCollection('customers');
  const { data: returnsData = [], loading: loadingRet } = useCollection('returns', 'createdAt');
  const { data: products, loading: loadingProd } = useCollection('products');
  const { data: stores, loading: loadingStores } = useCollection('stores');

  const [selectedStoreFilter, setSelectedStoreFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('overview');
  const [chartPeriod, setChartPeriod] = useState('daily');
  const [showAllLogs, setShowAllLogs] = useState(false); 
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPayDebtModal, setShowPayDebtModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false); 
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showEditTransModal, setShowEditTransModal] = useState(false);
  const [showEditBalanceModal, setShowEditBalanceModal] = useState(false);

  const [selectedEditTransaction, setSelectedEditTransaction] = useState(null);
  const [editBalanceType, setEditBalanceType] = useState('debt');
  const [editBalanceAmount, setEditBalanceAmount] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showNota, setShowNota] = useState(false);
  const [selectedNotaTransaction, setSelectedNotaTransaction] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [debtPaymentAmount, setDebtPaymentAmount] = useState('');
  const [isFullPayment, setIsFullPayment] = useState(true);
  const [newManualIncome, setNewManualIncome] = useState({ note: '', amount: '', method: 'TUNAI', storeId: '' });
  const [newExpense, setNewExpense] = useState({ title: '', amount: '', category: 'Operasional', storeId: '' });
  
  // TAMBAHAN: newManualDebt sekarang menyimpan state storeId
  const [newManualDebt, setNewManualDebt] = useState({ customerId: '', amount: '', note: '', storeId: '' });

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

  const selectedStoreName = selectedStoreFilter === 'ALL' ? 'Semua Cabang' : selectedStoreFilter === 'pusat' ? 'Pusat' : stores.find(s => s.id === selectedStoreFilter)?.name;

  const activeStoreTransactions = useMemo(() => {
    if (selectedStoreFilter === 'ALL') return transactions;
    return transactions.filter(t => t.storeId === selectedStoreFilter || (!t.storeId && selectedStoreFilter === 'pusat'));
  }, [transactions, selectedStoreFilter]);

  const activeStoreExpenses = useMemo(() => {
    if (selectedStoreFilter === 'ALL') return expenses;
    return expenses.filter(e => e.storeId === selectedStoreFilter || (!e.storeId && selectedStoreFilter === 'pusat'));
  }, [expenses, selectedStoreFilter]);

  const activeStoreReturns = useMemo(() => {
    if (selectedStoreFilter === 'ALL') return returnsData;
    return returnsData.filter(r => r.storeId === selectedStoreFilter || (!r.storeId && selectedStoreFilter === 'pusat'));
  }, [returnsData, selectedStoreFilter]);

  const totalIncome = useMemo(() => activeStoreTransactions.reduce((sum, t) => sum + (Number(t.total) || 0), 0), [activeStoreTransactions]);
  const totalExpenses = useMemo(() => activeStoreExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0), [activeStoreExpenses]);
  const balance = totalIncome - totalExpenses;

  const totalHPP = useMemo(() => activeStoreTransactions.reduce((sum, t) => {
    if (!t.items) return sum;
    const itemHpp = t.items.reduce((iSum, i) => iSum + (Number(i.capitalPrice || 0) * Number(i.qty || 0)), 0);
    return sum + itemHpp;
  }, 0), [activeStoreTransactions]);

  const debtLogs = useMemo(() => {
    let logs = [];
    activeStoreTransactions.forEach(t => {
      if (t.paymentStatus === 'HUTANG' || t.note === 'Penambahan Hutang Manual' || t.note === 'Koreksi Hutang (Bertambah)') {
        let amount = t.subtotal || t.amount;
        if (t.paymentStatus === 'HUTANG') {
           amount = t.subtotal - (t.returnUsed || 0);
           if (t.debtPaid > 0) amount += t.debtPaid; 
        }
        logs.push({ ...t, sourceCollection: 'transactions', debtType: 'in', nominal: amount, note: (t.paymentStatus === 'HUTANG' && t.debtPaid > 0) ? 'Konsolidasi Hutang Baru' : (t.note || 'Belanja Hutang') });
      }
      if (t.debtPaid > 0) {
        const outNote = t.paymentStatus === 'HUTANG' ? 'Penutupan Hutang Lama (Digabung ke Nota Baru)' : `Bayar Hutang di Kasir ${t.note ? '- '+t.note : ''}`;
        logs.push({ ...t, sourceCollection: 'transactions', debtType: 'out', nominal: t.debtPaid, note: outNote });
      }
      if (t.note === 'Cicilan/Pelunasan Hutang' || t.note === 'Pelunasan Hutang Manual' || t.note === 'Nol-kan Hutang Manual' || t.note === 'Koreksi Hutang (Berkurang)') {
         logs.push({ ...t, sourceCollection: 'transactions', debtType: 'out', nominal: t.subtotal, note: t.note });
      }
    });
    return logs.sort((a, b) => getSafeDate(b.createdAt) - getSafeDate(a.createdAt));
  }, [activeStoreTransactions]);

  const depositLogs = useMemo(() => {
    let logs = [];
    activeStoreReturns.forEach(r => {
      if (r.refundType === 'deposit' || r.type === 'manual_deposit_in') {
        logs.push({ ...r, sourceCollection: 'returns', depType: 'in', nominal: r.amount, note: r.note || `Retur: ${r.reason}` });
      } else if (r.type === 'manual_deposit_out') {
        logs.push({ ...r, sourceCollection: 'returns', depType: 'out', nominal: r.amount, note: r.note });
      }
    });
    activeStoreTransactions.forEach(t => {
      if (t.returnUsed > 0) logs.push({ ...t, sourceCollection: 'transactions', depType: 'out', nominal: t.returnUsed, note: `Dipakai belanja (Nota: #${t.id?.substring(0,6)})` });
    });
    return logs.sort((a, b) => getSafeDate(b.createdAt) - getSafeDate(a.createdAt));
  }, [activeStoreReturns, activeStoreTransactions]);

  // === KALKULASI HUTANG & DEPOSIT BERDASARKAN CABANG ===
  const { activeStoreCustomersDebt, activeStoreCustomersDeposit } = useMemo(() => {
    if (selectedStoreFilter === 'ALL') {
      return {
        activeStoreCustomersDebt: customers.filter(c => c.remainingDebt > 0).map(c => ({...c, displayDebt: c.remainingDebt})),
        activeStoreCustomersDeposit: customers.filter(c => c.returnAmount > 0).map(c => ({...c, displayDeposit: c.returnAmount}))
      };
    }

    const debtMap = {};
    debtLogs.forEach(log => {
      if (!log.customerId) return;
      if (!debtMap[log.customerId]) debtMap[log.customerId] = 0;
      debtMap[log.customerId] += log.debtType === 'in' ? Number(log.nominal) : -Number(log.nominal);
    });

    const depMap = {};
    depositLogs.forEach(log => {
      if (!log.customerId) return;
      if (!depMap[log.customerId]) depMap[log.customerId] = 0;
      depMap[log.customerId] += log.depType === 'in' ? Number(log.nominal) : -Number(log.nominal);
    });

    const debtArr = [];
    Object.keys(debtMap).forEach(cid => {
      if (debtMap[cid] > 0) {
        const c = customers.find(x => x.id === cid);
        if (c) debtArr.push({...c, displayDebt: debtMap[cid]});
      }
    });

    const depArr = [];
    Object.keys(depMap).forEach(cid => {
      if (depMap[cid] > 0) {
        const c = customers.find(x => x.id === cid);
        if (c) depArr.push({...c, displayDeposit: depMap[cid]});
      }
    });

    return { activeStoreCustomersDebt: debtArr, activeStoreCustomersDeposit: depArr };
  }, [selectedStoreFilter, customers, debtLogs, depositLogs]);

  const totalUnpaidDebtDisplay = activeStoreCustomersDebt.reduce((sum, c) => sum + c.displayDebt, 0);
  const totalDepositDisplay = activeStoreCustomersDeposit.reduce((sum, c) => sum + c.displayDeposit, 0);

  const netLogs = useMemo(() => {
    let logs = [];
    activeStoreTransactions.forEach(t => {
      if (Number(t.total) > 0) {
        logs.push({ ...t, sourceCollection: 'transactions', netType: 'in', nominal: t.total, subjName: t.customerName || 'Pemasukan Kas', detailNote: t.note || (t.items ? t.items.map(i => i.name).join(', ') : `Transaksi Lunas`), paymentMethod: t.paymentMethod || 'TUNAI' });
      }
    });
    activeStoreExpenses.forEach(e => {
      logs.push({ ...e, sourceCollection: 'expenses', netType: 'out', nominal: e.amount, subjName: 'Beban/Pengeluaran', detailNote: e.title });
    });
    return logs.sort((a, b) => getSafeDate(b.createdAt) - getSafeDate(a.createdAt));
  }, [activeStoreTransactions, activeStoreExpenses]);

  const allActivityLogs = useMemo(() => {
    let logs = [];
    netLogs.forEach(l => logs.push({ ...l, logTime: getSafeDate(l.createdAt), logCategory: 'KAS', logType: l.netType, logLabel: l.netType === 'in' ? `Kas Masuk` : 'Kas Keluar', logTitle: l.subjName, logDetail: l.detailNote }));
    debtLogs.forEach(l => logs.push({ ...l, logTime: getSafeDate(l.createdAt), logCategory: 'HUTANG', logType: l.debtType, logLabel: l.debtType === 'in' ? 'Hutang Bertambah' : 'Hutang Berkurang', logTitle: l.customerName || 'Tanpa Nama', logDetail: l.note }));
    depositLogs.forEach(l => logs.push({ ...l, logTime: getSafeDate(l.createdAt), logCategory: 'DEPOSIT', logType: l.depType, logLabel: l.depType === 'in' ? 'Deposit Masuk' : 'Deposit Terpakai', logTitle: l.customerName || 'Tanpa Nama', logDetail: l.note }));
    return logs.sort((a, b) => b.logTime - a.logTime);
  }, [netLogs, debtLogs, depositLogs]);

  const dynamicChartData = useMemo(() => {
    const dataMap = {};
    const processData = (list, isExpense = false) => {
      list.forEach(item => {
        const date = getSafeDate(item.createdAt);
        let key = chartPeriod === 'daily' ? date.toLocaleDateString('id-ID', { weekday: 'short' }) :
                  chartPeriod === 'weekly' ? `Mgg ${Math.ceil(((date - new Date(date.getFullYear(), 0, 1)) / 86400000 + date.getDay() + 1) / 7)}` :
                  chartPeriod === 'monthly' ? date.toLocaleDateString('id-ID', { month: 'short' }) :
                  date.getFullYear().toString();

        if (!dataMap[key]) dataMap[key] = { label: key, masuk: 0, keluar: 0 };
        if (isExpense) dataMap[key].keluar += (Number(item.amount) || 0);
        else dataMap[key].masuk += (Number(item.total) || 0);
      });
    };
    processData(activeStoreTransactions, false);
    processData(activeStoreExpenses, true);
    return Object.values(dataMap).slice(-12);
  }, [activeStoreTransactions, activeStoreExpenses, chartPeriod]);

  // === ACTIONS ===
  const handleAddManualIncome = async (e) => {
    e.preventDefault();
    if (!newManualIncome.note || !newManualIncome.amount || !newManualIncome.storeId) return onShowToast('Lengkapi data dan pilih cabang', 'error');
    const storeObj = stores.find(s => s.id === newManualIncome.storeId);
    await addDocument('transactions', { 
      note: newManualIncome.note, subtotal: Number(newManualIncome.amount), total: Number(newManualIncome.amount), 
      customerName: 'Pemasukan Manual', paymentStatus: 'LUNAS', paymentMethod: newManualIncome.method, 
      storeId: newManualIncome.storeId, storeName: storeObj ? storeObj.name : 'Pusat', createdAt: new Date() 
    });
    setNewManualIncome({ note: '', amount: '', method: 'TUNAI', storeId: '' });
    onShowToast('Pemasukan dicatat', 'success');
  };

  const handlePayDebt = async () => {
    const maxAmount = selectedCustomer.displayDebt ?? selectedCustomer.remainingDebt;
    const amount = isFullPayment ? maxAmount : Number(debtPaymentAmount);
    if (amount <= 0 || amount > maxAmount) return onShowToast('Nominal tidak valid', 'error');
    
    const updateRes = await updateDocument('customers', selectedCustomer.id, { remainingDebt: selectedCustomer.remainingDebt - amount });
    if (updateRes.success) {
      await addDocument('transactions', { customerName: selectedCustomer.name, customerId: selectedCustomer.id, subtotal: amount, total: amount, note: 'Pelunasan Hutang Manual', paymentStatus: 'LUNAS', paymentMethod: 'TUNAI', storeId: selectedStoreFilter !== 'ALL' ? selectedStoreFilter : 'pusat', storeName: selectedStoreName, createdAt: new Date() });
      onShowToast('Hutang diperbarui', 'success');
      setShowPayDebtModal(false);
    }
  };

  // TAMBAHAN: handleAddManualDebt agar membaca StoreId dengan tepat
  const handleAddManualDebt = async (e) => {
    e.preventDefault();
    if (!newManualDebt.customerId || !newManualDebt.amount || !newManualDebt.storeId) return onShowToast('Pilih pelanggan, cabang, dan isi nominal!', 'error');
    const cust = customers.find(c => c.id === newManualDebt.customerId);
    if (!cust) return;
    const amount = Number(newManualDebt.amount);
    
    const storeObj = stores.find(s => s.id === newManualDebt.storeId);
    const storeName = storeObj ? storeObj.name : 'Pusat';

    const updateRes = await updateDocument('customers', cust.id, { remainingDebt: (Number(cust.remainingDebt) || 0) + amount });
    if (updateRes.success) {
      await addDocument('transactions', { customerName: cust.name, customerId: cust.id, subtotal: amount, total: 0, note: newManualDebt.note || 'Penambahan Hutang Manual', paymentStatus: 'HUTANG', storeId: newManualDebt.storeId, storeName: storeName, createdAt: new Date() });
      onShowToast('Hutang manual berhasil ditambahkan', 'success');
      setNewManualDebt({ customerId: '', amount: '', note: '', storeId: '' });
    }
  };

  const handleSaveEditBalance = async () => {
    const newAmount = Number(editBalanceAmount);
    if (isNaN(newAmount) || newAmount < 0) return onShowToast('Nominal tidak valid', 'error');
    
    if (editBalanceType === 'debt') {
      const oldStoreAmount = selectedCustomer.displayDebt ?? selectedCustomer.remainingDebt;
      const diff = newAmount - oldStoreAmount;
      if (diff === 0) { setShowEditBalanceModal(false); return; }
      
      await updateDocument('customers', selectedCustomer.id, { remainingDebt: (selectedCustomer.remainingDebt || 0) + diff });
      if (diff > 0) {
        await addDocument('transactions', { customerName: selectedCustomer.name, customerId: selectedCustomer.id, subtotal: diff, total: 0, note: 'Koreksi Hutang (Bertambah)', paymentStatus: 'HUTANG', storeId: selectedStoreFilter !== 'ALL' ? selectedStoreFilter : 'pusat', storeName: selectedStoreName, createdAt: new Date() });
      } else {
        await addDocument('transactions', { customerName: selectedCustomer.name, customerId: selectedCustomer.id, subtotal: Math.abs(diff), total: 0, note: 'Koreksi Hutang (Berkurang)', paymentStatus: 'LUNAS', storeId: selectedStoreFilter !== 'ALL' ? selectedStoreFilter : 'pusat', storeName: selectedStoreName, createdAt: new Date() });
      }
      onShowToast('Hutang berhasil diubah', 'success');
    } else {
      const oldStoreAmount = selectedCustomer.displayDeposit ?? selectedCustomer.returnAmount;
      const diff = newAmount - oldStoreAmount;
      if (diff === 0) { setShowEditBalanceModal(false); return; }

      await updateDocument('customers', selectedCustomer.id, { returnAmount: (selectedCustomer.returnAmount || 0) + diff });
      if (diff > 0) {
        await addDocument('returns', { customerName: selectedCustomer.name, customerId: selectedCustomer.id, amount: diff, type: 'manual_deposit_in', note: 'Koreksi Deposit (Bertambah)', storeId: selectedStoreFilter !== 'ALL' ? selectedStoreFilter : 'pusat', storeName: selectedStoreName, createdAt: new Date() });
      } else {
        await addDocument('returns', { customerName: selectedCustomer.name, customerId: selectedCustomer.id, amount: Math.abs(diff), type: 'manual_deposit_out', note: 'Koreksi Deposit (Berkurang)', storeId: selectedStoreFilter !== 'ALL' ? selectedStoreFilter : 'pusat', storeName: selectedStoreName, createdAt: new Date() });
      }
      onShowToast('Deposit berhasil diubah', 'success');
    }
    setShowEditBalanceModal(false);
  };

  const handleResetAllData = async () => {
    try {
      for (const t of transactions) { await deleteDocument('transactions', t.id); }
      for (const e of expenses) { await deleteDocument('expenses', e.id); }
      for (const r of returnsData) { await deleteDocument('returns', r.id); }
      for (const c of customers) {
        if ((Number(c.remainingDebt) || 0) > 0 || (Number(c.returnAmount) || 0) > 0) {
          await updateDocument('customers', c.id, { remainingDebt: 0, returnAmount: 0 });
        }
      }
      onShowToast('Seluruh data berhasil dihapus bersih', 'success');
      setShowResetModal(false);
    } catch (error) {
      onShowToast('Gagal mereset sebagian data', 'error');
    }
  };

  const handleBulkDelete = async () => {
    let target = []; 
    if (activeTab === 'sales') target = filteredSales; 
    else if (activeTab === 'transactions') target = filteredTransactions; 
    else if (activeTab === 'expenses') target = filteredExpenses; 
    else if (activeTab === 'debts') target = filteredDebtHistory;
    else if (activeTab === 'returns') target = filteredDepositHistory;

    if (target.length === 0) return onShowToast('Tidak ada data untuk dihapus', 'error');
    
    let count = 0;
    for (const item of target) { 
      const colName = item.sourceCollection || (activeTab === 'expenses' ? 'expenses' : 'transactions');
      if (colName) {
        await deleteDocument(colName, item.id);
        count++;
      }
    }
    onShowToast(`${count} data dihapus`, 'success');
    setShowBulkDeleteModal(false);
  };

  const applyFilters = (list, searchFields) => list.filter(item => {
    const date = getSafeDate(item.createdAt);
    const matchesSearch = searchFields.some(field => (item[field] || '').toLowerCase().includes(searchTerm.toLowerCase()));
    let matchesDate = true;
    if (startDate && endDate) {
      const start = new Date(startDate); const end = new Date(endDate); end.setHours(23, 59, 59);
      matchesDate = date >= start && date <= end;
    }
    return matchesSearch && matchesDate;
  });

  const salesData = activeStoreTransactions.filter(t => t.items && t.items.length > 0);
  const incomeData = activeStoreTransactions.filter(t => !t.items || t.items.length === 0);

  const filteredSales = useMemo(() => applyFilters(salesData, ['customerName', 'note']), [salesData, searchTerm, startDate, endDate]);
  const filteredTransactions = useMemo(() => applyFilters(incomeData, ['customerName', 'note']), [incomeData, searchTerm, startDate, endDate]);
  const filteredExpenses = useMemo(() => applyFilters(activeStoreExpenses, ['title']), [activeStoreExpenses, searchTerm, startDate, endDate]);
  const filteredDebtHistory = useMemo(() => applyFilters(debtLogs, ['customerName', 'note']), [debtLogs, searchTerm, startDate, endDate]);
  const filteredDepositHistory = useMemo(() => applyFilters(depositLogs, ['customerName', 'note', 'reason']), [depositLogs, searchTerm, startDate, endDate]);
  const filteredNetBalance = useMemo(() => applyFilters(netLogs, ['customerName', 'note', 'title', 'subjName', 'detailNote']), [netLogs, searchTerm, startDate, endDate]);

  const navigateToTab = (tabId) => {
    setActiveTab(tabId);
    setCurrentPage(1);
    setSearchTerm('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loadingTrans || loadingExp || loadingCust || loadingRet || loadingProd || loadingStores) return <Loading />;

  let currentList = [];
  if (activeTab === 'sales') currentList = filteredSales;
  else if (activeTab === 'transactions') currentList = filteredTransactions;
  else if (activeTab === 'expenses') currentList = filteredExpenses;
  else if (activeTab === 'debts') currentList = filteredDebtHistory;
  else if (activeTab === 'returns') currentList = filteredDepositHistory;
  else if (activeTab === 'netbalance') currentList = filteredNetBalance;

  const paginatedItems = currentList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderPagination = () => {
    const totalPages = Math.ceil(currentList.length / itemsPerPage);
    return (
      <div className="flex flex-col md:flex-row justify-between items-center p-4 bg-gray-50/50 border-t gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-start">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tampilkan:</span>
          <select 
            value={itemsPerPage} 
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-lg focus:ring-teal-500 focus:border-teal-500 px-3 py-2 outline-none shadow-sm cursor-pointer"
          >
            <option value={5}>5 Baris</option>
            <option value={10}>10 Baris</option>
            <option value={20}>20 Baris</option>
            <option value={50}>50 Baris</option>
            <option value={1000000}>Semua Data</option>
          </select>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <span className="text-xs font-bold text-gray-500">
            Hal <span className="text-teal-600 font-black">{currentPage}</span> dari <span className="text-gray-800 font-black">{totalPages || 1}</span>
          </span>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-xl bg-white border hover:bg-gray-50 hover:text-teal-600 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-2 rounded-xl bg-white border hover:bg-gray-50 hover:text-teal-600 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    );
  };

  const displayedLogs = showAllLogs ? allActivityLogs : allActivityLogs.slice(0, 10);

  return (
    <div className="pb-10 bg-gray-50 min-h-screen p-2 md:p-6">
      
      {/* GLOBAL STORE FILTER */}
      <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border mb-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg md:text-xl font-black text-gray-800 tracking-tight">Laporan Multi-Cabang</h2>
          <p className="text-[10px] md:text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Pilih toko untuk memfilter seluruh data penjualan & kas di bawah</p>
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="bg-teal-50 p-2.5 rounded-xl border border-teal-100 hidden md:block">
             <Store className="w-5 h-5 text-teal-600" />
          </div>
          <div className="relative w-full lg:w-72">
            <select 
              value={selectedStoreFilter}
              onChange={e => { setSelectedStoreFilter(e.target.value); setCurrentPage(1); }}
              className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-800 px-4 py-3 rounded-xl font-black text-sm outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-sm"
            >
              <option value="ALL">🌐 SEMUA CABANG (GLOBAL)</option>
              <option value="pusat">🏢 CABANG PUSAT / UTAMA</option>
              {stores.map(s => <option key={s.id} value={s.id}>🏪 {s.name.toUpperCase()}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-3.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex gap-2 mb-6 bg-white p-2 rounded-xl shadow-sm border no-print overflow-x-auto custom-scrollbar whitespace-nowrap">
        {[
          { id: 'overview', label: 'Ringkasan', icon: TrendingUp }, 
          { id: 'sales', label: 'Transaksi', icon: ShoppingCart },
          { id: 'transactions', label: 'Pemasukan', icon: ArrowUpCircle }, 
          { id: 'expenses', label: 'Pengeluaran', icon: ArrowDownCircle }, 
          { id: 'debts', label: 'Hutang', icon: CreditCard },
          { id: 'returns', label: 'Retur/Deposit', icon: RotateCcw },
          { id: 'netbalance', label: 'Riwayat Kas', icon: Wallet }
        ].map(tab => (
          <button key={tab.id} onClick={() => navigateToTab(tab.id)} className={`flex items-center gap-2 px-4 md:px-6 py-3 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === tab.id ? 'bg-teal-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-8">
        <div onClick={() => navigateToTab('transactions')} className="bg-white rounded-2xl shadow-sm p-4 md:p-6 border-b-4 border-teal-500 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all">
          <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase mb-1">Total Pemasukan</p>
          <h3 className="text-base md:text-xl font-black text-teal-700">Rp {(totalIncome || 0).toLocaleString()}</h3>
        </div>
        <div onClick={() => navigateToTab('expenses')} className="bg-white rounded-2xl shadow-sm p-4 md:p-6 border-b-4 border-red-500 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all">
          <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase mb-1">Total Pengeluaran</p>
          <h3 className="text-base md:text-xl font-black text-red-600">Rp {(totalExpenses || 0).toLocaleString()}</h3>
        </div>
        <div onClick={() => navigateToTab('debts')} className="bg-white rounded-2xl shadow-sm p-4 md:p-6 border-b-4 border-orange-500 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all">
          <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase mb-1">Piutang {selectedStoreFilter === 'ALL' ? 'Global' : 'Cabang'}</p>
          <h3 className="text-base md:text-xl font-black text-orange-600">Rp {(totalUnpaidDebtDisplay || 0).toLocaleString()}</h3>
        </div>
        <div onClick={() => navigateToTab('returns')} className="bg-white rounded-2xl shadow-sm p-4 md:p-6 border-b-4 border-purple-500 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all">
          <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase mb-1">Deposit {selectedStoreFilter === 'ALL' ? 'Global' : 'Cabang'}</p>
          <h3 className="text-base md:text-xl font-black text-purple-600">Rp {(totalDepositDisplay || 0).toLocaleString()}</h3>
        </div>
        <div onClick={() => navigateToTab('netbalance')} className="col-span-2 md:col-span-1 bg-white rounded-2xl shadow-sm p-4 md:p-6 border-b-4 border-blue-600 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all bg-blue-50/30">
          <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase mb-1">Uang Bersih (Net)</p>
          <h3 className="text-lg md:text-xl font-black text-blue-700">Rp {(balance || 0).toLocaleString()}</h3>
        </div>
      </div>

      {/* TAB OVERVIEW */}
      {activeTab === 'overview' && (
        <>
          <div className="bg-white p-4 md:p-5 rounded-3xl border flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-6 shadow-sm">
             <div>
                <h4 className="text-sm font-black text-gray-800">Cetak Laporan Keuangan</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Laporan otomatis tersaring sesuai cabang yang dipilih di atas</p>
             </div>
             <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2.5 rounded-xl border border-gray-200 w-full md:w-auto">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <input type="date" className="bg-transparent text-xs font-black outline-none w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  <span className="text-gray-300">-</span>
                  <input type="date" className="bg-transparent text-xs font-black outline-none w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => setShowDownloadModal(true)} className="flex-1 justify-center p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-200 hover:bg-blue-100 flex items-center gap-2 text-xs font-black shadow-sm"><Download className="w-4 h-4" /> Download</button>
                    <button onClick={() => setShowResetModal(true)} className="flex-1 justify-center p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 hover:bg-red-100 flex items-center gap-2 text-xs font-black shadow-sm"><AlertTriangle className="w-4 h-4" /> Reset Data</button>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-4 md:p-8 rounded-3xl shadow-sm border overflow-hidden">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h3 className="text-base md:text-lg font-black text-gray-800 flex items-center gap-2"><Clock className="text-teal-500 w-5 h-5" /> Grafik Arus Kas</h3>
                <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto custom-scrollbar">
                  {['daily', 'weekly', 'monthly', 'yearly'].map(p => (
                    <button key={p} onClick={() => setChartPeriod(p)} className={`flex-1 md:flex-none px-3 py-1.5 text-[10px] font-black rounded-lg uppercase transition-all whitespace-nowrap ${chartPeriod === p ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'}`}>
                      {p === 'daily' ? 'Hari' : p === 'weekly' ? 'Minggu' : p === 'monthly' ? 'Bulan' : 'Tahun'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[250px] md:h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dynamicChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" style={{fontSize: '9px'}} />
                    <YAxis style={{fontSize: '9px'}} width={40} />
                    <Tooltip cursor={{fill: '#f9fafb'}} />
                    <Bar name="Masuk" dataKey="masuk" fill="#0d9488" radius={[6, 6, 0, 0]} />
                    <Bar name="Keluar" dataKey="keluar" fill="#dc2626" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white p-4 md:p-8 rounded-3xl shadow-sm border overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-4 md:mb-6">
                <h3 className="text-base md:text-lg font-black text-gray-800 flex items-center gap-2"><ListFilter className="text-blue-500 w-5 h-5" /> Log Aktivitas</h3>
                {allActivityLogs.length > 10 && (
                  <button onClick={() => setShowAllLogs(!showAllLogs)} className="text-[9px] md:text-[10px] font-black text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg">
                    {showAllLogs ? 'Tutup Sebagian' : 'Lihat Semua'}
                  </button>
                )}
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar transition-all duration-500" style={{ maxHeight: showAllLogs ? '500px' : '300px' }}>
                {displayedLogs.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 font-bold py-10">Belum ada aktivitas</p>
                ) : (
                  displayedLogs.map((log, idx) => {
                    const isIn = log.logType === 'in';
                    const colorClass = log.logCategory === 'KAS' ? (isIn ? 'text-teal-600' : 'text-red-600') : log.logCategory === 'HUTANG' ? (isIn ? 'text-orange-600' : 'text-green-600') : (isIn ? 'text-purple-600' : 'text-red-600');
                    const bgBadgeClass = log.logCategory === 'KAS' ? (isIn ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700') : log.logCategory === 'HUTANG' ? (isIn ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700') : (isIn ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700');

                    return (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl border bg-white shadow-sm">
                        <div className="min-w-0 flex-1 pr-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${bgBadgeClass}`}>{log.logLabel}</span>
                          <p className="text-xs md:text-sm font-black truncate text-gray-800 mt-1">{log.logTitle}</p>
                          <p className="text-[9px] text-gray-500 truncate">{log.logDetail}</p>
                          <p className="text-[8px] text-gray-400 font-bold mt-1">{formatDisplayDate(log.logTime)}</p>
                        </div>
                        <p className={`text-xs md:text-sm font-black ${colorClass}`}>{isIn ? '+' : '-'} Rp {Number(log.nominal || 0).toLocaleString()}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- GLOBAL TOOLBAR (Hanya muncul jika bukan tab overview) --- */}
      {activeTab !== 'overview' && (
        <div className="bg-white p-3 md:p-4 rounded-2xl border flex flex-col md:flex-row gap-3 items-center mb-6 shadow-sm">
          <div className="relative w-full md:flex-1"><Search className="absolute left-4 top-3 w-4 h-4 text-gray-300" /><input type="text" placeholder="Cari berdasarkan nama/keterangan..." className="w-full pl-11 pr-4 py-2 bg-gray-50 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-teal-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
          <div className="flex w-full md:w-auto items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
            <Calendar className="w-4 h-4 text-gray-400" /><input type="date" className="bg-transparent text-xs font-black outline-none w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-gray-300">-</span><input type="date" className="bg-transparent text-xs font-black outline-none w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button onClick={() => setShowBulkDeleteModal(true)} className="w-full md:w-auto p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-100 flex justify-center"><Trash2 className="w-5 h-5" /></button>
        </div>
      )}

      {/* TAB SALES - MENGGUNAKAN KOMPONEN BARU */}
      {activeTab === 'sales' && (
        <TabSales 
          paginatedItems={paginatedItems}
          formatDisplayDate={formatDisplayDate}
          onViewNota={(item) => { setSelectedNotaTransaction(item); setShowNota(true); }}
          onEditTransaction={(item) => { setSelectedEditTransaction(item); setShowEditTransModal(true); }}
          onDeleteTransaction={(item) => { setSelectedItem({...item, isSale: true}); setShowDeleteModal(true); }}
          paginationComponent={renderPagination()}
        />
      )}

      {/* TAB TRANSACTIONS & EXPENSES */}
      {(activeTab === 'transactions' || activeTab === 'expenses') && (
        <div className="space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-3xl border shadow-sm">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 md:mb-4">{activeTab === 'transactions' ? 'Pemasukan Manual' : 'Catat Pengeluaran'}</h4>
            <form onSubmit={activeTab === 'transactions' ? handleAddManualIncome : async (e) => { 
                e.preventDefault(); 
                if (!newExpense.storeId) return onShowToast('Pilih cabang toko terlebih dahulu', 'error');
                const storeObj = stores.find(s => s.id === newExpense.storeId);
                await addDocument('expenses', {...newExpense, amount: Number(newExpense.amount), storeId: newExpense.storeId, storeName: storeObj ? storeObj.name : 'Pusat', createdAt: new Date()}); 
                onShowToast('Disimpan', 'success'); 
                setNewExpense({title: '', amount: '', category: 'Operasional', storeId: ''}); 
              }} 
              className="flex flex-col md:flex-row gap-3"
            >
              <select required value={activeTab === 'transactions' ? newManualIncome.storeId : newExpense.storeId} onChange={(e) => activeTab === 'transactions' ? setNewManualIncome({...newManualIncome, storeId: e.target.value}) : setNewExpense({...newExpense, storeId: e.target.value})} className="w-full md:w-48 bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500">
                <option value="" disabled>-- Pilih Cabang --</option><option value="pusat">Cabang Pusat</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              
              <input type="text" placeholder="Deskripsi" required className="w-full md:flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold border border-gray-200 outline-none focus:ring-2 focus:ring-teal-500" value={activeTab === 'transactions' ? newManualIncome.note : newExpense.title} onChange={e => activeTab === 'transactions' ? setNewManualIncome({...newManualIncome, note: e.target.value}) : setNewExpense({...newExpense, title: e.target.value})} />
              <input type="number" placeholder="Nominal (Rp)" required className="w-full md:w-44 bg-gray-50 rounded-xl px-4 py-3 text-sm font-black border border-gray-200 outline-none focus:ring-2 focus:ring-teal-500" value={activeTab === 'transactions' ? newManualIncome.amount : newExpense.amount} onChange={e => activeTab === 'transactions' ? setNewManualIncome({...newManualIncome, amount: e.target.value}) : setNewExpense({...newExpense, amount: e.target.value})} />
              
              {activeTab === 'transactions' && (
                <select value={newManualIncome.method} onChange={(e) => setNewManualIncome({...newManualIncome, method: e.target.value})} className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="TUNAI">TUNAI</option><option value="TRANSFER">TRANSFER</option><option value="QRIS">QRIS</option>
                </select>
              )}
              <button className={`w-full md:w-auto px-8 py-3 rounded-xl font-black text-sm text-white ${activeTab === 'transactions' ? 'bg-teal-600' : 'bg-red-600'} shadow-md`}>Simpan</button>
            </form>
          </div>
          <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full custom-scrollbar">
              <table className="w-full min-w-[700px] text-left">
                <thead>
                  <tr className="bg-gray-50/50 border-b">
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Cabang</th>
                    {activeTab === 'transactions' && <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Nama / Metode</th>}
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px]">{activeTab === 'transactions' ? 'Keterangan' : 'Keterangan'}</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Nominal</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors text-xs md:text-sm">
                      <td className="p-4 font-bold text-gray-500 whitespace-nowrap">{formatDisplayDate(item.createdAt)}</td>
                      <td className="p-4 font-black text-gray-500 uppercase text-[10px]">{item.storeName || 'Pusat'}</td>
                      {activeTab === 'transactions' && (
                        <td className="p-4"><p className="font-black text-gray-800 uppercase">{item.customerName || 'Pemasukan Manual'}</p><p className="text-[9px] text-gray-400 font-bold uppercase">{item.paymentMethod || 'TUNAI'}</p></td>
                      )}
                      <td className="p-4 font-bold text-gray-600">{activeTab === 'transactions' ? (item.note || (item.items ? item.items.map(i => i.name).join(', ') : 'Pemasukan')) : item.title}</td>
                      <td className="p-4 font-black text-right text-gray-700 whitespace-nowrap">Rp {(Number(item.total || item.amount || item.subtotal || 0)).toLocaleString()}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          {activeTab === 'transactions' && item.items && (<button onClick={() => { setSelectedNotaTransaction(item); setShowNota(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Eye className="w-4 h-4"/></button>)}
                          <button onClick={() => { setSelectedItem(item); setShowDeleteModal(true); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </div>
        </div>
      )}

      {/* TAB DEBTS - MENGGUNAKAN KOMPONEN BARU */}
      {activeTab === 'debts' && (
        <TabDebt 
          stores={stores}
          customers={customers}
          activeStoreCustomersDebt={activeStoreCustomersDebt}
          totalUnpaidDebtDisplay={totalUnpaidDebtDisplay}
          isGlobal={selectedStoreFilter === 'ALL'}
          paginatedItems={paginatedItems}
          formatDisplayDate={formatDisplayDate}
          newManualDebt={newManualDebt}
          setNewManualDebt={setNewManualDebt}
          handleAddManualDebt={handleAddManualDebt}
          onPayDebt={(c) => { setSelectedCustomer(c); setShowPayDebtModal(true); setDebtPaymentAmount(''); setIsFullPayment(true); }}
          onEditDebt={(c) => { setEditBalanceType('debt'); setSelectedCustomer(c); setEditBalanceAmount(c.displayDebt); setShowEditBalanceModal(true); }}
          onDeleteCustomerDebt={(c) => { setSelectedItem({...c, isCustomerDebt: true}); setShowDeleteModal(true); }}
          onViewHistoryDetail={(item) => { setSelectedDetailItem(item); setShowDetailModal(true); }}
          onDeleteHistory={(item) => { setSelectedItem(item); setShowDeleteModal(true); }}
          paginationComponent={renderPagination()}
        />
      )}

      {/* TAB RETURNS */}
      {activeTab === 'returns' && (
        <div className="space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-3xl border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gradient-to-r from-purple-50 to-white gap-4">
            <div><h4 className="text-base md:text-lg font-black text-purple-800 tracking-tight flex items-center gap-2"><PackagePlus className="w-4 h-4 md:w-5 md:h-5"/> Retur ke Deposit</h4><p className="text-[10px] md:text-xs text-purple-600 font-bold mt-1">Gunakan tombol ini untuk meretur barang jadi saldo.</p></div>
            <button onClick={() => setShowReturnModal(true)} className="w-full sm:w-auto bg-purple-600 text-white px-6 py-3 rounded-xl font-black shadow-lg uppercase flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" /> Proses Retur</button>
          </div>

          <div className="bg-white rounded-3xl border shadow-sm mb-6 flex flex-col">
            <div className="p-4 md:p-6 bg-gray-50/50 border-b flex flex-col sm:flex-row justify-between gap-3">
               <h3 className="text-base md:text-lg font-black text-gray-800 uppercase tracking-tighter">Daftar Deposit {selectedStoreFilter === 'ALL' ? 'Global' : 'Cabang'}</h3>
               <div className="px-4 py-1.5 rounded-xl font-black text-xs uppercase bg-purple-100 text-purple-600">Total: Rp {totalDepositDisplay.toLocaleString()}</div>
            </div>
            <div className="overflow-x-auto w-full custom-scrollbar">
               <table className="w-full min-w-[500px] text-left text-xs md:text-sm">
                 <thead><tr className="border-b"><th className="p-4 font-black text-gray-400 uppercase text-[10px]">Pelanggan</th><th className="p-4 font-black text-gray-400 uppercase text-[10px]">Saldo</th><th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th></tr></thead>
                 <tbody className="divide-y">
                   {activeStoreCustomersDeposit.map(c => (
                     <tr key={c.id} className="hover:bg-gray-50 transition-all">
                       <td className="p-4"><div><p className="font-black text-gray-800 uppercase">{c.name}</p><p className="text-[10px] text-gray-400 font-bold">{c.phone || '-'}</p></div></td>
                       <td className="p-4 font-black italic text-sm md:text-lg whitespace-nowrap text-purple-600">Rp {c.displayDeposit.toLocaleString()}</td>
                       <td className="p-4 text-right">
                         <div className="flex justify-end items-center gap-2">
                           <button onClick={() => { setEditBalanceType('deposit'); setSelectedCustomer(c); setEditBalanceAmount(c.displayDeposit); setShowEditBalanceModal(true); }} className="bg-white border text-gray-600 p-2 rounded-xl hover:bg-gray-50 hover:text-teal-600"><Edit3 className="w-4 h-4 inline-block"/></button>
                           {selectedStoreFilter === 'ALL' && <button onClick={() => { setSelectedItem({...c, isCustomerDeposit: true}); setShowDeleteModal(true); }} className="bg-red-50 text-red-600 p-2 rounded-xl hover:bg-red-100"><Trash2 className="w-4 h-4" /></button>}
                         </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden flex flex-col">
             <div className="p-4 md:p-6 bg-gray-50/50 border-b"><h3 className="text-base md:text-lg font-black text-gray-800 uppercase flex items-center gap-2"><History className="text-gray-500 w-5 h-5"/> Histori Deposit</h3></div>
             <div className="overflow-x-auto w-full custom-scrollbar">
                <table className="w-full min-w-[700px] text-left text-xs md:text-sm">
                   <thead><tr className="bg-gray-50/50 border-b"><th className="p-4 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th><th className="p-4 font-black text-gray-400 uppercase text-[10px]">Pelanggan</th><th className="p-4 font-black text-gray-400 uppercase text-[10px]">Keterangan</th><th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Nominal</th><th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th></tr></thead>
                   <tbody className="divide-y">
                     {paginatedItems.map(item => {
                       const isIn = item.depType === 'in'; 
                       return (
                         <tr key={item.id + (item.depType || '')} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-bold text-gray-500 whitespace-nowrap">{formatDisplayDate(item.createdAt)}</td>
                            <td className="p-4 font-black text-gray-800 uppercase">{item.customerName}</td>
                            <td className="p-4 font-bold text-gray-600">{item.note}</td>
                            <td className={`p-4 font-black text-right whitespace-nowrap ${isIn ? 'text-teal-600' : 'text-red-600'}`}>{isIn ? '(+)' : '(-)'} Rp {(Number(item.nominal)||0).toLocaleString()}</td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => { setSelectedDetailItem(item); setShowDetailModal(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Eye className="w-4 h-4"/></button>
                                <button onClick={() => { setSelectedItem(item); setShowDeleteModal(true); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                              </div>
                            </td>
                         </tr>
                       );
                     })}
                   </tbody>
                </table>
             </div>
             {renderPagination()}
          </div>
        </div>
      )}

      {/* TAB SALDO BERSIH (NETBALANCE) */}
      {activeTab === 'netbalance' && (
        <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 md:p-6 bg-gray-50/50 border-b"><h3 className="text-base md:text-lg font-black text-gray-800 uppercase flex items-center gap-2"><Landmark className="text-blue-500 w-5 h-5"/> Riwayat Uang Masuk & Keluar</h3></div>
          <div className="overflow-x-auto w-full custom-scrollbar">
             <table className="w-full min-w-[700px] text-left text-xs md:text-sm">
                <thead><tr className="border-b bg-gray-50/50"><th className="p-4 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th><th className="p-4 font-black text-gray-400 uppercase text-[10px]">Kategori</th><th className="p-4 font-black text-gray-400 uppercase text-[10px]">Nama / Subjek</th><th className="p-4 font-black text-gray-400 uppercase text-[10px]">Metode / Info</th><th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Masuk/Keluar</th></tr></thead>
                <tbody className="divide-y">
                  {paginatedItems.map(item => {
                    const isMasuk = item.netType === 'in';
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-bold text-gray-500 whitespace-nowrap">{formatDisplayDate(item.createdAt)}</td>
                        <td className="p-4"><span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${isMasuk ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'}`}>{isMasuk ? 'PEMASUKAN' : 'PENGELUARAN'}</span></td>
                        <td className="p-4 font-black text-gray-800 uppercase">{item.subjName}</td>
                        <td className="p-4 font-bold text-gray-600"><span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-black mr-2 text-gray-500">{item.paymentMethod || 'TUNAI'}</span>{item.detailNote}</td>
                        <td className={`p-4 font-black text-right whitespace-nowrap ${isMasuk ? 'text-teal-600' : 'text-red-600'}`}>{isMasuk ? '(+)' : '(-)'} Rp {(Number(item.nominal)||0).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
             </table>
          </div>
          {renderPagination()}
        </div>
      )}

      {/* --- MODALS --- */}

      {/* MODAL DOWNLOAD MEMANGGIL FUNGSI DARI UTILS */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-sm w-full shadow-2xl relative border-t-8 border-blue-600">
            <button onClick={() => setShowDownloadModal(false)} className="absolute right-6 top-6 text-gray-400 hover:text-gray-600"><X /></button>
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-2 uppercase">Pilih Jenis Laporan</h3>
            <p className="text-xs text-gray-500 mb-6 font-bold">Laporan dicetak sesuai filter tanggal dan cabang saat ini.</p>
            <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
              <button onClick={() => { exportMasterExcel({transactions: activeStoreTransactions, filteredExpenses, filteredDebtHistory, activeStoreCustomersDebt, activeStoreCustomersDeposit, filteredDepositHistory, filteredNetBalance, startDate, endDate, storeName: selectedStoreName, formatDisplayDate, onShowToast}); setShowDownloadModal(false); }} className="w-full flex items-center gap-3 p-3 bg-green-50 text-green-700 rounded-2xl hover:bg-green-100 border border-green-200"><TableIcon className="w-5 h-5 flex-shrink-0" /><div className="text-left"><p className="font-black text-sm">Excel Master Lengkap</p></div></button>
              <button onClick={() => { exportNeracaExcel({balance, totalUnpaidDebt: totalUnpaidDebtDisplay, totalExpenses, totalDeposit: totalDepositDisplay, totalIncome, startDate, endDate, storeName: selectedStoreName, onShowToast}); setShowDownloadModal(false); }} className="w-full flex items-center gap-3 p-3 bg-green-50 text-green-700 rounded-2xl hover:bg-green-100 border border-green-200"><TableIcon className="w-5 h-5 flex-shrink-0" /><div className="text-left"><p className="font-black text-sm">Excel Neraca Saldo</p></div></button>
              <button onClick={() => { exportLabaRugiExcel({totalIncome, totalHPP, totalExpenses, startDate, endDate, storeName: selectedStoreName, onShowToast}); setShowDownloadModal(false); }} className="w-full flex items-center gap-3 p-3 bg-green-50 text-green-700 rounded-2xl hover:bg-green-100 border border-green-200"><TableIcon className="w-5 h-5 flex-shrink-0" /><div className="text-left"><p className="font-black text-sm">Excel Laba Rugi</p></div></button>
              <div className="h-px w-full bg-gray-200 my-2"></div>
              <button onClick={() => { exportMasterPDF({transactions: activeStoreTransactions, filteredExpenses, filteredDebtHistory, activeStoreCustomersDebt, activeStoreCustomersDeposit, filteredDepositHistory, filteredNetBalance, startDate, endDate, storeName: selectedStoreName, formatDisplayDate, onShowToast}); setShowDownloadModal(false); }} className="w-full flex items-center gap-3 p-3 bg-blue-50 text-blue-700 rounded-2xl hover:bg-blue-100 border border-blue-200"><FileText className="w-5 h-5 flex-shrink-0" /><div className="text-left"><p className="font-black text-sm">PDF Master Lengkap</p></div></button>
              <button onClick={() => { exportNeracaPDF({balance, totalUnpaidDebt: totalUnpaidDebtDisplay, totalExpenses, totalDeposit: totalDepositDisplay, totalIncome, startDate, endDate, storeName: selectedStoreName, onShowToast}); setShowDownloadModal(false); }} className="w-full flex items-center gap-3 p-3 bg-purple-50 text-purple-700 rounded-2xl hover:bg-purple-100 border border-purple-200"><FileText className="w-5 h-5 flex-shrink-0" /><div className="text-left"><p className="font-black text-sm">PDF Neraca Saldo</p></div></button>
              <button onClick={() => { exportLabaRugiPDF({totalIncome, totalHPP, totalExpenses, startDate, endDate, storeName: selectedStoreName, onShowToast}); setShowDownloadModal(false); }} className="w-full flex items-center gap-3 p-3 bg-purple-50 text-purple-700 rounded-2xl hover:bg-purple-100 border border-purple-200"><FileText className="w-5 h-5 flex-shrink-0" /><div className="text-left"><p className="font-black text-sm">PDF Laba Rugi</p></div></button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT BALANCE */}
      {showEditBalanceModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-sm w-full shadow-2xl relative border-t-8 border-teal-600">
            <button onClick={() => setShowEditBalanceModal(false)} className="absolute right-6 top-6 text-gray-400"><X /></button>
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-2 uppercase">Koreksi Manual</h3>
            <div className="mb-6">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Total {editBalanceType === 'debt' ? 'Hutang' : 'Deposit'} Baru</label>
              <input type="number" className="w-full bg-gray-50 rounded-2xl px-4 py-4 text-xl font-black text-teal-600 outline-none" value={editBalanceAmount} onChange={e => setEditBalanceAmount(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowEditBalanceModal(false)} className="flex-1 py-3 font-black text-gray-400 bg-gray-100 rounded-xl">Batal</button>
              <button onClick={handleSaveEditBalance} className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-black shadow-md">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TERIMA PEMBAYARAN HUTANG (DIPERBAIKI) */}
      {showPayDebtModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-6 md:p-8 w-full max-w-sm shadow-2xl relative border-t-8 border-teal-600 flex flex-col max-h-[90vh]">
            
            <button onClick={() => setShowPayDebtModal(false)} className="absolute right-6 top-6 text-gray-400 hover:text-red-500 transition-colors">
               <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-xl font-black text-gray-800 mb-2 uppercase flex items-center gap-2">
               <CreditCard className="w-5 h-5 text-teal-600"/> Bayar Hutang
            </h3>
            
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-4">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Pelanggan</p>
               <p className="font-black text-gray-800 text-sm">{selectedCustomer.name}</p>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2 mb-1">Sisa Hutang</p>
               <p className="font-black text-red-600 text-lg">Rp {(selectedCustomer.displayDebt ?? selectedCustomer.remainingDebt).toLocaleString('id-ID')}</p>
            </div>

            <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-1">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Jenis Pembayaran</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setIsFullPayment(true); setDebtPaymentAmount(''); }} 
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${isFullPayment ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    Lunas
                  </button>
                  <button 
                    onClick={() => setIsFullPayment(false)} 
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${!isFullPayment ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    Cicil
                  </button>
                </div>
              </div>

              {!isFullPayment && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Nominal Cicilan</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 font-black text-gray-400">Rp</span>
                    <input 
                      type="number" 
                      className="w-full bg-white border-2 border-gray-200 rounded-xl pl-12 pr-4 py-3 text-lg font-black text-teal-700 outline-none focus:border-teal-500 transition-colors" 
                      value={debtPaymentAmount} 
                      onChange={e => setDebtPaymentAmount(e.target.value)} 
                      placeholder="0"
                      autoFocus
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 mt-2 border-t border-gray-100 shrink-0">
              <button onClick={() => setShowPayDebtModal(false)} className="flex-1 py-3.5 font-black text-gray-500 bg-gray-100 rounded-xl text-sm uppercase hover:bg-gray-200 transition-colors">Batal</button>
              <button onClick={handlePayDebt} className="flex-1 bg-teal-600 text-white py-3.5 rounded-xl font-black text-sm uppercase shadow-md shadow-teal-200 hover:bg-teal-700 transition-colors active:scale-95">Proses</button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL HAPUS DATA DENGAN REVERT */}
      {showDeleteModal && selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-6">{selectedItem.isSale ? 'Hapus & Batalkan Transaksi?' : 'Hapus Data Ini?'}</h3>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 font-black text-gray-400 bg-gray-100 rounded-2xl">Batal</button>
              <button onClick={async () => { 
                if (selectedItem.isSale) {
                  if (selectedItem.items) {
                    for (const item of selectedItem.items) {
                      const product = products.find(p => p.id === item.productId);
                      if (product) {
                        const pcsToRestore = item.qty * (['KARTON', 'BALL', 'IKAT', 'RENCENG', 'BOX'].includes(item.unitType) ? (item.pcsPerCarton || 1) : 1);
                        await updateDocument('products', product.id, { stockPcs: product.stockPcs + pcsToRestore });
                      }
                    }
                  }
                  if (selectedItem.customerId) {
                    const customer = customers.find(c => c.id === selectedItem.customerId);
                    if (customer) {
                      let newDebt = Number(customer.remainingDebt) || 0;
                      let newDeposit = Number(customer.returnAmount) || 0;
                      if (selectedItem.paymentStatus === 'HUTANG') newDebt = Math.max(0, newDebt - (Number(selectedItem.subtotal) - Number(selectedItem.returnUsed || 0)));
                      if (Number(selectedItem.returnUsed) > 0) newDeposit += Number(selectedItem.returnUsed);
                      await updateDocument('customers', customer.id, { remainingDebt: newDebt, returnAmount: newDeposit });
                    }
                  }
                  await deleteDocument('transactions', selectedItem.id); 
                  onShowToast('Transaksi dibatalkan', 'success');
                } else {
                  const colName = selectedItem.sourceCollection || (activeTab === 'expenses' ? 'expenses' : activeTab === 'returns' ? 'returns' : 'transactions');
                  await deleteDocument(colName, selectedItem.id); 
                  onShowToast('Data dihapus', 'success');
                }
                setShowDeleteModal(false); 
              }} className="flex-1 bg-red-600 text-white py-3 rounded-2xl font-black shadow-md">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BULK DELETE */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-6 max-w-sm w-full shadow-2xl text-center border-t-8 border-red-600">
            <h3 className="text-xl font-black text-gray-800 mb-2">Hapus Masal?</h3>
            <button onClick={handleBulkDelete} className="w-full bg-red-600 text-white py-3 rounded-2xl font-black shadow-md my-4">Ya, Hapus Semua</button>
            <button onClick={() => setShowBulkDeleteModal(false)} className="w-full py-3 font-black text-gray-400 bg-gray-100 rounded-2xl">Batal</button>
          </div>
        </div>
      )}

      {/* MODAL RESET ALL DATA */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-6 max-w-sm w-full shadow-2xl text-center border-t-8 border-red-600">
            <h3 className="text-xl font-black text-gray-800 mb-2">Reset Semua Data?</h3>
            <button onClick={handleResetAllData} className="w-full bg-red-600 text-white py-3 rounded-2xl font-black shadow-md my-4">Ya, Bersihkan Semua</button>
            <button onClick={() => setShowResetModal(false)} className="w-full py-3 font-black text-gray-400 bg-gray-100 rounded-2xl">Batal</button>
          </div>
        </div>
      )}

      {/* DETAIL MODALS */}
      {showDetailModal && selectedDetailItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4"><div className="bg-white p-8 rounded-[32px] w-full max-w-sm"><h3 className="text-xl font-black mb-4">Detail</h3><button onClick={() => setShowDetailModal(false)} className="w-full py-3 bg-gray-100 rounded-xl font-black">Tutup</button></div></div>
      )}

      <FormRetur isOpen={showReturnModal} onClose={() => setShowReturnModal(false)} onShowToast={onShowToast} />
      {showEditTransModal && selectedEditTransaction && (<EditTransactionModal isOpen={showEditTransModal} transaction={selectedEditTransaction} products={products} customers={customers} onClose={() => setShowEditTransModal(false)} onShowToast={onShowToast} />)}
      {showNota && selectedNotaTransaction && (<Nota transaction={selectedNotaTransaction} onClose={() => setShowNota(false)} />)}
    </div>
  );
};

export default Dashboard;