#!/usr/bin/env bash
# Pascal overlay entrypoint. Wraps the upstream rca-agent entrypoint with
# per-agent MCP-config wiring + a scene-id hint file, then exec's the
# original entrypoint so tmux / ttyd / agent-supervisor come up unchanged.
set -euo pipefail

mkdir -p "${PASCAL_DATA_DIR:-/pascal-data}" 2>/dev/null || true

# Mirror the HOME-normalization the upstream rca-agent entrypoint does
# *after* us — otherwise setup-pascal-mcp.sh writes the per-agent MCP
# config to a HOME the upstream entrypoint is about to throw away (when
# the inherited HOME is missing or unwritable, e.g. HOME=/rca-home set by
# the backend with no host-side bind mount). Without this, the agent CLI
# starts with a fresh /tmp HOME and never sees the pascal MCP server.
CURRENT_HOME="${HOME:-}"
if [[ -z "$CURRENT_HOME" || ! -d "$CURRENT_HOME" || ! -w "$CURRENT_HOME" ]]; then
  HOME="$(mktemp -d /tmp/rca-home.XXXXXX)"
  export HOME
fi

/usr/local/bin/setup-pascal-mcp.sh

if [ -n "${PASCAL_SCENE_ID:-}" ]; then
  cat > /workspace/AGENTS.md <<EOF
# Pascal scene context

You are connected to the Pascal 3D editor via the \`pascal\` MCP server.

Active scene id: \`${PASCAL_SCENE_ID}\`

Before mutating, call \`pascal.load_scene\` with id \`${PASCAL_SCENE_ID}\`.
Mutations land in the SQLite store at \`${PASCAL_DATA_DIR:-/pascal-data}/pascal.db\`
and stream live to the user's 3D viewer via SSE.

After any mutation, call \`pascal.capture_viewer\` with \`view\` ∈
\`current|top|front|iso|perspective\` to see a PNG of what the user is
currently looking at — use it to verify placement, scale, and orientation
visually before continuing.
EOF
fi

exec /usr/local/bin/entrypoint.sh "$@"
