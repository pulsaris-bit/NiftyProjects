# --- Build Stage ---
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all dependencies (needed for building frontend)
RUN npm install

# Copy source code and build frontend
COPY . .
RUN npm run build

# --- App Stage ---
FROM node:20-slim

WORKDIR /app

# Install build dependencies again for native modules in the final image
# This is necessary because npm install --production will build better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --production

# If you want to use tsx in production, you can install it or keep it as a dependency
# Since it is a devDependency, it won't be installed with --production.
# We'll install it globally or add it to dependencies.
RUN npm install -g tsx

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy server source
COPY --from=builder /app/server.ts ./

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

ENV NODE_ENV=production

# Start the application
CMD ["tsx", "server.ts"]
