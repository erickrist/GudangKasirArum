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

  // 1. PEMASUKAN (Hanya Uang Fisik yang Masuk)
  let totalIn = 0;
  const inData = transactions.filter(t => Number(t.total) > 0).map(t => {
    totalIn += Number(t.total);
    return { 
      'Tanggal & Jam': formatDisplayDate(t.createdAt), 
      'Metode': t.paymentMethod || 'TUNAI', 
      'Nama Pembeli': t.customerName || 'Tanpa Nama', 
      'Keterangan Rinci': t.note || (t.items ? t.items.map(i => i.name).join(', ') : 'Transaksi Pemasukan'), 
      'Nominal': `+ Rp ${Number(t.total).toLocaleString('id-ID')}` 
    };
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
    return { 'Tanggal & Jam': formatDisplayDate(e.createdAt), 'Kategori': e.category || 'Operasional', 'Keterangan': e.title, 'Nominal': `- Rp ${Number(e.amount).toLocaleString('id-ID')}` };
  });
  if (opsData.length > 0) {
    opsData.push({ 'Tanggal & Jam': 'TOTAL OPERASIONAL', 'Kategori': '', 'Keterangan': '', 'Nominal': `Rp ${totalOps.toLocaleString('id-ID')}` });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(opsData), "2A. Biaya Operasional");
  }

  // 2B. BIAYA KULAKAN
  let totalKulakan = 0;
  const kulakanData = kulakanExpenses.map(e => {
    totalKulakan += Number(e.amount);
    return { 'Tanggal & Jam': formatDisplayDate(e.createdAt), 'Keterangan Barang': e.title, 'Nominal': `- Rp ${Number(e.amount).toLocaleString('id-ID')}` };
  });
  if (kulakanData.length > 0) {
    kulakanData.push({ 'Tanggal & Jam': 'TOTAL KULAKAN', 'Keterangan Barang': '', 'Nominal': `Rp ${totalKulakan.toLocaleString('id-ID')}` });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kulakanData), "2B. Biaya Kulakan");
  }

  // 3. HISTORI HUTANG
  let inDebt = 0, outDebt = 0;
  const debtHistData = (filteredDebtHistory || []).map(item => {
    const nominal = Number(item.nominal) || 0;
    if (item.debtType === 'in') inDebt += nominal; else outDebt += nominal;
    return { 'Tanggal & Jam': formatDisplayDate(item.createdAt), 'Status': item.debtType === 'in' ? 'BERTAMBAH' : 'BERKURANG', 'Keterangan Detail': `${item.customerName || 'Tanpa Nama'} [${item.note || 'Belanja Hutang'}]`, 'Nominal': (item.debtType === 'in' ? '+' : '-') + ` Rp ${nominal.toLocaleString('id-ID')}` };
  });
  if (debtHistData.length > 0) {
    debtHistData.push({ 'Tanggal & Jam': `TOTAL MASUK: Rp ${inDebt.toLocaleString('id-ID')} | KELUAR: Rp ${outDebt.toLocaleString('id-ID')}`, 'Status': '', 'Keterangan Detail': 'NET / SALDO:', 'Nominal': `Rp ${Math.abs(inDebt - outDebt).toLocaleString('id-ID')}` });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(debtHistData), "3. Histori Hutang");
  }

  // 4. DAFTAR PIUTANG
  let totalActDebt = 0;
  const actDebtData = (activeStoreCustomersDebt || []).map(c => {
    totalActDebt += Number(c.displayDebt);
    return { 'Nama Pembeli': c.name, 'No. Telepon': c.phone || '-', 'Sisa Hutang': `Rp ${Number(c.displayDebt).toLocaleString('id-ID')}` };
  });
  if (actDebtData.length > 0) {
    actDebtData.push({ 'Nama Pembeli': 'TOTAL KESELURUHAN PIUTANG', 'No. Telepon': '', 'Sisa Hutang': `Rp ${totalActDebt.toLocaleString('id-ID')}` });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(actDebtData), "4. Daftar Piutang");
  }

  // 5. HISTORI DEPOSIT
  let inDep = 0, outDep = 0;
  const depHistData = (filteredDepositHistory || []).map(item => {
    const nominal = Number(item.nominal) || 0;
    if (item.depType === 'in') inDep += nominal; else outDep += nominal;
    return { 'Tanggal & Jam': formatDisplayDate(item.createdAt), 'Status': item.depType === 'in' ? 'BERTAMBAH' : 'BERKURANG', 'Keterangan Detail': `${item.customerName || 'Tanpa Nama'} [${item.note || 'Retur'}]`, 'Nominal': (item.depType === 'in' ? '+' : '-') + ` Rp ${nominal.toLocaleString('id-ID')}` };
  });
  if (depHistData.length > 0) {
    depHistData.push({ 'Tanggal & Jam': `TOTAL MASUK: Rp ${inDep.toLocaleString('id-ID')} | KELUAR: Rp ${outDep.toLocaleString('id-ID')}`, 'Status': '', 'Keterangan Detail': 'NET / SALDO:', 'Nominal': `Rp ${Math.abs(inDep - outDep).toLocaleString('id-ID')}` });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(depHistData), "5. Histori Deposit");
  }

  // 6. DAFTAR DEPOSIT
  let totalActDep = 0;
  const actDepData = (activeStoreCustomersDeposit || []).map(c => {
    totalActDep += Number(c.displayDeposit);
    return { 'Nama Pembeli': c.name, 'No. Telepon': c.phone || '-', 'Saldo Deposit': `Rp ${Number(c.displayDeposit).toLocaleString('id-ID')}` };
  });
  if (actDepData.length > 0) {
    actDepData.push({ 'Nama Pembeli': 'TOTAL KESELURUHAN DEPOSIT', 'No. Telepon': '', 'Saldo Deposit': `Rp ${totalActDep.toLocaleString('id-ID')}` });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(actDepData), "6. Daftar Deposit");
  }

  // 7. SALDO BERSIH
  let netIn = 0, netOut = 0;
  const netData = (filteredNetBalance || []).map(item => {
    const nominal = Number(item.nominal) || 0;
    if (item.netType === 'in') netIn += nominal; else netOut += nominal;
    return { 'Tanggal & Jam': formatDisplayDate(item.createdAt), 'Kategori': item.netType === 'in' ? 'PEMASUKAN' : 'PENGELUARAN', 'Nama/Subjek': item.subjName, 'Keterangan Rinci': item.detailNote, 'Nominal': (item.netType === 'in' ? '+' : '-') + ` Rp ${nominal.toLocaleString('id-ID')}` };
  });
  if (netData.length > 0) {
    netData.push({ 'Tanggal & Jam': `TOTAL KAS MASUK: Rp ${netIn.toLocaleString('id-ID')} | KAS KELUAR: Rp ${netOut.toLocaleString('id-ID')}`, 'Kategori': '', 'Nama/Subjek': '', 'Keterangan Rinci': 'SALDO AKHIR:', 'Nominal': `Rp ${(netIn - netOut).toLocaleString('id-ID')}` });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(netData), "7. Saldo Bersih");
  }

  const fileName = storeName === 'Semua Cabang' ? 'Laporan_Global' : `Laporan_${storeName.replace(/\s+/g, '_')}`;
  XLSX.writeFile(wb, `${fileName}_${startDate||'Awal'}_sd_${endDate||'Sekarang'}.xlsx`);
  onShowToast('File Excel Berhasil Diunduh', 'success');
};

