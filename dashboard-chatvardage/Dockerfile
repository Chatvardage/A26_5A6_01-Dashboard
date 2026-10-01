FROM node:20-alpine AS builder

# Install build tools needed for native node-gyp / AdminJS compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# npm ci runs postinstall scripts by default; esbuild needs them to install its binary.
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
	ADMIN_JS_SKIP_BUNDLE=true

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.adminjs ./.adminjs

EXPOSE 3000

CMD ["node", "dist/main.js"]
