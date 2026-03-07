import { query, get } from '../database/db.js';

// ─────────────────────────────────────────────────────────────────
// SHARED: build date-filter SQL fragments for a given period
// Uses order_date for shipments (always populated, consistent)
// ─────────────────────────────────────────────────────────────────
function shipmentPeriodFilters(period) {
    if (period === 'quarter') {
        return {
            current: `QUARTER(s.order_date) = QUARTER(NOW()) AND YEAR(s.order_date) = YEAR(NOW())`,
            prev:    `QUARTER(s.order_date) = QUARTER(DATE_SUB(NOW(), INTERVAL 3 MONTH)) AND YEAR(s.order_date) = YEAR(DATE_SUB(NOW(), INTERVAL 3 MONTH))`,
        };
    }
    if (period === 'year') {
        return {
            current: `YEAR(s.order_date) = YEAR(NOW())`,
            prev:    `YEAR(s.order_date) = YEAR(NOW()) - 1`,
        };
    }
    // default: month
    return {
        current: `DATE_FORMAT(s.order_date, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')`,
        prev:    `DATE_FORMAT(s.order_date, '%Y-%m') = DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m')`,
    };
}

// bare version (no table alias) for queries that don't join shipments
function barePeriodFilter(period, field = 'order_date') {
    if (period === 'quarter') {
        return `QUARTER(${field}) = QUARTER(NOW()) AND YEAR(${field}) = YEAR(NOW())`;
    }
    if (period === 'year') {
        return `YEAR(${field}) = YEAR(NOW())`;
    }
    return `DATE_FORMAT(${field}, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')`;
}

