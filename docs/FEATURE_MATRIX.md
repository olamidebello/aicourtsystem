# Feature Matrix

The repository now contains working foundations for case CRUD, docket records, documents, evidence upload with SHA-256 verification, transcripts, legal research, tasks, deadlines, alerts, audit retrieval, global search, AI drafting, AI analysis, a responsive dashboard, PostgreSQL persistence, MinIO object storage, Redis, Keycloak, Ollama, Nginx, and Docker Compose.

## Production hardening still required

Before treating every README capability as production-complete, finish and test Keycloak JWT enforcement in the NestJS API, tenant-scoped SQL enforcement, fine-grained RBAC, immutable audit event creation on every mutation, presigned object downloads, malware scanning, database migrations, notification delivery workers, calendaring integrations, legal-research provider integrations, automated tests, TLS automation, backup automation, and observability/metrics.

The UI intentionally exposes the major workspaces while backend modules can be expanded incrementally without redesigning navigation.
