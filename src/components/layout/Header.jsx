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
    <header className="bg-white shadow-sm px-8 py-5 mb-8 rounded-b-[32px] border-b border-gray-100 sticky top-0 z-40">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        {/* BAGIAN KIRI: Sapaan & Judul */}
        <div>
          <p className="text-[10px] font-black text-teal-500 uppercase tracking-widest mb-1">
            {greeting}
          </p>
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">
            {title}
          </h2>
        </div>
        
        {/* BAGIAN KANAN: Tanggal & Jam Real-time */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 px-4 py-2.5 rounded-xl shadow-sm">
            <Calendar className="w-4 h-4 text-teal-600" />
            <p className="text-xs font-bold text-gray-600">{today}</p>
          </div>
          <div className="flex items-center gap-2 bg-teal-50 border border-teal-100 px-4 py-2.5 rounded-xl shadow-sm">
            <Clock className="w-4 h-4 text-teal-600" />
            <p className="text-xs font-black text-teal-700 tracking-widest">{time} WIB</p>
          </div>
        </div>

      </div>
    </header>
  );
};

export default Header;