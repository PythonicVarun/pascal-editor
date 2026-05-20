#!/usr/bin/env bash
# Write the per-agent MCP config file that registers the `pascal` stdio
# server. Runs once at container start, before tmux/ttyd come up.
set -euo pipefail

KIND="${AGENT_KIND:-shell}"
DATA_DIR="${PASCAL_DATA_DIR:-/pascal-data}"
HOME_DIR="${HOME:-/home/agent}"

write_json_mcp() {
  # $1 = absolute path to JSON config file
  # $2 = optional `type` field (e.g. "stdio", "local") — empty to omit
  # $3 = if "yes", include `"tools": ["*"]` (required by Copilot CLI)
  local cfg="$1"
  local type_field="${2:-}"
  local include_tools="${3:-}"
  mkdir -p "$(dirname "$cfg")"
  [ -f "$cfg" ] || echo '{}' > "$cfg"
  local tmp
  tmp="$(mktemp)"
  jq \
    --arg dir "$DATA_DIR" \
    --arg t "$type_field" \
    --arg with_tools "$include_tools" '
      .mcpServers = (.mcpServers // {}) |
      .mcpServers.pascal = (
        { "command": "pascal-mcp", "args": [], "env": { "PASCAL_DATA_DIR": $dir } }
        + (if $t == "" then {} else { "type": $t } end)
        + (if $with_tools == "yes" then { "tools": ["*"] } else {} end)
      )
    ' "$cfg" > "$tmp"
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
    # GitHub Copilot CLI reads ~/.copilot/mcp-config.json (overridable
    # via COPILOT_HOME). It requires `type: "local"` for stdio servers
    # and a `tools` allowlist — without `tools` Copilot won't load the
    # server. We allow `*` since pascal-mcp is the trusted local server
    # we just installed.
    cfg_dir="${COPILOT_HOME:-$HOME_DIR/.copilot}"
    write_json_mcp "$cfg_dir/mcp-config.json" "local" "yes"
    ;;
  shell|*)
    # Nothing to do for plain shell sessions.
    ;;
esac
