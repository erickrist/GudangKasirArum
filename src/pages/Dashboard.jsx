import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { 
  TrendingUp, Trash2, Eye, FileText, Table as TableIcon, Search, Calendar, Wallet, 
  CreditCard, ArrowDownCircle, ArrowUpCircle, History, Clock, ListFilter, X, RotateCcw, PackagePlus, ChevronDown, ChevronLeft, ChevronRight, AlertTriangle, Edit3, Download, ShoppingCart, Landmark
} from 'lucide-react';
import { useCollection, deleteDocument, addDocument, updateDocument } from '../hooks/useFirestore';
import Loading from '../components/common/Loading';
import Nota from '../components/Nota';
import FormRetur from '../components/FormRetur';
import EditTransactionModal from '../components/EditTransactionModal';

// Library untuk Export
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- KOMPONEN SMART DROPDOWN PENCARIAN ---
const CustomerSearchSelect = ({ customers, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.phone && c.phone.includes(search))
  );

  const selected = customers.find(c => c.id === value);

  return (
    <div className="relative flex-1 w-full" ref={wrapperRef}>
      <div 
        className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold text-gray-800 cursor-pointer flex justify-between items-center border border-transparent hover:border-teal-300 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selected ? 'text-gray-800' : 'text-gray-400'}>
          {selected ? `${selected.name} ${selected.phone ? `(${selected.phone})` : ''}` : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar overflow-hidden">
          <div className="p-2 sticky top-0 bg-white border-b border-gray-100 shadow-sm z-10">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Ketik nama pembeli..." 
                className="w-full bg-gray-50 rounded-lg pl-9 pr-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
                autoFocus
              />
            </div>
          </div>
          <div className="py-1">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-4 font-bold">Tidak ditemukan</p>
            ) : (
              filtered.map(c => (
                <div 
                  key={c.id} 
                  className="px-4 py-2.5 hover:bg-teal-50 cursor-pointer border-b border-gray-50 last:border-0"
                  onClick={() => { onChange(c.id); setIsOpen(false); setSearch(''); }}
                >
                  <p className="font-black text-sm text-gray-800 uppercase">{c.name}</p>
                  {c.phone && <p className="text-[10px] text-gray-500 font-bold">{c.phone}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Dashboard = ({ onShowToast }) => {
  const { data: transactions, loading: loadingTrans } = useCollection('transactions', 'createdAt');
  const { data: expenses, loading: loadingExp } = useCollection('expenses', 'createdAt');
  const { data: customers, loading: loadingCust } = useCollection('customers');
  const { data: returnsData = [], loading: loadingRet } = useCollection('returns', 'createdAt');
  const { data: products, loading: loadingProd } = useCollection('products');

  const [activeTab, setActiveTab] = useState('overview');
  const [chartPeriod, setChartPeriod] = useState('daily');
  const [showAllLogs, setShowAllLogs] = useState(false); 
  
  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPayDebtModal, setShowPayDebtModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false); 
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Edit Transaction Modals
  const [showEditTransModal, setShowEditTransModal] = useState(false);
  const [selectedEditTransaction, setSelectedEditTransaction] = useState(null);

  // Edit Balance Modals
  const [showEditBalanceModal, setShowEditBalanceModal] = useState(false);
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

  const [newManualIncome, setNewManualIncome] = useState({ note: '', amount: '', method: 'TUNAI' });
  const [newExpense, setNewExpense] = useState({ title: '', amount: '', category: 'Operasional' });
  const [newManualDebt, setNewManualDebt] = useState({ customerId: '', amount: '', note: '' });

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

  // --- FINANCIAL CALCULATIONS (DIPERBAIKI DENGAN HPP, SALDO DISATUKAN KEMBALI) ---
  const totalIncome = useMemo(() => transactions.reduce((sum, t) => sum + (Number(t.total) || 0), 0), [transactions]);
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0), [expenses]);
  const totalUnpaidDebt = useMemo(() => customers.reduce((sum, c) => sum + (Number(c.remainingDebt) || 0), 0), [customers]);
  const totalDeposit = useMemo(() => customers.reduce((sum, c) => sum + (Number(c.returnAmount) || 0), 0), [customers]);
  const balance = totalIncome - totalExpenses;

  // Penghitungan HPP (Harga Pokok Penjualan) untuk Laba Rugi
  const totalHPP = useMemo(() => transactions.reduce((sum, t) => {
    if (!t.items) return sum;
    const itemHpp = t.items.reduce((iSum, i) => {
      // Ambil capitalPrice jika ada, jika tidak ada fallback ke 0
      return iSum + (Number(i.capitalPrice || 0) * Number(i.qty || 0)); 
    }, 0);
    return sum + itemHpp;
  }, 0), [transactions]);

  // --- LOGIKA HISTORI SPESIFIK (+/-) ---
  const debtLogs = useMemo(() => {
    let logs = [];
    transactions.forEach(t => {
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
  }, [transactions]);

  const depositLogs = useMemo(() => {
    let logs = [];
    returnsData.forEach(r => {
      if (r.refundType === 'deposit' || r.type === 'manual_deposit_in') {
        logs.push({ ...r, sourceCollection: 'returns', depType: 'in', nominal: r.amount, note: r.note || `Retur: ${r.reason}` });
      } else if (r.type === 'manual_deposit_out') {
        logs.push({ ...r, sourceCollection: 'returns', depType: 'out', nominal: r.amount, note: r.note });
      }
    });
    transactions.forEach(t => {
      if (t.returnUsed > 0) logs.push({ ...t, sourceCollection: 'transactions', depType: 'out', nominal: t.returnUsed, note: `Dipakai belanja (Nota: #${t.id?.substring(0,6)})` });
    });
    return logs.sort((a, b) => getSafeDate(b.createdAt) - getSafeDate(a.createdAt));
  }, [returnsData, transactions]);

  const netLogs = useMemo(() => {
    let logs = [];
    transactions.forEach(t => {
      if (Number(t.total) > 0) {
        logs.push({ ...t, sourceCollection: 'transactions', netType: 'in', nominal: t.total, subjName: t.customerName || 'Pemasukan Kas', detailNote: t.note || (t.items ? t.items.map(i => i.name).join(', ') : `Transaksi Lunas`), paymentMethod: t.paymentMethod || 'TUNAI' });
      }
    });
    expenses.forEach(e => {
      logs.push({ ...e, sourceCollection: 'expenses', netType: 'out', nominal: e.amount, subjName: 'Beban/Pengeluaran', detailNote: e.title });
    });
    return logs.sort((a, b) => getSafeDate(b.createdAt) - getSafeDate(a.createdAt));
  }, [transactions, expenses]);

  // --- LOG CEPAT KESELURUHAN (ALL ACTIVITIES) ---
  const allActivityLogs = useMemo(() => {
    let logs = [];
    netLogs.forEach(l => {
      logs.push({ ...l, logTime: getSafeDate(l.createdAt), logCategory: 'KAS', logType: l.netType, logLabel: l.netType === 'in' ? `Kas Masuk` : 'Kas Keluar', logTitle: l.subjName, logDetail: l.detailNote })
    });
    debtLogs.forEach(l => logs.push({ ...l, logTime: getSafeDate(l.createdAt), logCategory: 'HUTANG', logType: l.debtType, logLabel: l.debtType === 'in' ? 'Hutang Bertambah' : 'Hutang Berkurang', logTitle: l.customerName || 'Tanpa Nama', logDetail: l.note }));
    depositLogs.forEach(l => logs.push({ ...l, logTime: getSafeDate(l.createdAt), logCategory: 'DEPOSIT', logType: l.depType, logLabel: l.depType === 'in' ? 'Deposit Masuk' : 'Deposit Terpakai', logTitle: l.customerName || 'Tanpa Nama', logDetail: l.note }));
    return logs.sort((a, b) => b.logTime - a.logTime);
  }, [netLogs, debtLogs, depositLogs]);

  // --- CHART LOGIC ---
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
    processData(transactions, false);
    processData(expenses, true);
    return Object.values(dataMap).slice(-12);
  }, [transactions, expenses, chartPeriod]);

  // --- ACTION HANDLERS ---
  const handleAddManualIncome = async (e) => {
    e.preventDefault();
    if (!newManualIncome.note || !newManualIncome.amount) return onShowToast('Lengkapi data', 'error');
    await addDocument('transactions', { note: newManualIncome.note, subtotal: Number(newManualIncome.amount), total: Number(newManualIncome.amount), customerName: 'Pemasukan Manual', paymentStatus: 'LUNAS', paymentMethod: newManualIncome.method, createdAt: new Date() });
    setNewManualIncome({ note: '', amount: '', method: 'TUNAI' });
    onShowToast('Pemasukan dicatat', 'success');
  };

  const handlePayDebt = async () => {
    const amount = isFullPayment ? selectedCustomer.remainingDebt : Number(debtPaymentAmount);
    if (amount <= 0 || amount > selectedCustomer.remainingDebt) return onShowToast('Nominal tidak valid', 'error');
    const updateRes = await updateDocument('customers', selectedCustomer.id, { remainingDebt: selectedCustomer.remainingDebt - amount });
    if (updateRes.success) {
      // Pembayaran cicilan dicatat dengan method yang bisa disesuaikan, untuk simplicity di set TUNAI/dari Kasir
      await addDocument('transactions', { customerName: selectedCustomer.name, customerId: selectedCustomer.id, subtotal: amount, total: amount, note: 'Pelunasan Hutang Manual', paymentStatus: 'LUNAS', paymentMethod: 'TUNAI', createdAt: new Date() });
      onShowToast('Hutang diperbarui', 'success');
      setShowPayDebtModal(false);
    }
  };

  const handleAddManualDebt = async (e) => {
    e.preventDefault();
    if (!newManualDebt.customerId || !newManualDebt.amount) return onShowToast('Pilih pelanggan dan isi nominal', 'error');
    const cust = customers.find(c => c.id === newManualDebt.customerId);
    if (!cust) return;
    const amount = Number(newManualDebt.amount);
    const updateRes = await updateDocument('customers', cust.id, { remainingDebt: (Number(cust.remainingDebt) || 0) + amount });
    if (updateRes.success) {
      await addDocument('transactions', { customerName: cust.name, customerId: cust.id, subtotal: amount, total: 0, note: newManualDebt.note || 'Penambahan Hutang Manual', paymentStatus: 'HUTANG', createdAt: new Date() });
      onShowToast('Hutang manual berhasil ditambahkan', 'success');
      setNewManualDebt({ customerId: '', amount: '', note: '' });
    }
  };

  const handleSaveEditBalance = async () => {
    const newAmount = Number(editBalanceAmount);
    if (isNaN(newAmount) || newAmount < 0) return onShowToast('Nominal tidak valid', 'error');
    
    if (editBalanceType === 'debt') {
      const oldAmount = Number(selectedCustomer.remainingDebt) || 0;
      const diff = newAmount - oldAmount;
      if (diff === 0) { setShowEditBalanceModal(false); return; }
      
      await updateDocument('customers', selectedCustomer.id, { remainingDebt: newAmount });
      if (diff > 0) {
        await addDocument('transactions', { customerName: selectedCustomer.name, customerId: selectedCustomer.id, subtotal: diff, total: 0, note: 'Koreksi Hutang (Bertambah)', paymentStatus: 'HUTANG', createdAt: new Date() });
      } else {
        await addDocument('transactions', { customerName: selectedCustomer.name, customerId: selectedCustomer.id, subtotal: Math.abs(diff), total: 0, note: 'Koreksi Hutang (Berkurang)', paymentStatus: 'LUNAS', createdAt: new Date() });
      }
      onShowToast('Hutang berhasil diubah', 'success');
      
    } else {
      const oldAmount = Number(selectedCustomer.returnAmount) || 0;
      const diff = newAmount - oldAmount;
      if (diff === 0) { setShowEditBalanceModal(false); return; }

      await updateDocument('customers', selectedCustomer.id, { returnAmount: newAmount });
      if (diff > 0) {
        await addDocument('returns', { customerName: selectedCustomer.name, customerId: selectedCustomer.id, amount: diff, type: 'manual_deposit_in', note: 'Koreksi Deposit (Bertambah)', createdAt: new Date() });
      } else {
        await addDocument('returns', { customerName: selectedCustomer.name, customerId: selectedCustomer.id, amount: Math.abs(diff), type: 'manual_deposit_out', note: 'Koreksi Deposit (Berkurang)', createdAt: new Date() });
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
      onShowToast('Seluruh data transaksi, hutang, dan deposit berhasil dihapus bersih', 'success');
      setShowResetModal(false);
    } catch (error) {
      onShowToast('Gagal mereset sebagian data. Periksa koneksi.', 'error');
    }
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

  const salesData = transactions.filter(t => t.items && t.items.length > 0);
  const incomeData = transactions.filter(t => !t.items || t.items.length === 0);

  const filteredSales = useMemo(() => applyFilters(salesData, ['customerName', 'note']), [salesData, searchTerm, startDate, endDate]);
  const filteredTransactions = useMemo(() => applyFilters(incomeData, ['customerName', 'note']), [incomeData, searchTerm, startDate, endDate]);
  const filteredExpenses = useMemo(() => applyFilters(expenses, ['title']), [expenses, searchTerm, startDate, endDate]);
  const filteredDebtHistory = useMemo(() => applyFilters(debtLogs, ['customerName', 'note']), [debtLogs, searchTerm, startDate, endDate]);
  const filteredDepositHistory = useMemo(() => applyFilters(depositLogs, ['customerName', 'note', 'reason']), [depositLogs, searchTerm, startDate, endDate]);
  const filteredNetBalance = useMemo(() => applyFilters(netLogs, ['customerName', 'note', 'title', 'subjName', 'detailNote']), [netLogs, searchTerm, startDate, endDate]);

  const handleBulkDelete = async () => {
    let target = []; 
    if (activeTab === 'sales') target = filteredSales; 
    else if (activeTab === 'transactions') target = filteredTransactions; 
    else if (activeTab === 'expenses') target = filteredExpenses; 
    else if (activeTab === 'debts') target = filteredDebtHistory;
    else if (activeTab === 'returns') target = filteredDepositHistory;

    if (target.length === 0) return onShowToast('Tidak ada data untuk dihapus pada tab ini', 'error');
    
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

  // =====================================================================
  // --- FUNGSI EXPORT EXCEL (MASTER) ---
  // =====================================================================
  const handleDownloadMasterExcel = () => { 
    if (filteredNetBalance.length === 0 && filteredDebtHistory.length === 0 && filteredDepositHistory.length === 0) {
      return onShowToast('Tidak ada data untuk dicetak pada periode ini', 'error');
    }
    const wb = XLSX.utils.book_new();

    // 1. PEMASUKAN
    let totalIn = 0;
    const inData = transactions.filter(t => Number(t.total) > 0).map(t => {
      totalIn += Number(t.total);
      return { 'Tanggal & Jam': formatDisplayDate(t.createdAt), 'Metode': t.paymentMethod || 'TUNAI', 'Nama Pembeli': t.customerName || 'Tanpa Nama', 'Keterangan Rinci': t.note || (t.items ? t.items.map(i => i.name).join(', ') : 'Transaksi Pemasukan'), 'Nominal': `+ Rp ${Number(t.total).toLocaleString('id-ID')}` };
    });
    if (inData.length > 0) {
      inData.push({ 'Tanggal & Jam': 'TOTAL PEMASUKAN', 'Metode': '', 'Nama Pembeli': '', 'Keterangan Rinci': '', 'Nominal': `Rp ${totalIn.toLocaleString('id-ID')}` });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inData), "1. Pemasukan");
    }

    // 2. PENGELUARAN
    let totalEx = 0;
    const exData = filteredExpenses.map(e => {
      totalEx += Number(e.amount);
      return { 'Tanggal & Jam': formatDisplayDate(e.createdAt), 'Keterangan Pengeluaran': e.title, 'Nominal': `- Rp ${Number(e.amount).toLocaleString('id-ID')}` };
    });
    if (exData.length > 0) {
      exData.push({ 'Tanggal & Jam': 'TOTAL PENGELUARAN', 'Keterangan Pengeluaran': '', 'Nominal': `Rp ${totalEx.toLocaleString('id-ID')}` });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exData), "2. Pengeluaran");
    }

    // 3. HISTORI HUTANG
    let inDebtEx = 0, outDebtEx = 0;
    const debtHistData = filteredDebtHistory.map(item => {
      const nominal = Number(item.nominal) || 0;
      if (item.debtType === 'in') inDebtEx += nominal; else outDebtEx += nominal;
      return { 'Tanggal & Jam': formatDisplayDate(item.createdAt), 'Status': item.debtType === 'in' ? 'BERTAMBAH' : 'BERKURANG', 'Nama Pembeli': item.customerName || 'Tanpa Nama', 'Keterangan': item.note || 'Belanja Hutang', 'Nominal': (item.debtType === 'in' ? '+' : '-') + ` Rp ${nominal.toLocaleString('id-ID')}` };
    });
    if (debtHistData.length > 0) {
      debtHistData.push({ 'Tanggal & Jam': `TOTAL MASUK: Rp ${inDebtEx.toLocaleString('id-ID')} | KELUAR: Rp ${outDebtEx.toLocaleString('id-ID')}`, 'Status': '', 'Nama Pembeli': '', 'Keterangan': 'NET:', 'Nominal': `Rp ${Math.abs(inDebtEx - outDebtEx).toLocaleString('id-ID')}` });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(debtHistData), "3. Histori Hutang");
    }

    // 4. DAFTAR HUTANG
    let totalDebtAct = 0;
    const activeDebts = customers.filter(c => (Number(c.remainingDebt) || 0) > 0).map(c => {
      totalDebtAct += Number(c.remainingDebt);
      return { 'Nama Pembeli': c.name, 'No. Telepon': c.phone || '-', 'Sisa Hutang': Number(c.remainingDebt).toLocaleString('id-ID') };
    });
    if (activeDebts.length > 0) {
      activeDebts.push({ 'Nama Pembeli': 'TOTAL KESELURUHAN PIUTANG', 'No. Telepon': '', 'Sisa Hutang': totalDebtAct.toLocaleString('id-ID') });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(activeDebts), "4. Daftar Hutang Aktif");
    }

    // 5. HISTORI DEPOSIT
    let inDepEx = 0, outDepEx = 0;
    const depHistData = filteredDepositHistory.map(item => {
      const nominal = Number(item.nominal) || 0;
      if (item.depType === 'in') inDepEx += nominal; else outDepEx += nominal;
      return { 'Tanggal & Jam': formatDisplayDate(item.createdAt), 'Status': item.depType === 'in' ? 'BERTAMBAH' : 'BERKURANG', 'Nama Pembeli': item.customerName || 'Tanpa Nama', 'Keterangan': item.note || 'Retur', 'Nominal': (item.depType === 'in' ? '+' : '-') + ` Rp ${nominal.toLocaleString('id-ID')}` };
    });
    if (depHistData.length > 0) {
      depHistData.push({ 'Tanggal & Jam': `TOTAL MASUK: Rp ${inDepEx.toLocaleString('id-ID')} | KELUAR: Rp ${outDepEx.toLocaleString('id-ID')}`, 'Status': '', 'Nama Pembeli': '', 'Keterangan': 'NET:', 'Nominal': `Rp ${Math.abs(inDepEx - outDepEx).toLocaleString('id-ID')}` });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(depHistData), "5. Histori Deposit");
    }

    // 6. DAFTAR DEPOSIT
    let totalDepAct = 0;
    const activeDeposits = customers.filter(c => (Number(c.returnAmount) || 0) > 0).map(c => {
      totalDepAct += Number(c.returnAmount);
      return { 'Nama Pembeli': c.name, 'No. Telepon': c.phone || '-', 'Saldo Deposit': Number(c.returnAmount).toLocaleString('id-ID') };
    });
    if (activeDeposits.length > 0) {
      activeDeposits.push({ 'Nama Pembeli': 'TOTAL KESELURUHAN DEPOSIT', 'No. Telepon': '', 'Saldo Deposit': totalDepAct.toLocaleString('id-ID') });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(activeDeposits), "6. Daftar Deposit Aktif");
    }

    // 7. SALDO BERSIH
    let netInEx = 0, netOutEx = 0;
    const netData = filteredNetBalance.map(item => {
      const nominal = Number(item.nominal) || 0;
      if (item.netType === 'in') netInEx += nominal; else netOutEx += nominal;
      return { 'Tanggal & Jam': formatDisplayDate(item.createdAt), 'Kategori': item.netType === 'in' ? 'PEMASUKAN' : 'PENGELUARAN', 'Nama / Subjek': item.subjName, 'Keterangan Rinci': item.detailNote, 'Metode (Masuk)': item.paymentMethod || '-', 'Nominal Kas': (item.netType === 'in' ? '+' : '-') + ` Rp ${nominal.toLocaleString('id-ID')}` };
    });
    if (netData.length > 0) {
      netData.push({ 'Tanggal & Jam': `TOTAL MASUK: Rp ${netInEx.toLocaleString('id-ID')} | KELUAR: Rp ${netOutEx.toLocaleString('id-ID')}`, 'Kategori': '', 'Nama / Subjek': '', 'Keterangan Rinci': '', 'Metode (Masuk)': 'SALDO AKHIR:', 'Nominal Kas': `Rp ${(netInEx - netOutEx).toLocaleString('id-ID')}` });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(netData), "7. Saldo Bersih");
    }

    XLSX.writeFile(wb, `Laporan_Buku_Kas_${startDate||'Awal'}_sd_${endDate||'Sekarang'}.xlsx`);
    onShowToast('File Excel berhasil diunduh', 'success');
  };

  // =====================================================================
  // --- FUNGSI EXPORT EXCEL (NERACA SALDO DIPERBAIKI) ---
  // =====================================================================
  const handleDownloadNeracaExcel = () => {
    const totalDebit = balance + totalUnpaidDebt + totalExpenses;
    const totalKredit = totalDeposit + totalIncome;

    const aoaData = [
      ['LAPORAN NERACA SALDO'],
      ['ARZEN Frozen Food'],
      [`Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`],
      [],
      ['No. Akun', 'Nama Akun / Uraian', 'Debit', 'Kredit'],
      ['101', 'Kas & Bank (Saldo Bersih Keseluruhan)', balance, 0],
      ['102', 'Piutang Usaha (Hutang Pelanggan)', totalUnpaidDebt, 0],
      ['201', 'Titipan / Deposit Pelanggan', 0, totalDeposit],
      ['401', 'Pendapatan Usaha (Total Penjualan)', 0, totalIncome],
      ['501', 'Beban Operasional (Total Pengeluaran)', totalExpenses, 0],
      ['', 'TOTAL KESELURUHAN', totalDebit, totalKredit],
      [],
      ['*Catatan: Laporan ini disusun menggunakan metode Buku Kas Tunggal (Single Entry).'],
      ['*Total Debit dan Kredit dapat memiliki selisih wajar apabila terdapat penambahan manual.']
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoaData);
    ws['!cols'] = [{ wch: 12 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Neraca Saldo");
    XLSX.writeFile(wb, `Neraca_Saldo_${Date.now()}.xlsx`);
    onShowToast('File Excel Neraca Saldo berhasil diunduh', 'success');
  };

  // =====================================================================
  // --- FUNGSI EXPORT EXCEL (LABA RUGI DIPERBAIKI DENGAN HPP) ---
  // =====================================================================
  const handleDownloadLabaRugiExcel = () => {
    const labaKotor = totalIncome - totalHPP;
    const labaBersih = labaKotor - totalExpenses;

    const aoaData = [
      ['LAPORAN LABA RUGI (CASH BASIS)'],
      ['ARZEN Frozen Food'],
      [`Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`],
      [],
      ['Keterangan', 'Nominal (Rp)'],
      ['PENDAPATAN', ''],
      ['Total Pemasukan Penjualan', totalIncome],
      ['Harga Pokok Penjualan (HPP)', `-${totalHPP}`],
      ['LABA KOTOR', labaKotor],
      [],
      ['BEBAN / PENGELUARAN', ''],
      ['Total Pengeluaran Operasional', `-${totalExpenses}`],
      [],
      ['LABA / (RUGI) BERSIH', labaBersih]
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoaData);
    ws['!cols'] = [{ wch: 45 }, { wch: 25 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laba Rugi");
    XLSX.writeFile(wb, `Laba_Rugi_${Date.now()}.xlsx`);
    onShowToast('File Excel Laba Rugi berhasil diunduh', 'success');
  };

  // =====================================================================
  // --- FUNGSI EXPORT PDF (MASTER) ---
  // =====================================================================
  const handleDownloadMasterPDF = () => { 
    if (filteredNetBalance.length === 0 && filteredDebtHistory.length === 0 && filteredDepositHistory.length === 0) {
      return onShowToast('Tidak ada data untuk dicetak pada periode ini', 'error');
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("Laporan Keseluruhan ARZEN Frozen Food", 14, 15);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`, 14, 22);

    let currentY = 32;

    const customDidParseCell = (data) => {
      if (data.section === 'body') {
        const lastColIndex = data.table.columns.length - 1;
        if (data.column.index === lastColIndex && typeof data.cell.raw === 'string') {
          if (data.cell.raw.includes('+')) data.cell.styles.textColor = [0, 128, 0];
          if (data.cell.raw.includes('-')) data.cell.styles.textColor = [220, 38, 38];
        }
      }
    };

    const checkPageBreak = (spaceNeeded) => {
      if (currentY + spaceNeeded > 280) { doc.addPage(); currentY = 20; }
    };

    // 1. PEMASUKAN
    const inList = transactions.filter(t => Number(t.total) > 0);
    if (inList.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("1. PEMASUKAN  ", 14, currentY); currentY += 5;
      let totalIn = 0;
      const inBody = inList.map(t => {
        totalIn += Number(t.total);
        return [formatDisplayDate(t.createdAt), t.paymentMethod || 'TUNAI', t.customerName || 'Tanpa Nama', t.note || (t.items ? t.items.map(i => i.name).join(', ') : 'Transaksi Pemasukan'), `+ Rp ${Number(t.total).toLocaleString('id-ID')}`];
      });
      inBody.push([
        { content: 'TOTAL PEMASUKAN KESELURUHAN:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `Rp ${totalIn.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [0, 128, 0], fillColor: [230, 245, 230] } }
      ]);
      autoTable(doc, { startY: currentY, head: [['Tanggal & Jam', 'Metode', 'Nama Pembeli', 'Keterangan Rinci', 'Nominal']], body: inBody, theme: 'grid', headStyles: { fillColor: [46, 204, 113] }, didParseCell: customDidParseCell, margin: { left: 14 } });
      currentY = doc.lastAutoTable.finalY + 12;
    }

    // 2. PENGELUARAN
    if (filteredExpenses.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("2. PENGELUARAN  ", 14, currentY); currentY += 5;
      let totalEx = 0;
      const exBody = filteredExpenses.map(e => {
        totalEx += Number(e.amount);
        return [formatDisplayDate(e.createdAt), e.title, `- Rp ${Number(e.amount).toLocaleString('id-ID')}`];
      });
      exBody.push([
        { content: 'TOTAL PENGELUARAN KESELURUHAN:', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `Rp ${totalEx.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [220, 38, 38], fillColor: [253, 237, 236] } }
      ]);
      autoTable(doc, { startY: currentY, head: [['Tanggal & Jam', 'Keterangan Pengeluaran', 'Nominal']], body: exBody, theme: 'grid', headStyles: { fillColor: [231, 76, 60] }, didParseCell: customDidParseCell, margin: { left: 14 } });
      currentY = doc.lastAutoTable.finalY + 12;
    }

    // 3. HISTORI HUTANG
    if (filteredDebtHistory.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("3. HISTORI HUTANG  ", 14, currentY); currentY += 5;
      let inDebt = 0, outDebt = 0;
      const debtHistBody = filteredDebtHistory.map(item => {
        const nominal = Number(item.nominal) || 0;
        if (item.debtType === 'in') inDebt += nominal; else outDebt += nominal;
        return [formatDisplayDate(item.createdAt), item.debtType === 'in' ? 'BERTAMBAH' : 'BERKURANG', `${item.customerName || 'Tanpa Nama'} [${item.note || 'Belanja Hutang'}]`, (item.debtType === 'in' ? '+' : '-') + ` Rp ${nominal.toLocaleString('id-ID')}`];
      });
      debtHistBody.push([
        { content: `TOTAL MASUK: Rp ${inDebt.toLocaleString('id-ID')} | KELUAR: Rp ${outDebt.toLocaleString('id-ID')}`, colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `NET: Rp ${Math.abs(inDebt - outDebt).toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [0, 128, 0], fillColor: [230, 245, 230] } }
      ]);
      autoTable(doc, { startY: currentY, head: [['Tanggal & Jam', 'Status', 'Keterangan Detail', 'Nominal']], body: debtHistBody, theme: 'grid', headStyles: { fillColor: [230, 126, 34] }, didParseCell: customDidParseCell, margin: { left: 14 } });
      currentY = doc.lastAutoTable.finalY + 12;
    }

    // 4. DAFTAR HUTANG
    const activeDebts = customers.filter(c => (Number(c.remainingDebt) || 0) > 0);
    if (activeDebts.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("4. DAFTAR HUTANG (PIUTANG AKTIF)", 14, currentY); currentY += 5;
      let totalActDebt = 0;
      const actDebtBody = activeDebts.map(c => {
        totalActDebt += Number(c.remainingDebt);
        return [c.name, c.phone || '-', `Rp ${Number(c.remainingDebt).toLocaleString('id-ID')}`];
      });
      actDebtBody.push([
        { content: 'TOTAL KESELURUHAN PIUTANG:', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `Rp ${totalActDebt.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [220, 38, 38], fillColor: [253, 237, 236] } }
      ]);
      autoTable(doc, { startY: currentY, head: [['Nama Pembeli', 'No. Telepon', 'Sisa Hutang']], body: actDebtBody, theme: 'grid', headStyles: { fillColor: [211, 84, 0] }, margin: { left: 14 } });
      currentY = doc.lastAutoTable.finalY + 12;
    }

    // 5. HISTORI DEPOSIT
    if (filteredDepositHistory.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("5. HISTORI DEPOSIT  ", 14, currentY); currentY += 5;
      let inDep = 0, outDep = 0;
      const depHistBody = filteredDepositHistory.map(item => {
        const nominal = Number(item.nominal) || 0;
        if (item.depType === 'in') inDep += nominal; else outDep += nominal;
        return [formatDisplayDate(item.createdAt), item.depType === 'in' ? 'BERTAMBAH' : 'BERKURANG', `${item.customerName || 'Tanpa Nama'} [${item.note || 'Retur'}]`, (item.depType === 'in' ? '+' : '-') + ` Rp ${nominal.toLocaleString('id-ID')}`];
      });
      depHistBody.push([
        { content: `TOTAL MASUK: Rp ${inDep.toLocaleString('id-ID')} | KELUAR: Rp ${outDep.toLocaleString('id-ID')}`, colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `NET: Rp ${Math.abs(inDep - outDep).toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [0, 128, 0], fillColor: [230, 245, 230] } }
      ]);
      autoTable(doc, { startY: currentY, head: [['Tanggal & Jam', 'Status', 'Keterangan Detail', 'Nominal']], body: depHistBody, theme: 'grid', headStyles: { fillColor: [155, 89, 182] }, didParseCell: customDidParseCell, margin: { left: 14 } });
      currentY = doc.lastAutoTable.finalY + 12;
    }

    // 6. DAFTAR DEPOSIT
    const activeDeposits = customers.filter(c => (Number(c.returnAmount) || 0) > 0);
    if (activeDeposits.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("6. DAFTAR DEPOSIT AKTIF", 14, currentY); currentY += 5;
      let totalActDep = 0;
      const actDepBody = activeDeposits.map(c => {
        totalActDep += Number(c.returnAmount);
        return [c.name, c.phone || '-', `Rp ${Number(c.returnAmount).toLocaleString('id-ID')}`];
      });
      actDepBody.push([
        { content: 'TOTAL KESELURUHAN DEPOSIT:', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `Rp ${totalActDep.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [0, 128, 0], fillColor: [230, 245, 230] } }
      ]);
      autoTable(doc, { startY: currentY, head: [['Nama Pembeli', 'No. Telepon', 'Saldo Deposit']], body: actDepBody, theme: 'grid', headStyles: { fillColor: [142, 68, 173] }, margin: { left: 14 } });
      currentY = doc.lastAutoTable.finalY + 12;
    }

    // 7. SALDO BERSIH
    if (filteredNetBalance.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("7. SALDO BERSIH ", 14, currentY); currentY += 5;
      let netIn = 0, netOut = 0;
      const netBody = filteredNetBalance.map(item => {
        const nominal = Number(item.nominal) || 0;
        if (item.netType === 'in') netIn += nominal; else netOut += nominal;
        return [formatDisplayDate(item.createdAt), item.netType === 'in' ? 'PEMASUKAN' : 'PENGELUARAN', item.subjName, item.detailNote, (item.netType === 'in' ? '+' : '-') + ` Rp ${nominal.toLocaleString('id-ID')}`];
      });
      netBody.push([
        { content: `TOTAL KAS MASUK: Rp ${netIn.toLocaleString('id-ID')} | KAS KELUAR: Rp ${netOut.toLocaleString('id-ID')}`, colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `SALDO AKHIR: Rp ${(netIn - netOut).toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [0, 128, 0], fillColor: [230, 245, 230] } }
      ]);
      autoTable(doc, { startY: currentY, head: [['Tanggal & Jam', 'Kategori', 'Nama/Subjek', 'Keterangan Rinci', 'Nominal']], body: netBody, theme: 'grid', headStyles: { fillColor: [52, 152, 219] }, didParseCell: customDidParseCell, margin: { left: 14 } });
    }

    doc.save(`Laporan_Buku_Kas_${Date.now()}.pdf`);
    onShowToast('File PDF berhasil diunduh', 'success');
  };

  // =====================================================================
  // --- FUNGSI EXPORT PDF (NERACA SALDO DIPERBAIKI) ---
  // =====================================================================
  const handleDownloadNeracaPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Header
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("LAPORAN NERACA SALDO", 105, 20, { align: "center" });
    doc.setFontSize(12); doc.setFont("helvetica", "normal");
    doc.text("ARZEN Frozen Food", 105, 28, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`, 105, 34, { align: "center" });

    // Menyusun data baris neraca
    const body = [
      ['101', 'Kas & Bank (Saldo Bersih Keseluruhan)', `Rp ${balance.toLocaleString('id-ID')}`, '-'],
      ['102', 'Piutang Usaha (Hutang Pelanggan)', `Rp ${totalUnpaidDebt.toLocaleString('id-ID')}`, '-'],
      ['201', 'Titipan / Deposit Pelanggan', '-', `Rp ${totalDeposit.toLocaleString('id-ID')}`],
      ['401', 'Pendapatan Usaha (Total Penjualan)', '-', `Rp ${totalIncome.toLocaleString('id-ID')}`],
      ['501', 'Beban Operasional (Total Pengeluaran)', `Rp ${totalExpenses.toLocaleString('id-ID')}`, '-'],
    ];

    // Kalkulasi Total Bawah
    const totalDebit = balance + totalUnpaidDebt + totalExpenses;
    const totalKredit = totalDeposit + totalIncome;

    body.push([
      { content: 'TOTAL KESELURUHAN', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: `Rp ${totalDebit.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [0, 100, 0] } },
      { content: `Rp ${totalKredit.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [0, 100, 0] } }
    ]);

    // Render Tabel
    autoTable(doc, {
      startY: 45,
      head: [['No. Akun', 'Nama Akun / Uraian', 'Debit', 'Kredit']],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [75, 85, 99], halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 25 },
        2: { halign: 'right', cellWidth: 45 },
        3: { halign: 'right', cellWidth: 45 }
      }
    });

    // Catatan Kaki
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("*Catatan: Laporan ini disusun menggunakan metode Buku Kas Tunggal (Single Entry).", 14, doc.lastAutoTable.finalY + 10);
    doc.text("Total Debit dan Kredit dapat memiliki selisih wajar apabila terdapat ", 14, doc.lastAutoTable.finalY + 15);
    doc.text("koreksi hutang/deposit manual.", 14, doc.lastAutoTable.finalY + 20);

    // Save
    doc.save(`Neraca_Saldo_${Date.now()}.pdf`);
    onShowToast('File PDF Neraca Saldo berhasil diunduh', 'success');
  };

  // =====================================================================
  // --- FUNGSI EXPORT PDF (LABA RUGI DIPERBAIKI DENGAN HPP) ---
  // =====================================================================
  const handleDownloadLabaRugiPDF = () => {
    const labaKotor = totalIncome - totalHPP;
    const labaBersih = labaKotor - totalExpenses;

    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("LAPORAN LABA RUGI (CASH BASIS)", 105, 20, { align: "center" });
    doc.setFontSize(12); doc.setFont("helvetica", "normal");
    doc.text("ARZEN Frozen Food", 105, 28, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`, 105, 34, { align: "center" });

    const body = [
      [{ content: 'PENDAPATAN', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
      ['Total Pemasukan Penjualan', `Rp ${totalIncome.toLocaleString('id-ID')}`],
      ['Harga Pokok Penjualan (HPP)', `- Rp ${totalHPP.toLocaleString('id-ID')}`],
      [{ content: 'LABA KOTOR', styles: { fontStyle: 'bold' } }, { content: `Rp ${labaKotor.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: labaKotor >= 0 ? [0, 128, 0] : [220, 38, 38] } }],
      [{ content: 'BEBAN / PENGELUARAN', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
      ['Total Pengeluaran Kas Operasional', `- Rp ${totalExpenses.toLocaleString('id-ID')}`],
      [{ content: 'LABA / (RUGI) BERSIH', styles: { fontStyle: 'bold' } }, { content: `Rp ${labaBersih.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: labaBersih >= 0 ? [0, 128, 0] : [220, 38, 38] } }]
    ];

    autoTable(doc, {
      startY: 45,
      body: body,
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 120 },
        1: { halign: 'right', cellWidth: 50 }
      }
    });

    doc.save(`Laba_Rugi_${Date.now()}.pdf`);
    onShowToast('File PDF Laba Rugi berhasil diunduh', 'success');
  };

  const navigateToTab = (tabId) => {
    setActiveTab(tabId);
    setCurrentPage(1);
    setSearchTerm('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loadingTrans || loadingExp || loadingCust || loadingRet || loadingProd) return <Loading />;

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
            <span className="ml-1 text-[10px] uppercase tracking-widest hidden md:inline">({currentList.length} Total Data)</span>
          </span>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 disabled:opacity-30 hover:bg-gray-50 hover:text-teal-600 transition-all shadow-sm"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 disabled:opacity-30 hover:bg-gray-50 hover:text-teal-600 transition-all shadow-sm"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    );
  };

  const displayedLogs = showAllLogs ? allActivityLogs : allActivityLogs.slice(0, 10);

  return (
    <div className="pb-10 bg-gray-50 min-h-screen p-2 md:p-6">
      {/* TABS NAVIGATION */}
      <div className="flex gap-2 mb-6 bg-white p-2 rounded-xl shadow-sm border no-print overflow-x-auto custom-scrollbar whitespace-nowrap">
        {[
          { id: 'overview', label: 'Ringkasan', icon: TrendingUp }, 
          { id: 'sales', label: 'Transaksi', icon: ShoppingCart },
          { id: 'transactions', label: 'Pemasukan', icon: ArrowUpCircle }, 
          { id: 'expenses', label: 'Pengeluaran', icon: ArrowDownCircle }, 
          { id: 'debts', label: 'Hutang', icon: CreditCard },
          { id: 'returns', label: 'Retur/Deposit', icon: RotateCcw },
          { id: 'netbalance', label: 'Riwayat Uang Masuk & Keluar', icon: Wallet }
        ].map(tab => (
          <button key={tab.id} onClick={() => navigateToTab(tab.id)} className={`flex items-center gap-2 px-4 md:px-6 py-3 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === tab.id ? 'bg-teal-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* STATS CARDS DIPERBAIKI (Kembali ke 5 Card) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-8">
        <div onClick={() => navigateToTab('transactions')} className="bg-white rounded-2xl shadow-sm p-4 md:p-6 border-b-4 border-teal-500 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-300">
          <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase mb-1">Total Pemasukan</p>
          <h3 className="text-base md:text-xl font-black text-teal-700">Rp {(totalIncome || 0).toLocaleString()}</h3>
        </div>
        <div onClick={() => navigateToTab('expenses')} className="bg-white rounded-2xl shadow-sm p-4 md:p-6 border-b-4 border-red-500 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-300">
          <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase mb-1">Total Pengeluaran</p>
          <h3 className="text-base md:text-xl font-black text-red-600">Rp {(totalExpenses || 0).toLocaleString()}</h3>
        </div>
        <div onClick={() => navigateToTab('debts')} className="bg-white rounded-2xl shadow-sm p-4 md:p-6 border-b-4 border-orange-500 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-300">
          <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase mb-1">Piutang Aktif</p>
          <h3 className="text-base md:text-xl font-black text-orange-600">Rp {(totalUnpaidDebt || 0).toLocaleString()}</h3>
        </div>
        <div onClick={() => navigateToTab('returns')} className="bg-white rounded-2xl shadow-sm p-4 md:p-6 border-b-4 border-purple-500 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-300">
          <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase mb-1">Deposit Aktif</p>
          <h3 className="text-base md:text-xl font-black text-purple-600">Rp {(totalDeposit || 0).toLocaleString()}</h3>
        </div>
        <div onClick={() => navigateToTab('netbalance')} className="col-span-2 md:col-span-1 bg-white rounded-2xl shadow-sm p-4 md:p-6 border-b-4 border-blue-600 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-300 bg-blue-50/30">
          <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase mb-1">Uang Bersih (Net)</p>
          <h3 className="text-lg md:text-xl font-black text-blue-700">Rp {(balance || 0).toLocaleString()}</h3>
        </div>
      </div>

      {/* --- TAB OVERVIEW --- */}
      {activeTab === 'overview' && (
        <>
          <div className="bg-white p-4 md:p-5 rounded-3xl border flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-6 shadow-sm">
             <div>
                <h4 className="text-sm font-black text-gray-800">Cetak Laporan Keseluruhan</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pilih format laporan keuangan yang dibutuhkan</p>
             </div>
             <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2.5 rounded-xl border border-gray-200 w-full md:w-auto">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <input type="date" className="bg-transparent text-xs font-black outline-none w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  <span className="text-gray-300">-</span>
                  <input type="date" className="bg-transparent text-xs font-black outline-none w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => setShowDownloadModal(true)} className="flex-1 justify-center p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-200 hover:bg-blue-100 flex items-center gap-2 text-xs font-black shadow-sm"><Download className="w-4 h-4" /> Download Laporan</button>
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
                <h3 className="text-base md:text-lg font-black text-gray-800 flex items-center gap-2"><ListFilter className="text-blue-500 w-5 h-5" /> Log Cepat Aktivitas</h3>
                {allActivityLogs.length > 10 && (
                  <button 
                    onClick={() => setShowAllLogs(!showAllLogs)}
                    className="text-[9px] md:text-[10px] font-black text-teal-600 hover:text-teal-800 uppercase tracking-wider bg-teal-50 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                  >
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
                    const colorClass = 
                      log.logCategory === 'KAS' ? (isIn ? 'text-teal-600' : 'text-red-600') :
                      log.logCategory === 'HUTANG' ? (isIn ? 'text-orange-600' : 'text-green-600') :
                      (isIn ? 'text-purple-600' : 'text-red-600');
                    
                    const bgBadgeClass = 
                      log.logCategory === 'KAS' ? (isIn ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700') :
                      log.logCategory === 'HUTANG' ? (isIn ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700') :
                      (isIn ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700');

                    return (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl border bg-white hover:bg-gray-50 transition-all shadow-sm">
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${bgBadgeClass}`}>
                              {log.logLabel}
                            </span>
                          </div>
                          <p className="text-xs md:text-sm font-black truncate text-gray-800">{log.logTitle}</p>
                          <p className="text-[9px] text-gray-500 truncate mt-0.5">{log.logDetail}</p>
                          <p className="text-[8px] text-gray-400 font-bold uppercase mt-1">{formatDisplayDate(log.logTime)}</p>
                        </div>
                        <p className={`text-xs md:text-sm font-black whitespace-nowrap ${colorClass}`}>
                          {isIn ? '+' : '-'} Rp {Number(log.nominal || 0).toLocaleString('id-ID')}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- GLOBAL TOOLBAR (SEARCH & DATE) UNTUK TAB TABEL --- */}
      {activeTab !== 'overview' && (
        <div className="bg-white p-3 md:p-4 rounded-2xl border flex flex-col md:flex-row gap-3 items-center mb-6 shadow-sm">
          <div className="relative w-full md:flex-1"><Search className="absolute left-4 top-3 w-4 h-4 text-gray-300" /><input type="text" placeholder="Cari berdasarkan nama/keterangan..." className="w-full pl-11 pr-4 py-2 bg-gray-50 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-teal-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
          <div className="flex w-full md:w-auto items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
            <Calendar className="w-4 h-4 text-gray-400" /><input type="date" className="bg-transparent text-xs font-black outline-none w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-gray-300">-</span><input type="date" className="bg-transparent text-xs font-black outline-none w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button onClick={() => setShowBulkDeleteModal(true)} className="w-full md:w-auto flex justify-center p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-100 transition-colors"><Trash2 className="w-5 h-5" /></button>
        </div>
      )}

      {/* --- TAB SALES (TRANSAKSI PENJUALAN) --- */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[32px] border shadow-sm flex flex-col">
            <div className="overflow-x-auto w-full custom-scrollbar">
              <table className="w-full min-w-[700px] text-left">
                <thead>
                  <tr className="bg-gray-50/50 border-b">
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Nota / Metode</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Nama Pembeli</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Status</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Item Dibeli</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Total Belanja</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedItems.map(item => {
                    const itemNameList = item.items ? item.items.map(i => `${i.qty}x ${i.name}`).join(', ') : '-';
                    const nilaiBelanja = Number(item.subtotal) || Number(item.total) || 0; 
                    
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors text-xs md:text-sm">
                        <td className="p-4 font-bold text-gray-500 whitespace-nowrap">{formatDisplayDate(item.createdAt)}</td>
                        <td className="p-4">
                          <p className="font-black text-teal-600 uppercase">#{item.id?.substring(0,6)}</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">{item.paymentMethod || 'TUNAI'}</p>
                        </td>
                        <td className="p-4 font-black text-gray-800 uppercase max-w-[120px] truncate">{item.customerName || 'Umum'}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 text-[9px] font-black uppercase rounded-lg ${item.paymentStatus === 'HUTANG' ? 'bg-orange-100 text-orange-600' : 'bg-teal-100 text-teal-600'}`}>
                            {item.paymentStatus || 'LUNAS'}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-gray-600 max-w-[200px] truncate" title={itemNameList}>{itemNameList}</td>
                        <td className="p-4 font-black text-right text-gray-700 whitespace-nowrap">Rp {nilaiBelanja.toLocaleString('id-ID')}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { setSelectedNotaTransaction(item); setShowNota(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg" title="Lihat Nota"><Eye className="w-4 h-4"/></button>
                            <button onClick={() => { setSelectedEditTransaction(item); setShowEditTransModal(true); }} className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg" title="Edit Transaksi"><Edit3 className="w-4 h-4"/></button>
                            <button onClick={() => { setSelectedItem({...item, isSale: true}); setShowDeleteModal(true); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Hapus (Revert)"><Trash2 className="w-4 h-4"/></button>
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

      {/* --- TAB TRANSACTIONS & EXPENSES --- */}
      {(activeTab === 'transactions' || activeTab === 'expenses') && (
        <div className="space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-3xl border shadow-sm">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 md:mb-4">{activeTab === 'transactions' ? 'Pemasukan Manual' : 'Catat Pengeluaran'}</h4>
            <form onSubmit={activeTab === 'transactions' ? handleAddManualIncome : (e) => { e.preventDefault(); addDocument('expenses', {...newExpense, amount: Number(newExpense.amount), createdAt: new Date()}); onShowToast('Disimpan', 'success'); setNewExpense({title: '', amount: '', category: 'Operasional'}); }} className="flex flex-col md:flex-row gap-3">
              <input type="text" placeholder="Deskripsi" className="w-full md:flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-teal-500" value={activeTab === 'transactions' ? newManualIncome.note : newExpense.title} onChange={e => activeTab === 'transactions' ? setNewManualIncome({...newManualIncome, note: e.target.value}) : setNewExpense({...newExpense, title: e.target.value})} />
              <input type="number" placeholder="Nominal (Rp)" className="w-full md:w-44 bg-gray-50 rounded-xl px-4 py-3 text-sm font-black border-none outline-none focus:ring-2 focus:ring-teal-500" value={activeTab === 'transactions' ? newManualIncome.amount : newExpense.amount} onChange={e => activeTab === 'transactions' ? setNewManualIncome({...newManualIncome, amount: e.target.value}) : setNewExpense({...newExpense, amount: e.target.value})} />
              
              {activeTab === 'transactions' && (
                <select value={newManualIncome.method} onChange={(e) => setNewManualIncome({...newManualIncome, method: e.target.value})} className="bg-gray-50 px-4 py-3 rounded-xl border-none text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="TUNAI">Keterangan: TUNAI</option>
                  <option value="TRANSFER">Keterangan: TRANSFER</option>
                  <option value="QRIS">Keterangan: QRIS</option>
                </select>
              )}

              <button className={`w-full md:w-auto px-8 py-3 rounded-xl font-black text-sm text-white ${activeTab === 'transactions' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-red-600 hover:bg-red-700'} shadow-md transition-all`}>Simpan</button>
            </form>
          </div>
          <div className="bg-white rounded-[32px] border shadow-sm flex flex-col">
            <div className="overflow-x-auto w-full custom-scrollbar">
              <table className="w-full min-w-[600px] text-left">
                <thead>
                  <tr className="bg-gray-50/50 border-b">
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th>
                    {activeTab === 'transactions' && <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Nama / Metode</th>}
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px]">{activeTab === 'transactions' ? 'Keterangan Rinci' : 'Keterangan'}</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Nominal Kas</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedItems.map(item => {
                    let tableNominal = Number(item.total || item.amount || 0);
                    if (item.paymentStatus === 'HUTANG' || (!item.total && item.subtotal)) tableNominal = Number(item.subtotal || 0);
                    const keteranganStr = activeTab === 'transactions' ? (item.note || (item.items ? item.items.map(i => i.name).join(', ') : 'Transaksi Pemasukan')) : item.title;

                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors text-xs md:text-sm">
                        <td className="p-4 font-bold text-gray-500 whitespace-nowrap">{formatDisplayDate(item.createdAt)}</td>
                        {activeTab === 'transactions' && (
                          <td className="p-4">
                            <p className="font-black text-gray-800 uppercase max-w-[150px] truncate">{item.customerName || 'Pemasukan Manual'}</p>
                            <p className="text-[9px] text-gray-400 font-bold uppercase">{item.paymentMethod || 'TUNAI'}</p>
                          </td>
                        )}
                        <td className="p-4 font-bold text-gray-600 max-w-[250px] truncate" title={keteranganStr}>{keteranganStr}</td>
                        <td className="p-4 font-black text-right text-gray-700 whitespace-nowrap">Rp {tableNominal.toLocaleString()}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            {activeTab === 'transactions' && item.items && (
                              <button onClick={() => { setSelectedNotaTransaction(item); setShowNota(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Eye className="w-4 h-4"/></button>
                            )}
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

      {/* --- TAB DEBTS (HISTORI HUTANG +/-) --- */}
      {activeTab === 'debts' && (
        <div className="space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-3xl border shadow-sm relative z-10">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 md:mb-4">Penambahan Hutang Manual</h4>
            <form onSubmit={handleAddManualDebt} className="flex flex-col md:flex-row gap-3">
              <CustomerSearchSelect customers={customers} value={newManualDebt.customerId} onChange={(id) => setNewManualDebt({...newManualDebt, customerId: id})} placeholder="-- Cari Pembeli --" />
              <input type="text" placeholder="Keterangan" required className="w-full md:flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-orange-500" value={newManualDebt.note} onChange={e => setNewManualDebt({...newManualDebt, note: e.target.value})} />
              <input type="number" placeholder="Rp" required className="w-full md:w-44 bg-gray-50 rounded-xl px-4 py-3 text-sm font-black border-none outline-none focus:ring-2 focus:ring-orange-500" value={newManualDebt.amount} onChange={e => setNewManualDebt({...newManualDebt, amount: e.target.value})} />
              <button className="w-full md:w-auto px-8 py-3 rounded-xl font-black text-sm text-white bg-orange-600 hover:bg-orange-700 transition-all shadow-md">Simpan</button>
            </form>
          </div>

          <div className="bg-white rounded-3xl border shadow-sm mb-6 relative z-0 flex flex-col">
            <div className="p-4 md:p-6 bg-gray-50/50 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
               <h3 className="text-base md:text-lg font-black text-gray-800 uppercase tracking-tighter">Daftar Piutang Aktif</h3>
               <div className="bg-orange-100 px-4 py-1.5 rounded-xl text-orange-600 font-black text-[10px] md:text-xs uppercase tracking-tighter">Total: Rp {(totalUnpaidDebt || 0).toLocaleString()}</div>
            </div>
            <div className="overflow-x-auto w-full custom-scrollbar">
               <table className="w-full min-w-[500px] text-left text-xs md:text-sm">
                 <thead>
                   <tr className="border-b">
                     <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Pelanggan</th>
                     <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Sisa Hutang</th>
                     <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {customers.filter(c => (Number(c.remainingDebt) || 0) > 0).map(c => (
                     <tr key={c.id} className="hover:bg-gray-50 transition-all">
                       <td className="p-4"><div><p className="font-black text-gray-800 uppercase">{c.name}</p><p className="text-[10px] text-gray-400 font-bold">{c.phone || '-'}</p></div></td>
                       <td className="p-4 font-black text-red-600 italic text-sm md:text-lg whitespace-nowrap">Rp {(Number(c.remainingDebt) || 0).toLocaleString()}</td>
                       <td className="p-4 text-right">
                         <div className="flex justify-end items-center gap-2">
                           <button onClick={() => { setSelectedCustomer(c); setShowPayDebtModal(true); setDebtPaymentAmount(''); setIsFullPayment(true); }} className="bg-teal-600 text-white px-4 py-2 rounded-xl text-[10px] md:text-xs font-black shadow-md hover:bg-teal-700 uppercase tracking-tighter transition-all whitespace-nowrap">Bayar / Cicil</button>
                           <button onClick={() => { setEditBalanceType('debt'); setSelectedCustomer(c); setEditBalanceAmount(c.remainingDebt || 0); setShowEditBalanceModal(true); }} className="bg-white border border-gray-200 text-gray-600 p-2 rounded-xl hover:bg-gray-50 hover:text-teal-600 transition-all shadow-sm" title="Edit Manual">
                             <Edit3 className="w-4 h-4" />
                           </button>
                           <button onClick={() => { setSelectedItem({...c, isCustomerDebt: true}); setShowDeleteModal(true); }} className="bg-red-50 text-red-600 p-2 rounded-xl hover:bg-red-100 transition-all" title="Nol-kan Hutang">
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border shadow-sm flex flex-col">
             <div className="p-4 md:p-6 bg-gray-50/50 border-b"><h3 className="text-base md:text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2"><History className="text-orange-500 w-4 h-4 md:w-5 md:h-5"/> Histori Hutang</h3></div>
             <div className="overflow-x-auto w-full custom-scrollbar">
                <table className="w-full min-w-[600px] text-left text-xs md:text-sm">
                   <thead>
                     <tr className="bg-gray-50/50 border-b">
                       <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th>
                       <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Pelanggan</th>
                       <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Keterangan</th>
                       <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Nominal</th>
                       <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y">
                     {paginatedItems.map(item => {
                       const isIn = item.debtType === 'in'; 
                       return (
                         <tr key={item.id + item.debtType} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-bold text-gray-500 whitespace-nowrap">{formatDisplayDate(item.createdAt)}</td>
                            <td className="p-4 font-black text-gray-800 uppercase max-w-[150px] truncate">{item.customerName}</td>
                            <td className="p-4 font-bold text-gray-600 max-w-[250px] truncate">{item.note || 'Belanja Hutang'}</td>
                            <td className={`p-4 font-black text-right whitespace-nowrap ${isIn ? 'text-red-600' : 'text-teal-600'}`}>
                              {isIn ? '(+)' : '(-)'} Rp {(Number(item.nominal)||0).toLocaleString()}
                            </td>
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

      {/* --- TAB RETURNS & DEPOSITS --- */}
      {activeTab === 'returns' && (
        <div className="space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-3xl border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gradient-to-r from-purple-50 to-white gap-4">
            <div>
              <h4 className="text-base md:text-lg font-black text-purple-800 tracking-tight flex items-center gap-2"><PackagePlus className="w-4 h-4 md:w-5 md:h-5"/> Retur ke Deposit</h4>
              <p className="text-[10px] md:text-xs text-purple-600 font-bold mt-1">Gunakan tombol ini untuk meretur barang jadi saldo.</p>
            </div>
            <button onClick={() => setShowReturnModal(true)} className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-black text-xs md:text-sm shadow-lg shadow-purple-200 transition-all uppercase tracking-widest flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" /> Proses Retur
            </button>
          </div>

          <div className="bg-white rounded-3xl border shadow-sm mb-6 relative z-0 flex flex-col">
            <div className="p-4 md:p-6 bg-gray-50/50 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
               <h3 className="text-base md:text-lg font-black text-gray-800 uppercase tracking-tighter">Daftar Deposit Aktif</h3>
               <div className="bg-purple-100 px-4 py-1.5 rounded-xl text-purple-600 font-black text-[10px] md:text-xs uppercase tracking-tighter">Total: Rp {(totalDeposit || 0).toLocaleString()}</div>
            </div>
            <div className="overflow-x-auto w-full custom-scrollbar">
               <table className="w-full min-w-[500px] text-left text-xs md:text-sm">
                 <thead>
                   <tr className="border-b">
                     <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Pelanggan</th>
                     <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Saldo Deposit</th>
                     <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {customers.filter(c => (Number(c.returnAmount) || 0) > 0).map(c => (
                     <tr key={c.id} className="hover:bg-gray-50 transition-all">
                       <td className="p-4"><div><p className="font-black text-gray-800 uppercase">{c.name}</p><p className="text-[10px] text-gray-400 font-bold">{c.phone || '-'}</p></div></td>
                       <td className="p-4 font-black text-purple-600 italic text-sm md:text-lg whitespace-nowrap">Rp {(Number(c.returnAmount) || 0).toLocaleString()}</td>
                       <td className="p-4 text-right">
                         <div className="flex justify-end items-center gap-2">
                           <button onClick={() => { setEditBalanceType('deposit'); setSelectedCustomer(c); setEditBalanceAmount(c.returnAmount || 0); setShowEditBalanceModal(true); }} className="bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-xl text-[10px] md:text-xs font-black shadow-sm hover:bg-gray-50 hover:text-teal-600 transition-all whitespace-nowrap">
                             <Edit3 className="w-4 h-4 inline-block mr-1"/> Edit
                           </button>
                           <button onClick={() => { setSelectedItem({...c, isCustomerDeposit: true}); setShowDeleteModal(true); }} className="bg-red-50 text-red-600 p-2 rounded-xl hover:bg-red-100 transition-all" title="Nol-kan Deposit">
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border shadow-sm flex flex-col">
            <div className="p-4 md:p-6 bg-gray-50/50 border-b"><h3 className="text-base md:text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2"><History className="text-purple-500 w-4 h-4 md:w-5 md:h-5"/> Histori Deposit</h3></div>
            <div className="overflow-x-auto w-full custom-scrollbar">
               <table className="w-full min-w-[600px] text-left text-xs md:text-sm">
                 <thead>
                   <tr className="border-b bg-gray-50/50">
                     <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th>
                     <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Pelanggan</th>
                     <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Detail</th>
                     <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Perubahan</th>
                     <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {paginatedItems.map(item => {
                     const isIn = item.depType === 'in';
                     return (
                       <tr key={item.id + item.depType} className="hover:bg-purple-50/30 transition-all">
                         <td className="p-4 font-bold text-gray-500 whitespace-nowrap">{formatDisplayDate(item.createdAt)}</td>
                         <td className="p-4 font-black text-gray-800 uppercase">{item.customerName}</td>
                         <td className="p-4 font-bold text-gray-600 leading-relaxed max-w-[200px] truncate">{item.note}</td>
                         <td className={`p-4 font-black text-right whitespace-nowrap ${isIn ? 'text-teal-600' : 'text-red-600'}`}>
                           {isIn ? '(+)' : '(-)'} Rp {(Number(item.nominal)||0).toLocaleString()}
                         </td>
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

      {/* --- TAB SALDO BERSIH (UANG MASUK & KELUAR) --- */}
      {activeTab === 'netbalance' && (
        <div className="bg-white rounded-[32px] border shadow-sm flex flex-col">
          <div className="p-4 md:p-6 bg-gray-50/50 border-b"><h3 className="text-base md:text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2"><Landmark className="text-blue-500 w-4 h-4 md:w-5 md:h-5"/> Riwayat Uang Masuk & Keluar</h3></div>
          <div className="overflow-x-auto w-full custom-scrollbar">
             <table className="w-full min-w-[600px] text-left text-xs md:text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Kategori</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Nama / Subjek</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Metode / Info</th>
                    <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Masuk/Keluar</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedItems.map(item => {
                    const isMasuk = item.netType === 'in';
                    const isBank = item.paymentMethod === 'TRANSFER' || item.paymentMethod === 'QRIS';
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-bold text-gray-500 whitespace-nowrap">{formatDisplayDate(item.createdAt)}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase ${isMasuk ? (isBank ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700') : 'bg-red-100 text-red-700'}`}>
                            {isMasuk ? 'PEMASUKAN' : 'PENGELUARAN'}
                          </span>
                        </td>
                        <td className="p-4 font-black text-gray-800 uppercase max-w-[150px] truncate">{item.subjName}</td>
                        <td className="p-4 font-bold text-gray-600 max-w-[200px] truncate" title={item.detailNote}>
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-black mr-2 text-gray-500">{item.paymentMethod || 'TUNAI'}</span>
                          {item.detailNote}
                        </td>
                        <td className={`p-4 font-black text-right whitespace-nowrap ${isMasuk ? 'text-teal-600' : 'text-red-600'}`}>
                          {isMasuk ? '(+)' : '(-)'} Rp {(Number(item.nominal)||0).toLocaleString()}
                        </td>
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

      {/* MODAL PILIH DOWNLOAD LAPORAN */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-sm w-full shadow-2xl relative border-t-8 border-blue-600 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setShowDownloadModal(false)} className="absolute right-6 top-6 text-gray-400 hover:text-gray-600"><X /></button>
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-2 uppercase">Pilih Jenis Laporan</h3>
            <p className="text-xs text-gray-500 mb-6 font-bold">Laporan akan dicetak sesuai filter tanggal saat ini.</p>
            
            <div className="flex flex-col gap-2">
              <button onClick={() => { handleDownloadMasterExcel(); setShowDownloadModal(false); }} className="w-full flex items-center gap-3 p-3 md:p-4 bg-green-50 text-green-700 rounded-2xl hover:bg-green-100 transition-colors border border-green-200 shadow-sm">
                <TableIcon className="w-5 h-5 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-black text-sm">Excel Master Lengkap</p>
                  <p className="text-[10px] font-bold opacity-80 mt-0.5">Semua tab riwayat dalam 1 file</p>
                </div>
              </button>

              <button onClick={() => { handleDownloadNeracaExcel(); setShowDownloadModal(false); }} className="w-full flex items-center gap-3 p-3 md:p-4 bg-green-50 text-green-700 rounded-2xl hover:bg-green-100 transition-colors border border-green-200 shadow-sm">
                <TableIcon className="w-5 h-5 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-black text-sm">Excel Neraca Saldo</p>
                  <p className="text-[10px] font-bold opacity-80 mt-0.5">Posisi Keuangan (Debit & Kredit)</p>
                </div>
              </button>

              <button onClick={() => { handleDownloadLabaRugiExcel(); setShowDownloadModal(false); }} className="w-full flex items-center gap-3 p-3 md:p-4 bg-green-50 text-green-700 rounded-2xl hover:bg-green-100 transition-colors border border-green-200 shadow-sm">
                <TableIcon className="w-5 h-5 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-black text-sm">Excel Laba Rugi</p>
                  <p className="text-[10px] font-bold opacity-80 mt-0.5">Omset kurangi HPP & Pengeluaran</p>
                </div>
              </button>
              
              <div className="h-px w-full bg-gray-200 my-2"></div>

              <button onClick={() => { handleDownloadMasterPDF(); setShowDownloadModal(false); }} className="w-full flex items-center gap-3 p-3 md:p-4 bg-blue-50 text-blue-700 rounded-2xl hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm">
                <FileText className="w-5 h-5 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-black text-sm">PDF Master Lengkap</p>
                  <p className="text-[10px] font-bold opacity-80 mt-0.5">Semua tab riwayat dalam format A4</p>
                </div>
              </button>

              <button onClick={() => { handleDownloadNeracaPDF(); setShowDownloadModal(false); }} className="w-full flex items-center gap-3 p-3 md:p-4 bg-purple-50 text-purple-700 rounded-2xl hover:bg-purple-100 transition-colors border border-purple-200 shadow-sm">
                <FileText className="w-5 h-5 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-black text-sm">PDF Neraca Saldo</p>
                  <p className="text-[10px] font-bold opacity-80 mt-0.5">Posisi Keuangan (Debit & Kredit)</p>
                </div>
              </button>

              <button onClick={() => { handleDownloadLabaRugiPDF(); setShowDownloadModal(false); }} className="w-full flex items-center gap-3 p-3 md:p-4 bg-purple-50 text-purple-700 rounded-2xl hover:bg-purple-100 transition-colors border border-purple-200 shadow-sm">
                <FileText className="w-5 h-5 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-black text-sm">PDF Laba Rugi</p>
                  <p className="text-[10px] font-bold opacity-80 mt-0.5">Omset kurangi HPP & Pengeluaran</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT HUTANG & DEPOSIT */}
      {showEditBalanceModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-sm w-full shadow-2xl relative border-t-8 border-teal-600">
            <button onClick={() => setShowEditBalanceModal(false)} className="absolute right-6 top-6 text-gray-400 hover:text-gray-600"><X /></button>
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-2 uppercase">Koreksi Manual</h3>
            <p className="text-xs text-gray-500 mb-6 font-bold">
              Ubah angka {editBalanceType === 'debt' ? 'hutang' : 'deposit'} untuk <span className="text-teal-600 uppercase tracking-widest">{selectedCustomer.name}</span>
            </p>
            
            <div className="mb-6">
              <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase ml-2 mb-2 block">
                Total {editBalanceType === 'debt' ? 'Hutang' : 'Deposit'} Baru
              </label>
              <input 
                type="number" 
                className="w-full bg-gray-50 rounded-2xl px-4 py-4 text-lg md:text-xl font-black text-teal-600 focus:ring-2 focus:ring-teal-500 outline-none border-none" 
                value={editBalanceAmount} 
                onChange={e => setEditBalanceAmount(e.target.value)} 
                placeholder="0" 
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowEditBalanceModal(false)} className="flex-1 py-3 font-black text-gray-400 hover:bg-gray-100 rounded-xl transition-all">Batal</button>
              <button onClick={handleSaveEditBalance} className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-black shadow-md hover:bg-teal-700 transition-all uppercase tracking-widest">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL HISTORI */}
      {showDetailModal && selectedDetailItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-sm w-full shadow-2xl relative border-t-8 border-teal-600">
            <button onClick={() => setShowDetailModal(false)} className="absolute right-6 top-6 text-gray-400 hover:text-gray-600"><X /></button>
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-6 uppercase">Detail Histori</h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500 font-bold">Tanggal</span>
                <span className="font-black text-gray-800">{formatDisplayDate(selectedDetailItem.createdAt)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500 font-bold">Pelanggan</span>
                <span className="font-black text-gray-800 uppercase">{selectedDetailItem.customerName || 'Tanpa Nama'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500 font-bold">Keterangan</span>
                <span className="font-black text-gray-800 text-right w-1/2">{selectedDetailItem.note || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500 font-bold">Nominal</span>
                <span className="font-black text-teal-600 text-base">Rp {(Number(selectedDetailItem.nominal) || 0).toLocaleString()}</span>
              </div>
              
              {selectedDetailItem.items && selectedDetailItem.items.length > 0 && (
                <div className="pt-2">
                  <span className="text-gray-500 font-bold block mb-2">Item Terkait:</span>
                  <ul className="bg-gray-50 p-3 rounded-xl max-h-32 overflow-y-auto custom-scrollbar">
                    {selectedDetailItem.items.map((i, idx) => (
                      <li key={idx} className="flex justify-between text-xs mb-2 pb-2 border-b border-gray-200 last:border-0 last:mb-0 last:pb-0 font-bold text-gray-700">
                        <span>{i.qty}x {i.name}</span>
                        <span>Rp {(i.price * i.qty).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <button onClick={() => setShowDetailModal(false)} className="w-full mt-6 bg-gray-100 text-gray-600 py-3 rounded-2xl font-black text-xs md:text-sm shadow-sm hover:bg-gray-200 transition-all">Tutup</button>
          </div>
        </div>
      )}

      {/* MODAL BAYAR HUTANG */}
      {showPayDebtModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[40px] p-6 md:p-10 max-w-sm w-full shadow-2xl relative border-t-8 border-teal-600 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setShowPayDebtModal(false)} className="absolute right-6 top-6 md:right-8 md:top-8 text-gray-400 hover:text-gray-600"><X /></button>
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-1 md:mb-2 uppercase">Terima Pembayaran</h3>
            <p className="text-[10px] md:text-sm text-gray-500 mb-6 font-bold uppercase tracking-widest text-teal-600">{selectedCustomer.name}</p>
            <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
              <button onClick={() => setIsFullPayment(true)} className={`flex-1 py-3 text-[10px] md:text-xs font-black rounded-xl transition-all ${isFullPayment ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'}`}>Lunasi Semua</button>
              <button onClick={() => setIsFullPayment(false)} className={`flex-1 py-3 text-[10px] md:text-xs font-black rounded-xl transition-all ${!isFullPayment ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'}`}>Cicil</button>
            </div>
            <div className="bg-orange-50 p-4 rounded-3xl mb-6 border border-orange-100 shadow-inner"><p className="text-[9px] md:text-[10px] font-black text-orange-600 uppercase mb-1">Tagihan Kumulatif</p><p className="text-xl md:text-2xl font-black text-orange-700">Rp {(Number(selectedCustomer.remainingDebt) || 0).toLocaleString()}</p></div>
            {!isFullPayment && <div className="mb-6"><label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase ml-2 mb-2 block">Nominal Bayar</label><input type="number" className="w-full bg-gray-50 rounded-2xl px-4 py-4 md:px-6 md:py-5 text-lg md:text-xl font-black text-teal-600 focus:ring-2 focus:ring-teal-500 outline-none border-none" value={debtPaymentAmount} onChange={e => setDebtPaymentAmount(e.target.value)} placeholder="0" /></div>}
            <button onClick={handlePayDebt} className="w-full bg-teal-600 text-white py-4 md:py-5 rounded-2xl font-black text-xs md:text-sm shadow-xl shadow-teal-100 hover:bg-teal-700 transition-all uppercase tracking-widest active:scale-95">Simpan</button>
          </div>
        </div>
      )}

      {/* MODAL HAPUS DATA DENGAN REVERT OTOMATIS */}
      {showDeleteModal && selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-6">
              {selectedItem.isSale ? 'Hapus & Batalkan Transaksi?' : selectedItem.isCustomerDebt ? 'Nol-kan Hutang?' : selectedItem.isCustomerDeposit ? 'Nol-kan Deposit?' : 'Hapus Data Ini?'}
            </h3>
            
            {selectedItem.isSale && (
               <p className="text-xs text-gray-500 mb-6 font-bold leading-relaxed">
                 Menghapus data ini akan membatalkan pemasukan, dan otomatis <strong>mengembalikan stok barang, serta saldo hutang/deposit</strong> pembeli jika digunakan pada nota ini.
               </p>
            )}
            {selectedItem.isCustomerDebt && (
              <p className="text-xs text-gray-500 mb-6 font-bold leading-relaxed">
                Ini akan mengubah sisa hutang <strong>{selectedItem.name}</strong> menjadi Rp 0.
              </p>
            )}
            {selectedItem.isCustomerDeposit && (
              <p className="text-xs text-gray-500 mb-6 font-bold leading-relaxed">
                Ini akan mengubah sisa deposit <strong>{selectedItem.name}</strong> menjadi Rp 0.
              </p>
            )}

            <div className="flex gap-3 md:gap-4">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 md:py-4 font-black text-gray-400 text-xs md:text-sm hover:bg-gray-50 rounded-2xl transition-all">Batal</button>
              <button 
                onClick={async () => { 
                  if (selectedItem.isSale) {
                      if (selectedItem.items && selectedItem.items.length > 0) {
                          for (const item of selectedItem.items) {
                              const product = products.find(p => p.id === item.productId);
                              if (product) {
                                  const multiplier = ['KARTON', 'BALL', 'IKAT', 'RENCENG', 'BOX'].includes(item.unitType) ? (item.pcsPerCarton || 1) : 1;
                                  const pcsToRestore = item.qty * multiplier;
                                  await updateDocument('products', product.id, { stockPcs: product.stockPcs + pcsToRestore });
                                  await addDocument('stock_logs', {
                                      productId: product.id, productName: product.name, type: 'in', 
                                      amount: item.qty, unitType: item.unitType, totalPcs: pcsToRestore,
                                      note: `Batal Nota #${selectedItem.id.substring(0,6)}`, createdAt: new Date()
                                  });
                              }
                          }
                      }

                      if (selectedItem.customerId) {
                          const customer = customers.find(c => c.id === selectedItem.customerId);
                          if (customer) {
                              let newDebt = Number(customer.remainingDebt) || 0;
                              let newDeposit = Number(customer.returnAmount) || 0;

                              if (selectedItem.paymentStatus === 'HUTANG') {
                                  let debtAdded = Number(selectedItem.subtotal) - Number(selectedItem.returnUsed || 0);
                                  if (debtAdded > 0) newDebt = Math.max(0, newDebt - debtAdded);
                              }
                              if (Number(selectedItem.returnUsed) > 0) {
                                  newDeposit += Number(selectedItem.returnUsed);
                              }

                              await updateDocument('customers', customer.id, { remainingDebt: newDebt, returnAmount: newDeposit });
                          }
                      }
                      await deleteDocument('transactions', selectedItem.id); 
                      onShowToast('Transaksi dibatalkan. Stok, uang & hutang telah disesuaikan ulang', 'success');

                  } else if (selectedItem.isCustomerDebt) {
                    const oldAmount = Number(selectedItem.remainingDebt) || 0;
                    await updateDocument('customers', selectedItem.id, { remainingDebt: 0 });
                    if(oldAmount > 0) {
                      await addDocument('transactions', { customerName: selectedItem.name, customerId: selectedItem.id, subtotal: oldAmount, total: 0, note: 'Nol-kan Hutang Manual', paymentStatus: 'LUNAS', createdAt: new Date() });
                    }
                    onShowToast('Hutang berhasil di-nol-kan', 'success');
                  } else if (selectedItem.isCustomerDeposit) {
                    const oldAmount = Number(selectedItem.returnAmount) || 0;
                    await updateDocument('customers', selectedItem.id, { returnAmount: 0 });
                    if(oldAmount > 0) {
                      await addDocument('returns', { customerName: selectedItem.name, customerId: selectedItem.id, amount: oldAmount, type: 'manual_deposit_out', note: 'Nol-kan Deposit Manual', createdAt: new Date() });
                    }
                    onShowToast('Deposit berhasil di-nol-kan', 'success');
                  } else {
                    const colName = selectedItem.sourceCollection || (activeTab === 'expenses' ? 'expenses' : activeTab === 'returns' ? 'returns' : 'transactions');
                    await deleteDocument(colName, selectedItem.id); 
                    onShowToast('Data berhasil dihapus', 'success');
                  }
                  setShowDeleteModal(false); 
                }} 
                className="flex-1 bg-red-600 text-white py-3 md:py-4 rounded-2xl font-black text-xs md:text-sm shadow-md hover:bg-red-700 transition-all"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HAPUS MASAL */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-sm w-full shadow-2xl text-center border-t-8 border-red-600">
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-2">Hapus Masal?</h3>
            <p className="text-xs md:text-sm text-gray-500 mb-6 font-bold">Yakin ingin menghapus seluruh histori data yang sedang tampil/difilter pada tab ini?</p>
            <div className="flex flex-col gap-2">
              <button onClick={handleBulkDelete} className="w-full bg-red-600 text-white py-3 md:py-4 rounded-2xl font-black text-xs md:text-sm shadow-md shadow-red-100 hover:bg-red-700 transition-all">Ya, Hapus Semua</button>
              <button onClick={() => setShowBulkDeleteModal(false)} className="w-full py-3 md:py-4 font-black text-gray-400 text-xs md:text-sm hover:bg-gray-50 rounded-2xl transition-all">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESET SEMUA DATA */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-sm w-full shadow-2xl text-center border-t-8 border-red-600 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="mx-auto bg-red-50 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mb-4 border border-red-100 shadow-inner">
              <AlertTriangle className="w-8 h-8 md:w-10 md:h-10 text-red-600" />
            </div>
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-2">Reset Semua Data?</h3>
            <p className="text-[10px] md:text-xs text-gray-500 mb-6 font-bold leading-relaxed">
              Tindakan ini akan menghapus permanen <strong>seluruh</strong> riwayat pemasukan, pengeluaran, histori hutang, dan retur. Saldo hutang dan deposit pembeli akan kembali menjadi Rp 0.
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={handleResetAllData} className="w-full bg-red-600 text-white py-3 md:py-4 rounded-2xl font-black text-xs md:text-sm shadow-md shadow-red-200 hover:bg-red-700 uppercase tracking-widest transition-all">Ya, Bersihkan Semua</button>
              <button onClick={() => setShowResetModal(false)} className="w-full py-3 md:py-4 font-black text-gray-400 text-xs md:text-sm hover:bg-gray-50 rounded-2xl transition-all">Batal</button>
            </div>
          </div>
        </div>
      )}

      <FormRetur isOpen={showReturnModal} onClose={() => setShowReturnModal(false)} onShowToast={onShowToast} />

      {/* COMPONENT EDIT TRANSAKSI (Modal Terpisah) */}
      {showEditTransModal && selectedEditTransaction && (
         <EditTransactionModal 
            isOpen={showEditTransModal}
            transaction={selectedEditTransaction} 
            products={products}
            customers={customers}
            onClose={() => setShowEditTransModal(false)} 
            onShowToast={onShowToast} 
         />
      )}

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