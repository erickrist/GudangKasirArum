import { useState } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Users, Phone, MapPin } from 'lucide-react';
import { useCollection, addDocument, updateDocument, deleteDocument } from '../hooks/useFirestore';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';

const DataPembeli = ({ onShowToast }) => {
  const { data: customers, loading } = useCollection('customers');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    remainingDebt: 0,
    returnAmount: 0,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      address: '',
      remainingDebt: 0,
      returnAmount: 0,
    });
  };

  const handleOpenModal = (mode, customer = null) => {
    setModalMode(mode);
    if (mode === 'edit' && customer) {
      setFormData(customer);
      setSelectedCustomer(customer);
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const customerData = {
      ...formData,
      remainingDebt: parseFloat(formData.remainingDebt) || 0,
      returnAmount: parseFloat(formData.returnAmount) || 0,
    };

    let result;
    if (modalMode === 'add') {
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

  if (loading) return <Loading />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Daftar Pembeli</h3>
          <p className="text-sm text-gray-500 mt-1">Kelola data pembeli dan informasi kontak</p>
        </div>
        <button
          onClick={() => handleOpenModal('add')}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Tambah Pembeli
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <EmptyState
            title="Belum Ada Data Pembeli"
            description="Mulai tambahkan data pembeli untuk memudahkan transaksi"
            icon={Users}
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Nama</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Telepon</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Alamat</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Sisa Nota</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Retur</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-teal-600" />
                        </div>
                        <span className="font-medium text-gray-800">{customer.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        {customer.phone || '-'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4" />
                        {customer.address || '-'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-sm font-semibold ${customer.remainingDebt > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        Rp {(customer.remainingDebt || 0).toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-sm font-semibold ${customer.returnAmount > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                        Rp {(customer.returnAmount || 0).toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenModal('edit', customer)}
                          className="text-teal-600 hover:text-teal-700 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-600 hover:text-red-700 transition-colors"
                        >
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
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">
              {modalMode === 'add' ? 'Tambah Pembeli' : 'Edit Pembeli'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Telepon</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sisa Nota (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.remainingDebt}
                  onChange={(e) => setFormData({ ...formData, remainingDebt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Retur Barang (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.returnAmount}
                  onChange={(e) => setFormData({ ...formData, returnAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  {modalMode === 'add' ? 'Tambah' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Hapus Pembeli?</h3>
            <p className="text-gray-600 mb-6">
              Apakah Anda yakin ingin menghapus data pembeli <strong>{selectedCustomer?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedCustomer(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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

export default DataPembeli;
