export const JUSTICE_SCHEMA=`
CREATE TABLE IF NOT EXISTS justice_roles (
 account_id BIGINT NOT NULL REFERENCES platform_accounts(id),role_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','revoked')),
 organization TEXT NOT NULL DEFAULT '',jurisdiction TEXT NOT NULL DEFAULT '',credential TEXT NOT NULL DEFAULT '',
 review_note TEXT NOT NULL DEFAULT '',reviewed_by BIGINT REFERENCES platform_accounts(id),
 requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),reviewed_at TIMESTAMPTZ,
 PRIMARY KEY(account_id,role_id)
);
ALTER TABLE justice_roles ADD COLUMN IF NOT EXISTS license_claim JSONB NOT NULL DEFAULT '{}';
ALTER TABLE justice_roles ADD COLUMN IF NOT EXISTS license_result JSONB NOT NULL DEFAULT '{}';
ALTER TABLE justice_roles ADD COLUMN IF NOT EXISTS license_version TEXT NOT NULL DEFAULT '';
ALTER TABLE justice_roles ADD COLUMN IF NOT EXISTS license_checked_at TIMESTAMPTZ;
ALTER TABLE justice_roles ADD COLUMN IF NOT EXISTS license_next_check TIMESTAMPTZ;
ALTER TABLE justice_roles ADD COLUMN IF NOT EXISTS license_check_lease TIMESTAMPTZ;
ALTER TABLE justice_roles ADD COLUMN IF NOT EXISTS license_valid_until TIMESTAMPTZ;
ALTER TABLE justice_roles ADD COLUMN IF NOT EXISTS license_manual_until TIMESTAMPTZ;
ALTER TABLE justice_roles ADD COLUMN IF NOT EXISTS license_manual_source TEXT NOT NULL DEFAULT '';
ALTER TABLE justice_roles ADD COLUMN IF NOT EXISTS license_review_note TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS justice_license_checks (
 id BIGSERIAL PRIMARY KEY,account_id BIGINT NOT NULL,role_id TEXT NOT NULL,
 result JSONB NOT NULL,checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(account_id,role_id) REFERENCES justice_roles(account_id,role_id)
);
CREATE INDEX IF NOT EXISTS justice_license_due_idx ON justice_roles(license_next_check);
CREATE TABLE IF NOT EXISTS justice_orgs (
 id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('law_firm','counsel','pro_se','business','court','organization')),
 owner_id BIGINT NOT NULL REFERENCES platform_accounts(id),active BOOLEAN NOT NULL DEFAULT true,
 features JSONB NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE justice_orgs DROP CONSTRAINT IF EXISTS justice_orgs_kind_check;
ALTER TABLE justice_orgs ADD CONSTRAINT justice_orgs_kind_check CHECK(kind IN ('law_firm','counsel','pro_se','business','court','organization'));
CREATE TABLE IF NOT EXISTS justice_org_members (
 org_id BIGINT NOT NULL REFERENCES justice_orgs(id),account_id BIGINT NOT NULL REFERENCES platform_accounts(id),
 role TEXT NOT NULL CHECK(role IN ('owner','admin','counsel','staff','client','pro_se')),active BOOLEAN NOT NULL DEFAULT true,
 PRIMARY KEY(org_id,account_id)
);
CREATE TABLE IF NOT EXISTS justice_org_invites (
 id BIGSERIAL PRIMARY KEY,org_id BIGINT NOT NULL REFERENCES justice_orgs(id),email TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','counsel','staff','client','pro_se')),created_by BIGINT NOT NULL REFERENCES platform_accounts(id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','revoked')),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '7 days',UNIQUE(org_id,email)
);
CREATE INDEX IF NOT EXISTS justice_org_member_account_idx ON justice_org_members(account_id,org_id);
CREATE TABLE IF NOT EXISTS justice_matters (
 id BIGSERIAL PRIMARY KEY,owner_id BIGINT NOT NULL REFERENCES platform_accounts(id),
 title TEXT NOT NULL,jurisdiction TEXT NOT NULL,court TEXT NOT NULL,reference TEXT NOT NULL DEFAULT '',
 confidentiality TEXT NOT NULL CHECK(confidentiality IN ('private','restricted','sealed')),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE justice_matters ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES justice_orgs(id);
CREATE INDEX IF NOT EXISTS justice_matters_org_idx ON justice_matters(org_id);
CREATE TABLE IF NOT EXISTS justice_members (
 matter_id BIGINT NOT NULL REFERENCES justice_matters(id),account_id BIGINT NOT NULL REFERENCES platform_accounts(id),
 role_id TEXT NOT NULL,can_write BOOLEAN NOT NULL DEFAULT false,sealed_access BOOLEAN NOT NULL DEFAULT false,
 PRIMARY KEY(matter_id,account_id,role_id), FOREIGN KEY(account_id,role_id) REFERENCES justice_roles(account_id,role_id)
);
CREATE TABLE IF NOT EXISTS justice_work (
 id BIGSERIAL PRIMARY KEY,matter_id BIGINT NOT NULL REFERENCES justice_matters(id),
 role_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('task','record','hearing','disclosure','custody','accommodation','service','report','document','evidence','transcript','research','deadline','note','motion')),
 title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','in_progress','review','completed','cancelled')),
 due_at TIMESTAMPTZ,assigned_to BIGINT REFERENCES platform_accounts(id),created_by BIGINT NOT NULL REFERENCES platform_accounts(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE justice_work DROP CONSTRAINT IF EXISTS justice_work_kind_check;
ALTER TABLE justice_work ADD CONSTRAINT justice_work_kind_check CHECK(kind IN ('task','record','hearing','disclosure','custody','accommodation','service','report','document','evidence','transcript','research','deadline','note','motion'));
CREATE TABLE IF NOT EXISTS justice_files (
 id BIGSERIAL PRIMARY KEY,matter_id BIGINT NOT NULL REFERENCES justice_matters(id),uploaded_by BIGINT NOT NULL REFERENCES platform_accounts(id),
 filename TEXT NOT NULL,object_key TEXT UNIQUE NOT NULL,mime_type TEXT NOT NULL,size_bytes BIGINT NOT NULL,sha256 TEXT NOT NULL,
 deleted_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS justice_files_matter_idx ON justice_files(matter_id);
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
