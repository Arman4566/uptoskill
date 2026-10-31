-- UpToSkill starter data. Safe to run repeatedly.
-- This only adds the tag vocabulary (sessions may only use tags that exist here).
-- It creates NO accounts: every user is a real person who signed up on the website.
INSERT INTO skills (name) VALUES
  ('React'), ('JavaScript'), ('TypeScript'), ('Node'), ('SQL'),
  ('Python'), ('DSA'), ('Git'), ('Flutter'), ('WebGL')
ON CONFLICT (name) DO NOTHING;
