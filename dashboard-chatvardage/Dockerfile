FROM node:20-alpine

# Install build dependencies required for compiling AdminJS UI components
RUN apk add --no-cache python3 make g++ 

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies (works safely even without a package-lock.json)
RUN npm install

# Copy the rest of your local repository files
COPY . .

EXPOSE 3000

# Start your application (Adjust "app.js" if your main file is named server.js, index.js, etc.)
CMD ["node", "app.js"]