// ─────────────────────────────────────────────────────────────────
// 1. SHIPMENT KPIs  — period-aware operational summary
// ─────────────────────────────────────────────────────────────────
export async function getShipmentKPIs(req, res) {
    try {
        const { period = 'month' } = req.query;
        const f = shipmentPeriodFilters(period);

        const [kpi, prevKpi] = await Promise.all([
            get(`SELECT
                    COUNT(*)                                                          AS total,
                    SUM(CASE WHEN status = 'delivered'  THEN 1 ELSE 0 END)           AS delivered,
                    SUM(CASE WHEN status = 'in_transit' THEN 1 ELSE 0 END)           AS in_transit,
                    SUM(CASE WHEN status IN ('pending','confirmed') THEN 1 ELSE 0 END) AS pending,
                    SUM(CASE WHEN status = 'cancelled'  THEN 1 ELSE 0 END)           AS cancelled,
                    AVG(
                      CASE WHEN status = 'delivered'
                                AND actual_delivery_date IS NOT NULL
                                AND actual_pickup_date   IS NOT NULL
                           THEN DATEDIFF(actual_delivery_date, actual_pickup_date)
                      END
                    )                                                                AS avg_transit_days,
                    SUM(CASE WHEN status = 'delivered'
                                  AND actual_delivery_date IS NOT NULL
                                  AND requested_delivery_date IS NOT NULL
                                  AND actual_delivery_date <= requested_delivery_date
                             THEN 1 ELSE 0 END)                                      AS on_time_count,
                    SUM(CASE WHEN status = 'delivered'
                                  AND requested_delivery_date IS NOT NULL
                             THEN 1 ELSE 0 END)                                      AS deliveries_with_deadline
                FROM shipments s
                WHERE ${f.current}`),

            get(`SELECT
                    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
                    COUNT(*) AS total
                FROM shipments s
                WHERE ${f.prev}`),
        ]);

        // on-time rate: guard divide-by-zero
        const onTimePct = kpi.deliveries_with_deadline > 0
            ? ((kpi.on_time_count / kpi.deliveries_with_deadline) * 100).toFixed(1)
            : null;

        // MoM / QoQ / YoY delta
        const deliveredDelta = (kpi.delivered || 0) - (prevKpi?.delivered || 0);

        res.json({
            total:           kpi.total || 0,
            delivered:       kpi.delivered || 0,
            in_transit:      kpi.in_transit || 0,
            pending:         kpi.pending || 0,
            cancelled:       kpi.cancelled || 0,
            avg_transit_days: kpi.avg_transit_days ? Number(kpi.avg_transit_days).toFixed(1) : null,
            on_time_pct:     onTimePct,
            delivered_delta: deliveredDelta,
            prev_delivered:  prevKpi?.delivered || 0,
        });
    } catch (error) {
        console.error('Shipment KPIs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ─────────────────────────────────────────────────────────────────
// 2. REVENUE BY CUSTOMER  — top 8 customers, period-aware
//    month = current month, quarter = current quarter,
//    year  = all-time (full history, not just calendar year)
// ─────────────────────────────────────────────────────────────────
export async function getRevenueByCustomer(req, res) {
    try {
        const { period = 'month' } = req.query;

        // year = all-time; month/quarter use the standard period filter
        let filter;
        if (period === 'year') {
            filter = '1=1';  // all-time
        } else {
            filter = barePeriodFilter(period, 'i.invoice_date');
        }

        const rows = await query(`
            SELECT
                c.id,
                c.company_name,
                c.customer_type,
                COUNT(i.id)                           AS shipment_count,
                COALESCE(SUM(i.total_amount), 0)      AS revenue
            FROM invoices i
            JOIN customers c ON c.id = i.customer_id
            WHERE i.status NOT IN ('cancelled', 'draft')
              AND ${filter}
            GROUP BY c.id, c.company_name, c.customer_type
            ORDER BY revenue DESC
            LIMIT 8
        `);

        // Calculate total on backend to avoid floating-point drift on frontend
        const total = rows.reduce((sum, r) => sum + Number(r.revenue), 0);
        const result = rows.map(r => ({
            ...r,
            revenue: Number(r.revenue),
            pct: total > 0 ? ((Number(r.revenue) / total) * 100).toFixed(1) : '0.0',
        }));

        res.json({ customers: result, total_revenue: total });
    } catch (error) {
        console.error('Revenue by customer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ─────────────────────────────────────────────────────────────────
// 3. ROUTE PERFORMANCE  — top 8 lanes by volume, period-aware
// ─────────────────────────────────────────────────────────────────
export async function getRoutePerformance(req, res) {
    try {
        const { period = 'month' } = req.query;
        const f = barePeriodFilter(period, 's.order_date');

        const rows = await query(`
            SELECT
                s.origin_city,
                s.destination_city,
                CONCAT(s.origin_city, ' → ', s.destination_city)   AS route,
                COUNT(DISTINCT s.id)                                 AS shipment_count,
                COALESCE(SUM(inv.inv_total), 0)                      AS total_revenue,
                COALESCE(
                    SUM(inv.inv_total) / NULLIF(COUNT(DISTINCT s.id), 0),
                    0
                )                                                    AS avg_revenue,
                AVG(
                  CASE WHEN s.status = 'delivered'
                            AND s.actual_delivery_date IS NOT NULL
                            AND s.actual_pickup_date   IS NOT NULL
                       THEN DATEDIFF(s.actual_delivery_date, s.actual_pickup_date)
                  END
                )                                                    AS avg_transit_days,
                SUM(CASE WHEN s.status = 'delivered'
                              AND s.actual_delivery_date IS NOT NULL
                              AND s.requested_delivery_date IS NOT NULL
                              AND s.actual_delivery_date <= s.requested_delivery_date
                         THEN 1 ELSE 0 END)                          AS on_time_count,
                SUM(CASE WHEN s.status = 'delivered'
                              AND s.requested_delivery_date IS NOT NULL
                         THEN 1 ELSE 0 END)                          AS deliveries_with_deadline
            FROM shipments s
            LEFT JOIN (
                SELECT shipment_id, SUM(total_amount) AS inv_total
                FROM invoices
                WHERE status NOT IN ('cancelled', 'draft')
                  AND shipment_id IS NOT NULL
                GROUP BY shipment_id
            ) inv ON inv.shipment_id = s.id
            WHERE ${f}
            GROUP BY s.origin_city, s.destination_city
            ORDER BY shipment_count DESC
            LIMIT 8
        `);

        const result = rows.map(r => ({
            route:            r.route,
            shipment_count:   r.shipment_count,
            total_revenue:    Number(r.total_revenue),
            avg_revenue:      Number(r.avg_revenue).toFixed(0),
            avg_transit_days: r.avg_transit_days ? Number(r.avg_transit_days).toFixed(1) : null,
            on_time_pct:      r.deliveries_with_deadline > 0
                ? ((r.on_time_count / r.deliveries_with_deadline) * 100).toFixed(1)
                : null,
        }));

        res.json(result);
    } catch (error) {
        console.error('Route performance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ─────────────────────────────────────────────────────────────────
// 4. FLEET ALERTS  — documents expiring within 60 days
//    Not period-filtered (always real-time)
// ─────────────────────────────────────────────────────────────────
export async function getFleetAlerts(req, res) {
    try {
        const [vehicleAlerts, driverAlerts] = await Promise.all([

            query(`
                SELECT
                    vehicle_code,
                    plate_number,
                    CONCAT(brand, ' ', model)           AS vehicle_name,
                    status,
                    registration_expiry,
                    insurance_expiry,
                    DATEDIFF(registration_expiry, CURDATE()) AS reg_days_left,
                    DATEDIFF(insurance_expiry,    CURDATE()) AS ins_days_left
                FROM vehicles
                WHERE status NOT IN ('retired','sold')
                  AND (
                      (registration_expiry IS NOT NULL AND registration_expiry <= DATE_ADD(CURDATE(), INTERVAL 60 DAY))
                   OR (insurance_expiry    IS NOT NULL AND insurance_expiry    <= DATE_ADD(CURDATE(), INTERVAL 60 DAY))
                  )
                ORDER BY LEAST(
                    COALESCE(registration_expiry, '9999-12-31'),
                    COALESCE(insurance_expiry,    '9999-12-31')
                )
            `),

            query(`
                SELECT
                    e.first_name,
                    e.last_name,
                    d.license_number,
                    d.license_type,
                    d.status AS driver_status,
                    d.license_expiry,
                    d.medical_certificate_expiry,
                    DATEDIFF(d.license_expiry, CURDATE())                    AS license_days_left,
                    DATEDIFF(d.medical_certificate_expiry, CURDATE())        AS medical_days_left
                FROM drivers d
                JOIN employees e ON e.id = d.employee_id
                WHERE d.status NOT IN ('suspended')
                  AND (
                      (d.license_expiry IS NOT NULL AND d.license_expiry <= DATE_ADD(CURDATE(), INTERVAL 60 DAY))
                   OR (d.medical_certificate_expiry IS NOT NULL AND d.medical_certificate_expiry <= DATE_ADD(CURDATE(), INTERVAL 60 DAY))
                  )
                ORDER BY d.license_expiry
            `),
        ]);

        res.json({
            vehicle_alerts: vehicleAlerts,
            driver_alerts:  driverAlerts,
            total_alerts:   vehicleAlerts.length + driverAlerts.length,
        });
    } catch (error) {
        console.error('Fleet alerts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ─────────────────────────────────────────────────────────────────
// 5. CASH FLOW FORECAST  — collected history + expected upcoming
//    Not period-filtered (always forward-looking)
// ─────────────────────────────────────────────────────────────────
export async function getCashFlowForecast(req, res) {
    try {
        const [collected, expected, overdueTotal] = await Promise.all([

            // Last 6 months of actual collections
            query(`
                SELECT
                    DATE_FORMAT(payment_date, '%Y-%m') AS month,
                    SUM(amount)                        AS collected
                FROM payments
                GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
                ORDER BY month DESC
                LIMIT 6
            `),

            // Expected from outstanding invoices bucketed into 30/60/90 day windows
            get(`
                SELECT
                    COALESCE(SUM(CASE WHEN due_date BETWEEN CURDATE()
                                               AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                                     THEN balance_due ELSE 0 END), 0)  AS next_30,
                    COALESCE(SUM(CASE WHEN due_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 31 DAY)
                                               AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
                                     THEN balance_due ELSE 0 END), 0)  AS next_31_60,
                    COALESCE(SUM(CASE WHEN due_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 61 DAY)
                                               AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)
                                     THEN balance_due ELSE 0 END), 0)  AS next_61_90,
                    COUNT(CASE WHEN due_date BETWEEN CURDATE()
                                        AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                               THEN 1 END)                              AS next_30_count,
                    COUNT(CASE WHEN due_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 31 DAY)
                                        AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
                               THEN 1 END)                              AS next_31_60_count,
                    COUNT(CASE WHEN due_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 61 DAY)
                                        AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)
                               THEN 1 END)                              AS next_61_90_count
                FROM invoices
                WHERE status IN ('sent','partial')
                  AND balance_due > 0
            `),

            // Overdue total (already past due)
            get(`
                SELECT
                    COALESCE(SUM(balance_due), 0) AS amount,
                    COUNT(*)                       AS count
                FROM invoices
                WHERE status IN ('sent','partial','overdue')
                  AND balance_due > 0
                  AND due_date < CURDATE()
            `),
        ]);

        res.json({
            collected_history: collected.reverse(), // chronological order
            expected,
            overdue: overdueTotal,
        });
    } catch (error) {
        console.error('Cash flow forecast error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ─────────────────────────────────────────────────────────────────
// 6. DRIVER PERIOD PERFORMANCE  — period-aware with prev-period delta
//    ALL non-aggregated SELECT columns are in GROUP BY (ONLY_FULL_GROUP_BY safe)
// ─────────────────────────────────────────────────────────────────
export async function getDriverPeriodPerformance(req, res) {
    try {
        const { period = 'month' } = req.query;
        const f = shipmentPeriodFilters(period);

        const rows = await query(`
            SELECT
                d.id,
                e.first_name,
                e.last_name,
                d.license_type,
                d.rating,
                d.years_of_experience,
                d.status                                                       AS driver_status,
                ANY_VALUE(v.plate_number)                                      AS assigned_vehicle_plate,

                /* Current period */
                COUNT(CASE WHEN s.id IS NOT NULL AND ${f.current} THEN 1 END) AS current_trips,
                COALESCE(SUM(CASE WHEN ${f.current}
                    THEN COALESCE(inv.inv_total, s.final_amount, s.quoted_amount)
                    ELSE NULL END), 0)                                         AS current_revenue,
                SUM(CASE WHEN ${f.current}
                              AND s.actual_delivery_date IS NOT NULL
                              AND s.requested_delivery_date IS NOT NULL
                              AND s.actual_delivery_date <= s.requested_delivery_date
                         THEN 1 ELSE 0 END)                                    AS current_on_time,
                SUM(CASE WHEN ${f.current}
                              AND s.requested_delivery_date IS NOT NULL
                         THEN 1 ELSE 0 END)                                    AS current_with_deadline,

                /* Previous period */
                COUNT(CASE WHEN s.id IS NOT NULL AND ${f.prev} THEN 1 END)    AS prev_trips,
                COALESCE(SUM(CASE WHEN ${f.prev}
                    THEN COALESCE(inv.inv_total, s.final_amount, s.quoted_amount)
                    ELSE NULL END), 0)                                         AS prev_revenue

            FROM drivers d
            JOIN employees e ON e.id = d.employee_id
            LEFT JOIN shipments s
                   ON s.driver_id = d.id
                  AND s.status = 'delivered'
            LEFT JOIN (
                SELECT shipment_id, SUM(total_amount) AS inv_total
                FROM invoices
                WHERE status NOT IN ('cancelled', 'draft')
                  AND shipment_id IS NOT NULL
                GROUP BY shipment_id
            ) inv ON inv.shipment_id = s.id
            LEFT JOIN vehicle_assignments va
                   ON va.driver_id = d.id
                  AND va.unassigned_date IS NULL
            LEFT JOIN vehicles v ON v.id = va.vehicle_id

            GROUP BY d.id, e.first_name, e.last_name, d.license_type,
                     d.rating, d.years_of_experience, d.status

            ORDER BY current_trips DESC
            LIMIT 15
        `);

        const result = rows.map(r => ({
            id:                    r.id,
            name:                  `${r.first_name} ${r.last_name}`,
            license_type:          r.license_type,
            rating:                Number(r.rating || 5).toFixed(1),
            years_of_experience:   r.years_of_experience || 0,
            driver_status:         r.driver_status,
            assigned_vehicle:      r.assigned_vehicle_plate || null,
            current_trips:         r.current_trips || 0,
            current_revenue:       Number(r.current_revenue || 0),
            prev_trips:            r.prev_trips || 0,
            prev_revenue:          Number(r.prev_revenue || 0),
            trips_delta:           (r.current_trips || 0) - (r.prev_trips || 0),
            on_time_pct:           r.current_with_deadline > 0
                ? ((r.current_on_time / r.current_with_deadline) * 100).toFixed(1)
                : null,
        }));

        res.json(result);
    } catch (error) {
        console.error('Driver period performance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
