#!/usr/bin/env bash
# Boot the full Pascal stack in one terminal:
#   - editor (Next.js, :3002 — apps/editor's configured port)
#   - agent-runner (services/agent-runner, :4000)
#
# Prereqs handled lazily:
#   - pascal-agent:latest Docker image (built via setup:pascal-agent if missing)
#   - services/agent-runner/node_modules (installed by dev:agent-runner)
#
# Ctrl-C kills both subtrees. Each child's stdout/stderr is prefixed so a
# single terminal stays readable.

set -u
set -m  # job control: each pipeline gets its own process group

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if command -v docker >/dev/null 2>&1; then
  if ! docker image inspect pascal-agent:latest >/dev/null 2>&1; then
    echo "[dev:all] pascal-agent:latest not found — building (one-time, ~minutes)..."
    bun run setup:pascal-agent
  fi
else
  echo "[dev:all] WARNING: docker not on PATH — agent containers will fail to start." >&2
fi

prefix() {
  local tag="$1"
  while IFS= read -r line; do
    printf '[%s] %s\n' "$tag" "$line"
  done
}

cleanup() {
  trap - INT TERM EXIT
  # Each backgrounded pipeline has its own process group thanks to `set -m`.
  # `kill -- -<pgid>` cascades to every descendant (turbo→tsc→next,
  # npm→tsx→node), which `kill <pid>` alone would miss.
  for spec in "%1" "%2"; do
    pgid=$(jobs -p "$spec" 2>/dev/null) || continue
    [ -n "$pgid" ] || continue
    kill -TERM -- -"$pgid" 2>/dev/null || true
  done
  sleep 1
  for spec in "%1" "%2"; do
    pgid=$(jobs -p "$spec" 2>/dev/null) || continue
    [ -n "$pgid" ] || continue
    kill -KILL -- -"$pgid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

bun run dev              2>&1 | prefix editor       &
bun run dev:agent-runner 2>&1 | prefix agent-runner &

wait -n
exit $?
