# Rencana Tahap 5 — Intelligence & reports

Status: **selesai dibuat** — tinggal dicoba di HP (Ask Rialna dan briefing dengan Claude sungguhan).

| Bagian | Status |
|---|---|
| A What if + simulasi 10 tahun | ✅ dites (hitungan + layar) |
| B Career | ✅ mulai kosong, diisi sendiri |
| C Laporan bulanan | ✅ dicetak ke PDF A4 dalam tes: 2 halaman, tidak ada bagian terpotong |
| D Ask Rialna | ✅ dites dengan jawaban AI tiruan; tes privasi lulus |
| E Briefing AI di Home + Listen | ✅ sekali sehari per tampilan (Family / per orang), disimpan di HP |

Jawaban Rialto: briefing dibuat AI · laporan belum dikirim email (cukup Save as PDF) · Career diisi sendiri
(mulai kosong) · pajak di What if: Claude yang tentukan → bawaan 30%, bisa diubah di layar (20 / 30 / 40%) ·
Rialna menjawab dalam bahasa pertanyaannya.

Tahap 3 dan 4 selesai dibuat; tes di HP dilakukan Rialto belakangan.

## Hasil akhir Tahap 5

1. **Ask Rialna** — chat dengan asisten AI (Claude, di server).
   - Jawaban pendek + sampai **3 kartu angka** + **satu langkah berikutnya** (misal tombol "Open What if").
   - Chip pertanyaan contoh ("Can we afford a new laptop in March?", "What happens if Studio has a slow month?").
   - **Privasi:** server mengambil data dengan login orang yang bertanya, jadi Rialna **hanya melihat data yang boleh dilihat penanya** —
     item Private pasangan tidak pernah sampai ke AI. (Dicek dengan tes: Rialna tidak pernah menyebut item private pasangan.)
   - Riwayat chat hanya disimpan di HP itu, tidak di server.
   - Dari pencarian (⌘K / ikon cari): Enter tanpa hasil → tanya Rialna.
2. **Briefing di Home + Listen** — ringkasan hari ini (uang tersisa, tagihan, shift, target), bisa dibacakan (`speechSynthesis`).
   Filter orang (Family / Rialto / Amnah) mengubah isinya.
3. **What if** — slider: pindahkan uang yang belum direncanakan ke target, perubahan penghasilan Studio
   (setelah pajak), cicilan ETF per bulan, perkiraan return per tahun, dan "hapus satu pengeluaran"
   (misal rokok, DAZN). Hasil: tanggal target baru, uang per tahun, hasil 10 tahun.
4. **Simulasi 10 tahun** — skenario buruk / tengah / baik dari aset Anda (ETF, Tagesgeld, emas, IDR), dengan toggle.
5. **Career** — rencana Studio dalam tahap-tahap (misal: rencana bisnis → nomor pajak → Gewerbe → rekening bisnis → …),
   bisa dicentang dan diedit.
6. **Laporan bulanan** — halaman siap cetak A4 (uang, target, waktu, hidup) → "Save as PDF" lewat print HP/laptop.
   **Cek:** tercetak di A4 tanpa bagian terpotong.

## Data baru

| Tabel | Isi |
|---|---|
| `career_steps` | judul, kapan, status (selesai / sedang / berikutnya), urutan, milik siapa |
| (tidak ada tabel chat) | riwayat Ask Rialna hanya di HP |

## Urutan kerja

| # | Bagian |
|---|---|
| A | What if + simulasi 10 tahun (hitungan saja, tanpa AI) |
| B | Career |
| C | Laporan bulanan (print → PDF) |
| D | Ask Rialna (server + tes privasi) |
| E | Briefing di Home + Listen |

## Pengecekan (dari ROADMAP)

- [x] Rialna tidak pernah menyebut item private pasangan: data diambil dengan login penanya (RLS) dan disaring sekali lagi;
  tes otomatis memastikan item private pasangan tidak ada di data yang dikirim ke AI.
- [x] Laporan tercetak di A4 tanpa bagian terpotong (tes PDF A4).

## Pertanyaan (sudah dijawab)

1. **Briefing di Home**: dibuat oleh **AI** sekali sehari per orang (lebih luwes, ada biaya kecil per hari),
   atau **otomatis dari aturan** tanpa AI (gratis, sudah ada versi sederhananya)? Usul saya: aturan dulu,
   tombol "Ask Rialna about today" untuk versi AI.
2. **Laporan dikirim email tiap tanggal 1?** Butuh akun layanan email (misal Resend, gratis). Usul saya: belum,
   cukup "Save as PDF" dulu.
3. **Career**: isinya hanya rencana **RIDEFF Studio** (Rialto), atau juga Amnah (Atelier / Mami I)?
   Mulai dari contoh tahap di desain atau kosong?
4. **What if – pajak**: perubahan penghasilan Studio dihitung setelah kira-kira **30% pajak**. Boleh begitu?
5. **Bahasa Rialna**: app tetap Inggris, tapi Rialna boleh **menjawab dalam bahasa pertanyaannya**
   (tanya Indonesia → jawab Indonesia)?
