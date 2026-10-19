# Debian hosting deployment

Run as root on the target server. Host Nginx keeps ports 80/443 and the Docker gateway binds only to 127.0.0.1:18080. Other domains are not rewritten. The playbook does not remove volumes, reset credentials, force Git updates, or replace an existing domain configuration.

For an existing installation, pass its actual checkout and Compose project name to reuse its data. Check `docker compose ls` first. The default project `docker` matches the original repository's `docker/` Compose directory. If the old project name differs, pass `-e compose_project=EXISTING_NAME`. Do not point a new checkout at an unrelated project's volumes.

```bash
apt-get update
apt-get install -y git ansible
# For a new installation only:
git clone https://github.com/olamidebello/justisolve.git /opt/justisolve
cd /opt/justisolve
# For subsequent runs, update the existing clean checkout:
git pull --ff-only
ansible-playbook -i localhost, -c local ansible/hosting.yml
```

An existing checkout elsewhere can run the same playbook with `-e app_dir=/actual/checkout`. Existing .env credentials must match the database volume; they are never rotated automatically. New credentials are stored in root-only .env. Review preexisting placeholder/default credentials before exposing existing installations.

The playbook verifies the web page and /api/dashboard before enabling its host configuration. It checks syntax before reloading Nginx. A failed build leaves the existing application containers in place; an application startup failure needs log review and is not automatically rolled back.

Set justisolve.com's A record to 181.214.149.146. Remove stale AAAA records or configure working IPv6 separately. Permit inbound TCP 80 and 443 in your provider firewall. The playbook defers Certbot when IPv4 DNS points elsewhere; rerun after DNS changes propagate. Only the apex domain is configured; www is not assumed. Certbot registers without email; add an operator email later with `certbot update_account --email YOUR_EMAIL`.

After deployment:

```bash
cd /opt/justisolve
docker compose -p docker --env-file .env -f docker/docker-compose.yml ps
curl --fail --resolve justisolve.com:80:127.0.0.1 http://justisolve.com/
curl --fail https://justisolve.com/
```

If the Compose plugin is unavailable, replace `docker compose` with `docker-compose`. Do not publish raw environment output or logs containing secrets. Existing per-domain Nginx configuration is retained; verify its upstream is 127.0.0.1:18080 if it predates this playbook. This deployment does not implement or certify application authentication, tenant isolation, or all roadmap features.

For an existing installation, the playbook retains the legacy installation directory to preserve its environment credentials and volumes. Override `app_dir` only after migrating the existing `.env` and deployment configuration.
