FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --include=dev
COPY src ./src
COPY test ./test
RUN npm run build && node --test test/*.cjs
EXPOSE 4000
CMD ["npm","run","start"]
