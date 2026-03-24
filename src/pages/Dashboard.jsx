import { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell
} from 'recharts';
import { 
  TrendingUp, DollarSign, ShoppingBag, Trash2, Eye, Printer, FileText, 
  Table as TableIcon, ChevronLeft, ChevronRight, Search, Calendar, Wallet, 
  CreditCard, ArrowDownCircle, ArrowUpCircle, History, AlertCircle, CheckCircle2, Clock, ListFilter, X
} from 'lucide-react';
import { useCollection, deleteDocument, addDocument, updateDocument } from '../hooks/useFirestore';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import Nota from '../components/Nota';

// Library untuk Export
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Dashboard = ({ onShowToast }) => {
  // --- DATA FETCHING ---
  const { data: transactions, loading: loadingTrans } = useCollection('transactions', 'createdAt');
  const { data: expenses, loading: loadingExp } = useCollection('expenses', 'createdAt');
  const { data: customers, loading: loadingCust } = useCollection('customers');

  // --- UI STATES ---
  const [activeTab, setActiveTab] = useState('overview');
  const [chartPeriod, setChartPeriod] = useState('daily');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPayDebtModal, setShowPayDebtModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showNota, setShowNota] = useState(false);
  const [selectedNotaTransaction, setSelectedNotaTransaction] = useState(null);

  // --- FILTER & INPUT STATES ---
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [debtPaymentAmount, setDebtPaymentAmount] = useState('');
  const [isFullPayment, setIsFullPayment] = useState(true);

  const [newManualIncome, setNewManualIncome] = useState({ note: '', amount: '' });
  const [newExpense, setNewExpense] = useState({ title: '', amount: '', category: 'Operasional' });

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
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // --- FINANCIAL CALCULATIONS ---
  const totalIncome = useMemo(() => 
    transactions.reduce((sum, t) => sum + (Number(t.total) || 0), 0)
  , [transactions]);

  const totalExpenses = useMemo(() => 
    expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  , [expenses]);

  const totalUnpaidDebt = useMemo(() => 
    customers.reduce((sum, c) => sum + (Number(c.remainingDebt) || 0), 0)
  , [customers]);

  const balance = totalIncome - totalExpenses;

  // --- LOG LOGIC ---
  const allActivityLog = useMemo(() => {
    const combined = [
      ...transactions.map(t => ({ ...t, logType: 'TRANSACTION' })),
      ...expenses.map(e => ({ ...e, logType: 'EXPENSE' }))
    ];
    return combined.sort((a, b) => getSafeDate(b.createdAt) - getSafeDate(a.createdAt));
  }, [transactions, expenses]);

  const debtHistory = useMemo(() => {
    const history = transactions.filter(t => t.paymentStatus === 'HUTANG' || t.note?.includes('Hutang'));
    return history.sort((a, b) => getSafeDate(b.createdAt) - getSafeDate(a.createdAt));
  }, [transactions]);

  // --- CHART LOGIC ---
  const dynamicChartData = useMemo(() => {
    const dataMap = {};
    const processData = (list, isExpense = false) => {
      list.forEach(item => {
        const date = getSafeDate(item.createdAt);
        let key;
        if (chartPeriod === 'daily') key = date.toLocaleDateString('id-ID', { weekday: 'short' });
        else if (chartPeriod === 'weekly') {
          const firstDay = new Date(date.getFullYear(), 0, 1);
          key = `Mgg ${Math.ceil(((date - firstDay) / 86400000 + firstDay.getDay() + 1) / 7)}`;
        }
        else if (chartPeriod === 'monthly') key = date.toLocaleDateString('id-ID', { month: 'short' });
        else key = date.getFullYear().toString();

        if (!dataMap[key]) dataMap[key] = { label: key, masuk: 0, keluar: 0 };
        if (isExpense) dataMap[key].keluar += (Number(item.amount) || 0);
        else dataMap[key].masuk += (Number(item.total) || 0);
      });
    };
    processData(transactions, false);
    processData(expenses, true);
    return Object.values(dataMap).slice(-12);
  }, [transactions, expenses, chartPeriod]);

  // --- ACTION HANDLERS ---
  const handleAddManualIncome = async (e) => {
    e.preventDefault();
    if (!newManualIncome.note || !newManualIncome.amount) return onShowToast('Lengkapi data', 'error');
    await addDocument('transactions', {
      note: newManualIncome.note,
      subtotal: Number(newManualIncome.amount),
      total: Number(newManualIncome.amount),
      customerName: 'Pemasukan Manual',
      paymentStatus: 'LUNAS',
      createdAt: new Date()
    });
    setNewManualIncome({ note: '', amount: '' });
    onShowToast('Pemasukan dicatat', 'success');
  };

  const handlePayDebt = async () => {
    const amount = isFullPayment ? selectedCustomer.remainingDebt : Number(debtPaymentAmount);
    if (amount <= 0 || amount > selectedCustomer.remainingDebt) return onShowToast('Nominal tidak valid', 'error');
    
    const updateRes = await updateDocument('customers', selectedCustomer.id, {
      remainingDebt: selectedCustomer.remainingDebt - amount
    });

    if (updateRes.success) {
      await addDocument('transactions', {
        customerName: selectedCustomer.name,
        subtotal: amount,
        total: amount,
        note: 'Cicilan/Pelunasan Hutang',
        paymentStatus: 'LUNAS',
        createdAt: new Date()
      });
      onShowToast('Hutang diperbarui', 'success');
      setShowPayDebtModal(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const date = getSafeDate(t.createdAt);
      const matchesSearch = (t.customerName || t.note || '').toLowerCase().includes(searchTerm.toLowerCase());
      let matchesDate = true;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59);
        matchesDate = date >= start && date <= end;
      }
      return matchesSearch && matchesDate;
    });
  }, [transactions, searchTerm, startDate, endDate]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const date = getSafeDate(e.createdAt);
      const matchesSearch = e.title?.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesDate = true;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59);
        matchesDate = date >= start && date <= end;
      }
      return matchesSearch && matchesDate;
    });
  }, [expenses, searchTerm, startDate, endDate]);

  const handleBulkDelete = async () => {
    const target = activeTab === 'transactions' ? filteredTransactions : filteredExpenses;
    for (const item of target) {
      await deleteDocument(activeTab === 'transactions' ? 'transactions' : 'expenses', item.id);
    }
    onShowToast(`${target.length} data dihapus`, 'success');
    setShowBulkDeleteModal(false);
  };

  // --- EXPORT TOOLS (DIPERBAIKI LOGIKA 0 UNTUK HUTANG) ---
  const handleDownloadExcel = () => {
    const data = activeTab === 'transactions' ? filteredTransactions : filteredExpenses;
    const reportData = data.map(item => {
      // Jika HUTANG, tampilkan subtotal (nilai belanjaannya). Jika bukan, tampilkan total/amount.
      let nominalToShow = Number(item.total || item.amount || 0);
      if (item.paymentStatus === 'HUTANG' || (!item.total && item.subtotal)) {
        nominalToShow = Number(item.subtotal || 0);
      }

      return {
        Tanggal: formatDisplayDate(item.createdAt),
        Keterangan: item.customerName || item.note || item.title,
        Nominal: nominalToShow,
        Status: item.paymentStatus || 'PENGELUARAN'
      };
    });
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    XLSX.writeFile(wb, `Laporan_${activeTab}.xlsx`);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.text(`Detail Laporan ${activeTab}`, 14, 15);
    const body = (activeTab === 'transactions' ? filteredTransactions : filteredExpenses).map(t => {
      // Jika HUTANG, tampilkan subtotal (nilai belanjaannya). Jika bukan, tampilkan total/amount.
      let nominalToShow = Number(t.total || t.amount || 0);
      if (t.paymentStatus === 'HUTANG' || (!t.total && t.subtotal)) {
        nominalToShow = Number(t.subtotal || 0);
      }

      return [
        formatDisplayDate(t.createdAt),
        t.customerName || t.note || t.title,
        t.items?.map(i => `${i.name} (x${i.qty})`).join(', ') || t.note || '-',
        `Rp ${nominalToShow.toLocaleString()}`,
        t.note === 'Cicilan/Pelunasan Hutang' ? 'PELUNASAN' : (t.paymentStatus || 'LUNAS')
      ];
    });
    autoTable(doc, { head: [['Tanggal', 'Pihak', 'Detail', 'Total', 'Status']], body, startY: 20 });
    doc.save(`Laporan_PDF_${Date.now()}.pdf`);
  };

  if (loadingTrans || loadingExp || loadingCust) return <Loading />;

  const paginatedItems = (activeTab === 'transactions' ? filteredTransactions : filteredExpenses).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="pb-10 bg-gray-50 min-h-screen">
      {/* TABS NAVIGATION */}
      <div className="flex flex-wrap gap-2 mb-6 bg-white p-2 rounded-xl shadow-sm border no-print">
        {[{ id: 'overview', label: 'Ringkasan', icon: TrendingUp }, { id: 'transactions', label: 'Pemasukan', icon: ArrowUpCircle }, { id: 'expenses', label: 'Pengeluaran', icon: ArrowDownCircle }, { id: 'debts', label: 'Manajemen Hutang', icon: CreditCard }].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }} className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold ${activeTab === tab.id ? 'bg-teal-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 border-b-4 border-teal-500">
          <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Pemasukan (Cash)</p>
          <h3 className="text-xl font-black text-teal-700">Rp {(totalIncome || 0).toLocaleString()}</h3>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6 border-b-4 border-red-500">
          <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Total Pengeluaran</p>
          <h3 className="text-xl font-black text-red-600">Rp {(totalExpenses || 0).toLocaleString()}</h3>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6 border-b-4 border-orange-500">
          <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Piutang Klien (Lama+Baru)</p>
          <h3 className="text-xl font-black text-orange-600">Rp {(totalUnpaidDebt || 0).toLocaleString()}</h3>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6 border-b-4 border-blue-600">
          <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Saldo Bersih</p>
          <h3 className="text-xl font-black text-blue-700">Rp {(balance || 0).toLocaleString()}</h3>
        </div>
      </div>

      {/* --- TAB OVERVIEW --- */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
              <h3 className="text-lg font-black text-gray-800 flex items-center gap-2"><Clock className="text-teal-500" /> Analisis Arus Kas</h3>
              <div className="flex bg-gray-100 p-1 rounded-xl">
                {['daily', 'weekly', 'monthly', 'yearly'].map(p => (
                  <button key={p} onClick={() => setChartPeriod(p)} className={`px-4 py-1.5 text-[10px] font-black rounded-lg uppercase transition-all ${chartPeriod === p ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'}`}>
                    {p === 'daily' ? 'Hari' : p === 'weekly' ? 'Minggu' : p === 'monthly' ? 'Bulan' : 'Tahun'}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dynamicChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="label" style={{fontSize: '10px'}} />
                  <YAxis style={{fontSize: '10px'}} />
                  <Tooltip cursor={{fill: '#f9fafb'}} />
                  <Bar name="Masuk" dataKey="masuk" fill="#0d9488" radius={[6, 6, 0, 0]} />
                  <Bar name="Keluar" dataKey="keluar" fill="#dc2626" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border overflow-hidden">
            <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2"><ListFilter className="text-blue-500" /> Log Aktivitas (Maks 10)</h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {allActivityLog.slice(0, 10).map((log, idx) => {
                const isIncome = log.logType === 'TRANSACTION' && log.paymentStatus !== 'HUTANG';
                const isDebt = log.paymentStatus === 'HUTANG';
                const isExpense = log.logType === 'EXPENSE';
                return (
                  <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${
                    isIncome ? 'bg-teal-50 border-teal-100' : isExpense ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'
                  }`}>
                    <div className="min-w-0">
                      <p className={`text-sm font-black truncate ${isIncome ? 'text-teal-800' : isExpense ? 'text-red-800' : 'text-orange-800'}`}>{log.customerName || log.note || log.title}</p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase">{formatDisplayDate(log.createdAt)}</p>
                    </div>
                    <p className={`text-sm font-black ${isIncome ? 'text-teal-600' : isExpense ? 'text-red-600' : 'text-orange-600'}`}>
                      Rp {(Number(log.total || log.subtotal || log.amount) || 0).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB TRANSACTIONS & EXPENSES --- */}
      {(activeTab === 'transactions' || activeTab === 'expenses') && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{activeTab === 'transactions' ? 'Pemasukan Manual' : 'Catat Pengeluaran'}</h4>
            <form onSubmit={activeTab === 'transactions' ? handleAddManualIncome : (e) => { e.preventDefault(); addDocument('expenses', {...newExpense, amount: Number(newExpense.amount), createdAt: new Date()}); onShowToast('Disimpan', 'success'); setNewExpense({title: '', amount: '', category: 'Operasional'}); }} className="flex flex-wrap gap-3">
              <input type="text" placeholder="Deskripsi" className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold border-none" value={activeTab === 'transactions' ? newManualIncome.note : newExpense.title} onChange={e => activeTab === 'transactions' ? setNewManualIncome({...newManualIncome, note: e.target.value}) : setNewExpense({...newExpense, title: e.target.value})} />
              <input type="number" placeholder="Rp" className="w-44 bg-gray-50 rounded-xl px-4 py-3 text-sm font-black border-none" value={activeTab === 'transactions' ? newManualIncome.amount : newExpense.amount} onChange={e => activeTab === 'transactions' ? setNewManualIncome({...newManualIncome, amount: e.target.value}) : setNewExpense({...newExpense, amount: e.target.value})} />
              <button className={`px-8 py-3 rounded-xl font-black text-sm text-white ${activeTab === 'transactions' ? 'bg-teal-600' : 'bg-red-600'}`}>Simpan</button>
            </form>
          </div>
          <div className="bg-white p-4 rounded-2xl border flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-4 top-3 w-4 h-4 text-gray-300" /><input type="text" placeholder="Cari..." className="w-full pl-12 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm font-bold border-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
              <Calendar className="w-4 h-4 text-gray-400" /><input type="date" className="bg-transparent text-xs font-black" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span className="text-gray-300">-</span><input type="date" className="bg-transparent text-xs font-black" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="flex gap-2">
                <button onClick={() => setShowBulkDeleteModal(true)} className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-100"><Trash2 className="w-5 h-5" /></button>
                <button onClick={handleDownloadExcel} className="p-2.5 bg-green-50 text-green-600 rounded-xl border border-green-100 hover:bg-green-100"><TableIcon className="w-5 h-5" /></button>
                <button onClick={handleDownloadPDF} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-100"><FileText className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="bg-white rounded-[32px] border overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead><tr className="bg-gray-50/50"><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Tanggal</th><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Keterangan</th><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Nominal</th><th className="p-5 font-black text-gray-400 uppercase text-[10px] text-center">Status</th><th className="p-5 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th></tr></thead>
              <tbody className="divide-y">
                {paginatedItems.map(item => {
                  // Perhitungan nominal untuk tabel UI
                  let tableNominal = Number(item.total || item.amount || 0);
                  if (item.paymentStatus === 'HUTANG' || (!item.total && item.subtotal)) tableNominal = Number(item.subtotal || 0);

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors text-sm">
                      <td className="p-5 font-bold text-gray-500">{formatDisplayDate(item.createdAt)}</td>
                      <td className="p-5 font-black text-gray-800 uppercase">{item.customerName || item.note || item.title}</td>
                      <td className="p-5 font-black">Rp {tableNominal.toLocaleString()}</td>
                      <td className="p-5 text-center"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${item.paymentStatus === 'HUTANG' ? 'bg-orange-100 text-orange-600' : 'bg-teal-100 text-teal-600'}`}>{item.paymentStatus || 'LUNAS'}</span></td>
                      <td className="p-5 text-right"><div className="flex justify-end gap-2">{activeTab === 'transactions' && item.items && (<button onClick={() => { setSelectedNotaTransaction(item); setShowNota(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Eye className="w-4 h-4"/></button>)}<button onClick={() => { setSelectedItem(item); setShowDeleteModal(true); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB DEBTS --- */}
      {activeTab === 'debts' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border overflow-hidden shadow-sm">
              <div className="p-6 bg-gray-50 border-b flex justify-between items-center"><h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Daftar Tagihan Aktif</h3><div className="bg-orange-100 px-4 py-1 rounded-xl text-orange-600 font-black text-xs uppercase tracking-tighter">Total Piutang: Rp {(totalUnpaidDebt || 0).toLocaleString()}</div></div>
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b"><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Pelanggan</th><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Total Hutang (Lama+Baru)</th><th className="p-5 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th></tr></thead>
                <tbody className="divide-y">
                  {customers.filter(c => (Number(c.remainingDebt) || 0) > 0).map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-all">
                      <td className="p-5"><div><p className="font-black text-gray-800 uppercase">{c.name}</p><p className="text-xs text-gray-400 font-bold">{c.phone || '-'}</p></div></td>
                      <td className="p-5 font-black text-red-600 italic text-lg">Rp {(Number(c.remainingDebt) || 0).toLocaleString()}</td>
                      <td className="p-5 text-right"><button onClick={() => { setSelectedCustomer(c); setShowPayDebtModal(true); setDebtPaymentAmount(''); setIsFullPayment(true); }} className="bg-teal-600 text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-lg hover:bg-teal-700 uppercase tracking-tighter transition-all">Bayar / Cicil</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white p-8 rounded-3xl border shadow-sm">
            <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2"><History className="text-orange-500" /> Histori Hutang</h3>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {debtHistory.slice(0, 10).map((log, idx) => (
                <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${log.paymentStatus === 'HUTANG' ? 'bg-orange-50 border-orange-100' : 'bg-teal-50 border-teal-100'}`}>
                  <div className="min-w-0"><p className="text-xs font-black text-gray-800 truncate uppercase">{log.customerName}</p><p className="text-[9px] text-gray-400 font-bold uppercase">{formatDisplayDate(log.createdAt)}</p></div>
                  <p className={`text-xs font-black ${log.paymentStatus === 'HUTANG' ? 'text-orange-600' : 'text-teal-600'}`}>{log.paymentStatus === 'HUTANG' ? '+' : '-'} Rp {(Number(log.subtotal || log.total) || 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      {showPayDebtModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[40px] p-10 max-w-sm w-full shadow-2xl relative border-t-8 border-teal-600">
            <button onClick={() => setShowPayDebtModal(false)} className="absolute right-8 top-8 text-gray-400 hover:text-gray-600"><X /></button>
            <h3 className="text-xl font-black text-gray-800 mb-2 uppercase">Terima Pembayaran</h3>
            <p className="text-sm text-gray-500 mb-8 font-bold uppercase tracking-widest text-teal-600">{selectedCustomer.name}</p>
            <div className="flex bg-gray-100 p-1 rounded-2xl mb-8">
              <button onClick={() => setIsFullPayment(true)} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${isFullPayment ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'}`}>Lunasi Semua</button>
              <button onClick={() => setIsFullPayment(false)} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${!isFullPayment ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'}`}>Cicil</button>
            </div>
            <div className="bg-orange-50 p-5 rounded-3xl mb-8 border border-orange-100 shadow-inner"><p className="text-[10px] font-black text-orange-600 uppercase mb-1">Tagihan Kumulatif</p><p className="text-2xl font-black text-orange-700">Rp {(Number(selectedCustomer.remainingDebt) || 0).toLocaleString()}</p></div>
            {!isFullPayment && <div className="mb-8"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-2 block">Nominal Bayar</label><input type="number" className="w-full bg-gray-50 rounded-2xl px-6 py-5 text-xl font-black text-teal-600 focus:ring-2 focus:ring-teal-500 outline-none border-none" value={debtPaymentAmount} onChange={e => setDebtPaymentAmount(e.target.value)} placeholder="0" /></div>}
            <button onClick={handlePayDebt} className="w-full bg-teal-600 text-white py-5 rounded-2xl font-black text-sm shadow-xl shadow-teal-100 hover:bg-teal-700 transition-all uppercase tracking-widest active:scale-95">Simpan Pembayaran</button>
          </div>
        </div>
      )}

      {/* --- MODAL HAPUS SATUAN & MASAL --- */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-xl font-black text-gray-800 mb-8">Hapus Data Ini?</h3>
            <div className="flex gap-4">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-4 font-black text-gray-400 text-sm">Batal</button>
              <button onClick={async () => { await deleteDocument(activeTab === 'expenses' ? 'expenses' : 'transactions', selectedItem.id); onShowToast('Dihapus', 'success'); setShowDeleteModal(false); }} className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-xl font-black text-gray-800 mb-2">Hapus Masal?</h3>
            <p className="text-sm text-gray-500 mb-8 font-bold">Menghapus {(activeTab === 'transactions' ? filteredTransactions : filteredExpenses).length} data.</p>
            <div className="flex flex-col gap-2">
              <button onClick={handleBulkDelete} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-red-100">Ya, Hapus Semua</button>
              <button onClick={() => setShowBulkDeleteModal(false)} className="w-full py-4 font-black text-gray-400 text-sm">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* STYLE HAPUS LOCALHOST SAAT PRINT */}
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
        }
      `}</style>

      {showNota && selectedNotaTransaction && (<Nota transaction={selectedNotaTransaction} onClose={() => setShowNota(false)} />)}
    </div>
  );
};

export default Dashboard;