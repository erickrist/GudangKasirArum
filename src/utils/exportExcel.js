import * as XLSX from 'xlsx';

// ==========================================
// EXPORT EXCEL UNTUK DASHBOARD
// ==========================================

export const exportMasterExcel = ({
  transactions, filteredExpenses, filteredDebtHistory, activeStoreCustomersDebt, 
  activeStoreCustomersDeposit, filteredDepositHistory, filteredNetBalance, startDate, endDate, 
  storeName, formatDisplayDate, onShowToast
}) => {
  if (transactions.length === 0 && filteredExpenses.length === 0 && filteredNetBalance.length === 0) {
    return onShowToast('Tidak ada data untuk dicetak pada periode ini', 'error');
  }
  const wb = XLSX.utils.book_new();

  // 1. PEMASUKAN
  let totalIn = 0;
  const inData = transactions.filter(t => Number(t.total) > 0).map(t => {
    totalIn += Number(t.total);
    return { 'Tanggal & Jam': formatDisplayDate(t.createdAt), 'Metode': t.paymentMethod || 'TUNAI', 'Nama Pembeli': t.customerName || 'Tanpa Nama', 'Keterangan Rinci': t.note || (t.items ? t.items.map(i => i.name).join(', ') : 'Transaksi Pemasukan'), 'Nominal': `+ Rp ${Number(t.total).toLocaleString('id-ID')}` };
  });
  if (inData.length > 0) {
    inData.push({ 'Tanggal & Jam': 'TOTAL PEMASUKAN', 'Metode': '', 'Nama Pembeli': '', 'Keterangan Rinci': '', 'Nominal': `Rp ${totalIn.toLocaleString('id-ID')}` });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inData), "1. Pemasukan");
  }

  // PISAHKAN PENGELUARAN JADI 2 (OPERASIONAL & KULAKAN)
  const opsExpenses = filteredExpenses.filter(e => e.category !== 'Kulakan' && e.category !== 'Restock');
  const kulakanExpenses = filteredExpenses.filter(e => e.category === 'Kulakan' || e.category === 'Restock');

  // 2A. BIAYA OPERASIONAL
  let totalOps = 0;
  const opsData = opsExpenses.map(e => {
    totalOps += Number(e.amount);
    return { 'Tanggal & Jam': formatDisplayDate(e.createdAt), 'Kategori': e.category, 'Keterangan Pengeluaran': e.title, 'Nominal': `- Rp ${Number(e.amount).toLocaleString('id-ID')}` };
  });
  if (opsData.length > 0) {
    opsData.push({ 'Tanggal & Jam': 'TOTAL BIAYA OPERASIONAL', 'Kategori': '', 'Keterangan Pengeluaran': '', 'Nominal': `Rp ${totalOps.toLocaleString('id-ID')}` });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(opsData), "2A. Operasional");
  }

  // 2B. BIAYA KULAKAN / RESTOCK
  let totalKulakan = 0;
  const kulakanData = kulakanExpenses.map(e => {
    totalKulakan += Number(e.amount);
    return { 'Tanggal & Jam': formatDisplayDate(e.createdAt), 'Kategori': e.category, 'Keterangan Pengeluaran': e.title, 'Nominal': `- Rp ${Number(e.amount).toLocaleString('id-ID')}` };
  });
  if (kulakanData.length > 0) {
    kulakanData.push({ 'Tanggal & Jam': 'TOTAL BIAYA KULAKAN', 'Kategori': '', 'Keterangan Pengeluaran': '', 'Nominal': `Rp ${totalKulakan.toLocaleString('id-ID')}` });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kulakanData), "2B. Kulakan");
  }

  // 3. HISTORI HUTANG
  let inDebtEx = 0, outDebtEx = 0;
  const debtHistData = (filteredDebtHistory || []).map(item => {
    const nominal = Number(item.nominal) || 0;
    if (item.debtType === 'in') inDebtEx += nominal; else outDebtEx += nominal;
    return { 'Tanggal & Jam': formatDisplayDate(item.createdAt), 'Status': item.debtType === 'in' ? 'BERTAMBAH' : 'BERKURANG', 'Nama Pembeli': item.customerName || 'Tanpa Nama', 'Keterangan': item.note || 'Belanja Hutang', 'Nominal': (item.debtType === 'in' ? '+' : '-') + ` Rp ${nominal.toLocaleString('id-ID')}` };
  });
  if (debtHistData.length > 0) {
    debtHistData.push({ 'Tanggal & Jam': `TOTAL MASUK: Rp ${inDebtEx.toLocaleString('id-ID')} | KELUAR: Rp ${outDebtEx.toLocaleString('id-ID')}`, 'Status': '', 'Nama Pembeli': '', 'Keterangan': 'NET:', 'Nominal': `Rp ${Math.abs(inDebtEx - outDebtEx).toLocaleString('id-ID')}` });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(debtHistData), "3. Histori Hutang");
  }

  // 4. DAFTAR HUTANG
  let totalDebtAct = 0;
  const activeDebts = (activeStoreCustomersDebt || []).map(c => {
    totalDebtAct += Number(c.displayDebt);
    return { 'Nama Pembeli': c.name, 'No. Telepon': c.phone || '-', 'Sisa Hutang': Number(c.displayDebt).toLocaleString('id-ID') };
  });
  if (activeDebts.length > 0) {
    activeDebts.push({ 'Nama Pembeli': 'TOTAL KESELURUHAN PIUTANG', 'No. Telepon': '', 'Sisa Hutang': totalDebtAct.toLocaleString('id-ID') });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(activeDebts), "4. Daftar Hutang Aktif");
  }

  // 5. HISTORI DEPOSIT
  let inDepEx = 0, outDepEx = 0;
  const depHistData = (filteredDepositHistory || []).map(item => {
    const nominal = Number(item.nominal) || 0;
    if (item.depType === 'in') inDepEx += nominal; else outDepEx += nominal;
    return { 'Tanggal & Jam': formatDisplayDate(item.createdAt), 'Status': item.depType === 'in' ? 'BERTAMBAH' : 'BERKURANG', 'Nama Pembeli': item.customerName || 'Tanpa Nama', 'Keterangan': item.note || 'Retur', 'Nominal': (item.depType === 'in' ? '+' : '-') + ` Rp ${nominal.toLocaleString('id-ID')}` };
  });
  if (depHistData.length > 0) {
    depHistData.push({ 'Tanggal & Jam': `TOTAL MASUK: Rp ${inDepEx.toLocaleString('id-ID')} | KELUAR: Rp ${outDepEx.toLocaleString('id-ID')}`, 'Status': '', 'Nama Pembeli': '', 'Keterangan': 'NET:', 'Nominal': `Rp ${Math.abs(inDepEx - outDepEx).toLocaleString('id-ID')}` });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(depHistData), "5. Histori Deposit");
  }

  // 6. DAFTAR DEPOSIT
  let totalDepAct = 0;
  const activeDeposits = (activeStoreCustomersDeposit || []).map(c => {
    totalDepAct += Number(c.displayDeposit);
    return { 'Nama Pembeli': c.name, 'No. Telepon': c.phone || '-', 'Saldo Deposit': Number(c.displayDeposit).toLocaleString('id-ID') };
  });
  if (activeDeposits.length > 0) {
    activeDeposits.push({ 'Nama Pembeli': 'TOTAL KESELURUHAN DEPOSIT', 'No. Telepon': '', 'Saldo Deposit': totalDepAct.toLocaleString('id-ID') });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(activeDeposits), "6. Daftar Deposit Aktif");
  }

  // 7. SALDO BERSIH
  let netInEx = 0, netOutEx = 0;
  const netData = (filteredNetBalance || []).map(item => {
    const nominal = Number(item.nominal) || 0;
    if (item.netType === 'in') netInEx += nominal; else netOutEx += nominal;
    return { 'Tanggal & Jam': formatDisplayDate(item.createdAt), 'Kategori': item.netType === 'in' ? 'PEMASUKAN' : 'PENGELUARAN', 'Nama / Subjek': item.subjName, 'Keterangan Rinci': item.detailNote, 'Metode (Masuk)': item.paymentMethod || '-', 'Nominal Kas': (item.netType === 'in' ? '+' : '-') + ` Rp ${nominal.toLocaleString('id-ID')}` };
  });
  if (netData.length > 0) {
    netData.push({ 'Tanggal & Jam': `TOTAL MASUK: Rp ${netInEx.toLocaleString('id-ID')} | KELUAR: Rp ${netOutEx.toLocaleString('id-ID')}`, 'Kategori': '', 'Nama / Subjek': '', 'Keterangan Rinci': '', 'Metode (Masuk)': 'SALDO AKHIR:', 'Nominal Kas': `Rp ${(netInEx - netOutEx).toLocaleString('id-ID')}` });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(netData), "7. Saldo Bersih");
  }

  const fileName = storeName === 'Semua Cabang' ? 'Laporan_Global' : `Laporan_${storeName.replace(/\s+/g, '_')}`;
  XLSX.writeFile(wb, `${fileName}_${startDate||'Awal'}_sd_${endDate||'Sekarang'}.xlsx`);
  onShowToast('File Excel berhasil diunduh', 'success');
};

