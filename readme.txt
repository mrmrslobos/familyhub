# Family Task Manager

A comprehensive family task management application with features for task organization, calendar view, meal planning, devotionals, health tracking, family goals, event planning, custom lists, budgeting, and family communication.

## Features

- 📋 **Task Management**: Private and shared tasks with due dates
- 📅 **Calendar View**: Visual calendar with task scheduling
- 🍽️ **Meal Planning**: Weekly meal planning with custom meal database
- 📖 **Daily Devotionals**: Daily Bible verses with family thoughts
- 💪 **Health & Fitness**: Track exercise, weight, steps, and sleep
- 🎯 **Family Goals**: Set and track family goals with sub-tasks
- 🎉 **Event Planning**: Plan events with detailed checklists
- 📝 **Custom Lists**: Create and manage custom lists and shopping lists
- 💰 **Family Budget**: Track expenses, income, and recurring bills
- 💬 **Communication Hub**: Family messaging system
- 🤖 **AI Suggestions**: Gemini-powered task breakdown suggestions

## Prerequisites

- Ubuntu LXC Container (or Ubuntu server)
- Node.js 18.x or higher
- Firebase project
- (Optional) Gemini API key for AI features

## Quick Setup

1. **Download and run the setup script:**
```bash
curl -o setup-family-task-manager.sh https://raw.githubusercontent.com/your-repo/family-task-manager/main/setup-family-task-manager.sh
chmod +x setup-family-task-manager.sh
./setup-family-task-manager.sh
```

2. **Configure Firebase:**
   - Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication (Email/Password and Anonymous)
   - Create a Firestore database
   - Copy your config values to `.env` file

3. **Add your application code:**
   - Replace the default `src/App.js` with your Family Task Manager code
   - Update `src/firebase-config.js` with your Firebase configuration

4. **Start development server:**
```bash
./start-dev.sh
```

## Manual Setup

### 1. System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install additional dependencies
sudo apt install -y git curl build-essential nginx ufw
```

### 2. Create React Application

```bash
# Create project directory
mkdir family-task-manager
cd family-task-manager

# Create React app
npx create-react-app . --template typescript

# Install dependencies
npm install firebase
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 3. Configure Environment

Create `.env` file with your Firebase configuration:

```bash
cp .env.example .env
# Edit .env with your actual Firebase config values
```

### 4. Firebase Setup

1. **Create Firebase Project:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Authentication (Email/Password and Anonymous)
   - Create Firestore database in test mode

2. **Get Configuration:**
   - Go to Project Settings > General > Your apps
   - Click "Add app" and select Web
   - Copy the configuration object values to your `.env` file

3. **Firestore Security Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /artifacts/{appId}/users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to read/write public data
    match /artifacts/{appId}/public/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 5. Application Files

Replace the default files with your Family Task Manager code:

- `src/App.js` - Your main application component
- `src/firebase-config.js` - Firebase configuration
- `src/index.css` - Tailwind CSS imports
- Update `tailwind.config.js` for proper content paths

### 6. Production Deployment

```bash
# Build the application
npm run build

# Deploy with nginx
sudo cp /etc/nginx/sites-available/family-task-manager /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

## Development

### Start Development Server
```bash
npm start
# or
./start-dev.sh
```

### Build for Production
```bash
npm run build
```

### Deploy to Production
```bash
./deploy.sh
```

## Production with PM2

For production deployment with process management:

```bash
# Install PM2 globally
sudo npm install -g pm2 serve

# Build and start with PM2
npm run build
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

## Network Configuration

### Proxmox LXC Container Setup

1. **Container Creation:**
   - Create Ubuntu 22.04 LXC container in Proxmox
   - Allocate at least 2GB RAM and 20GB storage
   - Enable nesting if needed: `Options > Features > Nesting: Yes`

2. **Network Access:**
   - Note your container's IP address: `ip addr show`
   - Access the app at `http://CONTAINER_IP` (production) or `http://CONTAINER_IP:3000` (development)

3. **Firewall Configuration:**
```bash
# Allow HTTP traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp  # Development server
sudo ufw enable
```

### Port Forwarding (Optional)

If you want to access the app from outside your network:

1. **Proxmox Host:**
   - Forward port 80 (or 3000 for dev) to your container IP
   - Example: `iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT --to-destination CONTAINER_IP:80`

2. **Router Configuration:**
   - Forward external port to Proxmox host
   - Configure dynamic DNS if needed

## Troubleshooting

### Common Issues

1. **Firebase Connection Issues:**
   - Verify `.env` file has correct Firebase configuration
   - Check Firebase console for project status
   - Ensure Firestore rules allow authenticated access

2. **Build Errors:**
   - Clear npm cache: `npm cache clean --force`
   - Delete node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`
   - Check Node.js version: `node --version` (should be 18.x+)

3. **Nginx Issues:**
   - Check nginx status: `sudo systemctl status nginx`
   - Test configuration: `sudo nginx -t`
   - Check logs: `sudo tail -f /var/log/nginx/error.log`

4. **Permission Issues:**
   - Ensure project files have correct ownership: `sudo chown -R $USER:$USER /path/to/project`
   - Check nginx user has access to build directory

### Log Locations

- **Nginx logs:** `/var/log/nginx/`
- **PM2 logs:** `pm2 logs`
- **System logs:** `journalctl -u nginx`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `REACT_APP_FIREBASE_API_KEY` | Firebase API Key | Yes |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | Yes |
| `REACT_APP_FIREBASE_PROJECT_ID` | Firebase Project ID | Yes |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | Yes |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID | Yes |
| `REACT_APP_FIREBASE_APP_ID` | Firebase App ID | Yes |
| `REACT_APP_GEMINI_API_KEY` | Gemini API Key for AI features | No |
| `REACT_APP_APP_ID` | Application ID | Yes |

## Security Considerations

1. **Firebase Security Rules:**
   - Implement proper Firestore security rules
   - Use authentication for all data access
   - Separate user data by UID

2. **Environment Variables:**
   - Never commit `.env` files to version control
   - Use different configurations for development/production
   - Regularly rotate API keys

3. **Server Security:**
   - Keep Ubuntu packages updated
   - Configure UFW firewall properly
   - Use HTTPS in production (consider Let's Encrypt)
   - Regular security updates

## Backup Strategy

1. **Database Backup:**
   - Export Firestore data regularly
   - Use Firebase CLI: `firebase firestore:delete --all-collections`

2. **Application Backup:**
   - Backup source code to Git repository
   - Backup environment configuration
   - Document deployment procedures

## Performance Optimization

1. **Build Optimization:**
   - Use `npm run build` for production builds
   - Enable gzip compression in nginx
   - Configure caching headers

2. **Database Optimization:**
   - Use Firestore indexes for complex queries
   - Implement pagination for large datasets
   - Monitor Firestore usage

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Check the [Issues](https://github.com/your-repo/family-task-manager/issues) page
- Create a new issue if your problem isn't already documented
- Include system information and error logs when reporting issues

## Acknowledgments

- React.js for the frontend framework
- Firebase for backend services
- Tailwind CSS for styling
- Google Gemini API for AI features