-- UpToSkill schema. Idempotent: safe to run repeatedly.

CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  level           INT  NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 4),
  languages       TEXT[] NOT NULL DEFAULT '{}',
  bio             TEXT NOT NULL DEFAULT '',
  rating_avg      NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count    INT  NOT NULL DEFAULT 0,
  sessions_given  INT  NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which login the account belongs to (student or tutor login page). Added with ALTER so older databases upgrade in place.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student','tutor'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS skills (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS user_skills (
  user_id          INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id         INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  experience_level INT NOT NULL DEFAULT 1 CHECK (experience_level BETWEEN 1 AND 5),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS availability_slots (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  is_booked  BOOLEAN NOT NULL DEFAULT false,
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_slots_user_time ON availability_slots (user_id, starts_at);

CREATE TABLE IF NOT EXISTS sessions (
  id          SERIAL PRIMARY KEY,
  learner_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'booked' CHECK (type IN ('booked','instant')),
  status      TEXT NOT NULL DEFAULT 'requested'
              CHECK (status IN ('requested','accepted','in_progress','completed',
                                'declined','expired','cancelled','no_show')),
  title        TEXT NOT NULL,
  problem_text TEXT NOT NULL,
  tags         TEXT[] NOT NULL DEFAULT '{}',
  difficulty   INT CHECK (difficulty BETWEEN 1 AND 3),
  minutes      INT NOT NULL CHECK (minutes IN (10,15,30,45)),
  credits      INT NOT NULL CHECK (credits BETWEEN 1 AND 6),   -- hard cap enforced in DB too
  ai_brief     JSONB,
  slot_id      INT REFERENCES availability_slots(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ,
  accepted_at  TIMESTAMPTZ,
  started_at   TIMESTAMPTZ,
  ended_at     TIMESTAMPTZ,
  settled_at   TIMESTAMPTZ,
  CHECK (learner_id <> mentor_id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_learner ON sessions (learner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_mentor  ON sessions (mentor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status  ON sessions (status);

-- Every credit movement is a row. Balance = SUM(delta). Holds are negative rows.
CREATE TABLE IF NOT EXISTS credit_ledger (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta      INT  NOT NULL CHECK (delta <> 0),
  reason     TEXT NOT NULL CHECK (reason IN ('starter','hold','release','payout','bonus',
                                             'bounty_hold','bounty_payout','bounty_refund')),
  ref_type   TEXT NOT NULL,
  ref_id     INT  NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- sign must match the reason: holds take credits out, everything else puts them in
  CHECK ( (reason IN ('hold','bounty_hold') AND delta < 0)
       OR (reason NOT IN ('hold','bounty_hold') AND delta > 0) )
);
-- One settlement per (thing, kind, user): re-running a settle can never double pay.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_settlement
  ON credit_ledger (ref_type, ref_id, reason, user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON credit_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS session_notes (
  session_id INT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  summary    JSONB,
  final_code TEXT,
  status     TEXT NOT NULL DEFAULT 'unavailable' CHECK (status IN ('ok','unavailable')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id         SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sender_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ratings (
  id         SERIAL PRIMARY KEY,
  session_id INT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  learner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stars      INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bounties (
  id          SERIAL PRIMARY KEY,
  author_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_text TEXT NOT NULL,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  reward      INT NOT NULL CHECK (reward BETWEEN 1 AND 10),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','solved','expired')),
  deadline    TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bounty_answers (
  id         SERIAL PRIMARY KEY,
  bounty_id  INT NOT NULL REFERENCES bounties(id) ON DELETE CASCADE,
  helper_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  accepted   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Instant Help: the atomic claim is UPDATE ... WHERE status='open'.
CREATE TABLE IF NOT EXISTS instant_requests (
  id          SERIAL PRIMARY KEY,
  learner_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_text TEXT NOT NULL,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  minutes     INT NOT NULL CHECK (minutes IN (10,15)),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','expired')),
  claimed_by  INT REFERENCES users(id) ON DELETE SET NULL,
  session_id  INT REFERENCES sessions(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS badges (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_key  TEXT NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_key)
);

-- ---------------------------------------------------------------------------------------------
-- App data saved by the website (student app, tutor app). Everything a user adds in the frontend
-- is stored here instead of only in the browser.
-- ---------------------------------------------------------------------------------------------

-- Private per-account data (a student's sessions / credits / doubts, a tutor's sessions / ledger / settings ...).
CREATE TABLE IF NOT EXISTS user_state (
  user_id    INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- Data that two accounts both see: tutor public profiles, student<->tutor chat threads, notifications.
-- collection: 'profiles' | 'chats' | 'notifs' (tutor -> student) | 'tnotifs' (student -> tutor)
-- item_key:   profiles: owner email · chats: "student-email|tutor-email" · notifs: notification id
-- owner_email / to_email decide who may read and write the row.
CREATE TABLE IF NOT EXISTS shared_items (
  collection TEXT NOT NULL CHECK (collection IN ('profiles','chats','notifs','tnotifs')),
  item_key   TEXT NOT NULL,
  owner_id   INT  REFERENCES users(id) ON DELETE CASCADE,
  to_email   TEXT,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, item_key)
);
CREATE INDEX IF NOT EXISTS idx_shared_to ON shared_items (collection, to_email);

-- A tutor's intro video (max 1 minute, up to 100 MB), so students on other devices can play it.
CREATE TABLE IF NOT EXISTS tutor_videos (
  user_id    INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mime       TEXT NOT NULL,
  data       BYTEA NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
