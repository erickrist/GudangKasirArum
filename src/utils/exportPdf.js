import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ==========================================
// EXPORT PDF UNTUK DASHBOARD
// ==========================================

export const exportMasterPDF = ({
  transactions, filteredExpenses, filteredDebtHistory, activeStoreCustomersDebt, 
  activeStoreCustomersDeposit, filteredDepositHistory, filteredNetBalance, startDate, endDate, 
  storeName, formatDisplayDate, onShowToast
}) => {
  if (transactions.length === 0 && filteredExpenses.length === 0 && filteredNetBalance.length === 0) {
    return onShowToast('Tidak ada data untuk dicetak pada periode ini', 'error');
  }

  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setFontSize(14); doc.setFont("helvetica", "bold");
  
  const headerTitle = `Laporan Keuangan ARZEN Frozen Food ${storeName && storeName !== 'Semua Cabang' ? `- Cabang ${storeName}` : ''}`;
  doc.text(headerTitle, 14, 15);
  
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(`Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`, 14, 22);

  let currentY = 32;

  const customDidParseCell = (data) => {
    if (data.section === 'body') {
      const lastColIndex = data.table.columns.length - 1;
      if (data.column.index === lastColIndex && typeof data.cell.raw === 'string') {
        if (data.cell.raw.includes('+')) data.cell.styles.textColor = [0, 128, 0];
        if (data.cell.raw.includes('-')) data.cell.styles.textColor = [220, 38, 38];
      }
    }
  };

  const checkPageBreak = (spaceNeeded) => {
    if (currentY + spaceNeeded > 280) { doc.addPage(); currentY = 20; }
  };

  // 1. PEMASUKAN
  const inList = transactions.filter(t => Number(t.total) > 0);
  if (inList.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("1. PEMASUKAN PENJUALAN", 14, currentY); currentY += 5;
    let totalIn = 0;
    const inBody = inList.map(t => {
      totalIn += Number(t.total);
      return [formatDisplayDate(t.createdAt), t.paymentMethod || 'TUNAI', t.customerName || 'Tanpa Nama', t.note || (t.items ? t.items.map(i => i.name).join(', ') : 'Transaksi Pemasukan'), `+ Rp ${Number(t.total).toLocaleString('id-ID')}`];
    });
    inBody.push([{ content: 'TOTAL PEMASUKAN:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `Rp ${totalIn.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [0, 128, 0], fillColor: [230, 245, 230] } }]);
    autoTable(doc, { startY: currentY, head: [['Tanggal & Jam', 'Metode', 'Nama Pembeli', 'Keterangan Rinci', 'Nominal']], body: inBody, theme: 'grid', headStyles: { fillColor: [46, 204, 113] }, didParseCell: customDidParseCell, margin: { left: 14 } });
    currentY = doc.lastAutoTable.finalY + 12;
  }

  // PISAHKAN PENGELUARAN JADI 2 (OPERASIONAL & KULAKAN)
  const opsExpenses = filteredExpenses.filter(e => e.category !== 'Kulakan' && e.category !== 'Restock');
  const kulakanExpenses = filteredExpenses.filter(e => e.category === 'Kulakan' || e.category === 'Restock');

  // 2A. BIAYA OPERASIONAL
  if (opsExpenses.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("2A. BIAYA OPERASIONAL (Gaji, Listrik, Retur, dll)", 14, currentY); currentY += 5;
    let totalOps = 0;
    const opsBody = opsExpenses.map(e => {
      totalOps += Number(e.amount);
      return [formatDisplayDate(e.createdAt), e.category || 'Operasional', e.title, `- Rp ${Number(e.amount).toLocaleString('id-ID')}`];
    });
    opsBody.push([{ content: 'TOTAL OPERASIONAL:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `Rp ${totalOps.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [220, 38, 38], fillColor: [253, 237, 236] } }]);
    autoTable(doc, { startY: currentY, head: [['Tanggal & Jam', 'Kategori', 'Keterangan Pengeluaran', 'Nominal']], body: opsBody, theme: 'grid', headStyles: { fillColor: [231, 76, 60] }, didParseCell: customDidParseCell, margin: { left: 14 } });
    currentY = doc.lastAutoTable.finalY + 12;
  }

  // 2B. BIAYA KULAKAN / RESTOCK
  if (kulakanExpenses.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("2B. BIAYA KULAKAN / RESTOCK BARANG", 14, currentY); currentY += 5;
    let totalKulakan = 0;
    const kulakanBody = kulakanExpenses.map(e => {
      totalKulakan += Number(e.amount);
      return [formatDisplayDate(e.createdAt), e.title, `- Rp ${Number(e.amount).toLocaleString('id-ID')}`];
    });
    kulakanBody.push([{ content: 'TOTAL KULAKAN:', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `Rp ${totalKulakan.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [220, 38, 38], fillColor: [253, 237, 236] } }]);
    autoTable(doc, { startY: currentY, head: [['Tanggal & Jam', 'Keterangan Barang', 'Nominal']], body: kulakanBody, theme: 'grid', headStyles: { fillColor: [211, 84, 0] }, didParseCell: customDidParseCell, margin: { left: 14 } });
    currentY = doc.lastAutoTable.finalY + 12;
  }

  // 3. HISTORI HUTANG
  if (filteredDebtHistory && filteredDebtHistory.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("3. HISTORI HUTANG", 14, currentY); currentY += 5;
    let inDebt = 0, outDebt = 0;
    const debtHistBody = filteredDebtHistory.map(item => {
      const nominal = Number(item.nominal) || 0;
      if (item.debtType === 'in') inDebt += nominal; else outDebt += nominal;
      return [formatDisplayDate(item.createdAt), item.debtType === 'in' ? 'BERTAMBAH' : 'BERKURANG', `${item.customerName || 'Tanpa Nama'} [${item.note || 'Belanja Hutang'}]`, (item.debtType === 'in' ? '+' : '-') + ` Rp ${nominal.toLocaleString('id-ID')}`];
    });
    debtHistBody.push([{ content: `TOTAL MASUK: Rp ${inDebt.toLocaleString('id-ID')} | KELUAR: Rp ${outDebt.toLocaleString('id-ID')}`, colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `NET: Rp ${Math.abs(inDebt - outDebt).toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [0, 128, 0], fillColor: [230, 245, 230] } }]);
    autoTable(doc, { startY: currentY, head: [['Tanggal & Jam', 'Status', 'Keterangan Detail', 'Nominal']], body: debtHistBody, theme: 'grid', headStyles: { fillColor: [230, 126, 34] }, didParseCell: customDidParseCell, margin: { left: 14 } });
    currentY = doc.lastAutoTable.finalY + 12;
  }

  // 4. DAFTAR HUTANG
  if (activeStoreCustomersDebt && activeStoreCustomersDebt.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); 
    doc.text(`4. DAFTAR PIUTANG (${storeName === 'Semua Cabang' ? 'GLOBAL' : `CABANG ${storeName.toUpperCase()}`})`, 14, currentY); currentY += 5;
    let totalActDebt = 0;
    const actDebtBody = activeStoreCustomersDebt.map(c => {
      totalActDebt += Number(c.displayDebt);
      return [c.name, c.phone || '-', `Rp ${Number(c.displayDebt).toLocaleString('id-ID')}`];
    });
    actDebtBody.push([{ content: 'TOTAL KESELURUHAN PIUTANG:', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `Rp ${totalActDebt.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [220, 38, 38], fillColor: [253, 237, 236] } }]);
    autoTable(doc, { startY: currentY, head: [['Nama Pembeli', 'No. Telepon', 'Sisa Hutang']], body: actDebtBody, theme: 'grid', headStyles: { fillColor: [211, 84, 0] }, margin: { left: 14 } });
    currentY = doc.lastAutoTable.finalY + 12;
  }

  // 5. HISTORI DEPOSIT
  if (filteredDepositHistory && filteredDepositHistory.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("5. HISTORI DEPOSIT", 14, currentY); currentY += 5;
    let inDep = 0, outDep = 0;
    const depHistBody = filteredDepositHistory.map(item => {
      const nominal = Number(item.nominal) || 0;
      if (item.depType === 'in') inDep += nominal; else outDep += nominal;
      return [formatDisplayDate(item.createdAt), item.depType === 'in' ? 'BERTAMBAH' : 'BERKURANG', `${item.customerName || 'Tanpa Nama'} [${item.note || 'Retur'}]`, (item.depType === 'in' ? '+' : '-') + ` Rp ${nominal.toLocaleString('id-ID')}`];
    });
    depHistBody.push([{ content: `TOTAL MASUK: Rp ${inDep.toLocaleString('id-ID')} | KELUAR: Rp ${outDep.toLocaleString('id-ID')}`, colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `NET: Rp ${Math.abs(inDep - outDep).toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [0, 128, 0], fillColor: [230, 245, 230] } }]);
    autoTable(doc, { startY: currentY, head: [['Tanggal & Jam', 'Status', 'Keterangan Detail', 'Nominal']], body: depHistBody, theme: 'grid', headStyles: { fillColor: [155, 89, 182] }, didParseCell: customDidParseCell, margin: { left: 14 } });
    currentY = doc.lastAutoTable.finalY + 12;
  }

  // 6. DAFTAR DEPOSIT
  if (activeStoreCustomersDeposit && activeStoreCustomersDeposit.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); 
    doc.text(`6. DAFTAR DEPOSIT (${storeName === 'Semua Cabang' ? 'GLOBAL' : `CABANG ${storeName.toUpperCase()}`})`, 14, currentY); currentY += 5;
    let totalActDep = 0;
    const actDepBody = activeStoreCustomersDeposit.map(c => {
      totalActDep += Number(c.displayDeposit);
      return [c.name, c.phone || '-', `Rp ${Number(c.displayDeposit).toLocaleString('id-ID')}`];
    });
    actDepBody.push([{ content: 'TOTAL KESELURUHAN DEPOSIT:', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `Rp ${totalActDep.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [0, 128, 0], fillColor: [230, 245, 230] } }]);
    autoTable(doc, { startY: currentY, head: [['Nama Pembeli', 'No. Telepon', 'Saldo Deposit']], body: actDepBody, theme: 'grid', headStyles: { fillColor: [142, 68, 173] }, margin: { left: 14 } });
    currentY = doc.lastAutoTable.finalY + 12;
  }

  // 7. SALDO BERSIH
  if (filteredNetBalance && filteredNetBalance.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("7. SALDO BERSIH ", 14, currentY); currentY += 5;
    let netIn = 0, netOut = 0;
    const netBody = filteredNetBalance.map(item => {
      const nominal = Number(item.nominal) || 0;
      if (item.netType === 'in') netIn += nominal; else netOut += nominal;
      return [formatDisplayDate(item.createdAt), item.netType === 'in' ? 'PEMASUKAN' : 'PENGELUARAN', item.subjName, item.detailNote, (item.netType === 'in' ? '+' : '-') + ` Rp ${nominal.toLocaleString('id-ID')}`];
    });
    netBody.push([{ content: `TOTAL KAS MASUK: Rp ${netIn.toLocaleString('id-ID')} | KAS KELUAR: Rp ${netOut.toLocaleString('id-ID')}`, colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `SALDO AKHIR: Rp ${(netIn - netOut).toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [0, 128, 0], fillColor: [230, 245, 230] } }]);
    autoTable(doc, { startY: currentY, head: [['Tanggal & Jam', 'Kategori', 'Nama/Subjek', 'Keterangan Rinci', 'Nominal']], body: netBody, theme: 'grid', headStyles: { fillColor: [52, 152, 219] }, didParseCell: customDidParseCell, margin: { left: 14 } });
  }

  const fileName = storeName === 'Semua Cabang' ? 'Laporan_Global' : `Laporan_${storeName.replace(/\s+/g, '_')}`;
  doc.save(`${fileName}_${Date.now()}.pdf`);
  onShowToast('File PDF berhasil diunduh', 'success');
};

export const exportNeracaPDF = ({ balance, totalUnpaidDebt, totalExpenses, totalDeposit, totalIncome, startDate, endDate, storeName, onShowToast }) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("LAPORAN NERACA SALDO", 105, 20, { align: "center" });
  doc.setFontSize(12); doc.setFont("helvetica", "normal");
  
  const headerTitle = `ARZEN Frozen Food ${storeName && storeName !== 'Semua Cabang' ? `- Cabang ${storeName}` : ''}`;
  doc.text(headerTitle, 105, 28, { align: "center" });
  
  doc.setFontSize(10);
  doc.text(`Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`, 105, 34, { align: "center" });

  const body = [
    ['101', 'Kas & Bank (Saldo Bersih Keseluruhan)', `Rp ${balance.toLocaleString('id-ID')}`, '-'],
    ['102', 'Piutang Usaha (Hutang Pelanggan)', `Rp ${totalUnpaidDebt.toLocaleString('id-ID')}`, '-'],
    ['201', 'Titipan / Deposit Pelanggan', '-', `Rp ${totalDeposit.toLocaleString('id-ID')}`],
    ['401', 'Pendapatan Usaha (Total Penjualan)', '-', `Rp ${totalIncome.toLocaleString('id-ID')}`],
    ['501', 'Beban Operasional (Total Pengeluaran Kas)', `Rp ${totalExpenses.toLocaleString('id-ID')}`, '-'],
  ];

  const totalDebit = balance + totalUnpaidDebt + totalExpenses;
  const totalKredit = totalDeposit + totalIncome;

  body.push([
    { content: 'TOTAL KESELURUHAN', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: `Rp ${totalDebit.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [0, 100, 0] } },
    { content: `Rp ${totalKredit.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [0, 100, 0] } }
  ]);

  autoTable(doc, {
    startY: 45,
    head: [['No. Akun', 'Nama Akun / Uraian', 'Debit', 'Kredit']],
    body: body, theme: 'grid', headStyles: { fillColor: [75, 85, 99], halign: 'center' },
    columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 2: { halign: 'right', cellWidth: 45 }, 3: { halign: 'right', cellWidth: 45 } }
  });

  doc.setFontSize(9); doc.setTextColor(100);
  doc.text("*Catatan: Laporan ini disusun menggunakan metode Buku Kas Tunggal.", 14, doc.lastAutoTable.finalY + 10);
  
  const fileName = storeName === 'Semua Cabang' ? 'Neraca_Saldo_Global' : `Neraca_Saldo_${storeName.replace(/\s+/g, '_')}`;
  doc.save(`${fileName}_${Date.now()}.pdf`);
  onShowToast('File PDF Neraca Saldo berhasil diunduh', 'success');
};

export const exportLabaRugiPDF = ({ totalIncome, totalHPP, totalPureOperational, totalDamagedGoods, startDate, endDate, storeName, onShowToast }) => {
  const labaKotor = totalIncome - totalHPP;
  const totalExpenses = totalPureOperational + totalDamagedGoods;
  const labaBersih = labaKotor - totalExpenses;

  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("LAPORAN LABA RUGI (CASH BASIS)", 105, 20, { align: "center" });
  doc.setFontSize(12); doc.setFont("helvetica", "normal");
  
  const headerTitle = `ARZEN Frozen Food ${storeName && storeName !== 'Semua Cabang' ? `- Cabang ${storeName}` : ''}`;
  doc.text(headerTitle, 105, 28, { align: "center" });
  
  doc.setFontSize(10);
  doc.text(`Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`, 105, 34, { align: "center" });

  const body = [
    [{ content: 'PENDAPATAN', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
    ['Total Pemasukan Penjualan', `Rp ${totalIncome.toLocaleString('id-ID')}`],
    ['Harga Pokok Penjualan (HPP)', `- Rp ${totalHPP.toLocaleString('id-ID')}`],
    [{ content: 'LABA KOTOR', styles: { fontStyle: 'bold' } }, { content: `Rp ${labaKotor.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: labaKotor >= 0 ? [0, 128, 0] : [220, 38, 38] } }],
    [{ content: 'BEBAN / PENGELUARAN', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
    ['Total Pengeluaran Kas Operasional', `- Rp ${totalPureOperational.toLocaleString('id-ID')}`],
    ['Kerugian (Retur/Barang Rusak/Batal Laba)', `- Rp ${totalDamagedGoods.toLocaleString('id-ID')}`],
    [{ content: 'LABA / (RUGI) BERSIH', styles: { fontStyle: 'bold' } }, { content: `Rp ${labaBersih.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: labaBersih >= 0 ? [0, 128, 0] : [220, 38, 38] } }]
  ];

  autoTable(doc, { startY: 45, body: body, theme: 'grid', columnStyles: { 0: { cellWidth: 120 }, 1: { halign: 'right', cellWidth: 50 } } });
  
  const fileName = storeName === 'Semua Cabang' ? 'Laba_Rugi_Global' : `Laba_Rugi_${storeName.replace(/\s+/g, '_')}`;
  doc.save(`${fileName}_${Date.now()}.pdf`);
  onShowToast('File PDF Laba Rugi berhasil diunduh', 'success');
};

// FIX NAMA: exportHistoristockPDF
export const exportHistoristockPDF = (filteredHistory, startDate, endDate, storeName, formatDisplayDate, onShowToast) => {
  if (filteredHistory.length === 0) return onShowToast('Tidak ada data untuk diexport', 'error');

  const doc = new jsPDF('l', 'mm', 'a4');
  doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text(`Laporan Histori Keluar Masuk Barang`, 14, 15);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); 
  doc.text(`Cabang Filter: ${storeName}`, 14, 21);
  doc.text(`Periode: ${startDate || 'Semua Data'} s/d ${endDate || 'Sekarang'}`, 14, 26);

  const body = filteredHistory.map(log => {
    let pcsPerCarton = 1;
    if (log.unitType !== 'PCS' && log.unitType !== 'KG' && log.amount > 0) {
      pcsPerCarton = Math.round(log.totalPcs / log.amount) || 1;
    }
    const utuh = Math.floor(log.totalPcs / pcsPerCarton);
    const ecer = Number((log.totalPcs % pcsPerCarton).toFixed(2)); // Fix: Support desimal untuk KG

    return [
      formatDisplayDate(log.createdAt), log.storeName || 'Pusat', log.productName, log.type, 
      `${utuh} ${log.unitType}`, `${ecer} Eceran`, `${log.totalPcs}`, log.note
    ];
  });

  autoTable(doc, { 
    head: [['Tanggal & Jam', 'Cabang', 'Nama Barang', 'Status', 'Jml Utuh', 'Jml Ecer', 'Total Pcs/Kg', 'Keterangan']], 
    body, startY: 32, styles: { fontSize: 8 },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 3) {
        if (data.cell.raw === 'MASUK') data.cell.styles.textColor = [0, 128, 0];
        if (data.cell.raw === 'KELUAR') data.cell.styles.textColor = [200, 100, 0];
        if (data.cell.raw === 'TERJUAL') data.cell.styles.textColor = [200, 0, 0];
        if (data.cell.raw === 'RETUR') data.cell.styles.textColor = [128, 0, 128]; // Warna Ungu untuk Retur
      }
    }
  });
  doc.save(`Histori_stock_${storeName}_${Date.now()}.pdf`);
  onShowToast('Laporan PDF berhasil diunduh', 'success');
};

export const exportKeuntunganPDF = (profitData, startDate, endDate, storeName, onShowToast) => {
  if (profitData.length === 0) return onShowToast('Tidak ada data penjualan di periode ini', 'error');

  const doc = new jsPDF('l', 'mm', 'a4');
  doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text(`Laporan Laba / Keuntungan Penjualan`, 14, 15);
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(`Cabang Filter: ${storeName}`, 14, 21);
  doc.text(`Periode: ${startDate || 'Semua Data'} s/d ${endDate || 'Sekarang'}`, 14, 26);

  let totalModal = 0, totalPendapatan = 0, totalUntung = 0;

  const body = profitData.map(item => {
    totalModal += item.totalHpp; totalPendapatan += item.netSales; totalUntung += item.profit;
    
    return [
      item.name, 
      item.displaySold || '-',       
      item.displayReturned || '-',   
      `Rp ${item.totalHpp.toLocaleString('id-ID')}`, 
      `Rp ${item.netSales.toLocaleString('id-ID')}`, 
      `Rp ${item.profit.toLocaleString('id-ID')}`
    ];
  });

  body.push([
    { content: 'TOTAL KESELURUHAN', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: `Rp ${totalModal.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold' } },
    { content: `Rp ${totalPendapatan.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold' } },
    { content: `Rp ${totalUntung.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: totalUntung < 0 ? [220, 38, 38] : [0, 128, 0] } }
  ]);

  autoTable(doc, { 
    head: [['Nama Barang', 'Terjual (Grosir & Ecer)', 'Diretur (Grosir & Ecer)', 'Tot Modal', 'Pendapatan', 'Laba/Rugi']], 
    body, startY: 32, styles: { fontSize: 8 }, 
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 5 && data.row.index < body.length - 1) {
        const profitValue = parseInt(data.cell.raw.replace(/Rp |\./g, '').replace(/-/g, '-')); 
        if (profitValue < 0) data.cell.styles.textColor = [220, 38, 38]; 
        else data.cell.styles.textColor = [0, 128, 0]; 
      }
    }
  });
  doc.save(`Laporan_Keuntungan_${storeName}_${Date.now()}.pdf`);
  onShowToast('Laporan Laba PDF berhasil diunduh', 'success');
};