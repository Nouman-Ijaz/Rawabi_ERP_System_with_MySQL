-- ─────────────────────────────────────────────────────────────────
-- shipment_issues_migration.sql
-- Run once. Adds the shipment_issues table for driver-reported
-- field issues (breakdowns, accidents, customs holds, etc.)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shipment_issues (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    shipment_id  INT NOT NULL,
    driver_id    INT NOT NULL,
    issue_type   ENUM('breakdown','accident','customs_hold','road_closure','other') NOT NULL,
    description  TEXT NOT NULL,
    location     VARCHAR(255) NULL,
    status       ENUM('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
    reported_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at  TIMESTAMP NULL,
    resolved_by  INT NULL,
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id)   REFERENCES drivers(id)   ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id)     ON DELETE SET NULL
);

-- Index for fast per-shipment and per-driver lookups
CREATE INDEX IF NOT EXISTS idx_shipment_issues_shipment ON shipment_issues (shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_issues_driver   ON shipment_issues (driver_id);
