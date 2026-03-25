import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { 
  TrendingUp, Trash2, Eye, FileText, Table as TableIcon, Search, Calendar, Wallet, 
  CreditCard, ArrowDownCircle, ArrowUpCircle, History, Clock, ListFilter, X, RotateCcw, PackagePlus, ChevronDown, ChevronLeft, ChevronRight, AlertTriangle
} from 'lucide-react';
import { useCollection, deleteDocument, addDocument, updateDocument } from '../hooks/useFirestore';
import Loading from '../components/common/Loading';
import Nota from '../components/Nota';
import FormRetur from '../components/FormRetur';

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
    <div className="relative flex-1" ref={wrapperRef}>
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

  const [activeTab, setActiveTab] = useState('overview');
  const [chartPeriod, setChartPeriod] = useState('daily');
  
  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPayDebtModal, setShowPayDebtModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false); // Modal untuk tombol hapus semua

  const [selectedItem, setSelectedItem] = useState(null);
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

  const [newManualIncome, setNewManualIncome] = useState({ note: '', amount: '' });
  const [newExpense, setNewExpense] = useState({ title: '', amount: '', category: 'Operasional' });
  const [newManualDebt, setNewManualDebt] = useState({ customerId: '', amount: '', note: '' });

  // --- DATE HELPERS (DENGAN JAM) ---
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

  // --- FINANCIAL CALCULATIONS ---
  const totalIncome = useMemo(() => transactions.reduce((sum, t) => sum + (Number(t.total) || 0), 0), [transactions]);
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0), [expenses]);
  const totalUnpaidDebt = useMemo(() => customers.reduce((sum, c) => sum + (Number(c.remainingDebt) || 0), 0), [customers]);
  const totalDeposit = useMemo(() => customers.reduce((sum, c) => sum + (Number(c.returnAmount) || 0), 0), [customers]);
  const balance = totalIncome - totalExpenses;

  // --- LOGIKA HISTORI SPESIFIK (+/-) ---
  const debtLogs = useMemo(() => {
    let logs = [];
    transactions.forEach(t => {
      if (t.paymentStatus === 'HUTANG' || t.note === 'Penambahan Hutang Manual') {
        let amount = t.subtotal;
        if (t.paymentStatus === 'HUTANG') amount = t.subtotal - (t.returnUsed || 0);
        if (t.note === 'Penambahan Hutang Manual') amount = t.subtotal || t.amount;
        logs.push({ ...t, debtType: 'in', nominal: amount });
      }
      if (t.debtPaid > 0) {
        logs.push({ ...t, debtType: 'out', nominal: t.debtPaid, note: `Bayar Hutang (Kasir) ${t.note ? '- '+t.note : ''}` });
      }
      if (t.note === 'Cicilan/Pelunasan Hutang') {
         logs.push({ ...t, debtType: 'out', nominal: t.subtotal });
      }
    });
    return logs.sort((a, b) => getSafeDate(b.createdAt) - getSafeDate(a.createdAt));
  }, [transactions]);

  const depositLogs = useMemo(() => {
    let logs = [];
    returnsData.forEach(r => {
      if (r.refundType === 'deposit') {
        logs.push({ ...r, depType: 'in', nominal: r.amount, note: `Retur: ${r.reason}` });
      }
    });
    transactions.forEach(t => {
      if (t.returnUsed > 0) {
        logs.push({ ...t, depType: 'out', nominal: t.returnUsed, note: `Dipakai belanja (Nota: #${t.id?.substring(0,6)})` });
      }
    });
    return logs.sort((a, b) => getSafeDate(b.createdAt) - getSafeDate(a.createdAt));
  }, [returnsData, transactions]);

  const netLogs = useMemo(() => {
    let logs = [];
    transactions.forEach(t => {
      if (Number(t.total) > 0) {
        logs.push({ ...t, netType: 'in', nominal: t.total });
      }
    });
    expenses.forEach(e => {
      logs.push({ ...e, netType: 'out', nominal: e.amount, customerName: e.title });
    });
    return logs.sort((a, b) => getSafeDate(b.createdAt) - getSafeDate(a.createdAt));
  }, [transactions, expenses]);

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

  const handleAddManualDebt = async (e) => {
    e.preventDefault();
    if (!newManualDebt.customerId || !newManualDebt.amount) return onShowToast('Pilih pelanggan dan isi nominal', 'error');
    const cust = customers.find(c => c.id === newManualDebt.customerId);
    if (!cust) return;
    const amount = Number(newManualDebt.amount);
    
    const updateRes = await updateDocument('customers', cust.id, {
      remainingDebt: (Number(cust.remainingDebt) || 0) + amount
    });

    if (updateRes.success) {
      await addDocument('transactions', {
        customerName: cust.name,
        customerId: cust.id,
        subtotal: amount, 
        total: 0, 
        note: newManualDebt.note || 'Penambahan Hutang Manual',
        paymentStatus: 'HUTANG',
        createdAt: new Date()
      });
      onShowToast('Hutang manual berhasil ditambahkan', 'success');
      setNewManualDebt({ customerId: '', amount: '', note: '' });
    }
  };

  // --- FITUR RESET SEMUA DATA (TOMBOL MERAH DI RINGKASAN) ---
  const handleResetAllData = async () => {
    try {
      // 1. Hapus semua histori transaksi & pemasukan
      for (const t of transactions) {
        await deleteDocument('transactions', t.id);
      }
      
      // 2. Hapus semua histori pengeluaran
      for (const e of expenses) {
        await deleteDocument('expenses', e.id);
      }
      
      // 3. Hapus semua histori form retur
      for (const r of returnsData) {
        await deleteDocument('returns', r.id);
      }
      
      // 4. Reset sisa hutang dan deposit semua pelanggan kembali ke 0
      for (const c of customers) {
        if ((Number(c.remainingDebt) || 0) > 0 || (Number(c.returnAmount) || 0) > 0) {
          await updateDocument('customers', c.id, {
            remainingDebt: 0,
            returnAmount: 0
          });
        }
      }

      onShowToast('Seluruh data transaksi, hutang, dan deposit berhasil dihapus bersih', 'success');
      setShowResetModal(false);
    } catch (error) {
      console.error("Gagal mereset data: ", error);
      onShowToast('Gagal mereset sebagian data. Periksa koneksi.', 'error');
    }
  };

  // --- FILTERS ---
  const applyFilters = (list, searchFields) => list.filter(item => {
    const date = getSafeDate(item.createdAt);
    const matchesSearch = searchFields.some(field => (item[field] || '').toLowerCase().includes(searchTerm.toLowerCase()));
    let matchesDate = true;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59);
      matchesDate = date >= start && date <= end;
    }
    return matchesSearch && matchesDate;
  });

  const filteredTransactions = useMemo(() => applyFilters(transactions, ['customerName', 'note']), [transactions, searchTerm, startDate, endDate]);
  const filteredExpenses = useMemo(() => applyFilters(expenses, ['title']), [expenses, searchTerm, startDate, endDate]);
  const filteredDebtHistory = useMemo(() => applyFilters(debtLogs, ['customerName', 'note']), [debtLogs, searchTerm, startDate, endDate]);
  const filteredDepositHistory = useMemo(() => applyFilters(depositLogs, ['customerName', 'note', 'reason']), [depositLogs, searchTerm, startDate, endDate]);
  const filteredNetBalance = useMemo(() => applyFilters(netLogs, ['customerName', 'note', 'title']), [netLogs, searchTerm, startDate, endDate]);

  const handleBulkDelete = async () => {
    let target = [];
    let collectionName = '';
    if (activeTab === 'transactions') { target = filteredTransactions; collectionName = 'transactions'; }
    else if (activeTab === 'expenses') { target = filteredExpenses; collectionName = 'expenses'; }
    
    if (target.length === 0) return onShowToast('Pilih tab Pemasukan atau Pengeluaran untuk hapus masal', 'error');

    for (const item of target) {
      await deleteDocument(collectionName, item.id);
    }
    onShowToast(`${target.length} data dihapus`, 'success');
    setShowBulkDeleteModal(false);
  };

  // --- EXPORT TOOLS LAPORAN MASTER ---
  const handleDownloadMasterExcel = () => {
    let aoa = [
      ["LAPORAN KESELURUHAN BUKU KAS (DETAIL ARUS & HISTORI)"],
      ["Periode:", startDate ? `${startDate} s/d ${endDate}` : "Semua Data Tersedia"],
      []
    ];

    const filterByDate = (list) => applyFilters(list, ['customerName', 'note', 'title', 'reason']);

    const addSimpleSection = (title, data, sign) => {
      if(data.length === 0) return 0;
      aoa.push([`--- ${title} ---`]);
      aoa.push(["Tanggal", "Keterangan", "Nominal"]);
      let sum = 0;
      data.forEach(item => {
        sum += item.nominal;
        aoa.push([formatDisplayDate(item.createdAt), item.customerName || item.note || item.title || item.reason || '-', `${sign} ${item.nominal}`]);
      });
      aoa.push(["TOTAL", "", sum]);
      aoa.push([]);
      return sum;
    };

    const addCombinedSection = (title, data, typeField) => {
      if(data.length === 0) return { sumIn: 0, sumOut: 0, net: 0 };
      aoa.push([`--- ${title} ---`]);
      aoa.push(["Tanggal", "Status", "Keterangan", "Masuk/Bertambah (+)", "Keluar/Berkurang (-)"]);
      let sumIn = 0, sumOut = 0;
      data.forEach(item => {
        const isIn = item[typeField] === 'in';
        const nominal = item.nominal || 0;
        if (isIn) sumIn += nominal; else sumOut += nominal;
        aoa.push([
          formatDisplayDate(item.createdAt), 
          isIn ? 'BERTAMBAH (+)' : 'BERKURANG (-)',
          item.customerName || item.note || item.title || item.reason || '-', 
          isIn ? nominal : 0, 
          !isIn ? nominal : 0
        ]);
      });
      aoa.push(["TOTAL", "", "", sumIn, sumOut]);
      aoa.push(["SELISIH / NETTO", "", "", sumIn - sumOut, ""]);
      aoa.push([]);
      return { sumIn, sumOut, net: sumIn - sumOut };
    };

    addSimpleSection("1. RINCIAN PEMASUKAN KAS", filterByDate(netLogs.filter(l => l.netType === 'in')), '+');
    addSimpleSection("2. RINCIAN PENGELUARAN KAS", filterByDate(netLogs.filter(l => l.netType === 'out')), '-');
    addCombinedSection("3. HISTORI PIUTANG (HUTANG PELANGGAN)", filterByDate(debtLogs), 'debtType');
    addCombinedSection("4. HISTORI DEPOSIT (RETUR PELANGGAN)", filterByDate(depositLogs), 'depType');
    const netKas = addCombinedSection("5. ARUS KAS RIIL (GABUNGAN PEMASUKAN & PENGELUARAN)", filterByDate(netLogs), 'netType');

    aoa.push(["====================================="]);
    aoa.push(["SALDO BERSIH AKHIR (Pemasukan - Pengeluaran)", "", "", netKas.net, ""]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan_Master");
    XLSX.writeFile(wb, `Laporan_Keuangan_Lengkap.xlsx`);
  };

  const handleDownloadMasterPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    let finalY = 15;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Laporan Keseluruhan`, 14, finalY);
    finalY += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`, 14, finalY);
    finalY += 10;

    const filterByDate = (list) => applyFilters(list, ['customerName', 'note', 'title', 'reason']);

    const addSimpleSectionPDF = (title, data, sign, colorHeader) => {
      if(data.length === 0) return 0;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(title, 14, finalY);
      
      let sum = 0;
      const body = data.map(item => {
        sum += item.nominal;
        return [
          formatDisplayDate(item.createdAt), 
          item.customerName || item.note || item.title || item.reason || '-', 
          `${sign} Rp ${item.nominal.toLocaleString()}`
        ];
      });
      
      body.push([
        { content: `TOTAL`, colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, 
        { content: `Rp ${sum.toLocaleString()}`, styles: { fontStyle: 'bold' } }
      ]);

      autoTable(doc, {
        startY: finalY + 3,
        head: [['Tanggal & Jam', 'Keterangan Detail', 'Nominal']],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: colorHeader },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 2) {
            if (data.cell.raw.includes && data.cell.raw.includes('+')) data.cell.styles.textColor = [0, 128, 0];
            if (data.cell.raw.includes && data.cell.raw.includes('-')) data.cell.styles.textColor = [200, 0, 0];
          }
        },
        margin: { bottom: 20 }
      });

      finalY = doc.lastAutoTable.finalY + 10;
      if (finalY > 270) { doc.addPage(); finalY = 15; }
      return sum;
    };

    const addCombinedSectionPDF = (title, data, typeField, colorHeader) => {
      if(data.length === 0) return { net: 0 };
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(title, 14, finalY);
      
      let sumIn = 0, sumOut = 0;
      const body = data.map(item => {
        const isIn = item[typeField] === 'in';
        const nominal = item.nominal || 0;
        if (isIn) sumIn += nominal; else sumOut += nominal;
        return [
          formatDisplayDate(item.createdAt), 
          isIn ? 'BERTAMBAH' : 'BERKURANG',
          item.customerName || item.note || item.title || item.reason || '-', 
          isIn ? `+ Rp ${nominal.toLocaleString()}` : `- Rp ${nominal.toLocaleString()}`
        ];
      });
      
      const net = sumIn - sumOut;
      body.push([
        { content: `TOTAL MASUK: Rp ${sumIn.toLocaleString()} | KELUAR: Rp ${sumOut.toLocaleString()}`, colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, 
        { content: `NET: Rp ${net.toLocaleString()}`, styles: { fontStyle: 'bold', fillColor: net >= 0 ? [240,255,240] : [255,240,240] } }
      ]);

      autoTable(doc, {
        startY: finalY + 3,
        head: [['Tanggal & Jam', 'Status', 'Keterangan Detail', 'Nominal']],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: colorHeader },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 3) {
            if (data.cell.raw.includes && data.cell.raw.includes('+')) data.cell.styles.textColor = [0, 128, 0];
            if (data.cell.raw.includes && data.cell.raw.includes('-')) data.cell.styles.textColor = [200, 0, 0];
          }
        },
        margin: { bottom: 20 }
      });

      finalY = doc.lastAutoTable.finalY + 10;
      if (finalY > 270) { doc.addPage(); finalY = 15; }
      return { net };
    };

    addSimpleSectionPDF("1. RINCIAN PEMASUKAN KAS", filterByDate(netLogs.filter(l => l.netType === 'in')), '+', [13, 148, 136]); 
    addSimpleSectionPDF("2. RINCIAN PENGELUARAN KAS", filterByDate(netLogs.filter(l => l.netType === 'out')), '-', [220, 38, 38]);
    addCombinedSectionPDF("3. HISTORI PIUTANG (HUTANG PELANGGAN)", filterByDate(debtLogs), 'debtType', [230, 80, 0]); 
    addCombinedSectionPDF("4. HISTORI SALDO DEPOSIT (RETUR PELANGGAN)", filterByDate(depositLogs), 'depType', [128, 0, 128]); 
    const netKas = addCombinedSectionPDF("5. ARUS KAS RIIL (GABUNGAN PEMASUKAN & PENGELUARAN)", filterByDate(netLogs), 'netType', [15, 118, 166]); 

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`SALDO BERSIH AKHIR (Pemasukan - Pengeluaran): Rp ${(netKas.net || 0).toLocaleString()}`, 14, finalY);

    doc.save(`Laporan_Keuangan_Lengkap.pdf`);
  };

  const navigateToTab = (tabId) => {
    setActiveTab(tabId);
    setCurrentPage(1);
    setSearchTerm('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loadingTrans || loadingExp || loadingCust || loadingRet) return <Loading />;

  let currentList = [];
  if (activeTab === 'transactions') currentList = filteredTransactions;
  else if (activeTab === 'expenses') currentList = filteredExpenses;
  else if (activeTab === 'debts') currentList = filteredDebtHistory;
  else if (activeTab === 'returns') currentList = filteredDepositHistory;
  else if (activeTab === 'netbalance') currentList = filteredNetBalance;

  const paginatedItems = currentList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- KOMPONEN PAGINASI CANGGIH ---
  const renderPagination = () => {
    const totalPages = Math.ceil(currentList.length / itemsPerPage);
    return (
      <div className="flex flex-col md:flex-row justify-between items-center p-4 bg-gray-50/50 border-t gap-4">
        <div className="flex items-center gap-2">
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
        
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-gray-500">
            Halaman <span className="text-teal-600 font-black">{currentPage}</span> dari <span className="text-gray-800 font-black">{totalPages || 1}</span>
            <span className="ml-2 text-[10px] uppercase tracking-widest">({currentList.length} Total Data)</span>
          </span>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
              disabled={currentPage === 1}
              className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 disabled:opacity-30 hover:bg-gray-50 hover:text-teal-600 transition-all shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
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

  return (
    <div className="pb-10 bg-gray-50 min-h-screen">
      {/* TABS NAVIGATION */}
      <div className="flex flex-wrap gap-2 mb-6 bg-white p-2 rounded-xl shadow-sm border no-print overflow-x-auto custom-scrollbar">
        {[
          { id: 'overview', label: 'Ringkasan', icon: TrendingUp }, 
          { id: 'transactions', label: 'Pemasukan', icon: ArrowUpCircle }, 
          { id: 'expenses', label: 'Pengeluaran', icon: ArrowDownCircle }, 
          { id: 'debts', label: 'Manajemen Hutang', icon: CreditCard },
          { id: 'returns', label: 'Retur & Deposit', icon: RotateCcw },
          { id: 'netbalance', label: 'Saldo Bersih', icon: Wallet }
        ].map(tab => (
          <button key={tab.id} onClick={() => navigateToTab(tab.id)} className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === tab.id ? 'bg-teal-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* STATS CARDS (KLIKABLE) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div onClick={() => navigateToTab('transactions')} className="bg-white rounded-2xl shadow-sm p-6 border-b-4 border-teal-500 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-300">
          <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Pemasukan Kas</p>
          <h3 className="text-xl font-black text-teal-700">Rp {(totalIncome || 0).toLocaleString()}</h3>
        </div>
        <div onClick={() => navigateToTab('expenses')} className="bg-white rounded-2xl shadow-sm p-6 border-b-4 border-red-500 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-300">
          <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Pengeluaran Kas</p>
          <h3 className="text-xl font-black text-red-600">Rp {(totalExpenses || 0).toLocaleString()}</h3>
        </div>
        <div onClick={() => navigateToTab('debts')} className="bg-white rounded-2xl shadow-sm p-6 border-b-4 border-orange-500 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-300">
          <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Piutang Aktif</p>
          <h3 className="text-xl font-black text-orange-600">Rp {(totalUnpaidDebt || 0).toLocaleString()}</h3>
        </div>
        <div onClick={() => navigateToTab('returns')} className="bg-white rounded-2xl shadow-sm p-6 border-b-4 border-purple-500 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-300">
          <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Deposit Aktif</p>
          <h3 className="text-xl font-black text-purple-600">Rp {(totalDeposit || 0).toLocaleString()}</h3>
        </div>
        <div onClick={() => navigateToTab('netbalance')} className="bg-white rounded-2xl shadow-sm p-6 border-b-4 border-blue-600 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-300">
          <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Uang bersih (Net)</p>
          <h3 className="text-xl font-black text-blue-700">Rp {(balance || 0).toLocaleString()}</h3>
        </div>
      </div>

      {/* --- TAB OVERVIEW --- */}
      {activeTab === 'overview' && (
        <>
          <div className="bg-white p-5 rounded-3xl border flex flex-col md:flex-row flex-wrap gap-4 items-center justify-between mb-6 shadow-sm">
             <div>
                <h4 className="text-sm font-black text-gray-800">Cetak Laporan Keseluruhan Detail (+/-)</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Harian, Mingguan, Bulanan, Tahunan</p>
             </div>
             <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200 flex-1 md:flex-none">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <input type="date" className="bg-transparent text-xs font-black outline-none w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  <span className="text-gray-300">-</span>
                  <input type="date" className="bg-transparent text-xs font-black outline-none w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={handleDownloadMasterExcel} className="flex-1 md:flex-none justify-center p-3 bg-green-50 text-green-700 rounded-xl border border-green-200 hover:bg-green-100 flex items-center gap-2 text-xs font-black shadow-sm"><TableIcon className="w-4 h-4" /> Excel</button>
                    <button onClick={handleDownloadMasterPDF} className="flex-1 md:flex-none justify-center p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-200 hover:bg-blue-100 flex items-center gap-2 text-xs font-black shadow-sm"><FileText className="w-4 h-4" /> PDF</button>
                    {/* TOMBOL RESET SEMUA DATA */}
                    {/* <button onClick={() => setShowResetModal(true)} className="flex-1 md:flex-none justify-center p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 hover:bg-red-100 flex items-center gap-2 text-xs font-black shadow-sm"><Trash2 className="w-4 h-4" /> Reset Data</button> */}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border">
              <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h3 className="text-lg font-black text-gray-800 flex items-center gap-2"><Clock className="text-teal-500" /> Grafik Arus Kas</h3>
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
              <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2"><ListFilter className="text-blue-500" /> Log Transaksi Cepat</h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {netLogs.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 font-bold py-10">Belum ada transaksi</p>
                ) : (
                  netLogs.slice(0, 10).map((log, idx) => {
                    const isIncome = log.netType === 'in';
                    return (
                      <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${isIncome ? 'bg-teal-50 border-teal-100' : 'bg-red-50 border-red-100'}`}>
                        <div className="min-w-0">
                          <p className={`text-sm font-black truncate ${isIncome ? 'text-teal-800' : 'text-red-800'}`}>
                            {log.customerName || log.title}
                          </p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">{formatDisplayDate(log.createdAt)}</p>
                        </div>
                        <p className={`text-sm font-black ${isIncome ? 'text-teal-600' : 'text-red-600'}`}>
                          {isIncome ? '+' : '-'} Rp {log.nominal.toLocaleString()}
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
        <div className="bg-white p-4 rounded-2xl border flex flex-wrap gap-4 items-center mb-6 shadow-sm">
          <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-4 top-3 w-4 h-4 text-gray-300" /><input type="text" placeholder="Cari berdasarkan nama/keterangan..." className="w-full pl-12 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-teal-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
            <Calendar className="w-4 h-4 text-gray-400" /><input type="date" className="bg-transparent text-xs font-black outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-gray-300">-</span><input type="date" className="bg-transparent text-xs font-black outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="flex gap-2">
              <button onClick={() => setShowBulkDeleteModal(true)} className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-100 transition-colors"><Trash2 className="w-5 h-5" /></button>
          </div>
        </div>
      )}

      {/* --- TAB TRANSACTIONS & EXPENSES --- */}
      {(activeTab === 'transactions' || activeTab === 'expenses') && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border shadow-sm">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{activeTab === 'transactions' ? 'Pemasukan Manual' : 'Catat Pengeluaran'}</h4>
            <form onSubmit={activeTab === 'transactions' ? handleAddManualIncome : (e) => { e.preventDefault(); addDocument('expenses', {...newExpense, amount: Number(newExpense.amount), createdAt: new Date()}); onShowToast('Disimpan', 'success'); setNewExpense({title: '', amount: '', category: 'Operasional'}); }} className="flex flex-wrap gap-3">
              <input type="text" placeholder="Deskripsi" className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-teal-500" value={activeTab === 'transactions' ? newManualIncome.note : newExpense.title} onChange={e => activeTab === 'transactions' ? setNewManualIncome({...newManualIncome, note: e.target.value}) : setNewExpense({...newExpense, title: e.target.value})} />
              <input type="number" placeholder="Rp" className="w-44 bg-gray-50 rounded-xl px-4 py-3 text-sm font-black border-none outline-none focus:ring-2 focus:ring-teal-500" value={activeTab === 'transactions' ? newManualIncome.amount : newExpense.amount} onChange={e => activeTab === 'transactions' ? setNewManualIncome({...newManualIncome, amount: e.target.value}) : setNewExpense({...newExpense, amount: e.target.value})} />
              <button className={`px-8 py-3 rounded-xl font-black text-sm text-white ${activeTab === 'transactions' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-red-600 hover:bg-red-700'} shadow-md transition-all`}>Simpan</button>
            </form>
          </div>
          <div className="bg-white rounded-[32px] border overflow-hidden shadow-sm flex flex-col">
            <table className="w-full text-left">
              <thead><tr className="bg-gray-50/50 border-b"><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Keterangan</th><th className="p-5 font-black text-gray-400 uppercase text-[10px] text-right">Nominal Kas</th><th className="p-5 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th></tr></thead>
              <tbody className="divide-y">
                {paginatedItems.map(item => {
                  let tableNominal = Number(item.total || item.amount || 0);
                  if (item.paymentStatus === 'HUTANG' || (!item.total && item.subtotal)) tableNominal = Number(item.subtotal || 0);

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors text-sm">
                      <td className="p-5 font-bold text-gray-500">{formatDisplayDate(item.createdAt)}</td>
                      <td className="p-5 font-black text-gray-800 uppercase">{item.customerName || item.note || item.title}</td>
                      <td className="p-5 font-black text-right text-gray-700">Rp {tableNominal.toLocaleString()}</td>
                      <td className="p-5 text-right"><div className="flex justify-end gap-2">{activeTab === 'transactions' && item.items && (<button onClick={() => { setSelectedNotaTransaction(item); setShowNota(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Eye className="w-4 h-4"/></button>)}<button onClick={() => { setSelectedItem(item); setShowDeleteModal(true); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {renderPagination()}
          </div>
        </div>
      )}

      {/* --- TAB DEBTS (HISTORI HUTANG +/-) --- */}
      {activeTab === 'debts' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border shadow-sm relative z-10">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Penambahan Hutang Manual</h4>
            <form onSubmit={handleAddManualDebt} className="flex flex-col md:flex-row gap-3">
              <CustomerSearchSelect 
                customers={customers} 
                value={newManualDebt.customerId} 
                onChange={(id) => setNewManualDebt({...newManualDebt, customerId: id})}
                placeholder="-- Ketik Cari Pembeli --"
              />
              <input type="text" placeholder="Keterangan" required className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-orange-500" value={newManualDebt.note} onChange={e => setNewManualDebt({...newManualDebt, note: e.target.value})} />
              <input type="number" placeholder="Rp" required className="w-full md:w-44 bg-gray-50 rounded-xl px-4 py-3 text-sm font-black border-none outline-none focus:ring-2 focus:ring-orange-500" value={newManualDebt.amount} onChange={e => setNewManualDebt({...newManualDebt, amount: e.target.value})} />
              <button className="px-8 py-3 rounded-xl font-black text-sm text-white bg-orange-600 hover:bg-orange-700 transition-all shadow-md">Simpan</button>
            </form>
          </div>

          <div className="bg-white rounded-3xl border overflow-hidden shadow-sm mb-6 relative z-0">
            <div className="p-6 bg-gray-50/50 border-b flex justify-between items-center"><h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Daftar Piutang Aktif</h3><div className="bg-orange-100 px-4 py-1 rounded-xl text-orange-600 font-black text-xs uppercase tracking-tighter">Total: Rp {(totalUnpaidDebt || 0).toLocaleString()}</div></div>
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b"><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Pelanggan</th><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Sisa Hutang (Lama+Baru)</th><th className="p-5 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th></tr></thead>
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

          <div className="bg-white rounded-[32px] border overflow-hidden shadow-sm flex flex-col">
             <div className="p-6 bg-gray-50/50 border-b"><h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2"><History className="text-orange-500 w-5 h-5"/> Histori Transaksi Hutang</h3></div>
             <table className="w-full text-left text-sm">
                <thead><tr className="bg-gray-50/50 border-b"><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Pelanggan</th><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Keterangan</th><th className="p-5 font-black text-gray-400 uppercase text-[10px] text-right">Perubahan Hutang</th></tr></thead>
                <tbody className="divide-y">
                  {paginatedItems.map(item => {
                    const isIn = item.debtType === 'in'; // 'in' = nambah hutang (merah), 'out' = bayar hutang (hijau)
                    return (
                      <tr key={item.id + item.debtType} className="hover:bg-gray-50 transition-colors">
                         <td className="p-5 font-bold text-gray-500">{formatDisplayDate(item.createdAt)}</td>
                         <td className="p-5 font-black text-gray-800 uppercase">{item.customerName}</td>
                         <td className="p-5 font-bold text-gray-600">{item.note || 'Belanja Hutang'}</td>
                         <td className={`p-5 font-black text-right whitespace-nowrap ${isIn ? 'text-red-600' : 'text-teal-600'}`}>
                           {isIn ? '(+)' : '(-)'} Rp {(Number(item.nominal)||0).toLocaleString()}
                         </td>
                      </tr>
                    );
                  })}
                </tbody>
             </table>
             {renderPagination()}
          </div>
        </div>
      )}

      {/* --- TAB RETURNS & DEPOSITS (HISTORI DEPOSIT +/-) --- */}
      {activeTab === 'returns' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row justify-between items-center bg-gradient-to-r from-purple-50 to-white gap-4">
            <div>
              <h4 className="text-lg font-black text-purple-800 tracking-tight flex items-center gap-2"><PackagePlus className="w-5 h-5"/> Retur ke Deposit</h4>
              <p className="text-xs text-purple-600 font-bold mt-1">Gunakan tombol ini untuk meretur barang jadi saldo deposit.</p>
            </div>
            <button onClick={() => setShowReturnModal(true)} className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl shadow-purple-200 transition-all uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" /> Proses Retur
            </button>
          </div>

          <div className="bg-white rounded-[32px] border overflow-hidden shadow-sm flex flex-col">
            <div className="p-6 bg-gray-50/50 border-b"><h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2"><History className="text-purple-500 w-5 h-5"/> Histori Saldo Deposit</h3></div>
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b bg-gray-50/50"><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Pelanggan</th><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Detail</th><th className="p-5 font-black text-gray-400 uppercase text-[10px] text-right">Perubahan Deposit</th></tr></thead>
              <tbody className="divide-y">
                {paginatedItems.map(item => {
                  const isIn = item.depType === 'in'; // 'in' = dapet retur (hijau), 'out' = dipake belanja (merah)
                  return (
                    <tr key={item.id + item.depType} className="hover:bg-purple-50/30 transition-all">
                      <td className="p-5 font-bold text-gray-500">{formatDisplayDate(item.createdAt)}</td>
                      <td className="p-5 font-black text-gray-800 uppercase">{item.customerName}</td>
                      <td className="p-5 font-bold text-gray-600 leading-relaxed max-w-xs">{item.note}</td>
                      <td className={`p-5 font-black text-right whitespace-nowrap ${isIn ? 'text-teal-600' : 'text-red-600'}`}>
                        {isIn ? '(+)' : '(-)'} Rp {(Number(item.nominal)||0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {renderPagination()}
          </div>
        </div>
      )}

      {/* --- TAB SALDO BERSIH (ARUS KAS +/-) --- */}
      {activeTab === 'netbalance' && (
        <div className="bg-white rounded-[32px] border overflow-hidden shadow-sm flex flex-col">
          <div className="p-6 bg-gray-50/50 border-b"><h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2"><Wallet className="text-blue-500 w-5 h-5"/> Histori Arus Kas Riil (Uang Laci)</h3></div>
          <table className="w-full text-left text-sm">
             <thead><tr className="border-b bg-gray-50/50"><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Tgl & Jam</th><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Kategori</th><th className="p-5 font-black text-gray-400 uppercase text-[10px]">Keterangan Transaksi</th><th className="p-5 font-black text-gray-400 uppercase text-[10px] text-right">Uang Masuk/Keluar</th></tr></thead>
             <tbody className="divide-y">
               {paginatedItems.map(item => {
                 const isMasuk = item.netType === 'in';
                 return (
                   <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                     <td className="p-5 font-bold text-gray-500">{formatDisplayDate(item.createdAt)}</td>
                     <td className="p-5"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${isMasuk ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'}`}>{isMasuk ? 'PEMASUKAN' : 'PENGELUARAN'}</span></td>
                     <td className="p-5 font-bold text-gray-800 uppercase">{item.customerName || item.title || item.note}</td>
                     <td className={`p-5 font-black text-right whitespace-nowrap ${isMasuk ? 'text-teal-600' : 'text-red-600'}`}>
                       {isMasuk ? '(+)' : '(-)'} Rp {(Number(item.nominal)||0).toLocaleString()}
                     </td>
                   </tr>
                 );
               })}
             </tbody>
          </table>
          {renderPagination()}
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

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-xl font-black text-gray-800 mb-8">Hapus Data Ini?</h3>
            <div className="flex gap-4">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-4 font-black text-gray-400 text-sm">Batal</button>
              <button onClick={async () => { await deleteDocument(activeTab === 'expenses' ? 'expenses' : activeTab === 'returns' ? 'returns' : 'transactions', selectedItem.id); onShowToast('Dihapus', 'success'); setShowDeleteModal(false); }} className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-xl font-black text-gray-800 mb-2">Hapus Masal?</h3>
            <p className="text-sm text-gray-500 mb-8 font-bold">Yakin ingin menghapus seluruh data yang sedang difilter?</p>
            <div className="flex flex-col gap-2">
              <button onClick={handleBulkDelete} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-red-100">Ya, Hapus Semua</button>
              <button onClick={() => setShowBulkDeleteModal(false)} className="w-full py-4 font-black text-gray-400 text-sm">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL UNTUK RESET SEMUA DATA */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center border-t-8 border-red-600">
            <div className="mx-auto bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mb-4 border border-red-100 shadow-inner">
              <AlertTriangle className="w-10 h-10 text-red-600" />
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-2">Reset Semua Data?</h3>
            <p className="text-xs text-gray-500 mb-6 font-bold leading-relaxed">
              Tindakan ini akan menghapus permanen <strong>seluruh</strong> riwayat pemasukan, pengeluaran, histori hutang, dan retur. Saldo hutang dan deposit pembeli akan kembali menjadi Rp 0.
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={handleResetAllData} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-red-200 hover:bg-red-700 uppercase tracking-widest transition-all">Ya, Bersihkan Semua Data</button>
              <button onClick={() => setShowResetModal(false)} className="w-full py-4 font-black text-gray-400 text-sm hover:bg-gray-50 rounded-2xl transition-all">Batal</button>
            </div>
          </div>
        </div>
      )}

      <FormRetur isOpen={showReturnModal} onClose={() => setShowReturnModal(false)} onShowToast={onShowToast} />

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