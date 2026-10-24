export const COMMUNICATIONS_SCHEMA=`
CREATE TABLE IF NOT EXISTS communication_deliveries (
 id BIGSERIAL PRIMARY KEY,recipient TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS phone_accounts (
 id BIGSERIAL PRIMARY KEY,account_id BIGINT NOT NULL REFERENCES platform_accounts(id),org_id BIGINT REFERENCES justice_orgs(id),
 context_key TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',provider_info JSONB NOT NULL DEFAULT '{}',
 attempts INT NOT NULL DEFAULT 0,next_attempt TIMESTAMPTZ NOT NULL DEFAULT now(),lease_until TIMESTAMPTZ,
 last_checked_at TIMESTAMPTZ,last_error TEXT NOT NULL DEFAULT '',UNIQUE(account_id,context_key)
);
CREATE INDEX IF NOT EXISTS phone_accounts_due_idx ON phone_accounts(next_attempt);
`;
