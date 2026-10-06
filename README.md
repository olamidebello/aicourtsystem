# AI Court System

AI Court System is a production-oriented, AI-assisted court, litigation, evidence, legal research, and case-management platform. The architecture combines a professional web interface, NestJS API, Python AI service, PostgreSQL, Redis, MinIO, Keycloak, Ollama, and Nginx in a containerized deployment.

> **Status:** Active development. Some modules described below are part of the platform roadmap/architecture and should be verified end-to-end before production use. This software does not replace independent legal judgment.

## Table of Contents

- [Platform Overview](#platform-overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Roles and Multi-Tenancy](#roles-and-multi-tenancy)
- [User Guide](#user-guide)
- [Administrator Guide](#administrator-guide)
- [Developer Guide](#developer-guide)
- [Deployment Guide](#deployment-guide)
- [Operations and Health Checks](#operations-and-health-checks)
- [Security](#security)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)
- [Production Checklist](#production-checklist)

## Platform Overview

The platform is designed to provide one workspace for managing matters, dockets, court records, evidence, transcripts, deadlines, research, AI analysis, drafting, administration, and operational monitoring. Services are independently containerized so components can be upgraded or scaled without redesigning the entire application.

## Features

### Case and Matter Management
- Create and manage civil, criminal, appellate, federal, state, and other matters.
- Store court, judge, party, attorney, case-number, status, stage, tag, and matter metadata.
- Link related, consolidated, companion, district-court, and appellate matters.
- Maintain case timelines, notes, activities, documents, tasks, and deadlines.
- Associate docket entries, evidence, transcripts, research, and drafts with a matter.

### Docket and Court Record Management
- Record docket number, title, filing date, type, status, and associated document.
- Chronological docket views and filtering.
- Track motions, responses, replies, notices, orders, judgments, and exhibits.
- Link related docket entries and identify potentially missing records.
- Track restricted/sealed-item metadata and record availability.
- Support district-to-appellate record mapping.

### Record on Appeal
- Organize record-on-appeal documents and references.
- Track transcripts and record completeness.
- Identify missing transcript segments, bench conferences, exhibits, or docket material.
- Organize FRAP 10(e)-style correction/supplement workflows.
- Track supplemental-record requests and record disputes.
- Preserve page/line and source references for later briefing.

### Document and Evidence Management
- Upload and organize PDFs, images, exhibits, and supporting files.
- MinIO-backed object storage.
- Evidence identifiers and metadata.
- Cryptographic hashing/integrity support.
- Provenance and chain-of-custody information.
- Evidence categorization, linking, version information, and retrieval.
- Document-to-case, issue, claim, and docket relationships.

### Transcript Analysis
- Store hearing, trial, sentencing, deposition, and other transcripts.
- Page/line-oriented references.
- Track speakers and testimony where source data permits.
- Identify indiscernible or missing segments.
- Compare testimony and related records.
- Link transcript passages to docket entries, issues, and evidence.
- AI-assisted transcript summaries and issue extraction.

### AI Legal Analysis
- Local/private model integration through Ollama.
- Dedicated Python AI service.
- Document and transcript summarization.
- Issue, claim, argument, and fact extraction.
- Compare documents, orders, testimony, and records.
- Identify inconsistencies and potentially favorable/adverse material.
- Generate chronologies and structured analysis.
- Assist with litigation-risk and next-step analysis.
- Prompt/template architecture for specialized workflows.

AI output must be independently reviewed. The system should not represent generated content as authoritative legal advice or verified law without validation.

### Legal Research
- Organize case law, statutes, rules, constitutional provisions, and secondary material.
- Associate authorities with cases and legal issues.
- Save research and research history.
- Classify favorable, adverse, distinguishing, or background authorities.
- Compare precedent and factual/legal issues.
- Maintain citation-oriented research collections.

### Drafting Workspace
- Support motions, memoranda, notices, briefs, replies, supplemental filings, and other drafts.
- Reusable document templates.
- Case captions and matter metadata.
- Statement of facts, procedural history, issues presented, argument, and relief sections.
- Signature and certificate/service sections.
- Draft/version workflow.
- AI-assisted drafting, editing, analysis, and review.

### Deadlines, Calendar, Tasks, and Workflow
- Filing, response, reply, hearing, trial, appeal, and other deadlines.
- Configurable reminders.
- Upcoming/overdue deadline views.
- Tasks with assignee, priority, status, and due date.
- Case-linked workflow and filing checklists.
- Review/approval workflow and completed activity history.

### Search
- Global and case-specific search.
- Case, docket, document, evidence, transcript, and metadata search.
- Date, type, status, and category filtering.
- Saved/recent-search architecture.
- AI-assisted retrieval architecture.

### Dashboard and Navigation
- Professional responsive dashboard.
- Grouped sidebar navigation and expandable submenus.
- Breadcrumbs and case-specific navigation.
- Quick actions and global search.
- Active cases, recent activity, pending motions, tasks, deadlines, documents, AI activity, and alerts.
- Customizable dashboard architecture.
- Forms grouped by business function rather than isolated screens.

### Notifications and Alerts
- Deadline and overdue-task alerts.
- Docket/document/evidence activity notifications.
- Workflow and administrative alerts.
- Service-health/system warnings.
- Notification center and preference architecture.

### Internationalization
- Language selector and localization-ready UI.
- Locale-aware dates and times.
- Currency selector and configurable defaults.
- Architecture for additional translations.

### Audit and Compliance
- Authentication and activity auditing.
- Administrative-action history.
- Document/evidence event history.
- User/role/permission change history.
- Timestamp and actor attribution.
- Evidence-integrity audit architecture.

### Health and Operations
- Service-health monitoring for Web, API, AI, PostgreSQL, Redis, MinIO, Keycloak, Ollama, and Nginx.
- Docker health checks and dependency handling.
- Operational diagnostics and logs.
- Architecture for infrastructure alerts.

## Architecture

```text
Browser / Mobile Browser
          |
          v
        Nginx
       /  |  \
      /   |   \
     v    v    v
 Next.js API  AI Service
   Web   NestJS   Python
          |         |
          |         v
          |       Ollama
          |
   +------+------+-------+--------+
   |             |       |        |
   v             v       v        v
PostgreSQL     Redis   MinIO   Keycloak
```

Nginx provides the external gateway. The Next.js application provides the GUI, NestJS provides application APIs, the Python service isolates AI workloads, Ollama provides local model inference, PostgreSQL stores relational application data, Redis supports caching/temporary state, MinIO stores documents/evidence, and Keycloak provides identity and access management.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js / Node.js |
| API | NestJS / TypeScript |
| AI Service | Python |
| Local AI | Ollama |
| Database | PostgreSQL |
| Cache/State | Redis |
| Object Storage | MinIO |
| Identity | Keycloak |
| Gateway | Nginx |
| Deployment | Docker / Docker Compose |

## Roles and Multi-Tenancy

The platform is designed for multi-tenant operation with isolated organizations/workspaces.

**Super Admin** manages platform-wide configuration, organizations/tenants, global users and roles, service health, AI configuration, storage visibility, and global audit information.

**Organization Admin** manages users, role assignments, organization settings, case access, security settings, and organization-level activity.

**Standard/Professional users** work with authorized cases, records, evidence, research, tasks, and drafts. The role model can be extended for attorneys, reviewers, clients, investigators, clerks, and read-only users.

Every backend authorization decision should be enforced server-side. Hiding a GUI menu is not an authorization boundary.

## User Guide

### Sign In
1. Open the configured AI Court System URL.
2. Select **Sign In**.
3. Authenticate through Keycloak.
4. After authentication, the dashboard displays resources allowed by your role and organization.

### Dashboard
Use the dashboard for active matters, recent activity, deadlines, tasks, documents, AI activity, alerts, and quick actions. Use the sidebar for full module navigation and breadcrumbs to return to a parent case or workspace.

### Create or Open a Case
Open **Cases**, select the create action, enter the case/matter metadata, and save. From the matter workspace, add docket entries, documents, evidence, deadlines, tasks, transcripts, research, and related cases.

### Upload Evidence or Documents
Open the relevant case and select its document/evidence area. Upload the source file, enter accurate metadata, classify the material, and save. Where integrity controls are enabled, retain the generated hash and provenance information. Do not alter original evidence merely to make it easier to analyze; create a derived copy when necessary.

### Analyze with AI
Select an authorized document, transcript, record, or case context and choose the relevant AI analysis workflow. Review generated results against the source record before relying on them. Legal citations and factual assertions generated by a model must be independently verified.

### Research
Use the research workspace to organize authorities by issue. Record citation, court, date, relevance, treatment, and whether the authority is favorable, adverse, distinguishable, or background.

### Draft a Filing
Create a draft from a supported template or blank workspace, associate it with the case, add source material, and use AI assistance where appropriate. Review citations, quotations, dates, names, jurisdiction, procedural posture, and requested relief before filing.

### Tasks and Deadlines
Create deadlines and tasks from the matter workspace. Assign responsibility, due date, priority, and status. The dashboard should be used as a convenience; independently verify jurisdictional and filing deadlines.

## Administrator Guide

Administrators should:
- Provision users through the configured identity workflow.
- Assign the minimum role required.
- Confirm tenant/organization membership.
- Restrict access to sensitive cases and evidence.
- Review audit events.
- Monitor storage, database, AI, and service health.
- Maintain tested backup and recovery procedures.
- Rotate production credentials and secrets.
- Remove or disable access promptly when no longer required.

Super Admin privileges should be limited to trusted platform operators.

## Developer Guide

### Repository Layout

```text
aicourtsystem/
├── docker/
│   └── docker-compose.yml
├── infra/
│   ├── keycloak/
│   └── nginx/
├── services/
│   ├── api/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── ai/
│   │   ├── app/
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   ├── db/
│   └── web/
│       ├── app/
│       ├── public/
│       ├── Dockerfile
│       └── package.json
└── .env.example
```

The exact tree may evolve as modules are added.

### Development Principles
- Keep controllers thin and business logic in services/modules.
- Validate all API input.
- Enforce authorization on the API, not only in the frontend.
- Keep tenant identifiers in authorization/data-access boundaries.
- Never commit secrets.
- Use migrations for schema evolution.
- Preserve original evidence and create derived analysis artifacts.
- Keep AI prompts/templates versionable.
- Add tests for authorization, tenant isolation, uploads, evidence integrity, and critical workflows.
- Use structured logging and avoid logging credentials, tokens, privileged legal material, or unnecessary personal data.

### API Development

The API is a NestJS/TypeScript service. Typical local/container build flow:

```bash
cd services/api
npm install
npm run build
```

When using the production container, dependencies should normally be installed inside the Docker build rather than requiring Node/npm on the host.

### Web Development

```bash
cd services/web
npm install
npm run build
```

Keep GUI actions connected to real backend operations. Disabled or not-yet-implemented actions should be visibly identified rather than silently behaving as successful operations.

### AI Development

The AI service is Python-based and communicates with Ollama. Keep model endpoints and model names configurable. AI workflows should return structured errors when inference is unavailable rather than causing unrelated application modules to fail.

### Database Development

Use PostgreSQL as the source of truth for relational application data. Schema changes should be repeatable and migration-driven. Do not make untracked production-only schema changes.

### Adding a New Feature
1. Define the data and authorization model.
2. Add database migration/schema changes.
3. Implement API service/controller endpoints.
4. Add unit/integration tests.
5. Implement the GUI.
6. Wire every button/form to a real API action.
7. Add audit events where appropriate.
8. Add role/tenant checks.
9. Add operational/health handling.
10. Update documentation.

## Deployment Guide

### Prerequisites
Recommended production host requirements depend on model size and workload. At minimum install:
- Linux server (Ubuntu/Debian or equivalent)
- Docker Engine
- Docker Compose v2 plugin
- Git
- DNS record for the production hostname
- TLS certificate/automated certificate solution for Internet-facing production deployments

Ollama can run CPU-only but larger models require substantially more RAM and will be slower. GPU acceleration should be sized and configured separately.

### Clone

```bash
git clone https://github.com/olamidebello/aicourtsystem.git
cd aicourtsystem
```

### Environment

Copy the example environment configuration and edit it:

```bash
cp .env.example .env
chmod 600 .env
```

Set strong, unique production values. Never commit the resulting `.env`.

### Validate Compose

```bash
cd docker
docker compose config
```

Resolve all validation errors before starting the stack.

### Build

```bash
docker compose build
```

For a clean rebuild:

```bash
docker compose build --no-cache
```

### Start

```bash
docker compose up -d --remove-orphans
docker compose ps
```

Wait for required dependencies to become healthy before diagnosing dependent services.

### Updating a Deployment

```bash
git pull
cd docker
docker compose build
docker compose up -d --remove-orphans
docker compose ps
```

Review migrations and release notes before updating production.

### Stopping

```bash
docker compose down
```

Do **not** add `-v` unless you intentionally want to remove persistent volumes/data.

## Operations and Health Checks

Useful commands:

```bash
cd docker
docker compose ps
docker compose logs --tail=200
docker compose logs --tail=200 api
docker compose logs --tail=200 web
docker compose logs --tail=200 ai
docker compose logs --tail=200 keycloak
docker compose logs --tail=200 minio
docker compose logs --tail=200 ollama
```

Inspect a container health result:

```bash
docker inspect --format '{{json .State.Health}}' CONTAINER_NAME | python3 -m json.tool
```

A container may be operational while an incorrectly configured healthcheck marks it unhealthy. Fix the healthcheck rather than permanently disabling meaningful readiness checking.

### Keycloak

Enable Keycloak health support where required by the selected Keycloak image/version. Modern Keycloak versions may expose management health endpoints differently from older releases, so match the Compose healthcheck to the deployed image.

### MinIO

Verify both MinIO service availability and the healthcheck command itself. Minimal container images may not include utilities such as `curl` or `wget`; prefer healthchecks compatible with the actual image or build a controlled custom image.

### Ollama

Confirm the service is listening and that the configured model exists. CPU-only systems can report low-VRAM mode and still operate correctly, although inference may be slow.

## Security

Production deployments should:
- Use HTTPS only for external traffic.
- Keep PostgreSQL, Redis, MinIO, Keycloak management interfaces, Ollama, and internal AI endpoints off the public Internet unless explicitly required and secured.
- Store secrets outside Git.
- Use strong unique credentials.
- Enforce Keycloak authentication and API-side RBAC.
- Enforce tenant isolation in every data-access path.
- Configure secure headers and rate limits.
- Restrict upload type and size.
- Scan/validate untrusted uploads.
- Encrypt sensitive backups.
- Rotate secrets after suspected exposure.
- Apply dependency/container security updates.
- Log security-relevant events without logging secrets.
- Test authorization for direct API requests, not only GUI navigation.

### Never Commit

```text
.env
.env.production
private keys
API tokens
database passwords
Keycloak administrative credentials
MinIO secret keys
session/JWT signing secrets
production certificates/private keys
unredacted sensitive evidence or privileged material
```

A typical `.gitignore` should include:

```gitignore
.env
.env.*
!.env.example
node_modules/
dist/
.next/
__pycache__/
*.pyc
*.log
```

## Backup and Recovery

Back up persistent data independently of containers:
- PostgreSQL database
- MinIO evidence/document objects
- Keycloak configuration/database as applicable
- Application configuration required for restoration
- Critical audit/integrity information

Backups are not proven until a restoration test succeeds. Maintain encrypted off-host copies appropriate to the sensitivity of the data.

Before destructive Docker operations, identify which named volumes contain production data.

## Troubleshooting

### A service is unhealthy
Run:

```bash
docker compose ps
docker inspect --format '{{json .State.Health}}' CONTAINER_NAME | python3 -m json.tool
docker logs --tail=200 CONTAINER_NAME
```

Determine whether the application failed or only the healthcheck command failed.

### Dependency failed to start
Identify the first unhealthy dependency rather than repeatedly recreating the entire stack. Fix that service, confirm it is healthy, then run:

```bash
docker compose up -d --remove-orphans
```

### Host does not have npm
That is acceptable for containerized production builds. Build the Node service through Docker:

```bash
docker compose build api web
```

### AI is slow
Check the Ollama logs and host resources. CPU inference is supported but model size, available RAM, context size, and concurrent requests significantly affect performance.

## Production Checklist

Before production launch, verify:
- DNS and HTTPS.
- No default passwords.
- No secrets committed to Git.
- All required containers are healthy.
- Database migrations complete successfully.
- Persistent volumes are correctly mounted.
- PostgreSQL backup and restore tested.
- MinIO backup and restore tested.
- Keycloak realm/users/roles configured.
- Tenant isolation tested.
- Admin and Super Admin permissions tested.
- Direct API authorization tested.
- Upload limits and validation tested.
- Evidence hashes/integrity workflow tested.
- AI failure modes tested.
- Every GUI button/menu/form tested against the backend.
- Error handling and audit logging verified.
- Monitoring and disk-space alerts configured.
- Recovery procedure documented and tested.

## Current Service Set

The standard deployment includes:

```text
web
api
ai
postgres
redis
minio
keycloak
ollama
nginx
```

## Contributing

Use focused branches and pull requests for significant changes. Include tests and documentation with new features. Do not merge code that bypasses authentication, tenant isolation, evidence integrity controls, or server-side authorization.

## License

Add the project's chosen license before third-party distribution or external contributions.
