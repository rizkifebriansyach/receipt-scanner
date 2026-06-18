FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

CMD ["sh", "-c", "npx knex migrate:latest && node index.js"]
