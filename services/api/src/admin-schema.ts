export const ADMIN_SCHEMA=`
SELECT setval('tenants_tenant_id_seq',greatest((SELECT coalesce(max(tenant_id),1) FROM tenants),(SELECT last_value FROM tenants_tenant_id_seq)),true);
CREATE TABLE IF NOT EXISTS platform_accounts (
 id BIGSERIAL PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,
 password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'super_admin',active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_sessions (
 token_hash TEXT PRIMARY KEY,account_id BIGINT NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS news_campaigns (
 id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,source TEXT NOT NULL DEFAULT 'courtlistener',keywords TEXT NOT NULL DEFAULT '',
 enabled BOOLEAN NOT NULL DEFAULT true,auto_publish BOOLEAN NOT NULL DEFAULT true,
 interval_minutes INT NOT NULL DEFAULT 360 CHECK(interval_minutes BETWEEN 60 AND 10080),
 provider TEXT NOT NULL,allow_external BOOLEAN NOT NULL DEFAULT false,max_items INT NOT NULL DEFAULT 2 CHECK(max_items BETWEEN 1 AND 5),
 next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),last_run_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS news_posts (
 id BIGSERIAL PRIMARY KEY,campaign_id BIGINT REFERENCES news_campaigns(id),source_url TEXT UNIQUE NOT NULL,source_title TEXT NOT NULL,
 title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','unpublished','failed')),
 provider TEXT NOT NULL,source_excerpt TEXT NOT NULL DEFAULT '',failure TEXT NOT NULL DEFAULT '',
 published_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS automation_runs (
 id BIGSERIAL PRIMARY KEY,campaign_id BIGINT REFERENCES news_campaigns(id),status TEXT NOT NULL DEFAULT 'running',
 message TEXT NOT NULL DEFAULT '',items_created INT NOT NULL DEFAULT 0,started_at TIMESTAMPTZ NOT NULL DEFAULT now(),finished_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY,value JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
INSERT INTO platform_settings(key,value) VALUES('news_paused','false') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS policy_requests (
 id BIGSERIAL PRIMARY KEY,kind TEXT NOT NULL,email TEXT NOT NULL,source_url TEXT NOT NULL DEFAULT '',message TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open',created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE news_campaigns ADD COLUMN IF NOT EXISTS generate_media BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE news_posts ADD COLUMN IF NOT EXISTS narration TEXT NOT NULL DEFAULT '';
ALTER TABLE news_posts ADD COLUMN IF NOT EXISTS audio_key TEXT NOT NULL DEFAULT '';
ALTER TABLE news_posts ADD COLUMN IF NOT EXISTS video_key TEXT NOT NULL DEFAULT '';
ALTER TABLE news_posts ADD COLUMN IF NOT EXISTS media_status TEXT NOT NULL DEFAULT 'pending';
CREATE TABLE IF NOT EXISTS court_automations (
 id BIGSERIAL PRIMARY KEY,case_id BIGINT NOT NULL REFERENCES cases(case_id),name TEXT NOT NULL,request TEXT NOT NULL,source TEXT NOT NULL,
 court TEXT NOT NULL,case_number TEXT NOT NULL DEFAULT '',parties TEXT NOT NULL DEFAULT '',court_rules TEXT NOT NULL DEFAULT '',
 providers JSONB NOT NULL,synthesis_provider TEXT NOT NULL,allow_external BOOLEAN NOT NULL DEFAULT false,
 target_score INT NOT NULL DEFAULT 90 CHECK(target_score BETWEEN 80 AND 100),enabled BOOLEAN NOT NULL DEFAULT true,
 interval_minutes INT NOT NULL DEFAULT 1440 CHECK(interval_minutes BETWEEN 60 AND 10080),next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 last_input_hash TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS court_automation_runs (
 id BIGSERIAL PRIMARY KEY,automation_id BIGINT REFERENCES court_automations(id),status TEXT NOT NULL,
 result JSONB NOT NULL DEFAULT '{}',draft_id BIGINT REFERENCES drafts(draft_id),created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS case_intakes (
 id BIGSERIAL PRIMARY KEY,account_id BIGINT NOT NULL REFERENCES platform_accounts(id),narrative TEXT NOT NULL,jurisdiction TEXT NOT NULL DEFAULT '',
 provider TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'processing',files JSONB NOT NULL DEFAULT '[]',result JSONB NOT NULL DEFAULT '{}',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS intake_owner_idx ON case_intakes(account_id,created_at DESC);
CREATE INDEX IF NOT EXISTS news_public_idx ON news_posts(status,published_at DESC);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON platform_sessions(expires_at);
`;
