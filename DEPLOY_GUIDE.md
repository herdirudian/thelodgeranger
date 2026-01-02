# Panduan Deployment The Lodge Ranger ke VPS (Ubuntu)

Dokumen ini menjelaskan langkah-langkah untuk melakukan deployment aplikasi **The Lodge Ranger** (Next.js + Express + MySQL) ke VPS menggunakan sistem operasi **Ubuntu 22.04 LTS** atau **24.04 LTS**.

## 1. Persiapan VPS

Masuk ke VPS Anda via SSH:
```bash
ssh root@ip-address-vps-anda
```

Update package list:
```bash
sudo apt update && sudo apt upgrade -y
```

## 2. Instalasi Dependensi Utama

Kita akan menginstall:
- **Node.js** (Versi LTS)
- **MySQL Server** (Database)
- **Nginx** (Web Server / Reverse Proxy)
- **PM2** (Process Manager agar aplikasi tetap jalan walau terminal ditutup)

### Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Install MySQL
```bash
sudo apt install mysql-server -y
sudo mysql_secure_installation
# Ikuti instruksi di layar (set password root, remove anonymous users, disallow root login remotely, dll)
```

### Install Nginx
```bash
sudo apt install nginx -y
```

### Install PM2
```bash
sudo npm install -g pm2
```

## 3. Setup Database

Masuk ke MySQL console:
```bash
sudo mysql -u root -p
```

Buat database dan user baru (jangan pakai root untuk aplikasi):
```sql
CREATE DATABASE thelodgeranger;
CREATE USER 'lodgeranger'@'localhost' IDENTIFIED BY 'BI5mill4h@@@';
GRANT ALL PRIVILEGES ON thelodgeranger.* TO 'lodgeranger'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 4. Setup Aplikasi

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
   pm2 start index.js --name "ranger-backend"
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
   NEXT_PUBLIC_API_URL=http://ip-address-atau-domain-anda/api
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

## 5. Konfigurasi Nginx (Reverse Proxy)

Nginx akan mengatur agar user mengakses port 80 (HTTP) dan diteruskan ke port 3000 (Frontend) dan 5000 (Backend).

1. Buat file konfigurasi:
   ```bash
   sudo nano /etc/nginx/sites-available/thelodgeranger
   ```

2. Isi dengan konfigurasi berikut:
   ```nginx
   server {
       listen 80;
       server_name domain-anda.com www.domain-anda.com; # Atau IP address jika belum ada domain

       # Frontend (Next.js)
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       # Backend (Express API)
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

3. Aktifkan konfigurasi:
   ```bash
   sudo ln -s /etc/nginx/sites-available/thelodgeranger /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default # Hapus default config jika perlu
   sudo nginx -t # Test konfigurasi
   sudo systemctl restart nginx
   ```

## 6. Selesai!

Sekarang aplikasi Anda sudah bisa diakses melalui IP Address VPS atau Domain Anda.

### Tips Tambahan (Keamanan)
Jika sudah menggunakan domain, sangat disarankan menginstall SSL (HTTPS) menggunakan Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d domain-anda.com
```
