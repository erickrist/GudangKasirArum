import { useState, useMemo } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Users, Phone, MapPin, Search, ChevronLeft, ChevronRight, Info, Store } from 'lucide-react';
import { useCollection, addDocument, updateDocument, deleteDocument } from '../hooks/useFirestore';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';

const DataPembeli = ({ onShowToast }) => {
  const { data: customers, loading } = useCollection('customers', 'name'); 
  const { data: stores } = useCollection('stores'); // FIX: Panggil data toko
  
  // --- UI & FORM STATES ---
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    storeId: '' // FIX: Tambah state cabang toko
  });

  // --- FILTER & PAGINATION STATES ---
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const resetForm = () => {
    setFormData({ name: '', phone: '', address: '', storeId: '' });
  };

  const handleOpenModal = (mode, customer = null) => {
    setModalMode(mode);
    if (mode === 'edit' && customer) {
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        address: customer.address || '',
        storeId: customer.storeId || '' // Set toko saat edit
      });
      setSelectedCustomer(customer);
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const customerData = {
      name: formData.name,
      phone: formData.phone,
      address: formData.address,
      storeId: formData.storeId || 'ALL', // Simpan data toko (Default ALL kalau kosong)
    };

    let result;
    if (modalMode === 'add') {
      customerData.remainingDebt = 0;
      customerData.returnAmount = 0;
      result = await addDocument('customers', customerData);
    } else {
      result = await updateDocument('customers', selectedCustomer.id, customerData);
    }

    if (result.success) {
      onShowToast(
        modalMode === 'add' ? 'Pembeli berhasil ditambahkan' : 'Data pembeli berhasil diperbarui',
        'success'
      );
      setShowModal(false);
      resetForm();
    } else {
      onShowToast('Gagal menyimpan data pembeli', 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedCustomer) return;

    const result = await deleteDocument('customers', selectedCustomer.id);
    if (result.success) {
      onShowToast('Pembeli berhasil dihapus', 'success');
      setShowDeleteModal(false);
      setSelectedCustomer(null);
    } else {
      onShowToast('Gagal menghapus pembeli', 'error');
    }
  };

  // --- FILTERING & PAGINATION LOGIC ---
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.phone || '').includes(searchTerm)
    );
  }, [customers, searchTerm]);

  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderPagination = () => {
    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
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
            <span className="ml-1 text-[10px] uppercase tracking-widest hidden md:inline">({filteredCustomers.length} Total)</span>
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

  if (loading) return <Loading />;

  return (
    <div className="pb-10 min-h-screen">
      {/* HEADER RESPONSIF */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border shadow-sm gap-4 mb-4 md:mb-6">
        <div>
          <h3 className="text-base md:text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" /> Database Pembeli
          </h3>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1 font-bold">Kelola nama, kontak, dan alamat pelanggan Anda.</p>
        </div>
        <button
          onClick={() => handleOpenModal('add')}
          className="w-full md:w-auto flex justify-center items-center gap-2 bg-teal-600 text-white px-6 py-3 md:py-3.5 rounded-xl md:rounded-2xl hover:bg-teal-700 transition-colors font-black text-xs md:text-sm shadow-md uppercase tracking-widest active:scale-95"
        >
          <Plus className="w-4 h-4" /> Tambah Pembeli
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border flex items-center shadow-sm mb-4 md:mb-6">
        <div className="relative w-full">
          <Search className="absolute left-4 top-3 md:top-3.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama atau no telepon..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-11 pr-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl text-xs md:text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* MAIN TABLE */}
      {customers.length === 0 ? (
        <div className="bg-white rounded-[24px] md:rounded-[32px] shadow-sm p-6 md:p-10 border">
          <EmptyState title="Belum Ada Data Pembeli" description="Mulai tambahkan data pembeli untuk memudahkan transaksi" icon={Users} />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-[24px] md:rounded-[32px] border shadow-sm p-6 md:p-10 text-center">
          <Users className="w-10 h-10 md:w-12 md:h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-bold text-sm">Pembeli tidak ditemukan</p>
        </div>
      ) : (
        <div className="bg-white rounded-[24px] md:rounded-[32px] border shadow-sm flex flex-col overflow-hidden">
          
          {/* PEMBUNGKUS TABEL AGAR BISA DI-SCROLL DI HP */}
          <div className="overflow-x-auto w-full custom-scrollbar">
            <table className="w-full min-w-[700px] text-left text-xs md:text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b">
                  <th className="p-4 md:p-5 font-black text-gray-400 uppercase text-[10px] whitespace-nowrap">Nama & Kontak</th>
                  <th className="p-4 md:p-5 font-black text-gray-400 uppercase text-[10px]">Alamat & Cabang</th>
                  <th className="p-4 md:p-5 font-black text-orange-400 uppercase text-[10px]">Hutang Aktif</th>
                  <th className="p-4 md:p-5 font-black text-purple-400 uppercase text-[10px]">Saldo Deposit</th>
                  <th className="p-4 md:p-5 font-black text-gray-400 uppercase text-[10px] text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedCustomers.map((customer) => {
                  const storeName = customer.storeId === 'pusat' ? 'Pusat' : 
                                    customer.storeId === 'ALL' ? 'Semua Cabang' : 
                                    (stores.find(s => s.id === customer.storeId)?.name || 'Semua Cabang');
                  return (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="p-4 md:p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-teal-50 rounded-full flex items-center justify-center flex-shrink-0">
                            <Users className="w-4 h-4 md:w-5 md:h-5 text-teal-600" />
                          </div>
                          <div>
                            <span className="font-black text-gray-800 uppercase block">{customer.name}</span>
                            <span className="text-[9px] md:text-[10px] font-bold text-gray-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" /> {customer.phone || 'Tidak ada nomor'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 md:p-5">
                        <div className="flex flex-col gap-1 text-[10px] md:text-xs font-bold text-gray-600 max-w-[150px] md:max-w-xs">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                            <span className="line-clamp-2">{customer.address || '-'}</span>
                          </div>
                          {/* Menampilkan label Cabang asal pembeli */}
                          <div className="flex items-center gap-1 mt-1 text-[9px] uppercase tracking-widest text-teal-600 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded w-max">
                            <Store className="w-2.5 h-2.5" /> {storeName}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 md:p-5">
                        <span className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-black whitespace-nowrap ${customer.remainingDebt > 0 ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'text-gray-400'}`}>
                          Rp {(customer.remainingDebt || 0).toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td className="p-4 md:p-5">
                        <span className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-black whitespace-nowrap ${customer.returnAmount > 0 ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'text-gray-400'}`}>
                          Rp {(customer.returnAmount || 0).toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td className="p-4 md:p-5 text-right">
                        <div className="flex justify-end gap-1 md:gap-2">
                          <button onClick={() => handleOpenModal('edit', customer)} className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg md:rounded-xl transition-all">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => { setSelectedCustomer(customer); setShowDeleteModal(true); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg md:rounded-xl transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
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
      )}

      {/* --- MODAL ADD / EDIT --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-4 md:mb-6 flex items-center gap-2 border-b pb-3 md:pb-4">
              {modalMode === 'add' ? <><Plus className="w-4 h-4 md:w-5 md:h-5 text-teal-600"/> Tambah Pembeli</> : <><Edit2 className="w-4 h-4 md:w-5 md:h-5 text-teal-600"/> Edit Profil Pembeli</>}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Nama Lengkap</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-teal-500" placeholder="Ketik nama pembeli..." />
              </div>

              <div>
                <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Nomor Telepon (Opsional)</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-teal-500" placeholder="08..." />
              </div>

              {/* FIX: Input Pilihan Cabang Asal Pembeli */}
              <div>
                <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Cabang Asal (Opsional)</label>
                <div className="relative">
                  <Store className="absolute left-3 md:left-4 top-3 md:top-3.5 w-4 h-4 text-gray-400" />
                  <select 
                    value={formData.storeId} 
                    onChange={(e) => setFormData({ ...formData, storeId: e.target.value })} 
                    className="w-full pl-10 md:pl-11 pr-3 md:pr-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer"
                  >
                    <option value="">-- Bebas (Semua Cabang) --</option>
                    <option value="pusat">🏢 Pusat / Utama</option>
                    {stores.map(s => <option key={s.id} value={s.id}>🏪 {s.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Alamat (Opsional)</label>
                <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows="2" className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none custom-scrollbar" placeholder="Alamat lengkap pengiriman..." />
              </div>

              {/* KETERANGAN READ-ONLY JIKA EDIT */}
              {modalMode === 'edit' && (
                <div className="bg-blue-50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-blue-100 flex gap-2 md:gap-3 mt-4">
                   <Info className="w-4 h-4 md:w-5 md:h-5 text-blue-500 flex-shrink-0" />
                   <p className="text-[9px] md:text-[10px] font-bold text-blue-800 leading-relaxed uppercase tracking-wider">
                     Perubahan nominal <strong>Hutang</strong> dan <strong>Deposit (Retur)</strong> dikunci dari form ini untuk keamanan. Gunakan menu Dashboard atau Kasir untuk mengelola Saldo/Hutang.
                   </p>
                </div>
              )}

              <div className="flex gap-2 md:gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-gray-400 hover:bg-gray-100 transition-colors text-xs md:text-sm uppercase tracking-widest">
                  Batal
                </button>
                <button type="submit" className="flex-1 px-4 py-3 md:py-4 bg-teal-600 text-white rounded-xl md:rounded-2xl font-black hover:bg-teal-700 transition-all shadow-lg shadow-teal-100 text-xs md:text-sm uppercase tracking-widest active:scale-95">
                  {modalMode === 'add' ? 'Simpan' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DELETE --- */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-2">Hapus Pembeli?</h3>
            <p className="text-xs md:text-sm text-gray-500 mb-6 font-bold leading-relaxed">
              Yakin ingin menghapus <strong>{selectedCustomer?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={handleDelete} className="w-full bg-red-600 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs md:text-sm shadow-md shadow-red-100 uppercase tracking-widest active:scale-95">
                Ya, Hapus
              </button>
              <button onClick={() => { setShowDeleteModal(false); setSelectedCustomer(null); }} className="w-full py-3 md:py-4 font-black text-gray-400 text-xs md:text-sm hover:bg-gray-50 rounded-xl md:rounded-2xl transition-colors uppercase tracking-widest">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataPembeli;