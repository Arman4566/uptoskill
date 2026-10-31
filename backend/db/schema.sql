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

-- ===================================================================================================
-- Real-money layer: credit purchases, tutor withdrawals, website fee, video lessons + recordings.
-- Everything below is idempotent, so `npm run db:migrate` is safe on an existing database.
-- ===================================================================================================

-- The website's own account. Fees are ledger rows credited to it, so the ledger always sums to
-- (money in) - (money out) and website revenue is simply this user's balance. It can never log in.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform BOOLEAN NOT NULL DEFAULT false;
INSERT INTO users (name, email, password_hash, is_platform)
VALUES ('UpToSkill Platform', 'platform@uptoskill.internal', '!', true)
ON CONFLICT (email) DO NOTHING;

-- Sessions now record both sides of the price: what the student paid, what the tutor gets, what the site keeps.
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_credits_check;   -- old 1..6 cap
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_credits_range;
ALTER TABLE sessions ADD CONSTRAINT sessions_credits_range CHECK (credits >= 1);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tutor_credits INT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS fee_credits   INT NOT NULL DEFAULT 0;
UPDATE sessions SET tutor_credits = credits WHERE tutor_credits IS NULL;  -- old sessions: no fee
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_price_split;
ALTER TABLE sessions ADD CONSTRAINT sessions_price_split
  CHECK (tutor_credits IS NULL OR (tutor_credits >= 1 AND tutor_credits + fee_credits = credits));
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS video_room TEXT;           -- Daily room name

-- New ledger reasons: purchase (+), fee (+, platform), withdraw_hold (-), withdraw_refund (+).
ALTER TABLE credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_reason_check;
ALTER TABLE credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_check;
ALTER TABLE credit_ledger DROP CONSTRAINT IF EXISTS ledger_reason_chk;
ALTER TABLE credit_ledger DROP CONSTRAINT IF EXISTS ledger_sign_chk;
ALTER TABLE credit_ledger ADD CONSTRAINT ledger_reason_chk CHECK (reason IN (
  'starter','hold','release','payout','bonus','bounty_hold','bounty_payout','bounty_refund',
  'purchase','fee','withdraw_hold','withdraw_refund'));
ALTER TABLE credit_ledger ADD CONSTRAINT ledger_sign_chk CHECK (
     (reason IN ('hold','bounty_hold','withdraw_hold') AND delta < 0)
  OR (reason NOT IN ('hold','bounty_hold','withdraw_hold') AND delta > 0));

-- Older copies of this file named some columns after a real payment company. Rename them once (no-op on new databases).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT table_name AS t, column_name AS c FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name LIKE 'razorpay\_%' LOOP
    EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', r.t, r.c, replace(r.c, 'razorpay_', 'gateway_'));
  END LOOP;
END $$;

-- Money in: one row per SimPay order. Credits are added only when the payment is verified as captured.
CREATE TABLE IF NOT EXISTS payments (
  id                   SERIAL PRIMARY KEY,
  user_id              INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credits              INT NOT NULL CHECK (credits > 0),
  amount_paise         BIGINT NOT NULL CHECK (amount_paise > 0),
  gateway_order_id     TEXT NOT NULL UNIQUE,
  gateway_payment_id   TEXT UNIQUE,
  status               TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at              TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_id, created_at DESC);

-- Where a tutor wants to be paid. Full bank numbers are NOT stored here, only the gateway's ids and a masked label.
CREATE TABLE IF NOT EXISTS payout_accounts (
  user_id                   INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  kind                      TEXT NOT NULL CHECK (kind IN ('upi','bank')),
  label                     TEXT NOT NULL,                -- e.g. "riya@okbank" or "HDFC ****1234"
  gateway_contact_id        TEXT NOT NULL,
  gateway_fund_account_id   TEXT NOT NULL,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Money out: one row per withdrawal. The credits leave the ledger first (withdraw_hold), come back
-- (withdraw_refund) only if the payout fails or is reversed.
CREATE TABLE IF NOT EXISTS payouts (
  id                       SERIAL PRIMARY KEY,
  user_id                  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credits                  INT NOT NULL CHECK (credits > 0),
  amount_paise             BIGINT NOT NULL CHECK (amount_paise > 0),
  fund_account_id          TEXT NOT NULL,
  mode                     TEXT NOT NULL CHECK (mode IN ('UPI','IMPS')),
  status                   TEXT NOT NULL DEFAULT 'queued'
                           CHECK (status IN ('queued','processing','paid','failed','reversed')),
  gateway_payout_id        TEXT UNIQUE,
  failure_reason           TEXT,
  attempts                 INT NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payouts_user ON payouts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts (status);

-- Finished lesson recordings (Daily cloud recording). One session can have several (pauses, reconnects).
CREATE TABLE IF NOT EXISTS recordings (
  id                 SERIAL PRIMARY KEY,
  session_id         INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  daily_recording_id TEXT NOT NULL UNIQUE,
  duration_sec       INT,
  started_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recordings_session ON recordings (session_id);

/* ============================ SimPay: the simulated payment gateway + bank ============================
   Stands in for a real payment company. Nothing here moves real money. It keeps its own books in rupees
   (paise) so the demo can show money leaving a pretend bank account when credits are bought, and arriving
   in it when earnings are withdrawn. The credit ledger above stays the single source of truth for credits. */
CREATE TABLE IF NOT EXISTS simpay_orders (
  id           TEXT PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  receipt      TEXT,
  status       TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS simpay_payments (
  id           TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL REFERENCES simpay_orders(id) ON DELETE CASCADE,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL,
  method       TEXT NOT NULL CHECK (method IN ('card','upi','netbanking')),
  detail       TEXT,                                  -- masked: "card ****1111", "name@bank", "SBI"
  status       TEXT NOT NULL CHECK (status IN ('captured','failed')),
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_simpay_one_capture ON simpay_payments (order_id) WHERE status = 'captured';
CREATE INDEX IF NOT EXISTS idx_simpay_payments_user ON simpay_payments (user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS simpay_accounts (
  id         TEXT PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('upi','bank')),
  detail     TEXT NOT NULL,                           -- upi id, or "IFSC:accountnumber" (simulation only)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS simpay_payouts (
  id              TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,               -- same key twice = same payout, never two
  reference_id    TEXT NOT NULL,                      -- "uts-payout-<our payout id>"
  user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id      TEXT NOT NULL REFERENCES simpay_accounts(id),
  amount_paise    BIGINT NOT NULL CHECK (amount_paise > 0),
  mode            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','processed','failed')),
  reason          TEXT,
  settle_at       TIMESTAMPTZ NOT NULL,               -- when the pretend bank finishes the transfer
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_simpay_payouts_due ON simpay_payouts (status, settle_at);
-- The user's pretend bank account: one row per movement, balance = SUM(delta_paise). "ref" makes each movement happen once.
CREATE TABLE IF NOT EXISTS simpay_bank (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta_paise BIGINT NOT NULL,
  note        TEXT NOT NULL,
  ref         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, ref)
);

-- Tutor's lesson notes (typed text + pasted screenshots). When the lesson ends a PDF is built from them and
-- stored here, so the student can open it any time. Both people can download it afterwards.
CREATE TABLE IF NOT EXISTS lesson_notes (
  session_id INT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  body       TEXT NOT NULL DEFAULT '',
  images     JSONB NOT NULL DEFAULT '[]',
  pdf        BYTEA,
  pdf_at     TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
