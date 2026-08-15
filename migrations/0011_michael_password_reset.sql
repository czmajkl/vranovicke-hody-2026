-- One-time reset requested before the live event.
-- Password: 00000, stored as the same PBKDF2-SHA256 format used by the app.
UPDATE users
SET password_hash = 'pbkdf2-sha256$10000$Cc8jzze2d4S__qAiINRF2A$F3DQCQ1iLFYNcJQ3Ccy2sVnCxk1gG5UDR5p7l455-dI',
    updated_at = CURRENT_TIMESTAMP
WHERE username_norm = 'michael';
