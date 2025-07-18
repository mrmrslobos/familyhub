#!/bin/bash

# Family Task Manager Setup Script for Ubuntu LXC Container
# Run this script to set up the complete environment

set -e

echo "🚀 Setting up Family Task Manager on Ubuntu LXC Container..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install additional dependencies
echo "📦 Installing additional system dependencies..."
sudo apt install -y git curl build-essential nginx ufw

# Verify installations
echo "✅ Verifying installations..."
node --version
npm --version

# Create project directory
echo "📁 Creating project directory..."
PROJECT_DIR="/home/$(whoami)/family-task-manager"
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# Initialize React project
echo "⚛️ Creating React application..."
npx create-react-app . --template typescript

# Install Tailwind CSS
echo "🎨 Installing Tailwind CSS..."
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Install Firebase
echo "🔥 Installing Firebase..."
npm install firebase

# Install additional dependencies
echo "📦 Installing additional dependencies..."
npm install react-router-dom

# Create environment file
echo "🔧 Creating environment configuration..."
cat > .env << EOF
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# Gemini API Key (optional for AI suggestions)
REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here

# Application Configuration
REACT_APP_APP_ID=family-hub-app-id
EOF

# Set up nginx configuration
echo "🌐 Setting up nginx configuration..."
sudo tee /etc/nginx/sites-available/family-task-manager << EOF
server {
    listen 80;
    server_name _;
    
    root $PROJECT_DIR/build;
    index index.html index.htm;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/family-task-manager /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Create deployment script
cat > deploy.sh << 'EOF'
#!/bin/bash
# Deployment script for Family Task Manager

set -e

echo "🏗️ Building React application..."
npm run build

echo "🔄 Restarting nginx..."
sudo systemctl restart nginx

echo "✅ Deployment complete!"
echo "🌐 Your app should be accessible at http://$(hostname -I | awk '{print $1}')"
EOF

chmod +x deploy.sh

# Create start development script
cat > start-dev.sh << 'EOF'
#!/bin/bash
# Development server start script

echo "🚀 Starting development server..."
echo "📱 Access your app at http://$(hostname -I | awk '{print $1}'):3000"
npm start
EOF

chmod +x start-dev.sh

# Configure firewall
echo "🔒 Configuring firewall..."
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # React dev server
sudo ufw --force enable

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
sudo nginx -t

# Start and enable nginx
echo "▶️ Starting nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx

# Create PM2 ecosystem file for production
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'family-task-manager',
    script: 'serve',
    args: '-s build -l 3000',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
EOF

# Install PM2 globally
echo "📦 Installing PM2 for process management..."
sudo npm install -g pm2 serve

echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure your Firebase project:"
echo "   - Edit .env file with your Firebase configuration"
echo "   - Update src/firebase-config.js with your settings"
echo ""
echo "2. Add your application code:"
echo "   - Replace src/App.js with your Family Task Manager code"
echo "   - Update other necessary files"
echo ""
echo "3. Development mode:"
echo "   ./start-dev.sh"
echo ""
echo "4. Production deployment:"
echo "   ./deploy.sh"
echo ""
echo "5. Production with PM2:"
echo "   npm run build && pm2 start ecosystem.config.js"
echo ""
echo "🌐 Server IP: $(hostname -I | awk '{print $1}')"
echo "📁 Project directory: $PROJECT_DIR"