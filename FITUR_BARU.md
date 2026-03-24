# Fitur-Fitur Baru - Sistem Gudang & Kasir Frozen Food

## Ringkasan Update

Sistem kasir telah diupdate dengan fitur-fitur canggih untuk meningkatkan fleksibilitas pembayaran dan manajemen transaksi.

---

## 1. SISTEM PEMBAYARAN FLEKSIBEL

### Status Pembayaran
- **LUNAS**: Pembayaran penuh saat transaksi
- **HUTANG**: Sebagian atau seluruh pembayaran menjadi hutang

### Metode Pembayaran (untuk LUNAS)
- **TUNAI**: Pembayaran tunai langsung
- **TRANSFER**: Pembayaran via transfer bank
- **QRIS**: Pembayaran via QRIS

### Implementasi
```
Saat checkout → Modal pembayaran
→ Pilih status (LUNAS/HUTANG)
→ Jika LUNAS → Pilih metode
→ Proses pembayaran
```

---

## 2. DISKON PER ITEM

### Fitur
- Setiap item di keranjang bisa diberi diskon
- Diskon berupa nominal (bukan persentase)
- Diskon dapat diubah kapan saja
- Subtotal item otomatis update

### Cara Penggunaan
1. Klik "Tambah Diskon" di item
2. Masukkan nominal diskon
3. Klik "Simpan"
4. Total otomatis terupdate

### Rumus
```
Subtotal Item = (Harga × Qty) - Diskon
```

---

## 3. SISTEM RETUR OTOMATIS

### Konsep
- Retur dianggap sebagai **saldo** customer
- Saldo retur bisa digunakan untuk mengurangi pembayaran

### Penggunaan Retur
```
Total Belanja = 100.000
Saldo Retur = 10.000

Jika gunakan retur 10.000:
Total Bayar = 100.000 - 10.000 = 90.000

Setelah transaksi:
Saldo Retur Customer = 10.000 - 10.000 = 0
```

### Fitur Auto-Suggest
Modal pembayaran menampilkan:
- Saldo retur customer
- Checkbox "Gunakan Retur"
- Input nominal (dapat diedit)
- Tombol "Semua" untuk gunakan maksimal

---

## 4. SISTEM HUTANG OTOMATIS

### Konsep
- Sisa pembayaran otomatis menjadi hutang customer
- Hutang dapat ditagih di transaksi berikutnya

### Contoh Skenario
```
Pembeli A:
- Total belanja: 200.000
- Status: HUTANG
- Pembayaran pertama: 100.000

Hasil:
- Total bayar: 0 (status HUTANG)
- Hutang baru: 100.000
- remainingDebt diupdate: +100.000
```

### Tagih Hutang Existing
```
Pembeli B (sudah punya hutang):
- Hutang sebelumnya: 50.000
- Total belanja baru: 100.000
- Ingin bayar hutang: 50.000

Opsi di modal pembayaran:
- Checkbox "Tagih Hutang"
- Input nominal: 50.000
- Tombol "Semua"

Hasil:
- Total bayar: 100.000 + 50.000 = 150.000
- remainingDebt Customer: 50.000 - 50.000 = 0
```

---

## 5. QUICK ADD CUSTOMER

### Fitur
- Tambah customer baru langsung dari halaman kasir
- Tidak perlu ke halaman "Data Pembeli"
- Customer langsung terpilih setelah ditambahkan

### Cara Penggunaan
1. Klik tombol **+** di samping search pembeli
2. Modal form muncul
3. Isi nama (wajib), telepon & alamat (opsional)
4. Klik "Simpan & Pilih"
5. Customer langsung aktif di keranjang

---

## 6. SEARCH & FILTER CUSTOMER

### Fitur
- Search berdasarkan nama atau nomor telepon
- Tampil info saldo retur dan hutang di setiap customer
- Visual highlighting untuk customer yang dipilih

### Info Tambahan per Customer
- Saldo Retur: Rp xxx (hijau)
- Sisa Hutang: Rp xxx (orange)

---

## 7. NOTA/STRUK TRANSAKSI LENGKAP

