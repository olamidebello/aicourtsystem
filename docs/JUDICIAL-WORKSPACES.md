# Judicial role workspaces and AI mock proceedings

Registration offers multiple requested roles from the 14 supplied categories.
The catalog contains every supplied title, grouped under stable IDs. System role
(`user` or `super_admin`), requested professional title, and case participation
are separate. Registration never approves credentials or grants elevated rights.
Existing users request additional roles in Judicial Roles & Workspaces.

Super administrators review organization, jurisdiction and credential references
and enter a review reason before approving, rejecting or revoking each role.
Verification is an operator responsibility; no bar, court or employment registry
is queried automatically. Account approval for login remains a separate action.

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
