# Rencana Tahap 4 — Time & life

Status: **rencana, menunggu jawaban dan persetujuan**. Belum ada kode yang ditulis.

Tahap 3 selesai dibuat. Tes di HP (notifikasi, scan struk, PDF, CSV asli) dilakukan Rialto nanti.

## Hasil akhir Tahap 4

1. **This week** — papan 7 hari (Senin–Minggu), warna per orang: Rialto / Amnah / Together.
   3 prioritas minggu ini (bisa dicentang). Tombol "+" untuk acara baru. Geser ke minggu depan/lalu.
2. **Shifts (bar)** — jumlah shift dan jam kerja bulan ini, daftar shift berikutnya dengan tanda
   *Night* dan *Sunday*, dan peringatan kalau bentrok dengan acara lain.
   **"Read roster"**: foto atau PDF jadwal kerja dibaca Claude → Anda cek dan centang shift satu per satu → disimpan.
3. **Yearly goals** — kartu per target tahunan (misal "30 ECTS", "500 orders", "45 date nights")
   dengan strip 52 minggu, status *Ahead / On track / Behind* (dihitung dari progres vs. minggu ke berapa),
   langkah minggu ini dan saran singkat.
4. **Learning** — menit belajar per orang vs. target mingguan (bar), dan daftar buku/kursus per topik dengan persen.
5. **Gym** — jumlah sesi per orang per minggu, catat sesi (jenis + waktu), riwayat.
6. **Journal** — **Private otomatis**, kotak tulis + Save, daftar catatan per tanggal.
7. **Date nights** — rencana Jumat ini, ide di sekitar Eichstätt (ketuk untuk merencanakan),
   riwayat dengan rating ⭐ dan biaya.
8. **Notifikasi** — shift: **2 jam sebelum mulai**; acara kalender (opsional per acara).
   Saklar "Bar shifts" di Settings → Reminders aktif.
9. **Quick add** — "Calendar event", "Bar shift", "Gym session", "Journal note" berfungsi.

## Data baru (Supabase, dengan aturan Private/Family seperti sebelumnya)

| Tabel | Isi |
|---|---|
| `events` | judul, tanggal, mulai, selesai, siapa (Rialto/Amnah/Together), jenis (acara/shift), pengingat |
| `week_priorities` | 3 prioritas per minggu, selesai/belum |
| `yearly_goals` | nama, ikon, target, satuan, sudah tercapai, langkah minggu ini, pemilik |
| `goal_progress` | catatan kemajuan per minggu (untuk strip 52 minggu) |
| `learning_items`, `learning_minutes` | buku/kursus + persen; menit per orang per minggu |
| `gym_sessions` | jenis, ikon, tanggal + jam, orang |
| `journal_entries` | tanggal, teks — **Private** bawaan |
| `date_nights`, `date_ideas` | riwayat (biaya, rating) dan daftar ide |

Bawaan privasi (README): Journal → Private; Gym, Learning, Yearly goals → Family.

## Urutan kerja

| # | Bagian | Butuh dari Anda |
|---|---|---|
| A | Tabel + This week + Calendar event | — |
| B | Shifts + notifikasi 2 jam sebelum | — |
| C | Read roster (Claude) | Contoh foto/PDF jadwal (boleh disamarkan) |
| D | Yearly goals + Learning | — |
| E | Gym + Journal + Date nights | — |

## Pengecekan (dari ROADMAP)

- [ ] Notifikasi shift datang 2 jam sebelum mulai.
- [ ] Journal milik satu orang tidak terlihat oleh pasangannya.

## Pertanyaan

1. **Shift**: hanya Rialto yang kerja shift di bar, atau Amnah juga?
2. **Gaji shift**: mau app menghitung perkiraan gaji dari shift (jam × tarif per jam, plus tambahan malam/Minggu)?
   Atau cukup jumlah shift dan jam saja?
3. **Jadwal kerja (roster)** biasanya dalam bentuk apa: foto kertas di dinding, PDF, atau screenshot WhatsApp/app?
   Dan nama Rialto tertulis seperti apa di jadwal itu (misal "Rialto", "R. Effendy")?
4. **Kalender HP**: cukup kalender di dalam app, atau perlu juga muncul di kalender iPhone/Google?
   (Bisa ditambah nanti; usul saya: di dalam app dulu.)
5. **Ide date night**: pakai 6 contoh ide sekitar Eichstätt dari desain (Trattoria, Altmühltal, Therme Bad Gögging, …)
   sebagai awal, atau mulai kosong?