### Informasi dalam Nota
```
1. Header
   - Nama toko: FROZEN FOOD
   - No. Struk (ID transaksi 8 karakter)
   - Tanggal & waktu

2. Data Pembeli
   - Nama lengkap
   - Nomor telepon
   - Alamat

3. Daftar Item
   - Nama produk
   - Qty
   - Satuan (PCS/KARTON)
   - Harga satuan
   - Diskon per item
   - Subtotal per item

4. Ringkasan Pembayaran
   - Subtotal
   - Total Diskon (jika ada)
   - Retur Digunakan (jika ada)
   - Hutang Dibayar (jika ada)
   - TOTAL BAYAR
   - Metode pembayaran (jika LUNAS)
   - Status (LUNAS/HUTANG)

5. Footer
   - Ucapan terima kasih
   - Kebijakan retur
```

### Fitur Cetak
- Tombol "Cetak" untuk print struk
- Format otomatis untuk printer termal 80mm
- Layout monospace untuk output yang rapi

---

## 8. PEMBARUAN DATA CUSTOMER OTOMATIS

### Saat Transaksi
Data customer otomatis terupdate:

1. **Jika gunakan retur**
   ```
   returnAmount -= returnUsed
   ```

2. **Jika bayar hutang**
   ```
   remainingDebt -= debtPaid
   ```

3. **Jika transaksi hutang**
   ```
   remainingDebt += (totalBelanja - pembayaran)
   ```

### Contoh Lengkap
```
Sebelum transaksi:
- returnAmount: 50.000
- remainingDebt: 30.000

Transaksi:
- Total belanja: 120.000
- Gunakan retur: 50.000
- Tagih hutang: 30.000
- Status: LUNAS

Pembayaran:
= 120.000 - 50.000 + 30.000 = 100.000

Sesudah transaksi:
- returnAmount: 50.000 - 50.000 = 0
- remainingDebt: 30.000 - 30.000 = 0
```

---

## 9. TAMPILAN CUSTOMER DI KASIR

### Di Keranjang
Menampilkan:
- Nama customer (truncate jika panjang)
- Nomor telepon
- Saldo retur (jika ada) - hijau
- Sisa hutang (jika ada) - orange
- Tombol "Ubah" untuk ganti customer

### Informasi Preview
Info saldo retur dan hutang ditampilkan agar kasir tahu posisi keuangan customer.

---

## 10. KOMPONEN BARU

### PaymentModal.jsx
Modal pembayaran dengan:
- Opsi status LUNAS/HUTANG
- Opsi gunakan retur (jika ada)
- Opsi tagih hutang (jika ada)
- Pilihan metode pembayaran
- Preview total pembayaran real-time

### CartItem.jsx
Komponen item keranjang dengan:
- Qty control
- Diskon input
- Preview subtotal
- Delete button

### QuickAddCustomer.jsx
Modal form tambah customer dengan:
- Input nama (required)
- Input telepon (optional)
- Input alamat (optional)
- Validasi input

---

## 11. LOGIKA PEMBAYARAN LENGKAP

### Rumus Final
```
Total Awal = Subtotal - Diskon Total

Jika gunakan retur:
  Total Awal = Total Awal - Retur Digunakan

Jika tagih hutang:
  Total Awal = Total Awal + Hutang Dibayar

Jika status LUNAS:
  Total Bayar = Total Awal
  remainingDebt tidak berubah (atau berkurang jika bayar hutang)

Jika status HUTANG:
  Hutang Baru = Total Awal - Pembayaran
  Total Bayar = Pembayaran (0 jika tidak ada pembayaran)
  remainingDebt += Hutang Baru
```

---

## 12. VALIDASI DATA

### Sistem validasi mencegah:
- Penggunaan retur melebihi saldo
- Pembayaran hutang melebihi sisa hutang
- Stok negatif
- Cart kosong saat checkout
- Customer belum dipilih

### Error Handling
- Toast notifikasi untuk setiap error
- Modal pembayaran tidak menutup jika ada validasi error
- Pesan error jelas dan informatif

---

## 13. STRUKTUR DATA FIREBASE UPDATE

