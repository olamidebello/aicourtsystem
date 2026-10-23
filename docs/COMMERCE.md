# Marketplace and PACER billing

Pull and install in one command on the existing server as root (default production checkout: `/opt/aicourtsystem`):

```bash
ansible-pull -U https://github.com/olamidebello/justisolve.git -C main -d /opt/justisolve-bootstrap -i localhost, -c local ansible/pull-and-install.yml
```

If Ansible is not installed, run `apt-get update && apt-get install -y ansible git` first. For a different production checkout append `-e app_dir=/actual/checkout`. For a different existing Compose project append `-e compose_project=yourproject`. The bootstrap checkout is separate from production; do not set it to the production path. The playbook pulls `main` into the production checkout, refuses to discard tracked local changes, then installs and checks the update. It requires the existing `.env` and a running Docker installation; for a new server use `ansible/hosting.yml` first. This updates JustiSolve API/web; it does not reconfigure other domains or download AI models.

Alternatively, deploy directly from the existing server checkout:

```bash
git pull --ff-only
ansible-playbook -i localhost, -c local ansible/commerce.yml -e "app_dir=$PWD"
```

The playbook preserves `.env`, generates `COMMERCE_ENCRYPTION_KEY` only if absent, rebuilds API/web, preserves volumes, and verifies health and authenticated routes. Use the existing Compose project name via `-e compose_project=...` if it differs from `docker`. Back up `.env` securely: changing the encryption key makes existing credentials unreadable. Run after the initial hosting deployment. Existing full deployment also needs the encryption key before credentials can be saved.

In **Administration > commerce**, configure Stripe secret key or PayPal client ID/secret, select production mode, then enable the desired gateway. Credentials are encrypted with AES-256-GCM and never returned to the browser. A $10 credit product is provided; administrators can create, edit, publish, and unpublish credit products with independent selling prices and credited amounts. All amounts are USD cents. Existing orders retain their original price and credits. Stripe test payments and PayPal sandbox payments never credit the production wallet. Test mode therefore does not provide spendable credits.

Payments use hosted Stripe Checkout or PayPal approval and capture. Return to the marketplace after paying; **Verify payment** safely retries provider verification. Credits are issued only after server-side verification of order identity, amount, currency, and paid/captured status. Row locks prevent repeated verification from crediting an order twice. Settlement currently occurs on return or user verification, not on a webhook; orders remain pending until verification. Refunds and chargebacks must be handled with the gateway and reconciled operationally; automated refund/dispute processing is not part of this release.

Users choose **My own PACER account** or **System PACER account**. Personal passwords and MFA codes are used only for login, never stored. Personal searches are billed directly by PACER and do not require wallet funds or incur the platform markup. Both modes require explicit authorization before each production search page. Case Locator searches are supported; court docket/PDF links open at the court and require the user's own court access. General case-management records remain restricted to administrators.

For system access, save an authorized PACER username/password/client code, enable managed PACER globally, and grant each user access and a monthly spending limit. MFA remains an interactive code per connection. System credentials never reach users. Ordinary users may buy credits and view only their own orders and usage.

The server checks available funds before system login and atomically reserves funds before every search. Default reserve is $5 including markup; the monthly limit includes settled charges and outstanding holds. User confirmation includes the reserve amount; a changed reserve requires renewed confirmation. No funds or access means no upstream search. Every managed search receipt is billed at **PACER cost + 30%**, rounded to whole cents: $1.00 + $0.30 = $1.30. A $0.10 receipt becomes $0.13. Free receipts remain free. Unused reserves return to the wallet exactly once.

Timeouts, missing receipts, malformed fees, process interruption, or charges above the reserve retain the hold for administrator review. Do not retry an uncertain PACER search blindly: PACER may have charged it. **PACER usage & reconciliation** accepts the confirmed PACER cost and a receipt reference/reason; the server computes the 30% fee. Costs above the reserve require enough additional wallet funds for reconciliation. Confirmed no-charge searches are reconciled at zero. Global pause and user revocation are enforced again on every search. Gateway and access changes, credential updates, product changes, and manual reconciliations are audited without recording secrets.

No real payment or billable PACER query is required by deployment or automated tests. API tests cover schema reapplication, markup, unknown fees, insufficient credit, permission boundaries, session ownership, receipt settlement, and payment credit idempotency. Production merchant/PACER credentials and a live end-to-end check are required before accepting real customers.

## Super admin keys, APIs and manual user credits

Open **Administration > Keys, APIs & Billing**. The encrypted credentials section manages Stripe/PayPal API credentials and system PACER username, password and client code. Saving nonblank values replaces credentials; blank fields retain existing values. **Remove credential & pause service** deletes the saved credential and pauses the corresponding gateway or system PACER. Credential values are never returned by the list API, rendered back into saved fields, or written to audit logs. Removing payment credentials also prevents verifying outstanding orders until valid credentials are restored.

