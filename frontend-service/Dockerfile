# Frontend Dockerfile  
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY frontend-service/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy frontend source
COPY frontend-service/ ./

# Copy root files (like index.html)
COPY *.html ./

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]