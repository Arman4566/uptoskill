-- UpToSkill demo data. Safe to run repeatedly. Every demo account uses the password: demo1234
-- Needs the tables from schema.sql first (npm run db:migrate).
BEGIN;

-- Tag vocabulary (sessions may only use tags that exist here).
INSERT INTO skills (name) VALUES
  ('React'), ('JavaScript'), ('TypeScript'), ('Node'), ('SQL'),
  ('Python'), ('DSA'), ('Git'), ('Flutter'), ('WebGL')
ON CONFLICT (name) DO NOTHING;

-- Levels match the rules in services/sessions.js (2: 3+ sessions, 3: 10+, 4: 25+).
INSERT INTO users (name, email, password_hash, level, languages, bio, rating_avg, rating_count, sessions_given, role) VALUES
  -- The two logins shown on the website's login pages (password demo1234).
  ('Riya Verma',   'student@demo.com', '$2a$10$4aJ9ZjrfFxHO1DykpO4Y2OBLZIRymwtoQcmLFlUQ/eXNy2kvpDbS2', 1, '{English,Hindi}', 'Learning React and SQL.',                       0,    0,  0, 'student'),
  ('Neha Sharma',  'tutor@demo.com',   '$2a$10$4aJ9ZjrfFxHO1DykpO4Y2OBLZIRymwtoQcmLFlUQ/eXNy2kvpDbS2', 3, '{English,Hindi}', 'Frontend mentor: React and JavaScript.',        4.80, 30, 14, 'tutor'),
  -- Extra sample people so the tutor list is not empty.
  ('Aman Khan',    'aman@demo.test',   '$2a$10$4aJ9ZjrfFxHO1DykpO4Y2OBLZIRymwtoQcmLFlUQ/eXNy2kvpDbS2', 1, '{English}',       'First-year student, learning JavaScript.',      0,    0,  0, 'student'),
  ('Pooja Singh',  'pooja@demo.test',  '$2a$10$4aJ9ZjrfFxHO1DykpO4Y2OBLZIRymwtoQcmLFlUQ/eXNy2kvpDbS2', 1, '{English,Hindi}', 'Starting out with SQL.',                        0,    0,  0, 'student'),
  ('Ishita Rao',   'ishita@demo.test', '$2a$10$4aJ9ZjrfFxHO1DykpO4Y2OBLZIRymwtoQcmLFlUQ/eXNy2kvpDbS2', 2, '{English,Hindi}', 'Python and DSA helper.',                        4.60, 8,  5, 'tutor'),
  ('Sana Qureshi', 'sana@demo.test',   '$2a$10$4aJ9ZjrfFxHO1DykpO4Y2OBLZIRymwtoQcmLFlUQ/eXNy2kvpDbS2', 3, '{English,Hindi}', 'Python and DSA mentor.',                        4.50, 22, 11, 'tutor'),
  ('Vikram Joshi', 'vikram@demo.test', '$2a$10$4aJ9ZjrfFxHO1DykpO4Y2OBLZIRymwtoQcmLFlUQ/eXNy2kvpDbS2', 4, '{English}',       'Full stack guide: React, Node and databases.',  4.70, 60, 31, 'tutor'),
  ('Karan Mehta',  'karan@demo.test',  '$2a$10$4aJ9ZjrfFxHO1DykpO4Y2OBLZIRymwtoQcmLFlUQ/eXNy2kvpDbS2', 4, '{English,Hindi}', 'SQL and backend guide.',                        4.90, 75, 40, 'tutor')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_skills (user_id, skill_id, experience_level)
SELECT u.id, s.id, v.lvl
  FROM (VALUES
    ('student@demo.com', 'React',      1), ('student@demo.com', 'SQL',        1),
    ('aman@demo.test',   'JavaScript', 1),
    ('pooja@demo.test',  'SQL',        1),
    ('ishita@demo.test', 'JavaScript', 3), ('ishita@demo.test', 'Python',     3), ('ishita@demo.test', 'DSA',        3),
    ('tutor@demo.com',   'React',      4), ('tutor@demo.com',   'JavaScript', 4), ('tutor@demo.com',   'TypeScript', 3),
    ('sana@demo.test',   'Python',     4), ('sana@demo.test',   'DSA',        4),
    ('vikram@demo.test', 'React',      5), ('vikram@demo.test', 'Node',       5), ('vikram@demo.test', 'Git',        4),
    ('karan@demo.test',  'SQL',        5), ('karan@demo.test',  'Node',       4), ('karan@demo.test',  'Python',     3)
  ) AS v(email, skill, lvl)
  JOIN users  u ON u.email = v.email
  JOIN skills s ON s.name  = v.skill
ON CONFLICT (user_id, skill_id) DO NOTHING;

-- Every demo user gets the 10 starter credits as a ledger row (never a bare balance).
INSERT INTO credit_ledger (user_id, delta, reason, ref_type, ref_id)
SELECT id, 10, 'starter', 'user', id FROM users WHERE email ~ '@demo\.(test|com)$'
ON CONFLICT (ref_type, ref_id, reason, user_id) DO NOTHING;

-- Fresh free slots for the mentors: today, tomorrow and the day after (all in the future).
DELETE FROM availability_slots
 WHERE is_booked = false AND user_id IN (SELECT id FROM users WHERE email ~ '@demo\.(test|com)$');

INSERT INTO availability_slots (user_id, starts_at, ends_at)
SELECT u.id,
       date_trunc('hour', now()) + make_interval(days => d, hours => h),
       date_trunc('hour', now()) + make_interval(days => d, hours => h + 1)
  FROM users u
 CROSS JOIN generate_series(0, 2) AS d
 CROSS JOIN (VALUES (2), (5)) AS hh(h)
 WHERE u.email ~ '@demo\.(test|com)$' AND u.level >= 2;

COMMIT;
