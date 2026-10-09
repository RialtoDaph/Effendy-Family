# Rencana Tahap 1 — Money core

Status: **kode selesai dan online**. Tinggal tes di HP dengan dua akun (perlu akun Amnah).

Keputusan dari Rialto (9 Okt 2026):
- Kategori awal: pakai 10 kategori contoh dari prototipe (bisa diubah/dihapus).
- "Dibayar oleh": Rialto / Amnah / Family.
- Bulan anggaran: tanggal 1 sampai akhir bulan.
- Pembayaran rutin dicatat otomatis oleh server (fitur terjadwal Supabase).

## Hasil akhir Tahap 1

Kalian bisa memakai app setiap hari untuk uang rumah tangga:
- mencatat pengeluaran dan pemasukan, masing-masing **Family** atau **Private**,
- melihat sisa uang bulan ini, jatah per hari, dan status tiap kategori,
- pembayaran rutin (sewa, asuransi, gaji) tercatat sendiri setiap bulan,
- Home menampilkan ringkasan hari ini, 3 hal penting minggu ini, dan goals,
- Alerts memberi tahu kategori yang hampir habis, tagihan yang akan datang, dan dana darurat,
- Setup checklist memandu memasukkan data asli.

## Halaman yang dibangun

| Halaman | Isi |
|---|---|
| **Budget** | Kartu hitam: sisa uang fleksibel, terpakai vs batas, jatah per hari. Daftar kategori (ikon, nama, terpakai/batas, garis, status). Penggeser batas peringatan (80%). Kartu dana darurat (target 3/4/6 bulan). Sumber pemasukan. Transaksi terakhir + tombol **+ Add**. |
| **Recurring** | 3 kartu (keluar tiap bulan, masuk tiap bulan, berikutnya). Daftar "Every month": tanggal, nama, status (Added / Due / Next / Paused), jumlah, saklar on/off. Bisa diubah. |
| **Home** | Tanggal + sapaan, filter Family / Rialto / Amnah. Ringkasan harian berupa teks otomatis (belum pakai AI). 3 kartu angka. "3 things this week" (diambil dari alert terpenting). Goals bersama + goal private (hanya untuk pemiliknya, garis putus-putus + gembok). |
| **Alerts** | Filter All / Money / Goals. Kelompok Needs attention / Coming up / Good to know. Tombol Open dan Dismiss / Mark done. Angka merah di ikon lonceng. |
| **Setup & data** | Checklist 8 langkah dengan progres. Langkah yang baru ada di tahap berikutnya ditandai "phase N". |
| **Quick add** | Transaction, Goal, Recurring payment sudah aktif (formulir bottom-sheet). |

Bagian Home yang butuh data tahap lain (Next 7 days, Net worth) disembunyikan dulu.

## Data baru di database

| Tabel | Isi | Privat bisa? |
|---|---|---|
| `categories` | nama, ikon, batas per bulan, tetap/fleksibel, urutan | Tidak, selalu Family |
| `transactions` | tanggal, jumlah (− keluar / + masuk), penerima, kategori, dibayar oleh, sumber (manual/recurring), catatan | **Ya** |
| `incomes` | nama, milik siapa, jenis (Salary/Business/Other), jumlah per bulan | **Ya** |
| `recurring` | nama, ikon, jumlah, kategori, dibayar oleh, tanggal 1–28, aktif, bulan terakhir dicatat | **Ya** |
| `goals` | nama, ikon, target, terkumpul, setoran per bulan, tenggat, dana darurat? | **Ya** |
| `alerts_state` | alert yang sudah di-dismiss / ditandai selesai | Per orang |

Plus pengaturan `warn_pct` (80%) dan `ef_months` (6) yang sudah ada sejak Tahap 0.

