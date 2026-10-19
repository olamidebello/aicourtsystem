#!/usr/bin/env bash
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then
  echo 'Run as root: sudo bash scripts/deploy.sh [Ansible options]' >&2
  exit 1
fi
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
command -v flock >/dev/null || { echo 'Install util-linux first.' >&2; exit 1; }
exec 9>/run/lock/justisolve-deploy.lock
flock -n 9 || { echo 'Another JustiSolve deployment is running.' >&2; exit 1; }
if ! command -v ansible-playbook >/dev/null; then
  apt-get update
  apt-get install -y ansible
fi
args=(-i localhost, -c local "$repo_dir/ansible/platform.yml" -e "app_dir=$repo_dir")
if [[ -f /etc/justisolve/automation.yml ]]; then args+=(-e @/etc/justisolve/automation.yml); fi
exec ansible-playbook "${args[@]}" "$@"
