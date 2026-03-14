// ─────────────────────────────────────────────────────────────────
// backend/middleware/rateLimiter.js
// Three separate rate limiters. Never use a single global limiter —
// different endpoints have different risk profiles.
//
// Usage in routes/index.js:
//   import { authLimiter, apiLimiter, sensitiveLimiter } from '../middleware/rateLimiter.js';
//   router.post('/auth/login', authLimiter, authController.login);
//   router.use(authenticateToken);
//   router.use(apiLimiter);
//   router.post('/users', sensitiveLimiter, authorize(SUPER_ADMIN), ...);
// ─────────────────────────────────────────────────────────────────
import rateLimit from 'express-rate-limit';

// ── Shared JSON error handler ──────────────────────────────────────
// express-rate-limit defaults to returning a plain string. Force JSON.
function jsonHandler(message) {
    return (req, res) => {
        res.status(429).json({ error: message });
    };
}

// ── 1. authLimiter ─────────────────────────────────────────────────
// Login endpoint only. Strict — 10 attempts per 15 minutes per IP.
// Blocks credential-stuffing and brute-force attacks.
export const authLimiter = rateLimit({
    windowMs:        15 * 60 * 1000, // 15 minutes
    max:             10,
    standardHeaders: true,
    legacyHeaders:   false,
    handler:         jsonHandler('Too many login attempts. Try again in 15 minutes.'),
});

// ── 2. apiLimiter ─────────────────────────────────────────────────
// Blanket limiter applied after authentication middleware.
// 120 requests per minute is generous for a single-user ERP session.
// Only authenticated requests reach this — rejects have already been
// stopped by authenticateToken before this runs.
export const apiLimiter = rateLimit({
    windowMs:        60 * 1000, // 1 minute
    max:             120,
    standardHeaders: true,
    legacyHeaders:   false,
    handler:         jsonHandler('Too many requests. Slow down.'),
});

// ── 3. sensitiveLimiter ────────────────────────────────────────────
// Password changes, user creation, role changes.
// 20 per hour is enough for legitimate admin work; stops abuse.
export const sensitiveLimiter = rateLimit({
    windowMs:        60 * 60 * 1000, // 1 hour
    max:             20,
    standardHeaders: true,
    legacyHeaders:   false,
    handler:         jsonHandler('Too many sensitive operations. Try again later.'),
});
