FROM node:22-alpine
WORKDIR /app
COPY package.json server.js ./
COPY src ./src
COPY data/catalog-generated.json data/catalog-meta.js ./data/
COPY public ./public
COPY scripts ./scripts
RUN mkdir -p data uploads && chown -R node:node /app
USER node
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
