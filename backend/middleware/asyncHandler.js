// ─────────────────────────────────────────────────────────────────
// backend/middleware/asyncHandler.js
// Wraps async controller functions so you never need a manual
// try/catch block again.
//
// Before:
//   export async function getAll(req, res) {
//     try {
//       const rows = await query('SELECT * FROM vehicles');
//       res.json(rows);
//     } catch (e) {
//       console.error(e);
//       res.status(500).json({ error: 'Internal server error' });
//     }
//   }
//
// After:
//   import { asyncHandler } from '../middleware/asyncHandler.js';
//   export const getAll = asyncHandler(async (req, res) => {
//     const rows = await query('SELECT * FROM vehicles');
//     res.json(rows);
//   });
// ─────────────────────────────────────────────────────────────────

/**
 * Wraps an async Express handler.
 * Any uncaught error is caught and returned as a JSON 500 response.
 * Thrown errors with a .status property use that HTTP status code.
 *
 * @param {Function} fn - async (req, res, next) handler
 * @returns {Function} Express middleware
 */
export const asyncHandler = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (e) {
        console.error('[asyncHandler]', e);
        const status  = e?.status  || 500;
        const message = e?.message || 'Internal server error';
        if (!res.headersSent) {
            res.status(status).json({ error: message });
        }
    }
};

/**
 * Helper to throw a structured HTTP error from inside a handler.
 * Usage: throw httpError(404, 'Vehicle not found');
 *
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 */
export function httpError(status, message) {
    const err  = new Error(message);
    err.status = status;
    return err;
}
