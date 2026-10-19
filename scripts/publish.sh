#!/usr/bin/env bash
set -euo pipefail
[[ ${EUID} -eq 0 ]] || { echo 'Run as root.' >&2; exit 1; }
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
exec 9>/run/lock/justisolve-deploy.lock
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
if ! command -v ansible-playbook >/dev/null; then apt-get update; apt-get install -y ansible; fi
args=(-i localhost, -c local "$repo_dir/ansible/publish.yml" -e "app_dir=$repo_dir")
if [[ -f /etc/justisolve/automation.yml ]]; then args+=(-e @/etc/justisolve/automation.yml); fi
exec ansible-playbook "${args[@]}" "$@"
