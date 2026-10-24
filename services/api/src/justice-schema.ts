export const JUSTICE_SCHEMA=`
CREATE TABLE IF NOT EXISTS justice_roles (
 account_id BIGINT NOT NULL REFERENCES platform_accounts(id),role_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','revoked')),
 organization TEXT NOT NULL DEFAULT '',jurisdiction TEXT NOT NULL DEFAULT '',credential TEXT NOT NULL DEFAULT '',
 review_note TEXT NOT NULL DEFAULT '',reviewed_by BIGINT REFERENCES platform_accounts(id),
 requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),reviewed_at TIMESTAMPTZ,
 PRIMARY KEY(account_id,role_id)
);
CREATE TABLE IF NOT EXISTS justice_matters (
 id BIGSERIAL PRIMARY KEY,owner_id BIGINT NOT NULL REFERENCES platform_accounts(id),
 title TEXT NOT NULL,jurisdiction TEXT NOT NULL,court TEXT NOT NULL,reference TEXT NOT NULL DEFAULT '',
 confidentiality TEXT NOT NULL CHECK(confidentiality IN ('private','restricted','sealed')),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS justice_members (
 matter_id BIGINT NOT NULL REFERENCES justice_matters(id),account_id BIGINT NOT NULL REFERENCES platform_accounts(id),
 role_id TEXT NOT NULL,can_write BOOLEAN NOT NULL DEFAULT false,sealed_access BOOLEAN NOT NULL DEFAULT false,
 PRIMARY KEY(matter_id,account_id,role_id), FOREIGN KEY(account_id,role_id) REFERENCES justice_roles(account_id,role_id)
);
CREATE TABLE IF NOT EXISTS justice_work (
 id BIGSERIAL PRIMARY KEY,matter_id BIGINT NOT NULL REFERENCES justice_matters(id),
 role_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('task','record','hearing','disclosure','custody','accommodation','service','report')),
 title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','in_progress','review','completed','cancelled')),
 due_at TIMESTAMPTZ,assigned_to BIGINT REFERENCES platform_accounts(id),created_by BIGINT NOT NULL REFERENCES platform_accounts(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS justice_proceedings (
 id BIGSERIAL PRIMARY KEY,matter_id BIGINT NOT NULL REFERENCES justice_matters(id),created_by BIGINT NOT NULL REFERENCES platform_accounts(id),
 role_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('trial','hearing','appeal')),title TEXT NOT NULL,
 source TEXT NOT NULL,issues TEXT NOT NULL,provider TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'ready' CHECK(status IN ('ready','running','paused','completed','cancelled','failed')),
 transcript JSONB NOT NULL DEFAULT '[]',turn INT NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE justice_proceedings ADD COLUMN IF NOT EXISTS run_token TEXT;
CREATE INDEX IF NOT EXISTS justice_proceedings_matter_idx ON justice_proceedings(matter_id);
CREATE INDEX IF NOT EXISTS justice_work_matter_idx ON justice_work(matter_id,id);
CREATE INDEX IF NOT EXISTS justice_members_account_idx ON justice_members(account_id,matter_id);
`;
