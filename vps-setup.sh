#!/bin/bash

# Configuration
APP_DIR="/var/www/thelodgeranger"
REPO_URL="https://github.com/herdirudian/thelodgeranger.git"
DB_NAME="thelodgeranger"
DB_USER="lodgeranger"
DB_PASS="LodgeRanger2025!" # Default password
DOMAIN="localhost"

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== Starting The Lodge Ranger VPS Setup ===${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root"
  exit
fi

# 1. Update System
echo -e "${GREEN}[1/8] Updating System...${NC}"
apt update && apt upgrade -y
apt install -y curl git unzip

# 2. Install Node.js 20
echo -e "${GREEN}[2/8] Installing Node.js...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Install MySQL
echo -e "${GREEN}[3/8] Installing MySQL...${NC}"
apt install -y mysql-server
# Start MySQL
systemctl start mysql
systemctl enable mysql

# Create DB & User (Idempotent)
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
echo "Setting up Backend..."
cd $APP_DIR/server
npm install
# Setup Server Env
if [ ! -f .env ]; then
    echo "Creating server .env..."
    cat > .env << EOL
DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}"
PORT=5000
JWT_SECRET="secret_key_$(date +%s)"
EOL
fi
echo "Running Database Migrations..."
npx prisma generate
npx prisma db push

# Client
echo "Setting up Frontend..."
cd $APP_DIR/client
npm install
# Setup Client Env
if [ ! -f .env.local ]; then
    # Ask for Domain/IP
    read -p "Enter your VPS IP Address or Domain (e.g. 103.x.x.x): " DOMAIN_INPUT
    DOMAIN=${DOMAIN_INPUT:-$DOMAIN}
    
    echo "Creating client .env.local..."
    echo "NEXT_PUBLIC_API_URL=http://${DOMAIN}/api" > .env.local
else
    # Read existing domain for nginx config later
    DOMAIN="localhost" 
fi

echo "Building Frontend (this may take a while)..."
npm run build

# 7. Setup PM2
echo -e "${GREEN}[7/8] Setting up PM2...${NC}"
npm install -g pm2
cd $APP_DIR/server
pm2 start index.js --name "ranger-backend"
cd $APP_DIR/client
pm2 start npm --name "ranger-frontend" -- start -- -p 3000
pm2 save
pm2 startup | tail -n 1 | bash # Auto-execute the startup command

# 8. Setup Nginx Config
echo -e "${GREEN}[8/8] Configuring Nginx...${NC}"
cat > /etc/nginx/sites-available/thelodgeranger << EOL
server {
    listen 80;
    server_name ${DOMAIN} _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

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

ln -sf /etc/nginx/sites-available/thelodgeranger /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo -e "${GREEN}=== Setup Complete! ===${NC}"
echo -e "Your app should be running at: http://${DOMAIN}"
