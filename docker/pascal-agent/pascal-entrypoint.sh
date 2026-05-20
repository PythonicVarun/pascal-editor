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

You are working inside a sandboxed agent container that is connected to a
live instance of the **Pascal 3D editor** through the \`pascal\` MCP
server. A human user is watching a browser tab that renders the same
scene you mutate. Your job is to read their request, change the scene
through MCP tools, and verify visually.

## Session bindings

- **Active scene id**: \`${PASCAL_SCENE_ID}\`
- **SQLite store**: \`${PASCAL_DATA_DIR:-/pascal-data}/pascal.db\`
  (shared bind mount with the editor process; do not edit directly)
- **Editor URL** (for capture_viewer callbacks): \`${PASCAL_EDITOR_URL:-http://host.docker.internal:3002}\`

The MCP server auto-binds to \`PASCAL_SCENE_ID\` at startup, so the
bridge is already loaded with the user's scene. **Do not call
\`pascal.load_scene\` first** unless you have switched away and need to
return — calling it just to "be safe" is wasted work.

## How mutations reach the viewer

1. You call a mutation tool (\`create_room\`, \`place_item\`, \`apply_patch\`,
   …).
2. The MCP server applies it to the in-memory bridge AND publishes a
   snapshot to the SQLite store with the active scene id + version.
3. The editor's Next.js route streams that snapshot over SSE to every
   open browser tab on that scene — the 3D viewer re-renders within a
   frame or two.

If the viewer does not change after a mutation, the most likely cause is
that the bridge lost its active-scene binding. Call \`pascal.get_scene\`
or \`pascal.list_levels\` — if \`activeSceneId\` is \`null\`, re-bind by
calling \`pascal.load_scene\` with id \`${PASCAL_SCENE_ID}\`.

## Pitfalls

- \`create_from_template\` / \`generate_variants\` accept a \`save\`
  argument. With the default \`save: false\` they apply to the bridge
  only; in *this* container that still publishes to the active scene
  (the binding is preserved), but if you pass \`save: true\` you will
  *create a new scene* and the user's current tab will no longer be the
  one you are editing. Prefer \`save: false\` unless the user explicitly
  asked for a new scene/project.
- The user's tab must actually be open on \`/agent/${PASCAL_SCENE_ID}\`
  for \`capture_viewer\` to work — capture is a round-trip through the
  editor. If you get a 503 from \`capture_viewer\`, the tab is closed.
- \`PASCAL_DATA_DIR\` is bind-mounted from the host; mutations persist
  across container restarts. Treat the database as shared state with the
  user.

## Verifying visually

After every batch of mutations call \`pascal.capture_viewer\` with one of:

- \`current\` — whatever angle the user is looking at (best for matching
  what they see).
- \`top\` — plan view, good for checking footprint, room layouts, wall
  intersections.
- \`front\` — elevation, good for window/door heights and storey rises.
- \`iso\` — orthographic 3/4, good for overall massing.
- \`perspective\` — perspective 3/4, good for "does this feel right."

Use the image to verify placement, scale, and orientation before
declaring work done. Do **not** rely on tool result JSON alone — a tool
can succeed structurally while producing geometry that is wrong in
practice (e.g. negative-area polygons, overlapping walls, items sunk
into the slab). \`pascal.verify_scene\` complements the visual: it
returns layout issues and validation errors.

## Coordinate conventions

- Units: **meters**. Right-handed coords; +Y is up.
- 2D polygons (floor footprints, slabs, ceilings, zones) live in the
  XZ-plane and are passed as \`[[x, z], …]\` arrays.
- Wall thickness, room heights, item rotations all default to sensible
  values — only override when the user asks for something specific.

## Working style

- Read the user's request, then sketch a plan in 1–3 lines before
  calling tools. Don't narrate every tool call.
- Batch logically related edits with \`apply_patch\` when you can —
  atomic, undoable, single SSE event.
- After each meaningful change: capture, look, decide if it matches
  intent, iterate. Stop when the user's request is met.
EOF
fi

exec /usr/local/bin/entrypoint.sh "$@"
