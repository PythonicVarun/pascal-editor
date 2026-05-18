ARG RCA_AGENT_TAG=latest
FROM rca-agent:${RCA_AGENT_TAG}

USER root

# Bun is required at runtime: the @pascal-app/mcp binary shebang is
# `#!/usr/bin/env bun`. The base image already has Node 20 + jq.
ENV BUN_INSTALL=/usr/local/bun
RUN curl -fsSL https://bun.sh/install | bash \
  && ln -sf /usr/local/bun/bin/bun /usr/local/bin/bun \
  && ln -sf /usr/local/bun/bin/bunx /usr/local/bin/bunx

# Pascal MCP server, installed globally via npm so `pascal-mcp` lands on PATH.
RUN npm install -g --no-fund --no-audit @pascal-app/mcp@0.2.0

COPY pascal-entrypoint.sh /usr/local/bin/pascal-entrypoint.sh
COPY setup-pascal-mcp.sh  /usr/local/bin/setup-pascal-mcp.sh
RUN chmod +x /usr/local/bin/pascal-entrypoint.sh /usr/local/bin/setup-pascal-mcp.sh

# Drop back to the non-root agent user the base image set up.
USER agent

# Default bind-mount target for the Pascal SQLite store. Override via
# containerEnv on the session-create API to point elsewhere.
ENV PASCAL_DATA_DIR=/pascal-data

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/pascal-entrypoint.sh"]
