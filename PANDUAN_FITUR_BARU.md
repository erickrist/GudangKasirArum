# Panduan Fitur Baru - Kasir Frozen Food

## Update Terbaru

Sistem kasir telah diupdate dengan fitur pembayaran yang lebih fleksibel. Berikut panduan penggunaan.

---

## 1. TAMBAH CUSTOMER BARU SAAT TRANSAKSI

### Cara
1. Klik **"+ Pilih Pembeli"** di keranjang
2. Klik tombol **plus** di samping search
3. Isi form:
   - **Nama** (wajib)
   - **Telepon** (opsional)
   - **Alamat** (opsional)
4. Klik **"Simpan & Pilih"**
5. Customer langsung terpilih

### Keuntungan
- Tidak perlu ke menu "Data Pembeli"
- Customer langsung aktif
- Proses lebih cepat

---

## 2. SEARCH CUSTOMER

### Fitur Search
- Cari berdasarkan **nama**
- Cari berdasarkan **nomor telepon**
- Tampil otomatis saat mengetik

### Info yang Ditampilkan
- Nama customer
- Telepon
- Alamat (preview)
- **Saldo Retur** (jika ada) - hijau
- **Sisa Hutang** (jika ada) - orange

### Gunakan
Ketik di kolom search → Pilih customer dari list

---

## 3. DISKON PER ITEM

### Cara Tambah Diskon
1. Di keranjang, buka item
2. Klik tombol **"Tambah Diskon"**
3. Masukkan nominal diskon
4. Klik **"Simpan"**

### Tampilan Diskon
- Setiap item menampilkan diskon (jika ada)
- Subtotal otomatis update
- Total keranjang otomatis berkurang

### Contoh
```
Harga: 50.000 × 2 = 100.000
Diskon: 10.000
Subtotal: 90.000
```

---

## 4. MODAL PEMBAYARAN - OPSI RETUR

### Jika Customer Punya Saldo Retur
1. Checkbox akan muncul: **"Gunakan Retur"**
2. Centang checkbox
3. Masukkan nominal (atau klik "Semua")
4. Total bayar otomatis berkurang

### Contoh
```
Total Belanja: 100.000
Saldo Retur: 50.000
Gunakan Retur: 50.000
Total Bayar: 50.000
```

### Hasil Transaksi
- Saldo retur customer berkurang 50.000
- Pembayaran hanya 50.000

---

## 5. MODAL PEMBAYARAN - OPSI HUTANG

### Jika Customer Punya Sisa Hutang
1. Checkbox akan muncul: **"Tagih Hutang"**
2. Centang checkbox
3. Masukkan nominal hutang yang mau ditagih
4. Klik "Semua" untuk tagih semua

### Contoh
```
Total Belanja: 100.000
Sisa Hutang Customer: 50.000
Tagih Hutang: 50.000
Total Bayar: 100.000 + 50.000 = 150.000
```

### Hasil Transaksi
- Customer bayar: 150.000
- Hutang customer berkurang 50.000
- Hutang baru: 0

---

## 6. PILIH STATUS PEMBAYARAN

### Status Tersedia

#### A. LUNAS
Pembayaran penuh saat transaksi

```
Pilih metode pembayaran:
- TUNAI (cash)
- TRANSFER (bank/e-wallet)
- QRIS (scan bayar)
```

#### B. HUTANG
Sebagian/seluruh transaksi menjadi hutang

```
Opsi:
- Pembayaran 0 = semua jadi hutang
- Pembayaran sebagian = sisa jadi hutang
```

### Contoh Transaksi Hutang
```
Belanja: 100.000
Pembayaran: 30.000 (TUNAI)
Status: HUTANG

Hasil:
- Sisa hutang baru: 70.000
- Customer bayar: 30.000
- Struk tertera: STATUS HUTANG
```

---

## 7. FLOW PEMBAYARAN LENGKAP

```
TRANSAKSI
    ↓
KLIK "PROSES PEMBAYARAN"
    ↓
MODAL PEMBAYARAN MUNCUL
├─ Tampil info customer
├─ Tampil saldo retur (jika ada)
├─ Tampil sisa hutang (jika ada)
└─ Pilih status LUNAS/HUTANG
    ↓
JIKA PILIH RETUR
└─ Centang "Gunakan Retur" & isi nominal
    ↓
JIKA PILIH HUTANG
└─ Centang "Tagih Hutang" & isi nominal
    ↓
JIKA STATUS LUNAS
└─ Pilih metode pembayaran
    ↓
LIHAT PREVIEW TOTAL
    ↓
KLIK "PROSES PEMBAYARAN"
    ↓
STRUK MUNCUL
    ↓
KLIK "CETAK" (opsional)
```

---

## 8. STRUK/NOTA

### Apa yang Ditampilkan
- Nama toko: FROZEN FOOD
- No. Struk
- Tanggal & waktu
- Data pembeli
- Daftar item + diskon
- Total pembayaran
- Metode pembayaran
- Status (LUNAS/HUTANG)

### Fitur
- **Cetak**: Untuk print ke printer termal 80mm
- **Tutup**: Selesai transaksi

---

## 9. VALIDASI & ERROR HANDLING

### Sistem Validasi
- Stok tidak boleh minus
- Retur tidak boleh lebih dari saldo
- Hutang tidak boleh lebih dari sisa hutang
- Cart tidak boleh kosong
- Customer harus dipilih

### Jika Ada Error
- Toast notifikasi akan muncul
- Modal pembayaran tidak menutup
- Pesan error jelas & informatif

### Contoh Error
```
"Stok Produk X tidak mencukupi"
"Saldo retur tidak cukup"
"Keranjang masih kosong"
"Pilih pembeli terlebih dahulu"
```

---

## 10. CONTOH SKENARIO PENGGUNAAN

### Skenario 1: Pembeli Baru, Belanja Lunas Tunai

1. Klik "Pilih Pembeli"
2. Klik tombol **+** → Tambah pembeli baru
3. Isi nama: "Budi", telepon: "08123456789"
4. Klik "Simpan & Pilih"
5. Tambahkan produk ke keranjang
6. Klik "Proses Pembayaran"
7. Status: **LUNAS**
8. Metode: **TUNAI**
9. Klik "Proses Pembayaran"
10. Struk muncul → Klik "Cetak"

### Skenario 2: Customer dengan Retur & Hutang

1. Pilih customer: "Rina"
   - Saldo retur: 50.000
   - Sisa hutang: 30.000
2. Belanja: 100.000
3. Klik "Proses Pembayaran"
4. Centang "Gunakan Retur" → 50.000
5. Centang "Tagih Hutang" → 30.000
6. Status: **LUNAS**
7. Metode: **TRANSFER**
8. Total Bayar: 100.000 - 50.000 + 30.000 = 80.000
9. Klik "Proses Pembayaran"

**Hasil:**
- Customer bayar: 80.000
- Saldo retur Rina: 0
- Hutang Rina: 0

### Skenario 3: Transaksi Hutang

1. Pilih customer: "Tono"
2. Belanja: 200.000
3. Klik "Proses Pembayaran"
4. Status: **HUTANG**
5. Total Bayar: 0 (belum bayar)
6. Klik "Proses Pembayaran"

**Hasil:**
- Hutang Tono: +200.000
- Struk tertera: STATUS HUTANG
- Tidak ada pembayaran hari ini

---

## 11. DATA YANG OTOMATIS UPDATE

### Customer Data
Setelah setiap transaksi, data customer otomatis terupdate:

1. **Saldo Retur**
   - Berkurang jika digunakan
   - Update real-time di database

2. **Sisa Hutang**
   - Bertambah jika transaksi hutang
   - Berkurang jika bayar hutang
   - Update real-time di database

### Stok Produk
- Berkurang sesuai qty yang dijual
- Konversi otomatis untuk satuan KARTON
- Update real-time

---

## 12. TIPS & TRIK

### Mempercepat Transaksi
1. Gunakan search customer (ketik 3 karakter)
2. Gunakan tombol "Semua" untuk retur/hutang
3. Simpan nomor pelanggan favorit

### Aman dari Kesalahan
1. Cek preview total sebelum proses
2. Verifikasi nama customer
3. Cek stok cukup sebelum transaksi

### Untuk Customer Baru
- Minimal cukup nama
- Telepon & alamat bisa diupdate nanti di menu "Data Pembeli"

---

## 13. SHORTCUT KEYBOARD (Fitur Tambahan)

> *Fitur ini akan ditambahkan di update berikutnya*

---

## 14. FAQ

### Q: Bagaimana jika retur customer hilang/rusak?
**A:** Input di menu "Data Pembeli" → ubah nilai returnAmount

### Q: Bisa tidak bayar hutang sebagian?
**A:** Bisa! Masukkan nominal hutang yang mau ditagih, sisanya tetap jadi hutang

### Q: Jika salah customer saat checkout?
**A:** Klik "Ubah" di kartu pembeli → pilih customer lain

### Q: Struk tidak keluar?
**A:** Klik tombol "Cetak" di modal struk, atau refresh halaman

### Q: Diskon bisa berapa maksimal?
**A:** Tidak ada batas, bisa sampai 100% tapi total harus >= 0

---

## 15. HUBUNGI SUPPORT

Jika ada pertanyaan atau menemukan bug:
- Periksa tab notifikasi (toast) untuk pesan error
- Verifikasi koneksi internet
- Refresh halaman jika ada masalah tampilan
- Hubungi tim teknis jika masalah persisten

---

**Selamat menggunakan Sistem Kasir Frozen Food! 🎉**
