# Marketplace and PACER billing

Deploy from the existing server checkout (the default app directory is `/opt/aicourtsystem`):

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
