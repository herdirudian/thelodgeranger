# Panduan Deployment The Lodge Ranger

## 1. Persiapan VPS
Pastikan VPS Anda menggunakan Ubuntu 20.04/22.04 LTS.

Akses VPS via SSH:
```bash
ssh root@ip-address-vps
```

## 2. Cara Cepat (Automated Script)
Kami telah menyediakan script otomatis untuk setup awal.

1. Upload file `vps-setup.sh` ke VPS.
2. Beri izin eksekusi dan jalankan:
   ```bash
   chmod +x vps-setup.sh
   ./vps-setup.sh
   ```
3. Ikuti instruksi di layar.

---

## 3. Cara Manual (Langkah demi Langkah)

### Prasyarat
Install software yang dibutuhkan:
```bash
sudo apt update
sudo apt install -y nodejs npm nginx mysql-server git ufw
```
*(Pastikan Node.js versi 18+)*

### Setup Database
1. Login ke MySQL: `sudo mysql`
2. Buat user dan db:
   ```sql
   CREATE DATABASE thelodgeranger;
   CREATE USER 'lodgeranger'@'localhost' IDENTIFIED BY 'password_kuat_anda';
   GRANT ALL PRIVILEGES ON thelodgeranger.* TO 'lodgeranger'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

### Upload Kode
Anda bisa mengupload kode menggunakan Git (GitHub/GitLab) atau SCP. Asumsi kita menggunakan Git di folder `/var/www`.

```bash
cd /var/www
git clone https://github.com/username/thelodgeranger.git
cd thelodgeranger
```

### Setup Backend (Server)

1. Masuk ke folder server:
   ```bash
   cd server
   npm install
   ```

2. Buat file `.env` produksi:
   ```bash
   nano .env
   ```
   Isi dengan konfigurasi VPS:
   ```env
   DATABASE_URL="mysql://lodgeranger:password_kuat_anda@localhost:3306/thelodgeranger"
   PORT=5000
   JWT_SECRET="kunci_rahasia_yang_sangat_panjang_dan_acak"
   # ... konfigurasi email lainnya
   ```

3. Setup Database Schema (Prisma):
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. Jalankan dengan PM2:
   ```bash
   pm2 start ecosystem.config.js
   # Atau jika belum ada ecosystem file:
   # pm2 start index.js --name "ranger-backend"
   ```

### Setup Frontend (Client)

1. Masuk ke folder client:
   ```bash
   cd ../client
   npm install
   ```

2. Buat file `.env.local` produksi:
   ```bash
   nano .env.local
   ```
   Isi dengan URL domain/IP VPS:
   ```env
   # PENTING: Gunakan HTTPS jika sudah disetting, atau HTTP jika belum.
   # Jangan pakai port :5000, arahkan ke /api (Nginx akan menghandle)
   NEXT_PUBLIC_API_URL=https://ranger.thelodgegroup.id/api
   ```

3. Build aplikasi Next.js:
   ```bash
   npm run build
   ```

4. Jalankan dengan PM2:
   ```bash
   pm2 start npm --name "ranger-frontend" -- start -- -p 3000
   ```

5. Simpan konfigurasi PM2 agar otomatis jalan saat restart VPS:
   ```bash
   pm2 save
   pm2 startup
   ```

## 4. Setup Domain & Keamanan Jaringan (PENTING)

Masalah umum: "Sistem tidak bisa diakses dari jaringan kantor/WiFi tertentu".
Solusi: Gunakan **Nginx Reverse Proxy** dan **SSL (HTTPS)**.

### Langkah 1: Konfigurasi Nginx
Nginx bertugas sebagai "resepsionis" yang menerima tamu di pintu utama (Port 80/443) lalu mengarahkan ke kamar yang tepat (Port 3000/5000). Ini membuat sistem bisa diakses tanpa mengetik port, dan menembus firewall kantor.

1. Buat konfigurasi:
   ```bash
   sudo nano /etc/nginx/sites-available/thelodgeranger
   ```

2. Isi file:
   ```nginx
   server {
       server_name ranger.thelodgegroup.id; # Ganti dengan domain Anda

       # Frontend (Next.js)
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       # Backend (API)
       location /api {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. Aktifkan:
   ```bash
   sudo ln -sf /etc/nginx/sites-available/thelodgeranger /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ``````

### Langkah 2: Pasang SSL (HTTPS) Gratis
Agar aman dan tidak diblokir browser/firewall, wajib gunakan HTTPS.

1. Install Certbot:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. Generate Sertifikat:
   ```bash
   sudo certbot --nginx -d ranger.thelodgegroup.id
   ```
   *Pilih opsi "2: Redirect" jika ditanya, agar semua akses otomatis ke HTTPS.*

### Langkah 3: Cloudflare (Solusi Pamungkas)
Jika Nginx + HTTPS masih diblokir (biasanya karena IP VPS kena blacklist firewall kantor), gunakan Cloudflare.

**PERINGATAN:** Langkah ini mengharuskan Anda memindahkan DNS utama domain `thelodgegroup.id`. Jika domain ini dipakai untuk email/website perusahaan utama lainnya, **WAJIB konsultasi dengan tim IT yang mengurus domain tersebut** agar email tidak mati.

1. **Daftar Akun:**
   Buka [dash.cloudflare.com](https://dash.cloudflare.com/sign-up) dan daftar gratis.

2. **Add Site:**
   - Klik tombol **Add a Site**.
   - Masukkan domain utama: `thelodgegroup.id` (bukan ranger.thelodgegroup.id).
   - Pilih **Free Plan** (paling bawah).

3. **Review DNS Records (PENTING):**
   - Cloudflare akan otomatis menscan record DNS lama Anda (Mail, WWW, dll).
   - **Pastikan semua record ada**. Jika ada yang hilang, email kantor bisa tidak bisa diakses.
   - Tambahkan record baru untuk Ranger:
     - **Type:** A
     - **Name:** ranger
     - **Content:** [Masukkan IP Public VPS Anda, contoh: 103.100.x.x]
     - **Proxy status:** **Proxied** (Awan Oranye). Ini kuncinya agar IP asli tersembunyi.

4. **Ubah Nameservers:**
   - Cloudflare akan memberikan 2 Nameserver (contoh: `bob.ns.cloudflare.com`).
   - Login ke tempat Anda membeli domain (Niagahoster/Rumahweb/dll).
   - Cari menu **Nameservers** dan ganti dengan yang dari Cloudflare.
   - Tunggu 1-24 jam untuk propagasi.

5. **Setting SSL/TLS (WAJIB):**
   - Di dashboard Cloudflare, menu sebelah kiri klik **SSL/TLS**.
   - Ubah mode menjadi **Full** atau **Full (Strict)**.
   - *Jangan pilih Flexible*, karena akan bentrok dengan settingan Nginx di VPS dan menyebabkan error "Too many redirects".

Dengan setup ini, user mengakses `Cloudflare -> VPS Anda`. Firewall kantor hanya melihat koneksi ke Cloudflare (yang aman), bukan ke IP VPS Anda.

## 5. Update Aplikasi

Jika ada perubahan kode (seperti fitur baru):

**Backend:**
```bash
cd /var/www/thelodgeranger/server
git pull
npm install
npx prisma db push
pm2 restart server-api
```

**Frontend:**
```bash
cd /var/www/thelodgeranger/client
git pull
npm install
npm run build
pm2 restart ranger-frontend
```
