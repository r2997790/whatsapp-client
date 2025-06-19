# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY backend-service/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY backend-service/ ./

# Create auth directory
RUN mkdir -p auth_info_baileys

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]