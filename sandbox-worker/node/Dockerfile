FROM node:20.19.4-bookworm-slim

# Install pinned TypeScript compiler globally so TS checks require zero network access
RUN npm install -g typescript@5.9.3 && npm cache clean --force

# Create unprivileged user and restricted mountpoints
RUN groupadd -g 65534 sandboxgroup || true \
    && useradd -u 65534 -g 65534 -M -s /usr/sbin/nologin sandboxuser || true \
    && mkdir -p /runner /workspace \
    && chmod 0755 /runner /workspace

COPY runner.mjs /runner/runner.mjs
RUN chmod 0555 /runner/runner.mjs

USER 65534:65534
WORKDIR /workspace

ENV HOME=/nonexistent \
    NODE_NO_WARNINGS=1

ENTRYPOINT ["node", "/runner/runner.mjs"]
