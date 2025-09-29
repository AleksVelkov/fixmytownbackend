# Use Node.js 20 LTS (recommended by Supabase)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Install all dependencies (production + dev for building)
RUN npm install

# Copy source code
COPY backend/src ./src

# Build the application
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]