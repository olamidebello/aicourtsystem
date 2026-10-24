# Email, SIP and organizational PBX services

## Deploy the application

On the existing JustiSolve server, run the deployment command in
[JUDICIAL-WORKSPACES.md](JUDICIAL-WORKSPACES.md). It builds API, web and AI, migrates
email/provisioning tables and installs the credential and phone refresh timers.

Administration > Email & Phone Services configures system SMTP, tests a saved
connection, optionally sends a test to the signed-in administrator, shows delivery
events, configures the scoped SIP bridge, tests it and retries provisioning.
Blank password/token fields retain saved secrets. New secrets are encrypted with
the existing COMMERCE_ENCRYPTION_KEY. Existing SMTP environment settings remain
available; saved GUI settings take precedence. A saved blank SMTP password can
reuse an existing server SMTP_PASSWORD. Disabled settings do not fall back to
an enabled configuration.

System email supports verification and password reset mail, with TLS, connection
timeouts and bounded metadata logs. Logs never retain message bodies or reset
links. SMTP acceptance is not guaranteed inbox delivery. Sender authorization,
SPF/DKIM/DMARC and provider connectivity must be configured independently. This
release provides transactional email, not inbound domain mailbox hosting/IMAP.

## Connect the two existing servers automatically

The SIP counterpart is committed in `olamidebello/Sip`. The target is
**https://sip.dobhrap.com**; `sip.dobhrapn.com` is not used.

From a trusted Ansible controller with SSH access to both servers, copy and edit
`ansible/communications-inventory.example.ini`, then run:

```bash
sudo ansible-playbook -i /path/to/communications-inventory.ini \
  ansible/link-phone-services.yml
```

Deploy the current JustiSolve code first. The link playbook generates a protected
controller token file once, pulls the SIP repository without overwriting tracked
local changes, sets only JUSTISOLVE_BRIDGE_TOKEN in the existing SIP secret file,
rebuilds/restarts only the SIP API/web, verifies bridge health and saves the same
token encrypted in JustiSolve's database. It preserves other application, carrier
and AI credentials. An existing different token is not silently rotated: reuse
its private controller token file. No token is displayed in Ansible output.
Override `bridge_token_file`, `sip_repo_dir`, `sip_env_file`, `app_dir` and
`compose_project` if your installations use other paths. It assumes Docker Compose
plugin on the two existing installations. The protected controller token file
must be backed up privately. Do not upload or paste it into chat.

The SIP host also needs its existing SIP_CREDENTIAL_KEY and commissioned switch,
secure SIP WebSocket endpoint and usable STUN/TURN networking. If WebSocket Origin
restrictions are configured, permit the intended JustiSolve HTTPS origin through
the existing reviewed SIP configuration. No carrier purchases, numbers, public
routes or switch authentication policies are changed by the link playbook.

## Signup and lifecycle

New registrations atomically queue a personal SIP identity. Non-individual
workspaces (law firm, independent counsel, business, court, other organization)
also queue an isolated organizational PBX tenant. Pro se workspaces use the
individual's phone account. Accepted administrators/counsel/staff receive their
own phone identity in the organizational tenant; membership alone does not confer
professional credentials. Clients and pro se participants use personal phone tools.

Provisioning uses a database outbox with per-job leases and idempotent source
context IDs. The refresh timer runs roughly every minute, checks bounded batches
of 100 with at most five concurrent bridge calls, and retries failures. Signup
still succeeds if the phone provider is offline. Pending accounts can have an
identity provisioned but cannot call until email verification or explicit source
account approval. Existing users can be queued with the administrator backfill
button. Phone and PBX activation remain distinct from professional role approval.

Only identities and tenants created by this integration can be modified. Existing
SIP users are never adopted merely because an email matches. The SIP counterpart
uses internal non-deliverable identity aliases, random unknown login passwords,
and scoped identity mappings. JustiSolve sends source IDs, display names and
eligibility; it does not forward the JustiSolve password or reuse email as proof
of ownership. Recovery remains through the source JustiSolve account.

The bridge uses one strong, scoped bearer token and fixed HTTPS destination with
redirects disabled. It permits only provisioning, bound identity sessions, bound
call authorization, short-lived portal handoff and an explicit PBX action list.
It cannot create a SIP super administrator or switch arbitrary tenants. Source
workspace ownership/administration controls PBX administration; staff/counsel can
use their own extension identities without receiving PBX administration rights.

Account eligibility and membership are periodically synchronized. Disabling a
source account or removing a member blocks source API access immediately. Remote
identities have a ten-minute renewable eligibility lease; the SIP service expires
stale identities and sessions and checks leases on federated sessions. Network
outages therefore fail closed after that window. Existing live calls are not
forcibly terminated by these controls. Timers must be running for prompt changes.

## Phone area

Workspace navigation includes Phone & PBX, with provisioning status, explicit
connect/disconnect, dial, answer/decline, hangup, mute/unmute, hold/resume, DTMF,
PBX overview, extensions, queues, and full-service/billing portal access.
SIP credentials are delivered only through a signed-in, case-independent phone
session for the caller's authorized context and remain in browser memory, not
local storage. Browser SIP logging is disabled. The component disconnects on exit.
Microphone permission is requested through user-initiated calling actions.

The full phone portal uses a hashed, one-use 60-second ticket in the URL fragment.
The SIP landing page clears the fragment, redeems it with a same-origin POST,
and creates a limited one-hour session respecting SIP session limits. No
administrator cookie, source password or bearer integration token enters the
browser. Passkey requirements in the SIP interface continue to apply.

Calling is authorized by the SIP service before a dial request. PSTN calling
requires the SIP service's subscription, wallet, carrier routes and commissioning.
JustiSolve wallet funds are not silently copied into the SIP wallet. Organizational
PBX extension and queue records retain the upstream service's distinction between
planning records and commissioned live routes; the interface displays its readiness
note. This integration does not purchase a DID, activate a paid plan or place calls
automatically. It does not certify the phone service for emergency calling.

## Slider registration and interface

Registration now has five slides: account, workspace, roles, optional license,
and review. Each step validates its inputs; Back retains answers, passwords stay
in component memory and are never shown on the review slide, and the account is
submitted only from the final step. No signup password is stored in browser local
storage. Animated transitions respect reduced-motion preferences. Progress labels,
keyboard focus, mobile horizontal workspace navigation and responsive forms are
included.

## Validation

API/interface tests use synthetic identities, fake SMTP transports and mocked SIP
responses; no real phone calls, emails or paid provider operations are made.
The SIP repository's unrelated route-contract inventory test has existing failures
for older UI endpoints; they reproduce on the untouched pre-integration revision.
Scoped bridge, SIP session policy, PBX, JustiSolve API and interface tests are
validated separately. Deployment and actual SMTP/WebRTC/carrier calls require the
server installation and its operator-provided configuration.
