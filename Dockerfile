# Use Node base image
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build frontend
COPY . .
RUN npm run build

# Production image
FROM node:20-slim

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --production

# Install SQLite dependencies specifically for better-sqlite3 if needed
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
# Re-install better-sqlite3 to ensure it's compiled for the container OS
RUN npm install better-sqlite3

# Copy build artifacts and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/package.json ./

# Expose port
EXPOSE 3000

ENV NODE_ENV=production

# Start the application (using tsx to run server.ts directly or compile it)
# For simplicity in this environment we use tsx which is already installed
RUN npm install -g tsx
CMD ["tsx", "server.ts"]
