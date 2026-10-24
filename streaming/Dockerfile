# Zero dependencies, so there is no install step and nothing to cache.
FROM node:20-alpine
WORKDIR /app
COPY package.json server.js auth.js gcs.js signing.js ./
# Cloud Run sets PORT; 8080 is its default and what the server falls back to.
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server.js"]
