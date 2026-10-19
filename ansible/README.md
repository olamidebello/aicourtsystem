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

## Single-command platform automation

From the **existing production checkout** (so its `.env` and persistent data remain in use):

```bash
git pull --ff-only
sudo bash scripts/deploy.sh
```

The wrapper installs Ansible on Debian/Ubuntu when missing and prevents concurrent deployments. `platform.yml` runs the hosting playbook to install dependencies, pull the repository without overwriting local changes, build/start containers, check the web/database/API, and configure Nginx/TLS when DNS permits. It then downloads the configured Ollama models, checks PACER/provider endpoints and installs an optional systemd update timer. It does not execute billable PACER searches, run AI requests, or file documents unattended. API keys/model IDs belong in the existing root-only `.env` before deployment. Preserve the old credentials when moving an installation.

Enable recurring builds/updates (03:30 in the **server timezone**, with up to ten minutes jitter):

```bash
sudo bash scripts/deploy.sh -e enable_auto_updates=true
```

Disable recurring updates:

```bash
sudo bash scripts/deploy.sh -e enable_auto_updates=false
```

For a smaller host, skip automatic model downloads with `-e install_ollama_models=false`. Install/pull the models separately before use. Set a different schedule using a root-readable vars file containing `update_calendar`. The selected deployment directory, Compose project and schedule are preserved in `/etc/justisolve/automation.yml`. Extra Ansible options passed to the wrapper take precedence. Scheduled updates stop on a dirty checkout or failed check; there is no automatic rollback. Updates can restart application services; schedule appropriately and maintain independent tested backups. Existing database volumes are retained; this automation does not apply new database migrations to existing databases.

Review results:

```bash
systemctl status justisolve-update.timer
journalctl -u justisolve-update.service -n 100 --no-pager
```

Syntax-only validation (does not deploy):

```bash
bash -n scripts/deploy.sh
ansible-playbook -i localhost, -c local ansible/platform.yml --syntax-check
```

## Administration, News and court-issue worker

The API now applies idempotent administrative/news migrations at startup. Ansible creates `ADMIN_SETUP_TOKEN` and `NEWS_WORKER_TOKEN` in the existing `.env` only when absent. Open the HTTPS workspace, use the setup token from that root-only file, and provision the first super administrator with a unique password of at least 14 characters. The operational workspace and case APIs require a super-admin session; public News and policy pages remain accessible. Delegated tenant-user access is not enabled. `COOKIE_SECURE=true` requires HTTPS; only set it false for isolated localhost development.

Bootstrap also creates three enabled, local-model news campaigns (all CourtListener opinions, Supreme Court, Fifth Circuit). They poll hourly with one new item per campaign; cross-feed source URL deduplication prevents repeat publication. The public page refreshes every 30 seconds. A source item must have readable opinion text and pass AI generation checks to publish; these checks are not independent legal verification. No story is guaranteed when sources/models are unavailable. Each campaign can be paused, edited, limited, set to draft-only, or assigned to a configured hosted model with explicit recurring processing authorization. A global news pause is available.

`platform.yml` installs and enables `justisolve-news.timer` by default. It runs after boot and fifteen minutes after the preceding run finishes. The worker monitors recorded deadlines and executes due court-issue drafting jobs before news campaigns. Court jobs require 2–4 configured models, court context and explicitly supplied authorized source material. Unchanged input is skipped. Results are stored in the drafts table and admin history; this automation does not calculate unknown deadlines, contact parties, file documents or appear in court. Administrator changes or a source provider can require later human review.

Audio is produced with local espeak-ng; video is a synthetic title card with audio using FFmpeg. Docker installs those resources in the AI image. Media is stored in the private MinIO bucket and served only for published posts. The public page includes synthetic-media labels and an audio transcript. Failed media generation is visible in the admin view and may be regenerated there. No voice cloning or simulated judge appearance is used. Public media access is revoked with the story when it is unpublished.

```bash
sudo bash scripts/deploy.sh
systemctl status justisolve-news.timer
journalctl -u justisolve-news.service -n 100 --no-pager
# Perform a worker pass immediately:
sudo systemctl start justisolve-news.service
# Disable polling through deployment configuration:
sudo bash scripts/deploy.sh -e enable_news_worker=false
```

Campaign “Queue next run” moves its due time forward; the next timer tick processes it. News global pause does not pause independent court drafting jobs; pause those individually. Already-sent provider requests may finish or incur costs. The worker uses database locks to prevent overlapping runs and keeps failures/history for review. It is bounded (up to three news campaigns and two court jobs per tick), so a large backlog may require additional ticks. Source URL deduplication retains failed records for admin review rather than retrying charges indefinitely. Publish/edit controls and policy request resolution are audited. Container restart policies recover exited services but do not provide rollback or a complete backup strategy.

Terms, Privacy, AI/Editorial, Acceptable Use and request reporting are available at `/policies`. Configure organization-specific legal details and obtain appropriate legal review before representing these as comprehensive jurisdiction-specific compliance terms. Privacy/copyright requests enter a protected admin queue; they do not automatically erase information or send email.

The OpenAI key created in the development workspace is not automatically transferred to the host. Configure production secrets through your secure deployment process. Never commit `.env`, paste API keys into logs or include them in support reports.

User accounts may now be provisioned through Admin → Accounts with role **User**. They can analyze their own narratives/documents through the private Intake workspace; administrative APIs, general case records and other users' intake submissions remain inaccessible. The API migration creates the intake storage table automatically. Text-readable PDF/DOCX/TXT extraction is supported; scanned/image documents require OCR before submission.

## Provision JustiSolve hosting in Olamidepanel (apex and www)

From the existing `/opt/aicourtsystem` checkout, run `git pull --ff-only` and `bash scripts/publish.sh` as root. The publisher runs platform installation first, verifies both hostname DNS records and the internal API, obtains a certificate covering both names, validates/reloads the dedicated Nginx host, verifies both public HTTPS pages, then merges the verified application status into Olamidepanel's Hosting Domains snapshot. Other domain records and existing application database volumes are retained. A failed API, DNS, certificate or public check stops publication; no successful panel status is fabricated.

Required DNS: `justisolve.com` A points to `181.214.149.146`; `www.justisolve.com` CNAME points to `justisolve.com` (or its A points to the same IP). Remove stale AAAA records unless IPv6 is configured separately. The publisher checks these records; it does not have DNS-provider credentials to change them. It refuses conflicting Nginx hostname definitions in other enabled files. Certificate renewal is managed by the installed Certbot setup. Optionally supply `-e tls_email=YOUR_OPERATOR_EMAIL`.

Olamidepanel's GUI remains a read-only hosting inventory for this application. Publishing does not install a general-purpose terminal, create a hosting subscription, reset an admin password, configure email, or transfer AI API credentials to production. It verifies and registers the actual JustiSolve installation. If any step fails, share the named task error without including `.env` contents.
