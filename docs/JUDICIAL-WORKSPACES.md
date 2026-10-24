# Judicial role workspaces and AI mock proceedings

Registration offers multiple requested roles from the 14 supplied categories.
The catalog contains every supplied title, grouped under stable IDs. System role
(`user` or `super_admin`), requested professional title, and case participation
are separate. Registration never approves credentials or grants elevated rights.
Existing users request additional roles in Judicial Roles & Workspaces.

Super administrators review organization, jurisdiction and credential references
and enter a review reason before approving, rejecting or revoking each role.
Role approval remains an operator responsibility. The supported automatic
license registry check is described below; court and employment appointments
are not verified automatically. Account approval for login remains a separate action.

Any signed-in user can create a private case workspace. Only its owner manages
membership. Members require an active account, an approved catalog role and an
explicit case assignment. Writing and sealed access are separate grants.
Revoked roles cease granting member access immediately. Platform administrators
have no implicit case-content access. Owners retain their own private materials,
but creating role work products and conducting AI sessions requires an approved
role. All members of a case can read its records: keep privileged, opposing-party
and jury materials in separate workspaces with appropriate membership.

Role workspaces offer jurisdiction, court, reference and confidentiality fields;
role checklists; tasks, records, hearing schedules, disclosure entries, custody
logs, accommodation requests, service entries and reports; draft/in-progress/
review/completed/cancelled states; user-entered due dates; case sharing and removal.
These records are organizational tools. Custody logs are user-entered records,
not a forensic chain-of-custody certification. Dates are not calculated legal
filing deadlines. No official notices, warrants, custody changes, payments,
certifications or enforcement actions are performed.

AI trial, hearing and appeal sessions use six predefined stages. Appeals cover
record/jurisdiction review, appellant argument, appellee response, panel questions,
rebuttal and a draft nonbinding recommendation. Trial and hearing stages cover
agendas, positions, evidence questions, closing/reply and draft findings/summary.
Users supply authorized excerpts, issues and optional participant input; select
an enabled provisioned model (latest enabled default in the UI); acknowledge the
simulation; and consent to hosted processing when applicable. The source, issues,
input and previous simulated rounds are sent to the selected model. No other case
records are sent automatically. Models are instructed to flag gaps and never
invent testimony, citations or authority. Output remains subject to human review.

Advance one round or run the remaining stages in the open browser. Automation
stops on error, pause, cancellation or completion; it does not run unattended on
the server. Each round can incur provider costs. Stop-after-current preserves
the current result; cancellation discards in-flight output. Duplicate/replayed
rounds are rejected. Failed rounds require explicit resume; stalled rounds can
be recovered after ten minutes. Per-attempt tokens prevent late outputs from
superseding a newer attempt. Provider failures may still incur charges. Transcript
exports are labeled mock and include model, inputs, stages and timestamps.
No legal decision, actual hearing or filing is produced by marking a stage complete.

## Deploy on the existing production server

```bash
ansible-pull -U https://github.com/olamidebello/justisolve.git -C main \
  -d /opt/justisolve-bootstrap -i localhost, -c local \
  ansible/justice-platform.yml
```

This preserves the existing database volumes and environment, builds API/web/AI,
migrates the five new PostgreSQL tables, and checks catalog and authentication
boundaries. No AI model calls, professional approvals, account promotions or
court actions occur during deployment. Custom installations can override
`app_dir` and `compose_project`.

## Scope

This release provides the role catalog, approval/access resources, shared work
records and supervised mock sessions. Specialized official systems such as jury
summons/random selection, correctional release calculations, official e-filing,
evidence certification, interpreter credential verification, court accounting,
remote video hearings and agency integrations require separate jurisdictional
requirements and integrations. Selecting a job title does not implement or
confer that office’s legal powers.

## Professional license checks

The catalog now identifies professional roles requiring credential review under
this platform's policy (attorney and certain forensic medical/mental-health roles).
This is not a universal statement about licensing law in every jurisdiction.
Judicial appointments, juror status and case authority remain separate reviews.

Registration and the signed-in profile accept a role-specific country/region,
profession, legal first/last name, license number and explicit lookup/recheck
consent. Submission replaces that role's prior claim, clears prior credential
validity and pauses an approved role pending fresh review. Other roles and account
login are unaffected. Registrations remain generic and never disclose existing
account details or modify an existing account through repeat registration.

The built-in automatic adapter is currently **US / NY / attorney** only. It uses
New York Office of Court Administration's official open dataset, exact seven-digit
registration number and exact normalized legal first/last names. Only `Currently
registered` produces `registry_current`; other statuses, no record, multiple rows,
name mismatch, missing fields, redirects, provider errors or stale source metadata
never produce a positive result. Source data must have an update timestamp within
seven days. Only number, names, registration status and source update time are
retained; addresses and phone numbers are not requested or stored.

Sources and field definitions:
- https://data.ny.gov/Transparency/NYS-Attorney-Registrations/eqw2-r5nb
- https://data.ny.gov/api/views/eqw2-r5nb.json
- https://www.nycourts.gov/courts/ad2/attorneymatters_CertificatesofGoodStanding.shtml

