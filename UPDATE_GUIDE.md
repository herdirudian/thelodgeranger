# Panduan Update Aplikasi (Future Updates)

Jika di masa depan ada penambahan fitur baru, perbaikan bug, atau perubahan tampilan, ikuti langkah-langkah ini untuk mengupdate aplikasi di VPS.

---

## 1. Upload File Terbaru ke VPS

Gunakan software FTP (seperti FileZilla atau WinSCP) atau terminal untuk mengupload file yang berubah.

**PENTING:** Jangan menimpa file konfigurasi server (`server/.env`) atau file upload gambar (`server/uploads/`) agar data tidak hilang.

Biasanya yang perlu diupload ulang adalah:
- Folder `client` (kecuali `.env.local` dan `node_modules`)
- Folder `server` (kecuali `.env`, `node_modules`, dan `uploads`)

## 2. Masuk ke VPS
Buka terminal dan login ke VPS:
```bash
ssh root@IP_VPS_ANDA
```

## 3. Update Backend (Server)

Jika ada perubahan pada Database (schema.prisma) atau logika backend:

```bash
# 1. Masuk ke folder server
cd /var/www/thelodgeranger/server

# 2. Install library baru (jika ada penambahan di package.json)
npm install

# 3. Update Database (HANYA JIKA ada perubahan di schema.prisma)
npx prisma db push

# 4. Restart Backend
pm2 restart ranger-backend
```

## 4. Update Frontend (Client)

Jika ada perubahan pada Tampilan (halaman baru, tombol, warna, dll):

```bash
# 1. Masuk ke folder client
cd /var/www/thelodgeranger/client

# 2. Install library baru (jika ada penambahan di package.json)
npm install

# 3. Build Ulang Aplikasi (WAJIB dilakukan setiap ada perubahan tampilan)
npm run build

# 4. Restart Frontend
pm2 restart ranger-frontend
```

## 5. Cek Status Aplikasi

Pastikan semuanya berjalan normal (status harus 'online'):
```bash
pm2 status
```

---

## Ringkasan Perintah Cepat (Cheat Sheet)

Jika Anda yakin hanya update kode biasa (tanpa ubah database):

```bash
# Update Server
cd /var/www/thelodgeranger/server && npm install && pm2 restart ranger-backend

# Update Client
cd /var/www/thelodgeranger/client && npm install && npm run build && pm2 restart ranger-frontend
```
