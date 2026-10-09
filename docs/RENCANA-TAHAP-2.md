# Rencana Tahap 2 — Money complete

Status: **kode selesai dan online**. Tinggal tes di HP (upload file sungguhan, dan dua akun).

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

- [x] Hitungan kiriman sama dengan README. (tes hitungan: Wise €200 @18.000 = Rp 3.568.320)
- [x] File bisnis bisa dibuka dari barisnya. (tes browser dengan data tiruan; perlu dicoba sekali di HP)
- [x] Net worth = aset − utang. (tes hitungan + tampilan: €31.320 − €4.296 = €27.024)

Cara cek: tes hitungan (Vitest), tes database dua akun (seperti Tahap 1), tes tampilan 360/390/1280px.

## Keputusan dari Rialto (10 Okt 2026)

- Nama bisnis bisa diubah sendiri di app (awal: Rialto Studio, Amnah Atelier).
- Status pajak: Kleinunternehmer, jadi tidak ada tenggat PPN otomatis. Bisa diubah per bisnis.
- Perkiraan refund diisi manual.
- Subscriptions sederhana: hanya aktif / sudah berhenti (tanpa "terakhir dipakai").

## Hasil tes

| Tes | Hasil |
|---|---|
| Database (`supabase/tests/money_complete_rules.sql`) | 10/10 lolos |
| Hitungan (`src/lib/finance.test.ts`) | 11/11 lolos (total semua tes 27/27) |
| Tampilan 360 / 390 / 1280px | Tidak ada geser horizontal; upload dan buka file berhasil (data tiruan) |
| Upload file sungguhan ke Supabase Storage | Belum bisa dari container Claude; perlu dicoba di HP |