A registry match is not proof of account-holder identity, a certificate of good
standing, court admission, employment or appointment. Before professional role
approval, a super administrator must independently confirm identity and current
professional authority, enter an issuing-authority HTTPS evidence reference and
review note, and set a review expiry within 31 days. Unsupported jurisdictions
and professions return `manual_required`; they require the same documented manual
review rather than a fabricated automatic approval. Links are evidence references,
not automatically fetched URLs. No arbitrary callback URL or API key is accepted.
Registry warnings must be resolved before attestation; correcting a claim triggers
a fresh check. SRA firm data and NPI numbers are not treated as individual licenses.

Matched automatic claims are rechecked daily by a bounded worker (30 due claims
per timer tick, every 15 minutes). Database leases and claim versions prevent
concurrent/stale results. Positive rechecks can extend access validity up to 48
hours, never beyond the administrator's review expiry. Provider outages preserve
only an existing validity window; they never create or extend one. Adverse,
mismatched or missing results clear validity and return an approved role to pending.
Manual-only reviews expire on their chosen date. Expired required credentials
block professional work and member-based case access immediately, without waiting
for a worker. Owners retain their personal records, but cannot perform work under
an expired professional role. Existing previously approved professional roles also
need a current credential review after deploying this release.

Administration > Firms & Feature Controls shows status counts and professional
reviews. Every lookup and attestation is audited. Credential history is stored in
`justice_license_checks`; it is not publicly listed. Global `license_checks` can
pause automatic lookup. The worker does not use AI or infer licensing eligibility.

## Law firm, counsel and pro se tenancy

Registration may provision a law firm, independent counsel or pro se workspace;
users can create or join additional workspaces after signing in. Workspace kinds
and tenant membership are separate from licensed professional titles and system
administrator status. No one becomes a lawyer by choosing Counsel in registration.

The workspace selector and navigation provide overview, case tools, team and
invitations, settings, personal intake, personal wallet/marketplace and PACER.
Case tools include professional profile, role requests, license review, case
creation, member grants, tasks, hearings, deadlines, notes, motions, research,
transcript/evidence/document entries, supervised AI proceedings and case-file upload
and download. Text records are not official court records or filings.

Operational workspaces use separate `justice_orgs`, `justice_org_members` and
`justice_org_invites` tables. Legacy `tenants` inventory records are unchanged.
Accepted active tenant membership is required even for a case's owner. Each case
also requires explicit case access; firm owners/admins do not inherit colleagues'
privileged files. Cross-tenant grants are rejected. Removing a tenant member,
suspending a workspace, or disabling its case tools blocks case access. Tenant
settings can disable case tools and AI proceedings. Personal workspaces and
personal wallet/PACER credentials are not shared firm assets.

Invitations are addressed to an account email and expire in seven days. Recipients
must sign in with that email and accept; there is no automatic email sending.
Workspace owners can invite administrators and transfer ownership to an active
member. Tenant administrators manage ordinary membership but cannot create or
modify other tenant administrators or the owner. Clients/pro se participants can
see their own membership, not the full firm directory. Organization ownership
transfer changes tenant administration, not individual case ownership.

Case files are stored in private object storage, bound to their case, with
SHA-256 metadata and audited uploads/downloads. Allowed uploads are PDF, DOCX, TXT,
PNG and JPEG (five files, 10 MB each, 20 MB total). Downloads require a current
session and case access and use attachment delivery with nosniff. File IDs never
serve as authorization. Uploading does not send files to an AI model. A failed
multi-file upload may retain earlier successfully saved files; check the case list
before retrying. Existing MinIO storage must be configured for file operations.

## Platform administration

Administration > Firms & Feature Controls manages feature availability, operational
workspace suspension/restoration and professional-role reviews. Every change needs
an audit reason. Dedicated existing tabs continue to manage accounts, keys/APIs,
AI provisioning, payment gateways, wallet adjustments, PACER and automation settings.
Professional and tenant administrators never receive platform administration rights.

Server feature controls cover registration, organizations, credential checks,
cases (including legacy admin case tools), AI mock proceedings, intake, PACER,
marketplace, ensemble, basic AI, news and court automation. Protected control and
authentication routes remain available to recover from disabled features. API-key
requests also respect switches. Scheduled news/court generation and credential
refresh workers honor their switches. Existing AI calls already running at the
time of a switch may finish; the switches are admission controls, not a provider
billing cancellation API. Workspace suspension does not close a person's separate
personal account or delete its data.

Run the existing `ansible/justice-platform.yml` deployment command to build and
migrate these resources and install `justisolve-license-refresh.timer`. To install
only the refresh timer after deploying the code, use `ansible/license-refresh.yml`.
The deployment does not approve professionals or query personal license records;
checks run only for submitted consented claims. Regional registry adapters beyond
New York, trust accounting, firm-level payments, video court systems and official
e-filing remain separate integrations.