**JustiSolve API access keys** creates scoped REST API keys for active, verified accounts. Select the account, key name, PACER and/or wallet scope, and a 1–365 day expiry. Copy the key when created; only its hash is saved. Keys cannot administer JustiSolve, even when issued for a super admin account. Use `X-API-Key: <key>` on authorized `/api/pacer/...` or `/api/marketplace...` requests. PACER session tokens still use `Authorization: Bearer <session>` after connecting. Account disablement, key expiry and revocation block subsequent key requests. System PACER additionally requires permission, wallet funds, and per-search charge consent. These are JustiSolve client API keys; they do not replace external AI-provider credentials.

Each account card has **Manual wallet credit**. Enter the USD amount (up to $10,000 per adjustment) and a 5–1000 character reason or payment reference, check the displayed recipient and amount, then choose **Add user credit**. This creates spendable credit without charging a gateway. The account balance and manual-credit history refresh after saving. Each adjustment records the account, acting administrator, amount, reason and timestamp; transaction-safe request IDs prevent repeat submissions from crediting twice. Manual credits do not grant PACER permission automatically. Ordinary users and API keys cannot create credits, edit credentials or manage API keys.

Redeploy through `ansible/pull-and-install.yml` to apply the additive database tables and new controls. No new credentials or live billable tests are needed to install this update.

## AI keys and provisioning

Open **Administration > AI Provisioning** to configure OpenAI, Anthropic Claude, and local Ollama models. This section manages provider credentials, separately from the JustiSolve client API keys under Keys, APIs & Billing.

Existing server keys and model settings remain in use until an administrator saves an override. For a hosted provider, leave it disabled, enter a new key (or select existing-server-key reuse), and save. Choose **Test saved connection / list models**, select an appropriate generation model ID, enable the provider, and save again. Model listing checks credential access and discovery; it does not prove generation support, quota, or billing readiness. The model field also accepts a manually entered ID. No default hosted model or new vendor key is created by deployment.

Saved keys use the existing encrypted secret store. List responses contain only key-presence metadata; key values are never returned to the admin GUI. Blank inputs preserve saved keys. **Remove key & disable provider** deletes the GUI-managed key, disables the provider, and disables fallback to its environment key. Enable/disable, save, remove, test and local download operations are audited without secrets. Revoking an upstream vendor key itself must be done with that vendor; the GUI removal controls JustiSolve's use of it.

The API supplies runtime configuration to the AI container through a separate token-protected internal endpoint. The deployment preserves or generates `AI_CONFIG_TOKEN` and injects it into API and AI services; it rebuilds API, web and AI while preserving existing volumes. Subsequent AI calls load the saved configuration, so an API/web-only restart does not lose provider settings. A failed configuration read disables providers for that request rather than silently reactivating an older environment key. Already-running requests may finish with the configuration they started with.

Configure 1–4 enabled Ollama models, comma separated. The first model powers basic drafting, analysis and comparison. **Download model to server** explicitly pulls the named model into the existing Ollama store; it may take several minutes and requires sufficient disk and memory. Downloading a model does not enable it automatically. Hosted providers are used by existing provider-selection workflows (case intake, ensemble drafting, news) that require external-processing consent. Basic tools remain local and fail clearly if all local models are disabled.

Deployment and automated tests perform no live provider generation, billable PACER searches, real payments, or model downloads. Provider checks and downloads occur only when an administrator clicks those controls.

## Multiple AI models and latest-model defaults

Hosted providers now support up to 100 provisioned model IDs per provider, using one encrypted provider key. In **AI Provisioning**, test the saved connection to discover models, check the text models you want users to access (or choose **Select all compatible models**), then save. Models can also be entered as comma-separated IDs. Image, speech, realtime, embedding, legacy completion and specialized search/coding names are not offered for these text workflows. Model listing still does not prove generation capability or available quota.

Each provisioned hosted model has a distinct option, such as `openai:gpt-6.1-sol` and `openai:gpt-5.4`. Users can select the desired model in case intake; drafting and analysis also have model selectors in the admin workspace. Ensemble drafting supports several models from the same provider, still with a 2–4 model limit. Its latest model and merge/review model are preselected, and the user chooses at least one additional model before running it.

The default is selected from enabled, provisioned models, never from an unapproved model merely discovered on the vendor account. OpenAI is preferred when enabled, then Claude, then the first configured Ollama model. Within hosted providers, model-family version numbers are ordered first and discovery creation metadata breaks version ties; this is a latest-version policy, not a quality or legal-accuracy score. For the provided model list, `gpt-6.1-sol` becomes the default when it is provisioned and enabled. Saving a newer compatible model updates the default for subsequently opened workflows. An explicit user selection is respected. Disabling or removing a model blocks future requests selecting that model.

Existing saved `openai` and `claude` references remain supported and resolve to that provider's latest enabled provisioned model. Existing single-model settings remain valid. External-source consent is required for hosted models, including when the default is hosted. The backend validates the selected model against provisioned models and returns the actual model ID in basic drafting/analysis responses. No model is downloaded or invoked automatically by selecting it in the GUI or by this deployment.
