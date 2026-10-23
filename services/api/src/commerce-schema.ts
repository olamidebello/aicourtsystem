export const COMMERCE_SCHEMA=`
CREATE TABLE IF NOT EXISTS commerce_secrets (name TEXT PRIMARY KEY,ciphertext TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS commerce_wallets (account_id BIGINT PRIMARY KEY REFERENCES platform_accounts(id),balance_cents BIGINT NOT NULL DEFAULT 0 CHECK(balance_cents>=0));
CREATE TABLE IF NOT EXISTS commerce_products (id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',price_cents INT NOT NULL CHECK(price_cents>0),credit_cents INT NOT NULL CHECK(credit_cents>0),active BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS commerce_orders (id UUID PRIMARY KEY,account_id BIGINT NOT NULL REFERENCES platform_accounts(id),product_name TEXT NOT NULL,amount_cents INT NOT NULL,credit_cents INT NOT NULL,gateway TEXT NOT NULL,provider_id TEXT UNIQUE,url TEXT,status TEXT NOT NULL DEFAULT 'pending',created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS pacer_access (account_id BIGINT PRIMARY KEY REFERENCES platform_accounts(id),enabled BOOLEAN NOT NULL DEFAULT false,limit_cents INT NOT NULL DEFAULT 1000 CHECK(limit_cents>=0));
CREATE TABLE IF NOT EXISTS pacer_usage (id UUID PRIMARY KEY,account_id BIGINT NOT NULL REFERENCES platform_accounts(id),reserved_cents INT NOT NULL,base_cents INT,fee_cents INT,total_cents INT,status TEXT NOT NULL DEFAULT 'pending',receipt JSONB,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
INSERT INTO platform_settings(key,value) VALUES ('commerce','{"stripe_enabled":false,"paypal_enabled":false,"paypal_sandbox":true,"pacer_enabled":false,"search_reserve_cents":500,"markup_percent":30}') ON CONFLICT DO NOTHING;
INSERT INTO commerce_products(name,description,price_cents,credit_cents,active)
SELECT 'PACER wallet $10','Prepaid wallet credits for system PACER searches.',1000,1000,true WHERE NOT EXISTS(SELECT 1 FROM commerce_products);
CREATE TABLE IF NOT EXISTS commerce_adjustments (
 id UUID PRIMARY KEY,account_id BIGINT NOT NULL REFERENCES platform_accounts(id),actor_id BIGINT NOT NULL REFERENCES platform_accounts(id),
 amount_cents INT NOT NULL CHECK(amount_cents>0),reason TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_api_keys (
 id UUID PRIMARY KEY,account_id BIGINT NOT NULL REFERENCES platform_accounts(id),name TEXT NOT NULL,
 token_hash TEXT UNIQUE NOT NULL,scopes JSONB NOT NULL,expires_at TIMESTAMPTZ NOT NULL,revoked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),last_used_at TIMESTAMPTZ
);
`;
