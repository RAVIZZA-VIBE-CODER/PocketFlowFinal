CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('survey', 'event', 'contest')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  questions_json TEXT NOT NULL DEFAULT '[]',
  closes_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS campaigns_public_idx ON campaigns (status, closes_at, created_at);

CREATE TABLE IF NOT EXISTS contest_submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  project_name TEXT NOT NULL,
  github_url TEXT NOT NULL,
  description TEXT NOT NULL,
  attachment_key TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'shortlisted', 'selected', 'declined')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS contest_submissions_status_idx ON contest_submissions (status, created_at);

CREATE TABLE IF NOT EXISTS campaign_responses (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS campaign_responses_campaign_idx ON campaign_responses (campaign_id, created_at);
