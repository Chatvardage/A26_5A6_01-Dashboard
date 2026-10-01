FROM node:20-alpine AS builder

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

# Generate AdminJS user components before dev dependencies are removed.
RUN node scripts/generate-adminjs.mjs

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
	ADMIN_JS_SKIP_BUNDLE=true \
	NPM_CONFIG_IGNORE_SCRIPTS=false

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.adminjs ./.adminjs

EXPOSE 3000

CMD ["node", "dist/main.js"]
