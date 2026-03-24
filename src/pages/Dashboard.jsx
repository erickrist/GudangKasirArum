import { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend 
} from 'recharts';
import { 
  TrendingUp, DollarSign, ShoppingBag, Trash2, Eye, Printer, FileText, 
  Table as TableIcon, ChevronLeft, ChevronRight, Search, Calendar, Wallet, CreditCard, ArrowDownCircle, ArrowUpCircle
} from 'lucide-react';
import { useCollection, deleteDocument, addDocument } from '../hooks/useFirestore';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import Nota from '../components/Nota';

// Library untuk Export
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Dashboard = ({ onShowToast }) => {
  // Data Firestore
  const { data: transactions, loading: loadingTrans } = useCollection('transactions', 'createdAt');
  const { data: expenses, loading: loadingExp } = useCollection('expenses', 'createdAt');
  const { data: customers, loading: loadingCust } = useCollection('customers');

  // State UI
  const [activeTab, setActiveTab] = useState('overview'); // overview, transactions, expenses, debts
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showNota, setShowNota] = useState(false);
  const [selectedNotaTransaction, setSelectedNotaTransaction] = useState(null);

  // State Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chartFilter, setChartFilter] = useState('7days');

  // State Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // State Input Pengeluaran
  const [newExpense, setNewExpense] = useState({ title: '', amount: '', category: 'Operasional' });

  // --- HELPER TANGGAL ---
  const getSafeDate = (dateSource) => {
    if (!dateSource) return null;
    try {
      if (dateSource.toDate) return dateSource.toDate();
      if (dateSource.seconds) return new Date(dateSource.seconds * 1000);
      const date = new Date(dateSource);
      return isNaN(date.getTime()) ? null : date;
    } catch (e) { return null; }
  };

  const formatDisplayDate = (dateSource) => {
    const date = getSafeDate(dateSource);
    return date ? date.toLocaleDateString('id-ID') : '-';
  };

  // --- LOGIKA KEUANGAN (CALCULATION) ---
  const totalIncome = useMemo(() => transactions.reduce((sum, t) => sum + (t.subtotal || 0), 0), [transactions]);
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0), [expenses]);
  const balance = totalIncome - totalExpenses;

  // --- FILTERING LOGIC (SEARCH & DATE) ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const date = getSafeDate(t.createdAt);
      const matchesSearch = t.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           t.id?.toLowerCase().includes(searchTerm.toLowerCase());
      
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

  const customersWithDebt = useMemo(() => {
    return customers.filter(c => (c.remainingDebt || 0) > 0);
  }, [customers]);

  // --- PAGINATION LOGIC ---
  const currentItems = useMemo(() => {
    const data = activeTab === 'transactions' ? filteredTransactions : filteredExpenses;
    const limit = itemsPerPage === 'all' ? data.length : itemsPerPage;
    const start = (currentPage - 1) * limit;
    return data.slice(start, start + limit);
  }, [activeTab, filteredTransactions, filteredExpenses, currentPage, itemsPerPage]);

  const totalPages = Math.ceil((activeTab === 'transactions' ? filteredTransactions.length : filteredExpenses.length) / itemsPerPage);

  // --- ACTION HANDLERS ---
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.title || !newExpense.amount) return onShowToast('Isi semua data', 'error');
    
    const result = await addDocument('expenses', {
      ...newExpense,
      amount: Number(newExpense.amount),
      createdAt: new Date()
    });

    if (result.success) {
      onShowToast('Pengeluaran dicatat', 'success');
      setNewExpense({ title: '', amount: '', category: 'Operasional' });
    }
  };

  const handleDownloadExcel = (type) => {
    const data = type === 'income' ? filteredTransactions : filteredExpenses;
    const reportData = data.map(item => type === 'income' ? ({
      Tanggal: formatDisplayDate(item.createdAt),
      Nama: item.customerName,
      Total: item.subtotal,
      Status: item.paymentStatus
    }) : ({
      Tanggal: formatDisplayDate(item.createdAt),
      Keterangan: item.title,
      Kategori: item.category,
      Jumlah: item.amount
    }));

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    XLSX.writeFile(wb, `Laporan_${type}_${Date.now()}.xlsx`);
  };

  const handleDownloadPDF = (type) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.text(`Laporan ${type === 'income' ? 'Pemasukan' : 'Pengeluaran'}`, 14, 15);
    
    const data = type === 'income' ? filteredTransactions : filteredExpenses;
    const body = data.map(item => type === 'income' ? 
      [formatDisplayDate(item.createdAt), item.customerName, `Rp ${item.subtotal.toLocaleString()}`, item.paymentStatus] :
      [formatDisplayDate(item.createdAt), item.title, item.category, `Rp ${item.amount.toLocaleString()}`]
    );

    autoTable(doc, {
      head: [type === 'income' ? ['Tanggal', 'Pembeli', 'Total', 'Status'] : ['Tanggal', 'Keterangan', 'Kategori', 'Jumlah']],
      body: body,
      startY: 20,
      theme: 'grid',
      headStyles: { fillColor: type === 'income' ? [13, 148, 136] : [220, 38, 38] }
    });
    doc.save(`Laporan_${type}.pdf`);
  };

  if (loadingTrans || loadingExp || loadingCust) return <Loading />;

  return (
    <div className="pb-10">
      {/* TABS NAVIGATION */}
      <div className="flex flex-wrap gap-2 mb-6 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
        {[
          { id: 'overview', label: 'Ringkasan', icon: TrendingUp },
          { id: 'transactions', label: 'Pemasukan', icon: ArrowUpCircle },
          { id: 'expenses', label: 'Pengeluaran', icon: ArrowDownCircle },
          { id: 'debts', label: 'Daftar Hutang', icon: CreditCard },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-teal-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* STATS CARDS (Selalu Muncul di Overview) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-teal-500">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase">Total Pemasukan</p>
              <h3 className="text-2xl font-bold text-gray-800">Rp {totalIncome.toLocaleString('id-ID')}</h3>
            </div>
            <div className="bg-teal-50 p-3 rounded-full text-teal-600"><ArrowUpCircle /></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-red-500">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase">Total Pengeluaran</p>
              <h3 className="text-2xl font-bold text-gray-800">Rp {totalExpenses.toLocaleString('id-ID')}</h3>
            </div>
            <div className="bg-red-50 p-3 rounded-full text-red-600"><ArrowDownCircle /></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase">Saldo (Balance)</p>
              <h3 className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                Rp {balance.toLocaleString('id-ID')}
              </h3>
            </div>
            <div className="bg-blue-50 p-3 rounded-full text-blue-600"><Wallet /></div>
          </div>
        </div>
      </div>

      {/* --- TAB CONTENT: OVERVIEW --- */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-6">Perbandingan Arus Kas (Income vs Expense)</h3>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Income', amount: totalIncome, fill: '#0d9488' },
                  { name: 'Expense', amount: totalExpenses, fill: '#dc2626' }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(v) => `Rp ${v.toLocaleString()}`} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: PEMASUKAN & PENGELUARAN (Shared Table UI) --- */}
      {(activeTab === 'transactions' || activeTab === 'expenses') && (
        <div className="space-y-6">
          {/* Form Input Pengeluaran (Hanya di tab Expenses) */}
          {activeTab === 'expenses' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-md font-bold text-gray-800 mb-4">Catat Pengeluaran Baru</h3>
              <form onSubmit={handleAddExpense} className="flex flex-wrap gap-4">
                <input 
                  type="text" placeholder="Keterangan (Contoh: Bayar Listrik)" 
                  className="flex-1 min-w-[200px] border rounded-lg px-4 py-2"
                  value={newExpense.title} onChange={e => setNewExpense({...newExpense, title: e.target.value})}
                />
                <input 
                  type="number" placeholder="Jumlah (Rp)" 
                  className="w-40 border rounded-lg px-4 py-2"
                  value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                />
                <select 
                  className="border rounded-lg px-4 py-2"
                  value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                >
                  <option>Operasional</option>
                  <option>Stok Barang</option>
                  <option>Gaji</option>
                  <option>Lainnya</option>
                </select>
                <button className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700">Simpan</button>
              </form>
            </div>
          )}

          {/* FILTER BAR */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input 
                type="text" placeholder="Cari data..." 
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input type="date" className="border rounded-lg px-2 py-1.5 text-xs" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span className="text-gray-400">-</span>
              <input type="date" className="border rounded-lg px-2 py-1.5 text-xs" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => handleDownloadExcel(activeTab === 'transactions' ? 'income' : 'expense')} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"><TableIcon className="w-5 h-5" /></button>
              <button onClick={() => handleDownloadPDF(activeTab === 'transactions' ? 'income' : 'expense')} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><FileText className="w-5 h-5" /></button>
            </div>
          </div>

          {/* DATA TABLE */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">Tanggal</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">{activeTab === 'transactions' ? 'Pembeli' : 'Keterangan'}</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">{activeTab === 'transactions' ? 'Items' : 'Kategori'}</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">Total</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {currentItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-sm text-gray-600">{formatDisplayDate(item.createdAt)}</td>
                    <td className="p-4 text-sm font-bold text-gray-800">{activeTab === 'transactions' ? (item.customerName || '-') : item.title}</td>
                    <td className="p-4 text-sm text-gray-500">
                      {activeTab === 'transactions' ? `${item.items?.length || 0} item` : <span className="px-2 py-1 bg-gray-100 rounded-md">{item.category}</span>}
                    </td>
                    <td className="p-4 text-sm font-bold">
                      <span className={activeTab === 'transactions' ? 'text-teal-600' : 'text-red-600'}>
                        Rp {(activeTab === 'transactions' ? item.subtotal : item.amount).toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="p-4 flex gap-3">
                      {activeTab === 'transactions' ? (
                        <>
                          <button onClick={() => handleViewNota(item)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => handlePrintNota(item)} className="text-teal-500 hover:bg-teal-50 p-1.5 rounded-lg"><Printer className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <button onClick={() => { setSelectedTransaction(item); setShowDeleteModal(true); }} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* PAGINATION */}
            <div className="p-4 border-t flex justify-between items-center bg-gray-50">
               <select 
                  value={itemsPerPage} onChange={(e) => {setItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value)); setCurrentPage(1);}}
                  className="text-xs border rounded-md p-1"
               >
                  <option value={5}>5 Baris</option>
                  <option value={10}>10 Baris</option>
                  <option value="all">Semua</option>
               </select>
               <div className="flex gap-2">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 border rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4"/></button>
                  <span className="text-xs font-bold self-center">Hal {currentPage} / {totalPages || 1}</span>
                  <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1 border rounded disabled:opacity-30"><ChevronRight className="w-4 h-4"/></button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: DAFTAR HUTANG --- */}
      {activeTab === 'debts' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b">
            <h3 className="text-lg font-bold text-gray-800">Pelanggan dengan Sisa Hutang</h3>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Nama Pelanggan</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">No. HP</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Total Hutang</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customersWithDebt.map(customer => (
                <tr key={customer.id}>
                  <td className="p-4 text-sm font-bold">{customer.name}</td>
                  <td className="p-4 text-sm text-gray-500">{customer.phone || '-'}</td>
                  <td className="p-4 text-sm font-bold text-red-600">Rp {customer.remainingDebt?.toLocaleString('id-ID')}</td>
                  <td className="p-4">
                    <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-bold uppercase">Belum Lunas</span>
                  </td>
                </tr>
              ))}
              {customersWithDebt.length === 0 && (
                <tr><td colSpan="4" className="p-10 text-center text-gray-400">Tidak ada tanggungan hutang saat ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL NOTA & HAPUS (Shared) */}
      {showNota && selectedNotaTransaction && (
        <Nota transaction={selectedNotaTransaction} onClose={() => { setShowNota(false); setSelectedNotaTransaction(null); }} />
      )}
      
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-sm w-full">
            <h3 className="text-lg font-bold mb-2">Hapus Data?</h3>
            <p className="text-sm text-gray-500 mb-6">Tindakan ini permanen dan akan mempengaruhi saldo Anda.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2 border rounded-lg text-sm">Batal</button>
              <button 
                onClick={async () => {
                  await deleteDocument(activeTab === 'expenses' ? 'expenses' : 'transactions', selectedTransaction.id);
                  onShowToast('Data dihapus', 'success');
                  setShowDeleteModal(false);
                }} 
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-bold"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;