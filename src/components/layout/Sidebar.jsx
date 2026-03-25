import { LayoutDashboard, Package, Users, ShoppingCart, Store } from 'lucide-react';

const Sidebar = ({ currentPage, onNavigate }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'kasir', label: 'Kasir', icon: ShoppingCart },
    { id: 'stock', label: 'Stock Opname', icon: Package },
    { id: 'pembeli', label: 'Data Pembeli', icon: Users },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-100 h-screen fixed left-0 top-0 z-50 flex flex-col">
      {/* BRANDING SECTION */}
      <div className="p-8 mb-4">
        <div className="flex items-center gap-3 mb-2 group cursor-pointer" onClick={() => onNavigate('dashboard')}>
          <div className="p-2.5 bg-teal-600 rounded-2xl shadow-lg shadow-teal-100 group-hover:scale-110 transition-transform duration-300">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-800 leading-tight tracking-tighter">
              ARSEN <br />
              <span className="text-teal-600">FROZEN FOOD</span>
            </h1>
          </div>
        </div>
        <div className="h-1 w-12 bg-teal-100 rounded-full mt-4"></div>
      </div>

      {/* NAVIGATION SECTION */}
      <nav className="flex-1 px-4 space-y-2">
        <p className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
          Main Menu
        </p>
        
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-[20px] transition-all duration-300 group ${
                isActive
                  ? 'bg-teal-600 text-white shadow-xl shadow-teal-100 translate-x-2'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-teal-600'
              }`}
            >
              <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-teal-600'}`} />
              </div>
              <span className={`text-sm font-black uppercase tracking-wider ${isActive ? 'text-white' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* FOOTER SECTION */}
      <div className="p-6">
        <div className="bg-gray-50 rounded-[24px] p-4 border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
            System
          </p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;