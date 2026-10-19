#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
project="${1:-docker}"
[[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || exit 1
cd "$repo_dir"
if docker compose version >/dev/null 2>&1; then compose=(docker compose); else compose=(docker-compose); fi
"${compose[@]}" -p "$project" --env-file .env -f docker/docker-compose.yml exec -T api node -e '
const token=process.env.NEWS_WORKER_TOKEN;
if(!token)throw Error("News worker token is not configured");
fetch("http://127.0.0.1:4000/api/internal/news/tick",{method:"POST",headers:{"X-Worker-Token":token},signal:AbortSignal.timeout(7000000)})
.then(async r=>{if(!r.ok)throw Error("News tick failed: "+r.status);const d=await r.json();console.log(JSON.stringify(d));})
.catch(()=>{console.error("News worker failed; inspect the admin automation history.");process.exit(1);});'
