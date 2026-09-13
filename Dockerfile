FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node . .

RUN mkdir -p /data && chown node:node /data

VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "const port=process.env.PORT||3000;fetch('http://127.0.0.1:'+port+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

USER node
CMD ["node", "server.js"]
