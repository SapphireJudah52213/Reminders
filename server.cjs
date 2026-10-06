const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const webpush = require("web-push");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    transports: ["polling", "websocket"],
    pingInterval: 25000,
    pingTimeout: 60000,
    connectTimeout: 20000,
    maxHttpBufferSize: 1e6
});

const PORT = process.env.PORT || 10001;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY.");
    process.exit(1);
}

if (!DATABASE_URL) {
    console.error("Missing DATABASE_URL.");
    process.exit(1);
}

webpush.setVapidDetails(
    "mailto:judahsiegal52213@gmail.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes("localhost")
        ? false
        : { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static("public"));

async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS reminders (
            id UUID PRIMARY KEY,
            time TEXT NOT NULL,
            rows JSONB NOT NULL,
            created_at BIGINT NOT NULL,
            triggered BOOLEAN NOT NULL DEFAULT FALSE,
            triggered_at BIGINT
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
            id SERIAL PRIMARY KEY,
            endpoint TEXT UNIQUE NOT NULL,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            expiration_time BIGINT,
            created_at BIGINT NOT NULL
        )
    `);

    console.log("PostgreSQL database initialized.");
}

function createId() {
    return crypto.randomUUID();
}

async function getSubscriptions() {
    const result = await pool.query(`
        SELECT
            endpoint,
            p256dh,
            auth,
            expiration_time
        FROM subscriptions
    `);

    return result.rows.map(row => ({
        endpoint: row.endpoint,
        expirationTime: row.expiration_time,
        keys: {
            p256dh: row.p256dh,
            auth: row.auth
        }
    }));
}

async function getReminders(includeTriggered = false) {
    const query = includeTriggered
        ? `
            SELECT
                id,
                time,
                rows,
                created_at,
                triggered,
                triggered_at
            FROM reminders
            ORDER BY time
        `
        : `
            SELECT
                id,
                time,
                rows,
                created_at,
                triggered,
                triggered_at
            FROM reminders
            WHERE triggered = FALSE
            ORDER BY time
        `;

    const result = await pool.query(query);

    return result.rows.map(row => ({
        id: row.id,
        time: row.time,
        rows: row.rows,
        createdAt: Number(row.created_at),
        triggered: row.triggered,
        triggeredAt: row.triggered_at
            ? Number(row.triggered_at)
            : undefined
    }));
}

async function removeSubscription(endpoint) {
    await pool.query(
        "DELETE FROM subscriptions WHERE endpoint = $1",
        [endpoint]
    );
}

async function sendPush(payload) {
    const subscriptions = await getSubscriptions();

    if (subscriptions.length === 0) {
        console.log("No push subscriptions registered.");
        return {
            sent: 0,
            failed: 0
        };
    }

    const message = JSON.stringify(payload);

    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
        try {
            await webpush.sendNotification(
                subscription,
                message
            );

            sent++;
            console.log("Push notification sent.");
        } catch (error) {
            failed++;

            console.error(
                "Push notification error:",
                error
            );

            if (
                error.statusCode === 404 ||
                error.statusCode === 410
            ) {
                console.log(
                    "Removing expired push subscription."
                );

                await removeSubscription(
                    subscription.endpoint
                );
            }
        }
    }

    return {
        sent,
        failed
    };
}

app.get("/api/vapid-public-key", (req, res) => {
    res.json({
        publicKey: VAPID_PUBLIC_KEY
    });
});

app.post("/api/subscribe", async (req, res) => {
    try {
        const subscription = req.body;

        if (
            !subscription ||
            typeof subscription.endpoint !== "string" ||
            !subscription.keys ||
            typeof subscription.keys.p256dh !== "string" ||
            typeof subscription.keys.auth !== "string"
        ) {
            return res.status(400).json({
                error: "Invalid push subscription"
            });
        }

        await pool.query(
            `
            INSERT INTO subscriptions (
                endpoint,
                p256dh,
                auth,
                expiration_time,
                created_at
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (endpoint)
            DO UPDATE SET
                p256dh = EXCLUDED.p256dh,
                auth = EXCLUDED.auth,
                expiration_time = EXCLUDED.expiration_time
            `,
            [
                subscription.endpoint,
                subscription.keys.p256dh,
                subscription.keys.auth,
                subscription.expirationTime
                    ? Number(subscription.expirationTime)
                    : null,
                Date.now()
            ]
        );

        console.log(
            "New push subscription registered."
        );

        res.json({
            success: true
        });
    } catch (error) {
        console.error(
            "Could not save push subscription:",
            error
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.delete("/api/subscribe", async (req, res) => {
    try {
        const endpoint = req.body?.endpoint;

        if (typeof endpoint !== "string") {
            return res.status(400).json({
                error: "Invalid subscription endpoint"
            });
        }

        await removeSubscription(endpoint);

        res.json({
            success: true
        });
    } catch (error) {
        console.error(
            "Could not delete push subscription:",
            error
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post("/api/reminders", async (req, res) => {
    try {
        const { time, rows } = req.body;

        if (
            typeof time !== "string" ||
            !/^\d{2}:\d{2}$/.test(time) ||
            !Array.isArray(rows) ||
            rows.length === 0
        ) {
            return res.status(400).json({
                error: "Invalid reminder"
            });
        }

        const reminder = {
            id: createId(),
            time,
            rows,
            createdAt: Date.now(),
            triggered: false
        };

        await pool.query(
            `
            INSERT INTO reminders (
                id,
                time,
                rows,
                created_at,
                triggered
            )
            VALUES ($1, $2, $3::jsonb, $4, $5)
            `,
            [
                reminder.id,
                reminder.time,
                JSON.stringify(reminder.rows),
                reminder.createdAt,
                false
            ]
        );

        io.emit(
            "reminder-created",
            reminder
        );

        res.json(reminder);
    } catch (error) {
        console.error(
            "Could not create reminder:",
            error
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get("/api/reminders", async (req, res) => {
    try {
        const reminders =
            await getReminders(false);

        res.json(reminders);
    } catch (error) {
        console.error(
            "Could not get reminders:",
            error
        );

        res.status(500).json({
            error: error.message
        });
    }
});

app.get("/api/reminders/all", async (req, res) => {
    try {
        const reminders =
            await getReminders(true);

        res.json(reminders);
    } catch (error) {
        console.error(
            "Could not get all reminders:",
            error
        );

        res.status(500).json({
            error: error.message
        });
    }
});

app.delete("/api/reminders/:id", async (req, res) => {
    try {
        const id = req.params.id;

        const result = await pool.query(
            `
            DELETE FROM reminders
            WHERE id = $1
            `,
            [id]
        );

        if (result.rowCount > 0) {
            io.emit(
                "reminder-deleted",
                id
            );
        }

        res.json({
            success: true
        });
    } catch (error) {
        console.error(
            "Could not delete reminder:",
            error
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.delete("/api/reminders", async (req, res) => {
    try {
        await pool.query(
            "DELETE FROM reminders"
        );

        io.emit(
            "reminders-cleared"
        );

        res.json({
            success: true
        });
    } catch (error) {
        console.error(
            "Could not clear reminders:",
            error
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get("/api/status", async (req, res) => {
    try {
        const subscriptionResult =
            await pool.query(
                "SELECT COUNT(*) FROM subscriptions"
            );

        const reminderResult =
            await pool.query(
                `
                SELECT
                    COUNT(*) FILTER (
                        WHERE triggered = FALSE
                    ) AS active,
                    COUNT(*) AS total
                FROM reminders
                `
            );

        res.json({
            online: true,
            subscriptions: Number(
                subscriptionResult.rows[0].count
            ),
            reminders: Number(
                reminderResult.rows[0].active
            ),
            totalReminders: Number(
                reminderResult.rows[0].total
            )
        });
    } catch (error) {
        console.error(
            "Could not get server status:",
            error
        );

        res.status(500).json({
            online: false,
            error: error.message
        });
    }
});

app.post("/api/test-push", async (req, res) => {
    try {
        const result = await sendPush({
            type: "test",
            id: createId(),
            title: "Push Test",
            body: "Web Push is working.",
            time: null,
            rows: []
        });

        res.json({
            success:
                result.sent > 0 &&
                result.failed === 0,
            ...result
        });
    } catch (error) {
        console.error(
            "Test push failed:",
            error
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

io.on("connection", async socket => {
    console.log(
        "Client connected:",
        socket.id
    );

    try {
        const reminders =
            await getReminders(false);

        socket.emit(
            "reminders",
            reminders
        );
    } catch (error) {
        console.error(
            "Could not send reminders to client:",
            error
        );
    }

    socket.on("disconnect", () => {
        console.log(
            "Client disconnected:",
            socket.id
        );
    });
});

async function checkReminders() {
    try {
        const now = new Date();

        const currentHour =
            now.getHours();

        const currentMinute =
            now.getMinutes();

        const currentTime =
            String(currentHour).padStart(2, "0") +
            ":" +
            String(currentMinute).padStart(2, "0");

        const result = await pool.query(
            `
            SELECT
                id,
                time,
                rows,
                created_at,
                triggered,
                triggered_at
            FROM reminders
            WHERE triggered = FALSE
              AND time = $1
            `,
            [currentTime]
        );

        for (const row of result.rows) {
            const reminder = {
                id: row.id,
                time: row.time,
                rows: row.rows,
                createdAt: Number(row.created_at),
                triggered: true,
                triggeredAt: Date.now()
            };

            await pool.query(
                `
                UPDATE reminders
                SET
                    triggered = TRUE,
                    triggered_at = $2
                WHERE id = $1
                  AND triggered = FALSE
                `,
                [
                    reminder.id,
                    reminder.triggeredAt
                ]
            );

            const body = reminder.rows
                .map(row => {
                    if (typeof row === "string") {
                        return row;
                    }

                    return row?.text || "";
                })
                .filter(Boolean)
                .join("\n");

            await sendPush({
                type: "reminder",
                id: reminder.id,
                title: "Reminder",
                body:
                    body ||
                    "Your reminder is due.",
                time: reminder.time,
                rows: reminder.rows
            });

            io.emit(
                "reminder-triggered",
                reminder
            );

            console.log(
                `Reminder triggered: ${reminder.id}`
            );
        }
    } catch (error) {
        console.error(
            "Error checking reminders:",
            error
        );
    }
}

async function startServer() {
    try {
        await initializeDatabase();

        server.listen(
            PORT,
            "0.0.0.0",
            () => {
                console.log(
                    `Reminders server running on port ${PORT}`
                );

                console.log(
                    "PostgreSQL storage enabled."
                );

                console.log(
                    "Service Worker: /sw.js"
                );
            }
        );

        setInterval(
            checkReminders,
            1000
        );
    } catch (error) {
        console.error(
            "Could not start server:",
            error
        );

        process.exit(1);
    }
}

startServer();
