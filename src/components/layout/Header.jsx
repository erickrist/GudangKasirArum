import { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';

const Header = ({ title }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Efek untuk memperbarui waktu setiap 1 detik
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Membersihkan interval saat komponen dilepas agar memori tidak bocor
    return () => clearInterval(timer);
  }, []);

  const today = currentTime.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Format jam real-time (contoh: 14:30:45)
  const time = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Logika sapaan berdasarkan jam
  const hour = currentTime.getHours();
  let greeting = 'Selamat Malam';
  if (hour >= 4 && hour < 11) greeting = 'Selamat Pagi';
  else if (hour >= 11 && hour < 15) greeting = 'Selamat Siang';
  else if (hour >= 15 && hour < 18) greeting = 'Selamat Sore';

  return (
    <header className="bg-white shadow-sm px-4 md:px-8 py-4 md:py-5 mb-4 md:mb-8 rounded-b-2xl md:rounded-b-[32px] border-b border-gray-100 sticky top-0 z-40">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">
        
        {/* BAGIAN KIRI: Sapaan & Judul */}
        <div className="w-full">
          <p className="text-[10px] md:text-[11px] font-black text-teal-500 uppercase tracking-widest mb-0.5 md:mb-1">
            {greeting}
          </p>
          <h2 className="text-xl md:text-2xl font-black text-gray-800 uppercase tracking-tight truncate">
            {title}
          </h2>
        </div>
        
        {/* BAGIAN KANAN: Tanggal & Jam Real-time */}
        <div className="flex flex-row items-center gap-2 md:gap-3 w-full md:w-auto">
          <div className="flex flex-1 md:flex-none justify-center md:justify-start items-center gap-1.5 md:gap-2 bg-gray-50 border border-gray-100 px-3 md:px-4 py-2 md:py-2.5 rounded-xl shadow-sm overflow-hidden">
            <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-teal-600 flex-shrink-0" />
            <p className="text-[9px] sm:text-[10px] md:text-xs font-bold text-gray-600 truncate whitespace-nowrap">
              {today}
            </p>
          </div>
          <div className="flex flex-1 md:flex-none justify-center md:justify-start items-center gap-1.5 md:gap-2 bg-teal-50 border border-teal-100 px-3 md:px-4 py-2 md:py-2.5 rounded-xl shadow-sm">
            <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-teal-600 flex-shrink-0" />
            <p className="text-[9px] sm:text-[10px] md:text-xs font-black text-teal-700 tracking-widest whitespace-nowrap">
              {time} <span className="hidden sm:inline">WIB</span>
            </p>
          </div>
        </div>

      </div>
    </header>
  );
};

export default Header;