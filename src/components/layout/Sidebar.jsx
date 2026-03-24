import { LayoutDashboard, Package, Users, ShoppingCart } from 'lucide-react';

const Sidebar = ({ currentPage, onNavigate }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'kasir', label: 'Kasir', icon: ShoppingCart },
    { id: 'stock', label: 'Stock Opname', icon: Package },
    { id: 'pembeli', label: 'Data Pembeli', icon: Users },
  ];

  return (
    <aside className="w-64 bg-white shadow-lg h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-teal-600">Frozen Food</h1>
        <p className="text-sm text-gray-500 mt-1">Sistem Gudang & Kasir</p>
      </div>

      <nav className="p-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                currentPage === item.id
                  ? 'bg-teal-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
