#!/usr/bin/env bash
# Write the per-agent MCP config file that registers the `pascal` stdio
# server. Runs once at container start, before tmux/ttyd come up.
set -euo pipefail

KIND="${AGENT_KIND:-shell}"
DATA_DIR="${PASCAL_DATA_DIR:-/pascal-data}"
HOME_DIR="${HOME:-/home/agent}"

write_json_mcp() {
  # $1 = absolute path to JSON config file
  # $2 = optional `type` field (e.g. "stdio") — empty to omit
  local cfg="$1"
  local type_field="${2:-}"
  mkdir -p "$(dirname "$cfg")"
  [ -f "$cfg" ] || echo '{}' > "$cfg"
  local tmp
  tmp="$(mktemp)"
  if [ -n "$type_field" ]; then
    jq --arg dir "$DATA_DIR" --arg t "$type_field" '
      .mcpServers = (.mcpServers // {}) |
      .mcpServers.pascal = {
        "type": $t,
        "command": "pascal-mcp",
        "args": [],
        "env": { "PASCAL_DATA_DIR": $dir }
      }
    ' "$cfg" > "$tmp"
  else
    jq --arg dir "$DATA_DIR" '
      .mcpServers = (.mcpServers // {}) |
      .mcpServers.pascal = {
        "command": "pascal-mcp",
        "args": [],
        "env": { "PASCAL_DATA_DIR": $dir }
      }
    ' "$cfg" > "$tmp"
  fi
  mv "$tmp" "$cfg"
}

case "$KIND" in
  claude)
    # Claude Code reads user-level config from ~/.claude.json.
    write_json_mcp "$HOME_DIR/.claude.json" "stdio"
    ;;
  codex)
    # Codex CLI reads ~/.codex/config.toml. Append the pascal section iff
    # not already present (TOML; jq cannot help here).
    cfg="$HOME_DIR/.codex/config.toml"
    mkdir -p "$(dirname "$cfg")"
    touch "$cfg"
    if ! grep -q '^\[mcp_servers\.pascal\]' "$cfg"; then
      cat >> "$cfg" <<EOF

[mcp_servers.pascal]
command = "pascal-mcp"

[mcp_servers.pascal.env]
PASCAL_DATA_DIR = "$DATA_DIR"
EOF
    fi
    ;;
  gemini)
    # Gemini CLI reads ~/.gemini/settings.json.
    write_json_mcp "$HOME_DIR/.gemini/settings.json" ""
    ;;
  copilot)
    # GitHub Copilot CLI MCP config location is still in flux upstream.
    # ~/.copilot/mcp.json is the most commonly cited path at the time of
    # writing — verify against `copilot --help` if registration silently
    # fails.
    write_json_mcp "$HOME_DIR/.copilot/mcp.json" "stdio"
    ;;
  shell|*)
    # Nothing to do for plain shell sessions.
    ;;
esac
