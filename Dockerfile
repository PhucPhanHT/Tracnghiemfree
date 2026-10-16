FROM node:20-bookworm-slim

WORKDIR /app

# Install build tools for native addons
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install && npm rebuild sqlite3 --build-from-source

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