export const exportNeracaExcel = ({ balance, totalUnpaidDebt, totalExpenses, totalDeposit, totalIncome, startDate, endDate, storeName, onShowToast }) => {
  const totalDebit = balance + totalUnpaidDebt + totalExpenses;
  const totalKredit = totalDeposit + totalIncome;

  const aoaData = [
    ['LAPORAN NERACA SALDO'], 
    [`ARZEN Frozen Food ${storeName && storeName !== 'Semua Cabang' ? `- Cabang ${storeName}` : ''}`], 
    [`Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`], [],
    ['No. Akun', 'Nama Akun / Uraian', 'Debit', 'Kredit'],
    ['101', 'Kas & Bank (Saldo Bersih Keseluruhan)', balance, 0],
    ['102', 'Piutang Usaha (Hutang Pelanggan)', totalUnpaidDebt, 0],
    ['201', 'Titipan / Deposit Pelanggan', 0, totalDeposit],
    ['401', 'Pendapatan Usaha (Total Penjualan)', 0, totalIncome],
    ['501', 'Beban Operasional (Total Pengeluaran Kas)', totalExpenses, 0],
    ['', 'TOTAL KESELURUHAN', totalDebit, totalKredit], [],
    ['*Catatan: Laporan ini disusun menggunakan metode Buku Kas Tunggal (Single Entry).'],
    ['*Total Debit dan Kredit dapat memiliki selisih wajar apabila terdapat penambahan manual.']
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoaData);
  ws['!cols'] = [{ wch: 12 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  
  const sheetName = storeName === 'Semua Cabang' ? 'Neraca_Global' : `Neraca_${storeName}`;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${sheetName}_${Date.now()}.xlsx`);
  onShowToast('File Excel Neraca Saldo berhasil diunduh', 'success');
};

export const exportLabaRugiExcel = ({ totalIncome, totalHPP, totalPureOperational, totalDamagedGoods, startDate, endDate, storeName, onShowToast }) => {
  const labaKotor = totalIncome - totalHPP;
  const totalExpenses = totalPureOperational + totalDamagedGoods;
  const labaBersih = labaKotor - totalExpenses;

  const aoaData = [
    ['LAPORAN LABA RUGI (CASH BASIS)'], 
    [`ARZEN Frozen Food ${storeName && storeName !== 'Semua Cabang' ? `- Cabang ${storeName}` : ''}`], 
    [`Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`], [],
    ['Keterangan', 'Nominal (Rp)'],
    ['PENDAPATAN', ''],
    ['Total Pemasukan Penjualan', totalIncome],
    ['Harga Pokok Penjualan (HPP)', `-${totalHPP}`],
    ['LABA KOTOR', labaKotor], [],
    ['BEBAN / PENGELUARAN', ''],
    ['Total Pengeluaran Operasional', `-${totalPureOperational}`],
    ['Kerugian (Retur/Barang Rusak/Batal Laba)', `-${totalDamagedGoods}`], [],
    ['LABA / (RUGI) BERSIH', labaBersih]
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoaData);
  ws['!cols'] = [{ wch: 45 }, { wch: 25 }];
  const wb = XLSX.utils.book_new();
  
  const sheetName = storeName === 'Semua Cabang' ? 'LabaRugi_Global' : `LabaRugi_${storeName}`;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${sheetName}_${Date.now()}.xlsx`);
  onShowToast('File Excel Laba Rugi berhasil diunduh', 'success');
};

// ==========================================
// EXPORT EXCEL UNTUK STOCK OPNAME
// ==========================================

export const exportTemplateProduk = (stores, onShowToast) => {
  const baseData = {
    "Nama Barang": 'Susu UHT 1L (Contoh)',
    "Kategori": 'Minuman',
    "Satuan (Karton/Ball/Pcs/dll)": 'KARTON',
    "Isi per Satuan (Pcs)": 12,
    "Harga Beli Modal (Satuan)": 130000,
    "Harga Jual Default (Satuan)": 150000,
  };

  stores.forEach(store => {
    baseData[`Harga Jual (${store.name})`] = 155000;
  });

  baseData["stock Saat Ini (Satuan)"] = 10;
  baseData["Url Gambar"] = '';

  const worksheet = XLSX.utils.json_to_sheet([baseData]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template_Produk");
  XLSX.writeFile(workbook, "Template_Import_Produk.xlsx");
  onShowToast('Template Excel Multi-Toko berhasil diunduh', 'success');
};

export const exportDataProduk = (products, stores, onShowToast) => {
  if (products.length === 0) return onShowToast('Tidak ada produk untuk diexport', 'error');

  const exportData = products.map(p => {
    const isiPerSatuan = Number(p.pcsPerCarton) || 1;
    const stockSatuan = Math.floor((Number(p.stockPcs) || 0) / isiPerSatuan);
    
    const row = {
      "Nama Barang": p.name || '',
      "Kategori": p.category || 'Umum',
      "Satuan (Karton/Ball/Pcs/dll)": p.unitType || 'PCS',
      "Isi per Satuan (Pcs)": isiPerSatuan,
      "Harga Beli Modal (Satuan)": Number(p.hpp) || 0,
      "Harga Jual Default (Satuan)": Number(p.defaultPrice || p.price) || 0,
    };

    stores.forEach(store => {
       row[`Harga Jual (${store.name})`] = p.storePrices?.[store.id] !== undefined ? p.storePrices[store.id] : (p.defaultPrice || p.price || 0);
    });

    row["stock Saat Ini (Satuan)"] = stockSatuan;
    row["Url Gambar"] = p.image || '';

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data_Produk");
  XLSX.writeFile(workbook, `Backup_Data_Produk_${Date.now()}.xlsx`);
  onShowToast('Data produk berhasil diexport', 'success');
};

// FIX NAMA: Ubah menjadi exportHistoristockExcel agar cocok dengan StockOpname
export const exportHistoristockExcel = (filteredHistory, startDate, endDate, storeName, formatDisplayDate, onShowToast) => {
  if (filteredHistory.length === 0) return onShowToast('Tidak ada data untuk diexport', 'error');
  
  const reportData = filteredHistory.map(log => {
    let pcsPerCarton = 1;
    if (log.unitType !== 'PCS' && log.unitType !== 'KG' && log.amount > 0) {
      pcsPerCarton = Math.round(log.totalPcs / log.amount) || 1;
    }
    
    const utuh = Math.floor(log.totalPcs / pcsPerCarton);
    const ecer = log.totalPcs % pcsPerCarton;

    return {
      'Tanggal & Jam': formatDisplayDate(log.createdAt),
      'Cabang / Lokasi': log.storeName || 'Pusat',
      'Nama Barang': log.productName,
      'Status': log.type,
      'Satuan Utama': log.unitType,
      'Keluar/Masuk (Utuh)': utuh,
      'Keluar/Masuk (Ecer/Pcs)': ecer,
      'Total Keseluruhan (PCS)': log.totalPcs,
      'Keterangan Detail': log.note
    };
  });

  const ws = XLSX.utils.json_to_sheet(reportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Histori_${storeName}`);
  XLSX.writeFile(wb, `Histori_stock_${storeName}_${startDate||'Awal'}_sd_${endDate||'Sekarang'}.xlsx`);
  onShowToast('Histori stock Excel berhasil diunduh', 'success');
};

export const exportKeuntunganExcel = (profitData, startDate, endDate, storeName, onShowToast) => {
  if (profitData.length === 0) return onShowToast('Tidak ada data penjualan kasir di periode/cabang ini', 'error');

  const reportData = profitData.map(item => {
    return {
      'Nama Barang': item.name,
      'Total Terjual': item.displaySold || '-',
      'Total Diretur': item.displayReturned || '-',
      'Total Modal (HPP)': item.totalHpp, 
      'Pendapatan Bersih': item.netSales, 
      'Laba / (Rugi) Bersih': item.profit 
    };
  });

  const totalModal = profitData.reduce((sum, item) => sum + item.totalHpp, 0);
  const totalPendapatan = profitData.reduce((sum, item) => sum + item.netSales, 0);
  const totalUntungRugi = profitData.reduce((sum, item) => sum + item.profit, 0);

  reportData.push({
    'Nama Barang': 'TOTAL KESELURUHAN', 'Total Terjual': '', 'Total Diretur': '',
    'Total Modal (HPP)': totalModal, 'Pendapatan Bersih': totalPendapatan, 'Laba / (Rugi) Bersih': totalUntungRugi
  });

  const ws = XLSX.utils.json_to_sheet(reportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Laba_${storeName}`);
  XLSX.writeFile(wb, `Laporan_Keuntungan_${storeName}_${startDate||'Awal'}_sd_${endDate||'Sekarang'}.xlsx`);
  onShowToast('Laporan Keuntungan Excel berhasil diunduh', 'success');
};