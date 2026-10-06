self.addEventListener("push", event => {
	if (!event.data) {
		return;
	}

	let data;

	try {
		data = event.data.json();
	} catch {
		data = {
			title: "Reminder",
			body: event.data.text()
		};
	}

	const title = data.title || "Reminder";

	const options = {
		body: data.body || "Your reminder is due.",
		icon: data.icon || "/icon.png",
		badge: data.badge || "/icon.png",
		tag: data.id || "reminder",
		renotify: true,
		requireInteraction: true,
		data: {
			id: data.id || null,
			time: data.time || null,
			rows: data.rows || []
		}
	};

	event.waitUntil(
		self.registration.showNotification(
			title,
			options
		)
	);
});

self.addEventListener("notificationclick", event => {
	event.notification.close();

	event.waitUntil(
		clients.matchAll({
			type: "window",
			includeUncontrolled: true
		}).then(clientList => {
			for (const client of clientList) {
				if ("focus" in client) {
					return client.focus();
				}
			}

			if (clients.openWindow) {
				return clients.openWindow("/");
			}
		})
	);
});

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", event => {
	event.waitUntil(
		clients.claim()
	);
});
