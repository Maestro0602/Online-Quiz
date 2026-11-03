# Multi-stage Dockerfile for qiuizez
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace package manifests
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install all dependencies including devDependencies for compilation
RUN npm install

# Copy all source files
COPY shared ./shared
COPY server ./server
COPY client ./client

# Compile packages in dependency order
RUN npm --workspace=shared run build
RUN npm --workspace=client run build
RUN npm --workspace=server run build

# Production runner image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy workspace manifests
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install production dependencies
RUN npm install --omit=dev

# Copy compiled artifacts
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/dist ./server/dist

EXPOSE 3001

CMD ["npm", "--workspace=server", "run", "start"]

