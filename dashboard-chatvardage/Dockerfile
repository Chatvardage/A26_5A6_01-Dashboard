FROM node:22-alpine AS builder

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
# Bundling only: no microservice is called (verified with fetch disabled).
RUN node scripts/generate-adminjs.mjs

FROM node:22-alpine AS production-deps

WORKDIR /app

ENV NODE_ENV=production \
	ADMIN_JS_SKIP_BUNDLE=true

COPY package*.json ./

RUN npm ci --omit=dev

# Le bundle AdminJS est déjà produit : esbuild et npm sont inutiles au runtime.
RUN find node_modules/@esbuild -type f -name esbuild -delete \
    && rm -f node_modules/esbuild/bin/esbuild \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Copier uniquement les dépendances nettoyées : les outils de compilation
# ne doivent pas rester récupérables dans une couche antérieure du runtime.
FROM node:22-alpine AS runtime
RUN apk upgrade --no-cache
WORKDIR /app
ENV NODE_ENV=production ADMIN_JS_SKIP_BUNDLE=true
COPY package*.json ./
COPY --from=production-deps /app/node_modules ./node_modules
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
    && test ! -e node_modules/@esbuild/linux-x64/bin/esbuild

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.adminjs ./.adminjs

EXPOSE 3000

# Utilisateur non privilegie fourni par l image node (fichiers en lecture seule suffisent).
USER node

CMD ["node", "dist/main.js"]