export const exportNeracaExcel = ({ balance, totalUnpaidDebt, totalExpenses, totalDeposit, totalIncome, startDate, endDate, storeName, onShowToast }) => {
  const totalDebit = balance + totalUnpaidDebt + totalExpenses;
  const totalKredit = totalDeposit + totalIncome;

  const aoaData = [
    ['LAPORAN NERACA SALDO'], 
    [`ARZEN Frozen Food ${storeName && storeName !== 'Semua Cabang' ? `- Cabang ${storeName}` : ''}`], 
    [`Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`], [],
    ['No. Akun', 'Nama Akun / Uraian', 'Debit', 'Kredit'],
    ['101', 'Kas & Bank (Uang Laci Fisik)', balance, 0],
    ['102', 'Piutang Usaha (Hutang Pelanggan)', totalUnpaidDebt, 0],
    ['201', 'Titipan / Deposit Pelanggan', 0, totalDeposit],
    ['401', 'Pendapatan Usaha (Total Penjualan)', 0, totalIncome],
    ['501', 'Beban Operasional (Total Pengeluaran Kas)', totalExpenses, 0],
    ['', 'TOTAL KESELURUHAN', totalDebit, totalKredit], [],
    ['*Catatan: Laporan ini disusun menggunakan metode Buku Kas Tunggal (Single Entry).']
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoaData);
  ws['!cols'] = [{ wch: 12 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  
  const sheetName = storeName === 'Semua Cabang' ? 'Neraca_Global' : `Neraca_${storeName}`;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${sheetName}_${Date.now()}.xlsx`);
  onShowToast('File Excel Neraca Saldo berhasil diunduh', 'success');
};

export const exportLabaRugiExcel = ({ totalIncome, totalHPP, totalPureOperational, totalKulakan = 0, totalDamagedGoods, startDate, endDate, storeName, onShowToast }) => {
  const labaKotor = totalIncome - totalHPP;
  const totalExpenses = totalPureOperational + totalDamagedGoods;
  const labaBersih = labaKotor - totalExpenses;

  const aoaData = [
    ['LAPORAN LABA RUGI (CASH BASIS)'], 
    [`ARZEN Frozen Food ${storeName && storeName !== 'Semua Cabang' ? `- Cabang ${storeName}` : ''}`], 
    [`Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`], [],
    ['Keterangan', 'Nominal (Rp)'],
    ['1. TOTAL OMSET PENJUALAN (Kotor)', totalIncome],
    ['2. TOTAL MODAL BARANG KELUAR (HPP)', `-${totalHPP}`],
    ['LABA KOTOR', labaKotor], [],
    ['3. BEBAN OPERASIONAL LACI KASIR', `-${totalPureOperational}`],
    ['4. KERUGIAN (RETUR / BARANG RUSAK)', `-${totalDamagedGoods}`], [],
    ['LABA / (RUGI) BERSIH AKHIR (NET)', labaBersih], [],
    ['=======================================', ''],
    ['INFO ARUS KAS PENGELUARAN LAINNYA', ''],
    ['Belanja Kulakan / Restock Barang', totalKulakan],
    ['*Catatan: Belanja Kulakan tidak memotong laba karena uang berubah menjadi aset stok gudang.', '']
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoaData);
  ws['!cols'] = [{ wch: 55 }, { wch: 25 }];
  const wb = XLSX.utils.book_new();
  
  const sheetName = storeName === 'Semua Cabang' ? 'LabaRugi_Global' : `LabaRugi_${storeName}`;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${sheetName}_${Date.now()}.xlsx`);
  onShowToast('File Excel Laba Rugi berhasil diunduh', 'success');
};

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