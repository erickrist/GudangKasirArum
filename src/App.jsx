import { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard';
import Kasir from './pages/Kasir';
import StockOpname from './pages/StockOpname';
import DataPembeli from './pages/DataPembeli';
import Toast from './components/common/Toast';

// OPTIMASI 1: Pindahkan ke luar agar tidak dirender ulang terus-menerus
const PAGE_TITLES = {
  dashboard: 'Dashboard',
  kasir: 'Kasir',
  stock: 'Stock Opname',
  pembeli: 'Data Pembeli',
};

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onShowToast={showToast} />;
      case 'kasir':
        return <Kasir onShowToast={showToast} />;
      case 'stock':
        return <StockOpname onShowToast={showToast} />;
      case 'pembeli':
        return <DataPembeli onShowToast={showToast} />;
      default:
        return <Dashboard onShowToast={showToast} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

      {/* OPTIMASI 2: Hapus 'w-full md:w-auto', biarkan 'flex-1' yang bekerja menyesuaikan ruang */}
      <div className="md:ml-64 flex-1 flex flex-col min-h-screen overflow-x-hidden pb-24 md:pb-0">
        
        {/* OPTIMASI 3: Berikan nilai default jika page tidak ditemukan */}
        <Header title={PAGE_TITLES[currentPage] || 'Dashboard'} />

        <main className="px-4 md:px-8 py-4 md:py-6 flex-1">
          {renderPage()}
        </main>
        
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}
    </div>
  );
}

export default App;