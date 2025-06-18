# WhatsApp Web Client

A complete WhatsApp Web Client built with Baileys library for real-time messaging capabilities.

## Features

- ✅ QR Code Authentication
- ✅ Real-time Connection Status
- ✅ Individual Message Sending
- ✅ Bulk Message Broadcasting
- ✅ Modern Responsive UI
- ✅ Socket.io Real-time Communication
- ✅ Message Delivery Tracking
- ✅ Auto-reconnection
- ✅ Session Persistence

## Architecture

### Backend Service (`backend-service/`)
- Node.js + Express server
- Baileys WhatsApp Web API integration
- Socket.io for real-time communication
- QR code generation
- Message handling and delivery

### Frontend Service (`frontend-service/`)
- Static HTML/CSS/JS interface served from root
- Real-time status updates
- Clean, mobile-responsive design
- Individual and bulk messaging interfaces

## Deployment Structure

```
whatsapp-web-client/
├── backend-service/
│   ├── server.js           # Main backend server
│   ├── package.json        # Backend dependencies
│   ├── Dockerfile          # Container configuration
│   └── .gitignore          # Git exclusions
├── frontend-service/
│   ├── app.js             # Frontend server (serves from parent dir)
│   ├── package.json       # Frontend dependencies
│   └── .gitignore         # Git exclusions
├── index.html             # Main web interface (ROOT LEVEL)
├── README.md              # This file
└── DEPLOYMENT-SUMMARY.md  # Deployment instructions
```

## Railway Deployment

### Backend Service (whatsapp-service)
1. Create/update repository with `backend-service/` contents
2. Deploy to Railway service: `whatsapp-service`
3. Environment variables:
   - `NODE_ENV=production`
   - `PORT=3000`

### Frontend Service (whatsapp-client)
1. Create/update repository with `frontend-service/` contents
2. Ensure `index.html` is in the root directory
3. Deploy to Railway service: `whatsapp-client`
4. Environment variables:
   - `NODE_ENV=production`
   - `PORT=3000`

## Usage Instructions

1. **Connect to WhatsApp:**
   - Visit the frontend URL
   - Click "Connect WhatsApp"
   - Scan QR code with WhatsApp mobile app
   - Wait for "Connected" status

2. **Send Individual Messages:**
   - Use format: `1234567890@s.whatsapp.net`
   - Enter your message
   - Click "Send Message"

3. **Send Bulk Messages:**
   - Enter multiple numbers (one per line)
   - Type your bulk message
   - Click "Send Bulk Message"

## Phone Number Formats

- **Individual contacts:** `1234567890@s.whatsapp.net`
- **Group chats:** `group_id@g.us`
- **Always include country code (without +)**

## Development

### Local Setup

Backend:
```bash
cd backend-service
npm install
npm start
```

Frontend:
```bash
cd frontend-service
npm install
npm start
```

### Environment Variables for Local Development
```env
# Backend (.env)
PORT=3001
NODE_ENV=development

# Frontend (.env)
PORT=3000
NODE_ENV=development
```

## Dependencies

### Backend
- `@whiskeysockets/baileys` - WhatsApp Web API
- `express` - Web server
- `socket.io` - Real-time communication
- `qrcode` - QR code generation
- `cors` - Cross-origin requests

### Frontend
- `express` - Static file server
- `socket.io-client` - Real-time client (CDN)
- Font Awesome - Icons (CDN)

## Security Features

- Session persistence in secure storage
- Rate limiting for bulk messages
- CORS configuration
- Error handling and recovery
- Health check endpoints

## Monitoring

- Backend health: `GET /health`
- Frontend health: `GET /health`
- Connection status: `GET /api/status`
- QR code endpoint: `GET /api/qr`

## Troubleshooting

### QR Code Not Appearing
1. Check backend service logs
2. Verify services are running
3. Click "Connect WhatsApp" again

### Connection Issues
1. Verify both services deployed
2. Check Railway service status
3. Review application logs

### Message Sending Fails
1. Ensure WhatsApp is connected (green status)
2. Verify phone number format
3. Check rate limiting

## Created: June 18, 2025
## Last Updated: June 18, 2025

Files ready for GitHub deployment!
