# Bilhikma Purchasing

Aplikasi web untuk purchasing & restok Bilhikma, dikembangkan dari artefak *Analisa Restok*.

## Fitur
- **Analisa Restok**: upload export Ginee "Penjualan per Varian" → warna × ukuran, kelas ABC, rencana restok, kebutuhan bahan (yard/rol/biaya), export Excel.
- **Purchase Order**: PO Produksi (ke konveksi) dan PO Bahan (ke toko kain), bisa dibuat langsung dari rencana restok. Alurnya: draft → dipesan → diterima sebagian → selesai. Ada juga cetak/PDF dan kirim via WhatsApp.
- **Master data**: Supplier, Bahan (harga/yard, isi rol), Artikel (prefix SKU, pemakaian yard per ukuran, ongkos jahit, aksesoris, harga jual).
- **HPP & Margin** per artikel × ukuran, pakai harga jual di master atau rata-rata aktual dari Ginee.
- **Multi-user**: peran Owner / Purchasing / Viewer.

## Menjalankan di komputer
```bash
npm install
npm run dev      # buka http://localhost:5173
```
Tanpa konfigurasi apa pun aplikasi berjalan dalam **mode demo**. Datanya hanya tersimpan di browser, dan ada 3 akun contoh untuk tiap peran.

## Menyambungkan database (Supabase, gratis)
1. Buat project di https://supabase.com.
2. **SQL Editor → New query**, tempel isi `supabase/schema.sql`, lalu **Run**.
3. Salin `.env.example` menjadi `.env`, lalu isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
4. Jalankan ulang `npm run dev`. **Orang pertama yang mendaftar otomatis menjadi Owner.** Anggota tim lain mendaftar sendiri (perannya Viewer), lalu Owner menaikkan perannya di menu *Pengguna*.
5. (Opsional) Kalau tidak perlu konfirmasi email, matikan *Authentication → Providers → Email → Confirm email*.

## Online (hosting)
Deploy ke Vercel/Netlify: build command `npm run build`, output `dist`. Isi dua variabel `VITE_SUPABASE_*` di pengaturan environment hosting.

## Struktur kode
- `src/lib/ginee.ts`: parser export Ginee & aturan SKU (PREFIX + kode warna + ukuran)
- `src/lib/calc.ts`: HPP, rencana restok, kebutuhan bahan, item PO
- `src/lib/po.ts`: penomoran & status PO
- `src/data/backend.ts`: koneksi Supabase / mode demo
- `src/pages/*`: halaman aplikasi
- `supabase/schema.sql`: tabel & hak akses (Row Level Security)
