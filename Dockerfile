FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    SHOPIFY_FLAG_HOST=0.0.0.0 \
    SHOPIFY_FLAG_PORT=3000 \
    SHOPIFY_FLAG_LIVE_RELOAD=off \
    SHOPIFY_FLAG_NO_COLOR=1

RUN npm install --global @shopify/cli@4.8.0 \
    && npm cache clean --force

WORKDIR /theme

COPY --chown=node:node . .
COPY docker-entrypoint.sh /usr/local/bin/gamehub-entrypoint

RUN chmod +x /usr/local/bin/gamehub-entrypoint

EXPOSE 3000

USER node

ENTRYPOINT ["gamehub-entrypoint"]
CMD ["shopify", "theme", "dev"]
