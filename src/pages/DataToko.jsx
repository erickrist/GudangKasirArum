import { useState, useRef } from 'react';
import { Store, Plus, Edit2, Trash2, Search, X, Download, Upload, ShieldAlert } from 'lucide-react';
import { useCollection, addDocument, updateDocument, deleteDocument } from '../hooks/useFirestore';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import * as XLSX from 'xlsx';
import { exportTemplateToko, exportDataToko } from '../utils/exportExcel';

const DataToko = ({ onShowToast }) => {
  const { data: stores, loading } = useCollection('stores');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetAllModal, setShowResetAllModal] = useState(false); // Modal sapu jagat
  const [modalMode, setModalMode] = useState('add');
  const [selectedStore, setSelectedStore] = useState(null);
  
  const fileInputRef = useRef(null);

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

  // FUNGSI SAPU JAGAT HAPUS SEMUA TOKO
  const handleResetAllStores = async () => {
    let count = 0;
    try {
      for (const s of stores) {
        await deleteDocument('stores', s.id);
        count++;
      }
      onShowToast(`${count} Cabang berhasil dihapus permanen`, 'success');
      setShowResetAllModal(false);
    } catch (err) {
      onShowToast('Gagal menghapus sebagian cabang', 'error');
    }
  };

  // FUNGSI IMPORT EXCEL
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const excelData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        if (excelData.length === 0) return onShowToast('File Excel kosong', 'error');

        let successCount = 0; let updateCount = 0; 
        for (const row of excelData) {
          const rawName = row["Nama Cabang"] || row.Nama;
          if (!rawName) continue; // Skip jika tidak ada nama

          const storeData = {
            name: String(rawName), 
            address: row["Alamat Lengkap"] ? String(row["Alamat Lengkap"]) : '',
          };

          // Cari jika toko sudah ada (Update)
          const existingStore = stores.find(s => s.name.toLowerCase() === storeData.name.toLowerCase());
          if (existingStore) {
             await updateDocument('stores', existingStore.id, storeData); 
             updateCount++;
          } else {
             // Jika belum ada (Tambah Baru)
             await addDocument('stores', { ...storeData, createdAt: new Date() });
             successCount++;
          }
        }
        onShowToast(`${successCount} cabang baru, ${updateCount} diperbarui`, 'success');
      } catch (error) { 
        onShowToast('Gagal import file Excel', 'error'); 
      }
      e.target.value = null; // Reset input file
    };
    reader.readAsArrayBuffer(file);
  };

  if (loading) return <Loading />;

  return (
    <div className="pb-10 min-h-screen">
      
      {/* HEADER RESPONSIF SESUAI STANDAR BARU */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border shadow-sm gap-4 mb-4 md:mb-6">
        <div>
          <h3 className="text-base md:text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2">
            <Store className="w-5 h-5 text-teal-600" /> Manajemen Cabang Toko
          </h3>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1 font-bold">Kelola daftar cabang toko untuk membedakan harga jual dan omset.</p>
        </div>
        
        {/* TOMBOL-TOMBOL AKSI */}
        <div className="grid grid-cols-2 md:flex flex-wrap gap-2 w-full xl:w-auto">
          {/* Tombol Sapu Jagat */}
          {/* <button onClick={() => setShowResetAllModal(true)} className="flex items-center justify-center gap-1.5 bg-red-600 text-white px-3 py-2 rounded-xl text-xs font-black shadow-sm hover:bg-red-700 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Hapus Semua
          </button> */}
          
          <button onClick={() => exportTemplateToko(onShowToast)} className="flex items-center justify-center gap-1.5 bg-gray-50 text-gray-700 border px-3 py-2 rounded-xl text-xs font-black shadow-sm">
            <Download className="w-3.5 h-3.5" /> Template
          </button>
          
          <button onClick={() => exportDataToko(stores, onShowToast)} className="flex items-center justify-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 px-3 py-2 rounded-xl text-xs font-black shadow-sm">
            <Upload className="w-3.5 h-3.5 rotate-180" /> Export
          </button>

          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded-xl text-xs font-black shadow-sm">
            <Upload className="w-3.5 h-3.5" /> Import
          </button>

          <button onClick={() => handleOpenModal('add')} className="col-span-2 md:col-auto flex items-center justify-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md hover:bg-teal-700 transition-colors">
            <Plus className="w-4 h-4" /> Tambah Cabang
          </button>
        </div>
      </div>

      <div className="bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border flex items-center shadow-sm mb-4 md:mb-6">
        <div className="relative w-full">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Cari nama toko..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-2.5 md:py-3 bg-gray-50 border-none rounded-xl text-xs md:text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>

      {stores.length === 0 ? (
        <div className="bg-white rounded-[24px] md:rounded-[32px] border shadow-sm p-6 md:p-10"><EmptyState title="Belum Ada Toko" description="Silakan tambah cabang toko pertama Anda." /></div>
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

      {/* MODAL HAPUS SEMUA TOKO (SAPU JAGAT) */}
      {showResetAllModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 w-full max-w-sm shadow-2xl text-center border-t-8 border-red-600 animate-in zoom-in-95 duration-200">
            <div className="bg-red-50 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-5">
              <ShieldAlert className="w-8 h-8 md:w-10 md:h-10 text-red-600" />
            </div>
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-2 uppercase tracking-tight">HAPUS SEMUA CABANG?</h3>
            <p className="text-xs md:text-sm text-gray-500 mb-6 md:mb-8 font-bold leading-relaxed">
              Peringatan FATAL! Seluruh daftar toko/cabang Anda akan <span className="text-red-600">dihapus permanen</span> dari database.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowResetAllModal(false)} className="flex-1 py-3 rounded-xl font-black text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors text-xs md:text-sm">Batal</button>
              <button onClick={handleResetAllStores} className="flex-1 py-3 rounded-xl font-black text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 transition-colors text-xs md:text-sm active:scale-95">Ya, Hapus Semua</button>
            </div>
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