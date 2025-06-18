# WhatsApp Web Client

A comprehensive WhatsApp messenger client built with Baileys API that allows you to send live messages to individuals and groups with advanced features.

## Features

### Core Messaging
- ✅ Real-time messaging to individuals and groups
- ✅ Send text messages, images, videos, documents, and audio files
- ✅ Message status indicators (sent, delivered, read)
- ✅ Typing indicators
- ✅ QR code authentication
- ✅ Auto-reconnection

### Advanced Features
- ✅ **Message Templates**: Create and manage reusable message templates with variables
- ✅ **Contact Groups**: Organize contacts into groups for bulk messaging
- ✅ **Bulk Messaging**: Send messages to multiple recipients with customizable delays
- ✅ **File Uploads**: Support for images, videos, documents, and audio files (up to 50MB)
- ✅ **Template Variables**: Dynamic content replacement in templates
- ✅ **Contact Management**: View and search through all WhatsApp contacts
- ✅ **Group Management**: Access to all WhatsApp groups
- ✅ **Message History**: Store and display conversation history
- ✅ **Responsive Design**: Works on desktop and mobile devices

### User Interface
- ✅ Modern WhatsApp-like interface
- ✅ Real-time updates via WebSocket
- ✅ Search functionality for contacts, groups, and chats
- ✅ File preview before sending
- ✅ Progress indicators for bulk operations
- ✅ Toast notifications for success/error messages
- ✅ Dark mode support

## Installation

1. **Clone or extract the project**
   ```bash
   cd whatsapp-client
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

4. **Access the application**
   Open your browser and go to `http://localhost:3000`

## Usage

### Initial Setup
1. Start the application
2. Scan the QR code with your WhatsApp mobile app
3. Once connected, your contacts and groups will be automatically loaded

### Sending Messages
1. Select a contact or group from the sidebar
2. Type your message in the input field
3. Press Enter or click the send button

### Using Templates
1. Go to the "Tools" tab in the sidebar
2. Click "Add Template" to create a new message template
3. Use `{{variable}}` syntax for dynamic content
4. Save and use templates for quick messaging

### Bulk Messaging
1. Go to Tools → Bulk Messaging
2. Select recipients (individual contacts, contact groups, or WhatsApp groups)
3. Choose between custom message or template
4. Set delay between messages
5. Send to all selected recipients

### File Sharing
1. Click the attachment button (📎) in the message input
2. Select your file (images, videos, documents, audio)
3. Add an optional caption
4. Send the file

## API Endpoints

### Authentication & Status
- `GET /api/status` - Get connection status and QR code
- `GET /api/qr` - Get current QR code

### Contacts & Groups
- `GET /api/contacts` - Get all contacts
- `GET /api/groups` - Get all groups

### Messaging
- `POST /api/send-message` - Send a single message
- `POST /api/send-bulk` - Send bulk messages
- `POST /api/send-template` - Send message using template
- `GET /api/messages/:chatId` - Get message history

### File Upload
- `POST /api/upload` - Upload file for sharing

### Templates
- `GET /api/templates` - Get all templates
- `POST /api/templates` - Create new template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template

### Contact Groups
- `GET /api/contact-groups` - Get all contact groups
- `POST /api/contact-groups` - Create new contact group
- `PUT /api/contact-groups/:id` - Update contact group
- `DELETE /api/contact-groups/:id` - Delete contact group

## Configuration

### Environment Variables
- `PORT` - Server port (default: 3000)

### File Upload Limits
- Maximum file size: 50MB
- Supported formats: All common image, video, document, and audio formats

### Message Delays
- Recommended delay for bulk messaging: 1000ms (1 second)
- Minimum delay: 500ms
- Maximum delay: 5000ms

## Data Storage

The application stores data in the following locations:
- `./auth_info_baileys/` - WhatsApp authentication data
- `./data/templates.json` - Message templates
- `./data/contact-groups.json` - Contact groups
- `./data/messages.json` - Message history
- `./uploads/` - Uploaded files
- `./baileys_store_multi.json` - WhatsApp store data

## Security Notes

1. **Authentication Data**: The `auth_info_baileys` folder contains sensitive authentication data. Keep it secure.
2. **File Uploads**: Files are stored locally in the `uploads` directory.
3. **API Access**: Consider implementing authentication for production use.
4. **CORS**: Currently configured to allow all origins for development.

## Troubleshooting

### Connection Issues
- Ensure your phone has internet connectivity
- Try refreshing the QR code if it expires
- Check if WhatsApp Web is already connected on another device

### Message Sending Failures
- Verify the recipient's phone number format
- Check if the contact exists in your WhatsApp
- Ensure you have an active internet connection

### File Upload Issues
- Check file size (must be under 50MB)
- Verify file format is supported
- Ensure sufficient disk space

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Mobile Support

The application is responsive and works on mobile devices, though the desktop experience is recommended for bulk operations.

## License

MIT License - Feel free to use this project for personal or commercial purposes.

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify all dependencies are installed correctly
3. Ensure WhatsApp is properly connected
4. Check server logs for detailed error information

## Features in Detail

### Message Templates
- Create reusable message templates
- Support for variables using `{{variable}}` syntax
- Easy template management (create, edit, delete)
- Quick template usage in conversations

### Contact Groups
- Organize contacts into custom groups
- Use groups for targeted bulk messaging
- Easy group management interface
- Visual contact selection

### Bulk Messaging
- Send to multiple recipients simultaneously
- Support for individual contacts, contact groups, and WhatsApp groups
- Customizable delays between messages
- Template-based bulk messaging
- Progress tracking and result reporting

### File Management
- Upload and send various file types
- File preview before sending
- Progress indicators for uploads
- Automatic file type detection
- Caption support for media files

This WhatsApp client provides a complete solution for personal and business messaging needs with advanced automation features.
