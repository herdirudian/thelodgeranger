#!/bin/bash

# Configuration
APP_DIR="/var/www/thelodgeranger"
REPO_URL="https://github.com/herdirudian/thelodgeranger.git"
DB_NAME="thelodgeranger"
DB_USER="lodgeranger"
DB_PASS="LodgeRanger2025!" # You should change this!
DOMAIN="ranger.thelodgegroup.id" # Replace with your actual domain

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Starting The Lodge Ranger VPS Setup ===${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Please run as root (sudo)${NC}"
  exit
fi

# 1. Update System
echo -e "${GREEN}[1/8] Updating System...${NC}"
apt update && apt upgrade -y
apt install -y curl git unzip ufw

# 2. Install Node.js 20
echo -e "${GREEN}[2/8] Installing Node.js...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Install MySQL
echo -e "${GREEN}[3/8] Installing MySQL...${NC}"
apt install -y mysql-server
systemctl start mysql
systemctl enable mysql

# Create DB & User
echo "Configuring Database..."
mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME};"
mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

# 4. Install Nginx
echo -e "${GREEN}[4/8] Installing Nginx...${NC}"
apt install -y nginx
systemctl start nginx
systemctl enable nginx

# 5. Setup Application Code
echo -e "${GREEN}[5/8] Setting up Application...${NC}"
mkdir -p /var/www
if [ -d "$APP_DIR" ]; then
    echo "Directory exists, pulling latest changes..."
    cd $APP_DIR
    git reset --hard
    git pull
else
    echo "Cloning repository..."
    cd /var/www
    git clone $REPO_URL
    cd $APP_DIR
fi

# 6. Install Dependencies & Build
echo -e "${GREEN}[6/8] Installing Dependencies...${NC}"

# Server
echo "--> Setting up Backend..."
cd $APP_DIR/server
npm ci
# Setup Server Env
if [ ! -f .env ]; then
    echo "Creating server .env..."
    cat > .env << EOL
DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}"
PORT=5000
JWT_SECRET="secret_key_$(openssl rand -hex 32)"
EOL
fi

echo "--> Running Database Migrations..."
npx prisma generate
npx prisma db push

# Client
echo "--> Setting up Frontend..."
cd $APP_DIR/client
npm ci
# Setup Client Env
echo "Creating client .env.local..."
# Note: In production, NEXT_PUBLIC_API_URL should point to the public domain/IP
cat > .env.local << EOL
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api
EOL

echo "--> Building Frontend..."
npm run build

# 7. Setup PM2
echo -e "${GREEN}[7/8] Setting up PM2 Process Manager...${NC}"
npm install -g pm2

# Stop existing processes if any
pm2 delete all || true

# Start Backend
cd $APP_DIR/server
pm2 start index.js --name "ranger-backend"

# Start Frontend
cd $APP_DIR/client
pm2 start npm --name "ranger-frontend" -- start -- -p 3000

# Save PM2 list
pm2 save
pm2 startup | bash

# 8. Configure Nginx
echo -e "${GREEN}[8/8] Configuring Nginx...${NC}"
cat > /etc/nginx/sites-available/thelodgeranger << EOL
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend (Express API)
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL

# Enable Site
ln -sf /etc/nginx/sites-available/thelodgeranger /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and Restart Nginx
nginx -t
systemctl restart nginx

# Firewall Setup
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw --force enable

echo -e "${GREEN}=== Setup Complete! ===${NC}"
echo "Your application should be live at http://${DOMAIN}"
echo "To enable HTTPS, run: certbot --nginx -d ${DOMAIN}"
