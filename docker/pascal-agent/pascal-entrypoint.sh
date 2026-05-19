#!/usr/bin/env bash
# Pascal overlay entrypoint. Wraps the upstream rca-agent entrypoint with
# per-agent MCP-config wiring + a scene-id hint file, then exec's the
# original entrypoint so tmux / ttyd / agent-supervisor come up unchanged.
set -euo pipefail

mkdir -p "${PASCAL_DATA_DIR:-/pascal-data}" 2>/dev/null || true

/usr/local/bin/setup-pascal-mcp.sh

if [ -n "${PASCAL_SCENE_ID:-}" ]; then
  cat > /workspace/PASCAL.md <<EOF
# Pascal scene context

You are connected to the Pascal 3D editor via the \`pascal\` MCP server.

Active scene id: \`${PASCAL_SCENE_ID}\`

Before mutating, call \`pascal.load_scene\` with id \`${PASCAL_SCENE_ID}\`.
Mutations land in the SQLite store at \`${PASCAL_DATA_DIR:-/pascal-data}/pascal.db\`
and stream live to the user's 3D viewer via SSE.
EOF
fi

exec /usr/local/bin/entrypoint.sh "$@"
