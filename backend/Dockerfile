# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy root package.json and install root dependencies
COPY package*.json ./
RUN npm install

# Copy backend directory
COPY backend/ ./backend/

# Install backend dependencies and build
WORKDIR /app/backend
RUN npm install
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]
