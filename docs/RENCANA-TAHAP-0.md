# Rencana Tahap 0 — Fondasi

Status: **kode selesai dan sudah online**. Tinggal langkah yang harus diklik sendiri (lihat bagian paling bawah) dan tes di HP.

Acuan: `docs/design/README.md`, `DATA_MODEL.md`, `ROADMAP.md`, dan prototipe
`docs/design/Effendy Family v7.dc.html` (dibangun ulang, tidak disalin).

## Hasil akhir Tahap 0

Sebuah web app di internet yang:
- bisa dipasang di Home Screen iPhone dan Android seperti aplikasi biasa,
- tetap terbuka (kerangkanya) walau tidak ada internet,
- bisa dimasuki oleh Rialto dan Amnah dengan email + password (dan passkey / Face ID),
- sudah punya "rangka rumah": menu samping di laptop, tab bawah + tombol "+" di HP,
  halaman More, pencarian ⌘K, notifikasi kecil (toast), dan formulir bottom-sheet,
- punya halaman Settings: Tampilan (Light/Dark/Auto), Anggota, dan Backup (Export/Import JSON).

Halaman modul (Money, Time, dst.) di Tahap 0 masih kosong ("segera hadir"). Isinya
dibangun mulai Tahap 1.

## Langkah kerja

| # | Langkah | Siapa |
|---|---|---|
| 1 | Membuat proyek Next.js + TypeScript + Tailwind, font Geist, ikon lucide-react | Claude |
| 2 | Warna & ukuran dari README dijadikan "token" (light, dark, palet mono default) | Claude |
| 3 | Membuat akun/proyek Supabase di region Frankfurt | Anda (dipandu) atau Claude lewat konektor |
| 4 | Tabel dasar + aturan privasi (RLS): `households`, `members`, `member_settings`, `passkeys`, fungsi `my_household()` | Claude |
| 5 | Halaman masuk (login) email + password; pendaftaran umum dimatikan | Claude |
| 6 | Membuat akun untuk Rialto dan Amnah | Anda (dipandu) |
| 7 | Rangka app: sidebar, header, tab bawah, FAB, More, ⌘K, toast, bottom sheet | Claude |
| 8 | Settings: Tampilan, Anggota, Export/Import JSON | Claude |
| 9 | PWA: manifest, ikon 192/512 + Apple, service worker, pill "Offline", tombol install / langkah iOS | Claude |
| 10 | Menghubungkan GitHub ke Vercel (region fra1) + memasukkan kunci Supabase | Anda (dipandu) |
| 11 | Passkey / Face ID untuk login (butuh alamat web final) | Claude + Anda |
| 12 | Pengecekan di HP sungguhan | Anda (dipandu) |

## Pengecekan (dari ROADMAP)

- [ ] Bisa dipasang ke Home Screen.
- [ ] Terbuka saat offline dan menampilkan rangka app.
- [ ] Rialto dan Amnah sama-sama bisa masuk.
- [ ] Tidak ada geser horizontal di layar 360px.

## Keputusan yang saya ambil (bisa diubah)

- **Tabel database dibuat per tahap**, bukan semuanya sekarang. Tahap 0 hanya tabel
  dasar; tabel uang dibuat di Tahap 1. Lebih mudah dites dan diperbaiki.
- **Bahasa tampilan app: Inggris** (sesuai README). Penjelasan ke Anda tetap bahasa Indonesia.
- **Palet warna default: mono** (hitam-putih), sesuai README.
- **Data contoh di prototipe tidak dipakai**; app mulai kosong.

## Yang sudah dikerjakan

- Supabase proyek "Effendy Family", region Frankfurt (`eu-central-1`), paket gratis.
- Tabel `households`, `members`, `member_settings` + aturan privasi (RLS), sudah dites
  (`supabase/tests/access_rules.sql`, 15 dari 15 cek lolos).
- Akun baru otomatis masuk ke satu rumah tangga; akun ke-3 ditolak.
- Login email + password, login passkey (Face ID / sidik jari), lupa password.
- Rangka app sesuai prototipe: sidebar (laptop), header + tab bawah + tombol + (HP),
  More, pencarian ⌘K, toast, formulir bottom-sheet.
- Settings: Your data (Export/Import JSON), Appearance, Sign-in, Offline & install,
  Members, Language & region.
- PWA: manifest, ikon, service worker (terbuka saat offline, pill "Offline").
- Vercel proyek `effendy-family`, region fra1.

## Hasil tes otomatis

| Cek | Hasil |
|---|---|
| Tidak ada geser horizontal di 360px | Lolos (juga 390px dan 1280px) |
| Terbuka saat offline | Lolos (Home, Journal, Settings, pindah tab) |
| Pengunjung tanpa login dialihkan ke /login | Lolos |
| Aturan akses database | Lolos 15/15 |
| Dipasang di Home Screen | Perlu dites di HP Anda |
| Kalian berdua bisa masuk | Perlu dites setelah akun dibuat |
