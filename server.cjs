const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const webpush = require("web-push");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
	transports: ["polling", "websocket"],
	pingInterval: 25000,
	pingTimeout: 60000,
	connectTimeout: 20000,
	maxHttpBufferSize: 1e6
});

const PORT = 10001;
const DATA_FILE = path.join(__dirname, "reminders.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const VAPID_PUBLIC_KEY =
	process.env.VAPID_PUBLIC_KEY;

const VAPID_PRIVATE_KEY =
	process.env.VAPID_PRIVATE_KEY;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
	console.error(
		"Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY."
	);

	console.error(
		"Set both environment variables before starting the server."
	);

	process.exit(1);
}

webpush.setVapidDetails(
	"mailto:judahsiegal52213@gmail.com",
	VAPID_PUBLIC_KEY,
	VAPID_PRIVATE_KEY
);

app.use(express.json());

app.use(
	express.static(PUBLIC_DIR)
);

let subscriptions = [];
let reminders = [];

function loadData() {
	if (!fs.existsSync(DATA_FILE)) {
		saveData();
		return;
	}

	try {
		const data = JSON.parse(
			fs.readFileSync(
				DATA_FILE,
				"utf8"
			)
		);

		subscriptions =
			Array.isArray(data.subscriptions)
				? data.subscriptions
				: [];

		reminders =
			Array.isArray(data.reminders)
				? data.reminders
				: [];
	} catch (error) {
		console.error(
			"Could not load reminders.json:",
			error
		);

		subscriptions = [];
		reminders = [];
	}
}

function saveData() {
	try {
		fs.writeFileSync(
			DATA_FILE,
			JSON.stringify(
				{
					subscriptions,
					reminders
				},
				null,
				2
			)
		);
	} catch (error) {
		console.error(
			"Could not save reminders.json:",
			error
		);
	}
}

function createId() {
	return crypto.randomUUID();
}

function removeSubscription(endpoint) {
	subscriptions =
		subscriptions.filter(
			subscription =>
				subscription.endpoint !== endpoint
		);

	saveData();
}

async function sendPush(payload) {
	const message =
		JSON.stringify(payload);

	for (
		const subscription
		of [...subscriptions]
	) {
		try {
			await webpush.sendNotification(
				subscription,
				message
			);

			console.log(
				"Push notification sent."
			);
		} catch (error) {
			if (
				error.statusCode === 404 ||
				error.statusCode === 410
			) {
				console.log(
					"Removing expired push subscription."
				);

				removeSubscription(
					subscription.endpoint
				);
			} else {
				console.error(
					"Push notification error:",
					error
				);
			}
		}
	}
}

app.get(
	"/api/vapid-public-key",
	(req, res) => {
		res.json({
			publicKey:
				VAPID_PUBLIC_KEY
		});
	}
);

app.post(
	"/api/subscribe",
	(req, res) => {
		const subscription =
			req.body;

		if (
			!subscription ||
			typeof subscription.endpoint !==
				"string" ||
			!subscription.keys ||
			typeof subscription.keys.p256dh !==
				"string" ||
			typeof subscription.keys.auth !==
				"string"
		) {
			return res.status(400).json({
				error:
					"Invalid push subscription"
			});
		}

		const alreadyExists =
			subscriptions.some(
				existing =>
					existing.endpoint ===
					subscription.endpoint
			);

		if (!alreadyExists) {
			subscriptions.push(
				subscription
			);

			saveData();

			console.log(
				"New push subscription registered."
			);
		}

		res.json({
			success: true
		});
	}
);

app.delete(
	"/api/subscribe",
	(req, res) => {
		const endpoint =
			req.body?.endpoint;

		if (
			typeof endpoint !==
			"string"
		) {
			return res.status(400).json({
				error:
					"Invalid subscription endpoint"
			});
		}

		removeSubscription(
			endpoint
		);

		res.json({
			success: true
		});
	}
);

