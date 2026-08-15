PRAGMA defer_foreign_keys = ON;

-- One-time production reset before opening the app to the real crowd.
-- Keep the schema, wipe all accounts and event/game data.
DELETE FROM pair_spice_events;
DELETE FROM photo_challenge_completions;
DELETE FROM shot_transfers;
DELETE FROM shots;
DELETE FROM wine_donations;
DELETE FROM interaction_questions;
DELETE FROM interactions;
DELETE FROM photo_tags;
DELETE FROM photos;
DELETE FROM invites;
DELETE FROM user_achievements;
DELETE FROM score_events;
DELETE FROM sessions;
UPDATE users SET inviter_user_id = NULL;
DELETE FROM users;
DELETE FROM achievements;
DELETE FROM questions;
