FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./
ENV NODE_ENV=production PORT=8080 STORAGE_DIR=/data
# Runs as the unprivileged `node` user; /data is the mounted volume.
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1
CMD ["node", "server.mjs"]
