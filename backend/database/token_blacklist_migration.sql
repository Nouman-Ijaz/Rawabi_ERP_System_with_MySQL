-- ─────────────────────────────────────────────────────────────────
-- token_blacklist_migration.sql
-- Run once. Creates the token blacklist table used for:
--   - Explicit logout
--   - Account deactivation (all sessions)
--   - Password change
--   - Role change
-- The expires_at index keeps the nightly DELETE efficient.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS token_blacklist (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    jti            VARCHAR(100) NOT NULL UNIQUE,
    user_id        INT NOT NULL,
    invalidated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at     TIMESTAMP NOT NULL,
    reason         ENUM('logout','deactivated','password_changed','role_changed') NOT NULL,
    INDEX idx_jti     (jti),
    INDEX idx_expires (expires_at),
    INDEX idx_user    (user_id)
);
