import { useState } from 'react';
import { Store, Plus, Edit2, Trash2, Search, X } from 'lucide-react';
import { useCollection, addDocument, updateDocument, deleteDocument } from '../hooks/useFirestore';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';

const DataToko = ({ onShowToast }) => {
  const { data: stores, loading } = useCollection('stores');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedStore, setSelectedStore] = useState(null);
  
  const [formData, setFormData] = useState({ name: '', address: '' });

  const filteredStores = stores.filter(store => 
    store.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => setFormData({ name: '', address: '' });

  const handleOpenModal = (mode, store = null) => {
    setModalMode(mode);
    if (mode === 'edit' && store) {
      setFormData({ name: store.name, address: store.address || '' });
      setSelectedStore(store);
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return onShowToast('Nama toko wajib diisi', 'error');

    let result;
    if (modalMode === 'add') {
      result = await addDocument('stores', { ...formData, createdAt: new Date() });
      if (result.success) onShowToast('Cabang toko berhasil ditambahkan', 'success');
    } else {
      result = await updateDocument('stores', selectedStore.id, formData);
      if (result.success) onShowToast('Data toko berhasil diperbarui', 'success');
    }

    if (result.success) {
      setShowModal(false);
      resetForm();
    } else {
      onShowToast('Gagal menyimpan data', 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedStore) return;
    const result = await deleteDocument('stores', selectedStore.id);
    if (result.success) {
      onShowToast('Toko berhasil dihapus', 'success');
      setShowDeleteModal(false);
      setSelectedStore(null);
    } else {
      onShowToast('Gagal menghapus toko', 'error');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="pb-10 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border shadow-sm gap-4 mb-6">
        <div>
          <h3 className="text-lg font-black text-gray-800 uppercase flex items-center gap-2"><Store className="w-6 h-6 text-teal-600"/> Manajemen Cabang Toko</h3>
          <p className="text-xs text-gray-500 mt-1 font-bold">Kelola daftar cabang toko untuk membedakan harga jual dan omset.</p>
        </div>
        <button onClick={() => handleOpenModal('add')} className="flex items-center gap-2 bg-teal-600 text-white px-5 py-3 rounded-xl text-sm font-black shadow-md hover:bg-teal-700 transition-all active:scale-95">
          <Plus className="w-5 h-5" /> Tambah Cabang
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border flex items-center shadow-sm mb-6">
        <div className="relative w-full">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Cari nama toko..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>

      {stores.length === 0 ? (
        <div className="bg-white rounded-3xl border shadow-sm p-10"><EmptyState title="Belum Ada Toko" description="Silakan tambah cabang toko pertama Anda." /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {filteredStores.map(store => (
            <div key={store.id} className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-teal-300 transition-all flex flex-col justify-between h-full">
              <div>
                <div className="bg-teal-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <Store className="w-6 h-6 text-teal-600" />
                </div>
                <h4 className="font-black text-gray-800 text-lg uppercase tracking-tight mb-2">{store.name}</h4>
                <p className="text-xs text-gray-500 font-bold leading-relaxed">{store.address || 'Alamat tidak diisi'}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-6 pt-4 border-t border-dashed border-gray-100">
                <button onClick={() => handleOpenModal('edit', store)} className="flex items-center justify-center gap-2 bg-gray-50 text-gray-600 hover:bg-teal-50 hover:text-teal-600 py-2.5 rounded-xl font-black text-xs uppercase transition-colors"><Edit2 className="w-4 h-4"/> Edit</button>
                <button onClick={() => { setSelectedStore(store); setShowDeleteModal(true); }} className="flex items-center justify-center gap-2 bg-gray-50 text-gray-600 hover:bg-red-50 hover:text-red-600 py-2.5 rounded-xl font-black text-xs uppercase transition-colors"><Trash2 className="w-4 h-4"/> Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL FORM TOKO */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-6 md:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black uppercase flex items-center gap-2"><Store className="w-6 h-6 text-teal-600"/> {modalMode === 'add' ? 'Tambah Toko' : 'Edit Toko'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 bg-gray-50 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><X/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block ml-2">Nama Toko / Cabang</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-sm outline-none focus:ring-2 focus:ring-teal-500" placeholder="Cth: Cabang Pasar Malam" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block ml-2">Keterangan / Alamat (Opsional)</label>
                <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-teal-500 min-h-[100px] resize-none" placeholder="Cth: Jl. Merdeka No.12" />
              </div>
              <div className="flex gap-2 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 p-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 transition-colors">Batal</button>
                <button type="submit" className="flex-1 p-4 bg-teal-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-teal-700 shadow-md shadow-teal-100 transition-colors">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HAPUS TOKO */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-6 md:p-8 text-center">
            <h3 className="text-xl font-black mb-2 uppercase tracking-tighter">Hapus Toko Ini?</h3>
            <p className="text-xs text-gray-500 font-bold mb-8">Anda yakin ingin menghapus cabang <strong className="text-gray-800">{selectedStore?.name}</strong>?</p>
            <div className="flex flex-col gap-2">
              <button onClick={handleDelete} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-md shadow-red-100 hover:bg-red-700">Ya, Hapus</button>
              <button onClick={() => setShowDeleteModal(false)} className="w-full py-4 bg-gray-50 text-gray-500 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-100">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataToko;