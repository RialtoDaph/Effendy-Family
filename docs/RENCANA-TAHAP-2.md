# Rencana Tahap 2 — Money complete

Status: **rencana, menunggu jawaban dan persetujuan**. Belum ada kode yang ditulis.

Catatan: tes dua akun dari Tahap 1 (transaksi "Only me" tidak terlihat di HP Amnah)
masih menunggu akun Amnah. Tahap 2 bisa dibangun sambil menunggu.

## Hasil akhir Tahap 2

Semua bagian uang di prototipe berfungsi:
- **Debts**: daftar utang, total, cicilan per bulan, tanggal bebas utang, urutan pelunasan
  (Avalanche = bunga tertinggi dulu, Snowball = saldo terkecil dulu), penggeser "Extra per month" (€0–400).
- **Subscriptions**: total per bulan dan per tahun, yang tidak dipakai 45+ hari, uang yang dihemat
  kalau dibatalkan, tombol Cancel / Keep per baris.
- **To Indonesia**: total kiriman tahun ini (EUR dan ≈ Rupiah), kalkulator "Before you send"
  (€100/200/300/500, kurs 1 € = Rp yang bisa diubah), perbandingan Wise / bank SWIFT / Western Union,
  tombol "Log this transfer", daftar kiriman (EUR + Rp).
- **Business**: satu kartu per bisnis (pendapatan & laba 3 bulan, laba per bulan), tambah bulan,
  **upload laporan bulanan (PDF, CSV, Excel)**, file bisa dibuka dari barisnya.
- **Taxes & refund**: tax pot (dari kolom "tax" di Business), daftar tenggat (VAT, prepayment,
  annual return) dengan tanda selesai, checklist potongan pajak, perkiraan refund.
- **Invest**: total tabungan & investasi, kartu per aset (ETF, Tagesgeld, emas, aset di Indonesia…),
  nilai Rupiah dikonversi dengan kurs tersimpan, **net worth = aset − utang**.
- Quick add: Debt, Subscription, Investment value, Transfer home jadi aktif.
- Home: kartu Net worth muncul.

## Data baru di database

| Tabel | Isi | Private bisa? |
|---|---|---|
| `debts` | nama, pemberi pinjaman, saldo, pinjaman awal, bunga %, cicilan per bulan | Ya |
| `debt_settings` | strategi (avalanche/snowball), extra per bulan | — (bersama) |
| `subscriptions` | nama, harga per bulan, untuk siapa, terakhir dipakai, status (active / cancel_requested / cancelled) | Ya |
| `remittances` | penerima, EUR, biaya, kurs, Rupiah diterima, provider, tujuan, tanggal | Ya |
| `fx_rates` | tanggal, kurs IDR per EUR (diisi manual) | — |
| `business_months` | bisnis, bulan, pendapatan, biaya, sisihan pajak, file | Ya |
| `files` + Storage | file laporan bisnis (bucket privat, hanya rumah tangga ini) | ikut barisnya |
| `tax_deadlines` | judul, tanggal, jumlah, jenis, selesai | Ya |
| `assets` | nama, ikon, tempat, nilai EUR, mata uang asal, nilai asal, catatan | Ya |

Aturan privasi sama seperti Tahap 1 dan dipaksa di database: baris "Only me" tidak terlihat oleh
pasangan dan tidak masuk total mereka.

## Rumus (dari README)

- Kiriman: diterima = (EUR − biaya) × kurs. Provider (perkiraan, bukan kurs live):
  Wise biaya €0,62 + 0,57%, kurs tengah; Bank biaya €15, kurs × 0,975; Western Union biaya €4,90, kurs × 0,968.
  Setiap kiriman menyimpan EUR, biaya, kurs dan Rupiah diterima.
- Simulasi utang per bulan; uang yang bebas setelah satu utang lunas pindah ke utang berikutnya.
- Net worth = Σ aset − Σ utang.
- Tax pot = Σ sisihan pajak bulan-bulan bisnis tahun ini.

## Pengecekan (dari ROADMAP)

- [ ] Hitungan kiriman sama dengan README.
- [ ] File bisnis bisa dibuka dari barisnya.
- [ ] Net worth = aset − utang.

Cara cek: tes hitungan (Vitest), tes database dua akun (seperti Tahap 1), tes tampilan 360/390/1280px.
