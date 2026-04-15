import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard';
import Kasir from './pages/Kasir';
import StockOpname from './pages/StockOpname';
import DataPembeli from './pages/DataPembeli';
import DataToko from './pages/DataToko'; 
import Toast from './components/common/Toast';

// Mapping judul halaman berdasarkan path URL
const PAGE_TITLES = {
  '/': 'Dashboard',
  '/kasir': 'Kasir',
  '/stock': 'Stock Opname',
  '/pembeli': 'Data Pembeli',
  '/toko': 'Data Toko', 
};

// Komponen pembungkus agar bisa menggunakan hooks useLocation
function AppContent() {
  const location = useLocation();
  const currentPath = location.pathname;
  
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mengirimkan currentPath ke Sidebar untuk mendeteksi menu yang aktif */}
      <Sidebar currentPath={currentPath} />

      <div className="md:ml-64 flex-1 flex flex-col min-h-screen overflow-x-hidden pb-24 md:pb-0">
        
        {/* Header otomatis berubah tulisan sesuai URL saat ini */}
        <Header title={PAGE_TITLES[currentPath] || 'Dashboard'} />

        <main className="px-4 md:px-8 py-4 md:py-6 flex-1">
          {/* SISTEM ROUTING URL BARU */}
          <Routes>
            <Route path="/" element={<Dashboard onShowToast={showToast} />} />
            <Route path="/kasir" element={<Kasir onShowToast={showToast} />} />
            <Route path="/stock" element={<StockOpname onShowToast={showToast} />} />
            <Route path="/pembeli" element={<DataPembeli onShowToast={showToast} />} />
            <Route path="/toko" element={<DataToko onShowToast={showToast} />} />
            
            {/* Jika user mengetik URL ngawur, otomatis tendang balik ke Dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
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

// Komponen Utama App dibungkus dengan Router
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;