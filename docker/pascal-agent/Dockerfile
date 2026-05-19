# Pascal-agent overlay. The MCP tarball at ./out/pascal-app-mcp.tgz is
# produced on the host by `setup:pascal-agent` (which runs
# scripts/prepare-mcp-tarball.mjs) — the host already has the workspace
# resolved, so we don't fight npm-vs-bun-workspace semantics inside Docker.

ARG RCA_AGENT_TAG=latest
FROM rca-agent:${RCA_AGENT_TAG}

USER root

# Bun is required at runtime: the @pascal-app/mcp binary shebang is
# `#!/usr/bin/env bun`. The base image already has Node 20 + jq.
ENV BUN_INSTALL=/usr/local/bun
RUN curl -fsSL https://bun.sh/install | bash \
  && ln -sf /usr/local/bun/bin/bun /usr/local/bin/bun \
  && ln -sf /usr/local/bun/bin/bunx /usr/local/bin/bunx

# Install the locally-packed MCP tarball instead of the published one so
# the container always matches the editor it talks back to.
COPY out/pascal-app-mcp.tgz /tmp/pascal-app-mcp.tgz
RUN npm install -g --no-fund --no-audit --legacy-peer-deps /tmp/pascal-app-mcp.tgz \
  && rm /tmp/pascal-app-mcp.tgz

COPY docker/pascal-agent/pascal-entrypoint.sh /usr/local/bin/pascal-entrypoint.sh
COPY docker/pascal-agent/setup-pascal-mcp.sh  /usr/local/bin/setup-pascal-mcp.sh
RUN chmod +x /usr/local/bin/pascal-entrypoint.sh /usr/local/bin/setup-pascal-mcp.sh

# Pre-create the SQLite bind-mount target so the entrypoint doesn't have to
# escalate to mkdir it at boot under the unprivileged agent user. The runtime
# bind mount overlays this with the host's Pascal data dir.
RUN mkdir -p /pascal-data && chown agent:agent /pascal-data

USER agent

ENV PASCAL_DATA_DIR=/pascal-data

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/pascal-entrypoint.sh"]
