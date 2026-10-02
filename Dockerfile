FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4174 SETUPNINJA_DATA_DIR=/var/lib/setupninja
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force && mkdir -p /var/lib/setupninja && chown node:node /var/lib/setupninja
COPY --from=build /app/server ./server
COPY --from=build /app/data/products.json /app/data/scrape-report.json /app/data/categories.json ./data/
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4174
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4174/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
