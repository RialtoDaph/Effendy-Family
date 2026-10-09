# Rencana Tahap 3 — Capture, security, reminders

Status: **sedang dikerjakan.** Jawaban: AI = Claude Opus; API key dibuat Rialto (dipandu);
bank = Sparkasse, TF Bank, Revolut, BCA, PayPal, Wise.

| Bagian | Status |
|---|---|
| A PIN + Face ID | ✅ selesai, dites otomatis (PIN tidak tersimpan polos, jeda 30 dtk setelah 5x salah, terkunci saat dibuka lagi) |
| C Offline queue | ✅ selesai, dites otomatis (simpan tanpa internet → "Offline · 1" → terkirim otomatis saat online) |
| B Notifikasi | berikutnya |
| D Bank import CSV | menunggu contoh CSV |
| E PDF + struk | menunggu API key |

Tahap 0–2 selesai dan dites di HP dengan dua akun (11 Okt 2026).

## Hasil akhir Tahap 3

1. **Kunci PIN + Face ID** — app terkunci saat dibuka / setelah ditinggal (langsung, 1 menit, 5 menit).
   PIN 4 angka, disimpan sebagai hash (tidak pernah teks biasa). 5x salah → tunggu 30 detik,
   lalu 60, 120, … "Forgot PIN?" → login ulang dengan password atau Face ID.
2. **Notifikasi (Web Push)** — langsung ke HP walau app tertutup (iPhone: iOS 16.4+ dan app
   dipasang di layar utama). Ringkasan pagi (07:00 / 08:00 / 20:00), tagihan rutin 1 hari sebelumnya,
   tenggat pajak 3 hari sebelumnya, kategori melewati batas peringatan, goals tiap Minggu 19:00.
   Saklar per jenis, tombol "Send a test reminder".
3. **Offline write queue** — transaksi yang dicatat tanpa internet disimpan di HP lalu dikirim
   otomatis saat online lagi.
4. **Bank import, bank apa saja** — upload CSV atau PDF rekening:
   - CSV: app mengenali pemisah dan encoding (Sparkasse: `;` dan ISO-8859-1). Pertama kali per bank,
     Anda pilih kolom mana tanggal / jumlah / penerima / keterangan; pilihan disimpan per bank.
   - PDF: dibaca oleh Claude (AI), Anda cek dulu sebelum disimpan.
   - **Tidak ada dobel**: setiap baris punya sidik (tanggal + jumlah + penerima + keterangan).
   - Kategori otomatis: aturan dari koreksi Anda dulu ("Rewe → Groceries"), lalu AI.
     Yang ragu masuk "flagged" dan Anda pilih dari 3 usulan.
5. **Scan struk** — foto struk → Claude membaca toko, tanggal, total, item, usulan kategori →
   Anda cek → simpan. Foto ikut tersimpan dan terhubung ke transaksinya.

## Urutan kerja

| # | Bagian | Butuh dari Anda |
|---|---|---|
| A | PIN + Face ID lock | — |
| B | Notifikasi | Tes di HP (iPhone: app harus dari layar utama) |
| C | Offline queue | — |
| D | Bank import CSV (Sparkasse + bank lain) | Contoh file CSV (boleh disamarkan) |
| E | PDF import + scan struk | **Claude API key** (dipandu) |

A–C tidak butuh akun baru, jadi dikerjakan dulu. D–E menyusul.

## Data baru

| Tabel | Isi |
|---|---|
| ~~`security`~~ | diganti: PIN disimpan per HP (hash + salt di perangkat), tanpa tabel — sesuai README "on the device" |
| `push_subscriptions` | alamat notifikasi per perangkat — per orang |
| `member_settings.notif` | saklar per jenis + jam ringkasan pagi (sudah ada sejak Tahap 0) |
| `import_mappings` | pemetaan kolom CSV per bank |
| `merchant_rules` | "penerima ini → kategori ini", dari koreksi Anda |
| `transactions.import_hash` | sidik anti-dobel (kolom sudah ada sejak Tahap 1) |
| `files` (kind `receipt`, `statement`) | foto struk dan file rekening (bucket privat yang sudah ada) |

Notifikasi dikirim oleh fungsi server Supabase (Edge Function) yang dipanggil `pg_cron`
tiap 15 menit dan untuk ringkasan pagi. Kunci notifikasi (VAPID) saya buat sendiri dan disimpan sebagai rahasia di server.

Claude API hanya dipanggil dari server (Vercel), kuncinya tidak pernah sampai ke HP.

## Pengecekan (dari ROADMAP)

- [ ] Impor CSV Sparkasse sungguhan + satu file bank lain, tanpa dobel.
- [ ] Notifikasi sampai dengan app tertutup di iPhone (iOS 16.4+, terpasang di layar utama).
- [x] Jeda setelah PIN salah berjalan (tes otomatis).
