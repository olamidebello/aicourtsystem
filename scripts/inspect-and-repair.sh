#!/usr/bin/env bash
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo 'Run with sudo bash scripts/inspect-and-repair.sh [Ansible options]' >&2; exit 1; fi
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
command -v ansible-playbook >/dev/null || { echo 'Install Ansible or run scripts/deploy.sh first.' >&2; exit 1; }
exec 9>/run/lock/justisolve-deploy.lock
flock -n 9 || { echo 'Another deployment or inspection is running.' >&2; exit 1; }
args=(-i localhost, -c local "$repo_dir/ansible/inspect.yml" -e "app_dir=$repo_dir")
if [[ -f /etc/justisolve/automation.yml ]]; then args+=(-e @/etc/justisolve/automation.yml); fi
exec ansible-playbook "${args[@]}" "$@"
