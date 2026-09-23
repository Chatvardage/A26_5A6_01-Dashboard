FROM node:20-alpine

# Install build tools needed for native node-gyp / AdminJS compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Explicitly allow npm post-install scripts (needed for esbuild binary installation)
ENV NPM_CONFIG_IGNORE_SCRIPTS=false

# Copy package files
COPY package*.json ./

# Clean install to ensure exact lockfile dependencies and complete postinstall scripts
RUN npm ci

# Copy application source
COPY . .

# Set production environment for build step
ENV NODE_ENV=production

# Build the NestJS application (compiles TS and triggers AdminJS bundler if configured)
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]