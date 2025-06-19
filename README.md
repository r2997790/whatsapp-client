# WhatsApp Bulk Messaging Client

A web-based WhatsApp messaging client that uses the Baileys API to send direct messages to WhatsApp users without requiring the WhatsApp Business API.

## Features

- 📱 **QR Code Authentication** - Scan QR code with your WhatsApp mobile app
- 💬 **Single Messages** - Send individual messages to specific numbers
- 📨 **Bulk Messaging** - Send the same message to multiple recipients
- 👥 **Group Messaging** - Send messages to WhatsApp groups
- 📊 **Results Tracking** - Track successful and failed message deliveries
- 🔄 **Real-time Status** - Live connection status updates
- 🌐 **Web Interface** - Easy-to-use web dashboard
- 🛡️ **Anti-Loop Protection** - Built-in safeguards against connection loops

## Quick Start

### Option 1: Deploy to Railway (Recommended)

1. **Fork this repository**
2. **Deploy to Railway:**
   - Connect your GitHub account to Railway
   - Create a new project from your forked repository
   - Railway will automatically detect and deploy the application

3. **Access your deployed app:**
   - Open the Railway-provided URL
   - Click "Connect WhatsApp"
   - Scan the QR code with your WhatsApp mobile app
   - Start sending messages!

### Option 2: Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/r2997790/whatsapp-client.git
   cd whatsapp-client
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open your browser:**
   ```
   http://localhost:3000
   ```

## How to Use

### 1. Connect WhatsApp
- Click the "Connect WhatsApp" button
- Wait for the QR code to appear
- Open WhatsApp on your mobile device
- Go to Settings → Linked Devices → Link a Device
- Scan the QR code shown on the website

### 2. Send Single Messages
- Navigate to the "Single Message" tab
- Enter the phone number (with country code, without +)
- Type your message
- Click "Send Message"

### 3. Send Bulk Messages
- Navigate to the "Bulk Messages" tab
- Enter phone numbers (one per line, with country code)
- Type your message
- Click "Send Bulk Messages"

### 4. Send Messages to WhatsApp Groups

The application now supports sending messages to WhatsApp groups! Here are the methods:

#### Method 1: Using Group Phone Number Format
Some groups have a phone number format that can be used directly:
- Look for the group's phone number in group info
- Use it like a regular phone number in the forms
- Format: `[countrycode][groupnumber]` (without + symbol)

#### Method 2: Using Group ID from WhatsApp Web
1. Open WhatsApp Web in your browser
2. Click on the group you want to message
3. Look at the URL - it will contain the group ID
4. Group ID format: `[numbers]@g.us`
5. Use the Group ID in the phone number field

**Example:** If URL shows `120363123456789@g.us`, use that in the phone number field

#### Important Notes for Group Messaging:
- ⚠️ You must be an admin or have permission to send messages to the group
- ⚠️ Some groups may have restrictions on who can send messages
- ⚠️ Group messaging follows the same rate limits as individual messages
- ⚠️ Test with a single message first before sending bulk messages to groups

#### Tips for Group Messaging:
- Always verify the group ID is correct with a test message
- Consider the time zones of group members
- Keep messages relevant and respectful to the group's purpose
- Use bulk messaging sparingly to avoid being flagged as spam

### 5. View Results
- Check the "Results" tab to see delivery status
- View statistics for successful and failed deliveries
- Clear results when needed

## Phone Number Format

Always include the country code without the + symbol:
- ✅ Correct: `1234567890` (US number)
- ✅ Correct: `441234567890` (UK number)
- ✅ Correct: `120363123456789@g.us` (WhatsApp group)
- ❌ Wrong: `+1234567890`
- ❌ Wrong: `01234567890` (missing country code)

## Technical Details

### Built With
- **Backend:** Node.js + Express
- **WhatsApp API:** @whiskeysockets/baileys
- **Real-time Communication:** Socket.io
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Deployment:** Railway Platform

### Environment Variables
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (production/development)

### Authentication Storage
- WhatsApp session data is stored in `/tmp/auth_info_baileys/`
- On Railway's ephemeral filesystem, you'll need to re-scan QR code after each deployment
- For persistent storage, consider upgrading to Railway Pro with volume mounts

## Recent Updates

### Version 1.1.0
- ✅ **Fixed:** Network error "Cannot read properties of undefined (reading 'target')" during bulk messaging
- ✅ **Added:** Complete WhatsApp Groups messaging support with detailed guide
- ✅ **Improved:** Tab switching logic to prevent JavaScript errors
- ✅ **Enhanced:** User interface with dedicated Groups Guide tab

## Important Notes

⚠️ **Terms of Service Compliance**
- This tool is for legitimate messaging purposes only
- Respect WhatsApp's Terms of Service and anti-spam policies
- Don't send unsolicited messages or spam
- Use responsibly and in compliance with local laws

⚠️ **Rate Limiting**
- The application includes built-in delays between bulk messages
- Sending too many messages quickly may result in temporary blocks
- Start with small batches to test delivery rates

⚠️ **Session Management**
- Your WhatsApp session will persist until logout or deployment restart
- On Railway, you may need to re-authenticate after deployments
- Keep your mobile device connected to maintain the session

## Troubleshooting

### QR Code Not Appearing
1. Check the debug console for error messages
2. Ensure your Railway deployment is successful
3. Try refreshing the page and clicking "Connect WhatsApp" again
4. Check the server logs in Railway dashboard

### Messages Not Sending
1. Verify phone number format (country code without +)
2. Ensure WhatsApp connection is active (green status)
3. Check if the recipient number exists on WhatsApp
4. Try sending a single message first before bulk sending

### Group Messages Not Working
1. Verify you have permission to send messages to the group
2. Check if the group ID format is correct (`[numbers]@g.us`)
3. Ensure you're a member of the group
4. Test with a single message before bulk sending

### Connection Issues
1. Check your internet connection
2. Verify Railway deployment status
3. Try disconnecting and reconnecting WhatsApp
4. Check Railway service logs for errors
5. Use the "Reset Connection" button if QR scan fails repeatedly

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Railway deployment logs
3. Open an issue on GitHub with detailed error information

## License

This project is for educational and legitimate business use only. Please comply with WhatsApp's Terms of Service and local regulations.

---

**Disclaimer:** This tool is not affiliated with WhatsApp Inc. Use responsibly and in accordance with WhatsApp's Terms of Service.