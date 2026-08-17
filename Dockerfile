# ==========================================
# STAGE 1: Frontend build (Vue/Vite)
# ==========================================
FROM node:22-alpine AS frontend-build
WORKDIR /app

# Copy frontend configuration files
COPY package*.json ./
# Install frontend dependencies
RUN npm install

# Copy all frontend source code
COPY . .
# Build the frontend for production (generates the /dist folder)
RUN npm run build

# ==========================================
# STAGE 2: Backend setup (Express)
# ==========================================
FROM node:22-alpine
WORKDIR /app

# Create the backend directory and copy its package.json
WORKDIR /app/backend
COPY backend/package*.json ./
# Install backend dependencies
RUN npm install

# Copy backend source code
COPY backend/ .

# Copy the compiled frontend ("dist" folder) from Stage 1
COPY --from=frontend-build /app/dist /app/dist

# Expose the server port (configured via .env or defaulting to 3000)
EXPOSE 3000

# Command to start the server
CMD ["node", "server.js"]
