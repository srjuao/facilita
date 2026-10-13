FROM node:20-alpine AS build

WORKDIR /app

# Prisma detects the installed OpenSSL version when it generates its native
# engine. Alpine's Node image does not include it by default.
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

# Keep the matching runtime library in the final image as well.
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist

RUN mkdir /app/uploads && chown -R node:node /app
USER node

EXPOSE 3001

CMD ["node", "dist/index.js"]
