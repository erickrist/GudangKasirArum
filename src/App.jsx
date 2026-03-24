import { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard';
import Kasir from './pages/Kasir';
import StockOpname from './pages/StockOpname';
import DataPembeli from './pages/DataPembeli';
import Toast from './components/common/Toast';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  const pageTitle = {
    dashboard: 'Dashboard',
    kasir: 'Kasir',
    stock: 'Stock Opname',
    pembeli: 'Data Pembeli',
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
    <div className="min-h-screen bg-gray-50">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

      <div className="ml-64">
        <Header title={pageTitle[currentPage]} />

        <main className="px-8 py-6">
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
