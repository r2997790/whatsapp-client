FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Create necessary directories
RUN mkdir -p auth_info_baileys data uploads

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "start"]