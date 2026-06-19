FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

CMD ["sh", "-c", "npx knex migrate:latest --knexfile db/knexfile.js && node index.js"]
