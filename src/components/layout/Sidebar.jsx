import { Link } from 'react-router-dom';
import { LayoutDashboard, Package, Users, ShoppingCart, Store } from 'lucide-react';

const Sidebar = ({ currentPath }) => {
  // Mapping menu dengan path URL yang sesuai di App.jsx
  const menuItems = [
    { id: 'dashboard', path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'kasir', path: '/kasir', label: 'Kasir', icon: ShoppingCart },
    { id: 'stock', path: '/stock', label: 'stock', icon: Package },
    { id: 'pembeli', path: '/pembeli', label: 'Pembeli', icon: Users },
    { id: 'toko', path: '/toko', label: 'Toko', icon: Store },
  ];

  return (
    <>
      {/* --- SIDEBAR UNTUK DESKTOP --- */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-100 h-screen fixed left-0 top-0 z-50 flex-col">
        <div className="p-8 mb-4">
          <Link to="/" className="flex items-center gap-3 mb-2 group cursor-pointer">
            <div className="p-2.5 bg-teal-600 rounded-2xl shadow-lg shadow-teal-100 group-hover:scale-110 transition-transform duration-300">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 leading-tight tracking-tighter">
                ARSEN <span className="text-teal-600">POS</span>
              </h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Frozen Food</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;

            return (
              <Link
                key={item.id}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-300 ${
                  isActive 
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-100 translate-x-2' 
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />
                <span className="text-sm tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6">
          <div className="bg-gray-50 rounded-[24px] p-4 border border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center italic">Version 2.0</p>
          </div>
        </div>
      </aside>

      {/* --- BOTTOM NAVIGATION UNTUK HP --- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-[100] px-2 py-2 flex justify-around items-center shadow-[0_-10px_40px_rgba(0,0,0,0.08)] pb-safe">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;
          
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 w-full ${
                isActive ? 'text-teal-600' : 'text-gray-400 hover:text-teal-500'
              }`}
            >
              <div className={`p-1.5 rounded-xl mb-1 transition-all ${isActive ? 'bg-teal-50 scale-110' : ''}`}>
                 <Icon className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <span className={`text-[10px] font-bold tracking-tighter ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};

export default Sidebar;