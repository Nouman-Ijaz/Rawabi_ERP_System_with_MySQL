# Rawabi Logistics ERP — V2 Setup Guide

## What Changed from V1

| Area | V1 | V2 |
|---|---|---|
| Database | SQLite (file-based) | MySQL 8.x (server-based) |
| Roles | admin, manager, accountant, dispatcher, viewer | super_admin, admin, accountant, office_admin, dispatcher, driver |
| Driver access | Management only | Separate login — drivers see own shipments only |
| Shipment workflow | Direct create | Draft → Submit → Approve → Confirm |
| Schema | schema.sql combined | schema.sql + seed.sql separate |

---

## Step 1 — MySQL Setup

Open MySQL shell (run as root or your admin user):

```sql
CREATE DATABASE rawabi_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'rawabi_user'@'localhost' IDENTIFIED BY 'RawabiERP@2024!';
GRANT ALL PRIVILEGES ON rawabi_erp.* TO 'rawabi_user'@'localhost';
FLUSH PRIVILEGES;
```

Then run the schema and seed files:

```bash
mysql -u rawabi_user -p rawabi_erp < backend/database/schema.sql
mysql -u rawabi_user -p rawabi_erp < backend/database/seed.sql
```

---

## Step 2 — Environment File

Edit `backend/.env` and set your credentials:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=rawabi_user
DB_PASSWORD=RawabiERP@2024!
DB_NAME=rawabi_erp
JWT_SECRET=change-this-to-a-long-random-string-in-production
```

---

## Step 3 — Install Dependencies

From the project root:

```bash
npm install
```

This installs `mysql2` and removes the old `sqlite3` dependency.

---

## Step 4 — Run the System

**Backend only (API server):**
```bash
npm run server:dev
```
Server starts on http://localhost:3001

**Frontend (dev mode):**
```bash
npm run dev
```
Frontend starts on http://localhost:5173

---

## Test Accounts

All accounts use password: **Rawabi@2024!**

| Role | Email | Access |
|---|---|---|
| Super Admin | superadmin@rawabilogistics.com | Everything — user management, all modules |
| Admin | admin@rawabilogistics.com | All modules, approve shipments |
| Accountant | finance@rawabilogistics.com | Invoices, payments, expenses, reports |
| Office Admin | hr@rawabilogistics.com | Employees, customers, basic ops |
| Dispatcher | dispatch@rawabilogistics.com | Shipments, vehicles, drivers (read) |
| Driver | driver1@rawabilogistics.com | Own shipments and assignments only |
| Driver | driver2@rawabilogistics.com | Own shipments and assignments only |
| Driver | driver3@rawabilogistics.com | Own shipments and assignments only |

---

## Role Permission Summary

| Module | Super Admin | Admin | Accountant | Office Admin | Dispatcher | Driver |
|---|---|---|---|---|---|---|
| Users | Full | Read | — | — | — | — |
| Employees | Full | Full | — | Full | — | — |
| Vehicles | Full | Full | Read | Read | Read | — |
| Drivers | Full | Full | — | Read | Read | Own only |
| Shipments | Full | Full+Approve | Read | Read | Full | Own only |
| Customers | Full | Full | Read | Full | Read | — |
| Invoices | Full | Full | Full | — | — | — |
| Payments | Full | Full | Full | — | — | — |
| Expenses | Full | Full+Approve | Full | — | Create | — |
| Maintenance | Full | Full | — | — | Read | — |
| Dashboard | Full | Full | Finance view | HR view | Ops view | Personal |

---

## Shipment Approval Workflow

```
Dispatcher creates shipment  →  status: draft
Dispatcher submits           →  approval_status: pending_approval
Admin/Super Admin reviews    →  approved or rejected
On approval                  →  shipment status moves to confirmed
On rejection                 →  dispatcher sees rejection reason, can resubmit
```

API endpoints:
- `PUT /api/shipments/:id/submit-approval`  — dispatcher
- `PUT /api/shipments/:id/approve`          — admin / super_admin
- `PUT /api/shipments/:id/reject`           — admin / super_admin (body: `{ reason: "..." }`)

---

## Files Changed from V1

Replace these files in your V1 project:

```
package.json
backend/.env
backend/server.js
backend/database/db.js
backend/database/schema.sql          ← replaces old schema
backend/database/seed.sql            ← new file (run separately)
backend/middleware/auth.js
backend/routes/index.js
backend/controllers/authController.js
backend/controllers/driverController.js
backend/controllers/shipmentController.js
backend/controllers/financeController.js
backend/controllers/maintenanceController.js
backend/controllers/vehicleController.js
backend/controllers/customerController.js
backend/controllers/employeeController.js  ← unchanged, copied
backend/controllers/userController.js      ← unchanged, copied
backend/config/multer.js                   ← unchanged, copied
```

Frontend (`src/`) files are **not changed** in Phase 1.

---

## Verify Installation

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{ "status": "OK", "version": "2.0.0", "database": "MySQL" }
```

Test login:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rawabilogistics.com","password":"Rawabi@2024!"}'
```