app.post(
	"/api/reminders",
	(req, res) => {
		const {
			time,
			rows
		} = req.body;

		if (
			typeof time !==
				"string" ||
			!/^\d{2}:\d{2}$/.test(
				time
			) ||
			!Array.isArray(rows) ||
			rows.length === 0
		) {
			return res.status(400).json({
				error:
					"Invalid reminder"
			});
		}

		const reminder = {
			id: createId(),
			time,
			rows,
			createdAt:
				Date.now(),
			triggered: false
		};

		reminders.push(
			reminder
		);

		saveData();

		io.emit(
			"reminder-created",
			reminder
		);

		res.json(
			reminder
		);
	}
);

app.get(
	"/api/reminders",
	(req, res) => {
		res.json(
			reminders.filter(
				reminder =>
					!reminder.triggered
			)
		);
	}
);

app.get(
	"/api/reminders/all",
	(req, res) => {
		res.json(
			reminders
		);
	}
);

app.delete(
	"/api/reminders/:id",
	(req, res) => {
		const id =
			req.params.id;

		const oldLength =
			reminders.length;

		reminders =
			reminders.filter(
				reminder =>
					reminder.id !== id
			);

		if (
			reminders.length !==
			oldLength
		) {
			saveData();

			io.emit(
				"reminder-deleted",
				id
			);
		}

		res.json({
			success: true
		});
	}
);

app.delete(
	"/api/reminders",
	(req, res) => {
		reminders = [];

		saveData();

		io.emit(
			"reminders-cleared"
		);

		res.json({
			success: true
		});
	}
);

app.get(
	"/api/status",
	(req, res) => {
		res.json({
			online: true,
			subscriptions:
				subscriptions.length,
			reminders:
				reminders.filter(
					reminder =>
						!reminder.triggered
				).length,
			totalReminders:
				reminders.length
		});
	}
);

io.on(
	"connection",
	socket => {
		console.log(
			"Client connected:",
			socket.id
		);

		socket.emit(
			"reminders",
			reminders.filter(
				reminder =>
					!reminder.triggered
			)
		);

		socket.on(
			"disconnect",
			() => {
				console.log(
					"Client disconnected:",
					socket.id
				);
			}
		);
	}
);

async function checkReminders() {
	const now =
		new Date();

	const currentHour =
		now.getHours();

	const currentMinute =
		now.getMinutes();

	for (
		const reminder
		of reminders
	) {
		if (
			reminder.triggered
		) {
			continue;
		}

		if (
			typeof reminder.time !==
			"string"
		) {
			continue;
		}

		const parts =
			reminder.time.split(
				":"
			);

		if (
			parts.length !== 2
		) {
			continue;
		}

		const hour =
			Number(parts[0]);

		const minute =
			Number(parts[1]);

		if (
			!Number.isInteger(hour) ||
			!Number.isInteger(minute)
		) {
			continue;
		}

		if (
			hour !== currentHour ||
			minute !== currentMinute
		) {
			continue;
		}

		reminder.triggered =
			true;

		reminder.triggeredAt =
			Date.now();

		saveData();

		const body =
			reminder.rows
				.map(row => {
					if (
						typeof row ===
						"string"
					) {
						return row;
					}

					return row?.text ||
						"";
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
			time:
				reminder.time,
			rows:
				reminder.rows
		});

		io.emit(
			"reminder-triggered",
			reminder
		);
	}
}

loadData();

setInterval(
	checkReminders,
	1000
);

server.listen(
	PORT,
	"0.0.0.0",
	() => {
		console.log(
			`Reminders server running on http://localhost:${PORT}`
		);

		console.log(
			`Loaded ${reminders.length} reminders`
		);

		console.log(
			`Loaded ${subscriptions.length} push subscriptions`
		);

		console.log(
			`Service Worker: http://localhost:${PORT}/sw.js`
		);
	}
);