### Transactions Collection
```javascript
{
  id: string,
  customerId: string,
  customerName: string,
  customerPhone: string,
  customerAddress: string,

  items: [
    {
      productId: string,
      name: string,
      qty: number,
      unitType: string,
      pcsPerCarton: number,
      price: number,
      discount: number,
      subtotal: number
    }
  ],

  subtotal: number,        // Total sebelum diskon
  total: number,           // Total akhir
  returnUsed: number,      // Retur yang digunakan
  debtPaid: number,        // Hutang yang dibayar

  paymentStatus: 'LUNAS' | 'HUTANG',
  paymentMethod: 'TUNAI' | 'TRANSFER' | 'QRIS' | null,

  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Customers Collection
```javascript
{
  id: string,
  name: string,
  phone: string,
  address: string,

  remainingDebt: number,   // Hutang yang masih harus dibayar
  returnAmount: number,    // Saldo retur

  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

## 14. FLOW TRANSAKSI LENGKAP

```
1. PILIH PRODUK
   ↓
2. TAMBAH KE KERANJANG
   (bisa tambah diskon per item)
   ↓
3. PILIH CUSTOMER
   (bisa tambah customer baru)
   ↓
4. MODAL PEMBAYARAN
   - Tampil saldo retur (jika ada)
   - Tampil sisa hutang (jika ada)
   - Pilih status LUNAS/HUTANG
   - Jika LUNAS: pilih metode pembayaran
   - Preview total pembayaran
   ↓
5. PROSES PEMBAYARAN
   - Validasi stok
   - Update stok produk
   - Simpan transaksi
   - Update data customer
   ↓
6. TAMPIL NOTA/STRUK
   - Preview nota
   - Tombol cetak
   ↓
7. RESET SISTEM
   - Cart kosong
   - Customer de-select
   - Siap transaksi baru
```

---

## 15. SKENARIO PENGGUNAAN

### Skenario 1: Transaksi Normal (Lunas Tunai)
```
Customer: Budi
Belanja: 100.000
Diskon per item: 10.000
Subtotal: 90.000
Pembayaran: LUNAS - TUNAI
Result: Transaksi selesai, struk cetak
```

### Skenario 2: Transaksi dengan Retur
```
Customer: Rina (punya saldo retur 50.000)
Belanja: 100.000
Gunakan retur: 50.000
Subtotal: 50.000
Pembayaran: LUNAS - TRANSFER
Result:
- Transaksi selesai
- Saldo retur Rina: 0
```

### Skenario 3: Transaksi Hutang
```
Customer: Tono
Belanja: 100.000
Pembayaran: HUTANG (belum bayar)
Result:
- Transaksi terserah
- Hutang Tono: +100.000
- Status di struk: HUTANG
```

### Skenario 4: Bayar Hutang + Belanja Baru
```
Customer: Ani (hutang 30.000)
Belanja baru: 70.000
Total: 100.000
Tagih hutang: 30.000
Pembayaran: LUNAS - QRIS
Total bayar: 100.000 + 30.000 = 130.000
Result:
- Hutang Ani jadi: 0
- Transaksi catat: debtPaid: 30.000
```

---

## Catatan Penting

1. **Semua field optional kecuali yang diwajibkan**
   - Nama customer wajib
   - Total belanja auto-generated

2. **Update realtime**
   - Total keranjang otomatis update saat ada diskon
   - Saldo customer di-preview saat select customer
   - Preview total pembayaran di modal pembayaran

3. **Data integrity**
   - Validasi stok sebelum transaksi
   - Transaksi gagal jika stok tidak cukup
   - Customer data otomatis sinkron

4. **Security**
   - Validasi input di client dan server
   - Stok tidak bisa minus
   - Pembayaran tidak bisa melebihi limit

---

## Testing Checklist

- [ ] Tambah customer baru saat transaksi
- [ ] Search customer berdasarkan nama
- [ ] Search customer berdasarkan telepon
- [ ] Tambah diskon per item
- [ ] Gunakan saldo retur
- [ ] Tagih hutang existing
- [ ] Transaksi LUNAS dengan berbagai metode
- [ ] Transaksi HUTANG
- [ ] Print struk
- [ ] Verifikasi update data customer
- [ ] Stok berkurang setelah transaksi
- [ ] Error handling (stok, input, dll)

---

Semua fitur sudah terintegrasi dan siap digunakan! 🎉
