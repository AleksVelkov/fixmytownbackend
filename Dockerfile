# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy backend directory
COPY backend/ ./backend/

# Install backend dependencies and build
WORKDIR /app/backend
RUN npm ci --only=production
RUN npm install --only=dev
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]