**Aturan privasi** (dipaksa di database, bukan hanya di tampilan):
- Baris **Family**: kalian berdua bisa lihat dan ubah.
- Baris **Private**: hanya pemiliknya yang bisa lihat. Pasangan tidak melihat barisnya, jumlahnya, atau total yang memuatnya.
- Total Budget keluarga hanya menghitung transaksi Family. Transaksi private hanya masuk ke tampilan pribadi pemiliknya.

**Pencatatan otomatis**: fungsi di database berjalan setiap jam (dengan `pg_cron`). Jam 05:00 waktu Jerman, setiap pembayaran rutin yang aktif dan tanggalnya sudah lewat bulan ini dicatat sebagai transaksi, **tepat sekali per bulan**. Ini dijaga dua kali: kolom "bulan terakhir dicatat" dan kunci unik di database, jadi tidak mungkin dobel. Pembayaran rutin baru yang tanggalnya sudah lewat dianggap sudah tercatat bulan ini.

**Data awal**: 10 kategori contoh (batasnya dari prototipe, bisa diubah) dan satu goal "Emergency fund" (mulai dari €0) supaya kartu dana darurat langsung jalan.

## Aturan hitungan (dari README)

- Sisa uang fleksibel = jumlah batas kategori fleksibel − terpakai di kategori fleksibel.
- Jatah per hari = sisa fleksibel / sisa hari bulan ini.
- Status kategori: **Over** kalau terpakai > batas; **Near limit** kalau ≥ batas peringatan; **Fast** kalau fleksibel dan % terpakai > % bulan berjalan + margin; selain itu **Paid** (tetap) atau **On track**.
- Dana darurat (bulan) = terkumpul / jumlah semua batas kategori. Status: di bawah 3 bulan / minimum tercapai / penuh.

## Urutan kerja

| # | Langkah | Siapa |
|---|---|---|
| 1 | Tabel + aturan privasi + data awal | Claude |
| 2 | Tes database: privasi, total, pencatatan otomatis | Claude |
| 3 | Fungsi pencatatan otomatis + jadwal | Claude |
| 4 | Formulir: transaksi, kategori, pemasukan, pembayaran rutin, goal (dengan pilihan "Visible to: Family · Only me") | Claude |
| 5 | Halaman Budget, Recurring | Claude |
| 6 | Alerts + angka di lonceng | Claude |
| 7 | Home + Setup checklist | Claude |
| 8 | Tes tampilan 360 / 390 / 1280px, terang & gelap | Claude |
| 9 | Tes di HP dengan dua akun | Rialto & Amnah (dipandu) |

## Pengecekan (dari ROADMAP)

- [x] Transaksi private tidak terlihat oleh pasangan, termasuk di total. (tes database)
- [x] Pembayaran rutin tercatat tepat sekali per bulan. (tes database: dijalankan 3x, tetap 1 transaksi)
- [x] Status budget sesuai aturan di atas. (16 tes hitungan, `npm test`)
- [ ] Tes di HP dengan dua akun sungguhan.

Cara saya mengecek: tes SQL di database dengan dua akun simulasi (seperti Tahap 0), tes hitungan di kode, dan tes tampilan di browser. Tes terakhir di HP sungguhan perlu akun Amnah.

## Hasil tes

| Tes | Hasil |
|---|---|
| Database (`supabase/tests/money_rules.sql`) | 14/14 lolos. Satu cek "hapus" tidak bisa dijalankan dari Claude (butuh konfirmasi); aturannya sama dengan cek "ubah" yang lolos. |
| Hitungan (`src/lib/money.test.ts`) | 16/16 lolos |
| Tampilan 360 / 390 / 1280px | Tidak ada geser horizontal; tambah transaksi lewat formulir berhasil |

## Catatan

- Kategori tetap (sewa, asuransi) yang belum dibayar bulan ini berstatus **Not yet**, bukan "Paid".
  Di prototipe statusnya langsung "Paid", yang menyesatkan di awal bulan.
- Next 7 days dan Net worth di Home disembunyikan sampai datanya ada (Tahap 2 dan 4).
