
const d = document;
const b = d.body;
const cl = console.log;
const cc = console.clear;

function getEl(name) {
    return d.getElementById(name);
}

const table1 = getEl("table1");
const table2 = getEl("table2");

let tables = d.querySelectorAll(".table");

const newTable = getEl("newTableButton");
const tableInput = getEl("tablelabel");
const confirmButton = getEl("confirmTable");
const yearDiv = getEl("year");
const confirm = getEl("confirmDelete");

let E;
let EVENT;

let CONFIG = {
    militaryTime: false,
    darkTheme: true
};

let Notification1;

function updateSubtractRows() {
    const labels = getEl("labels");

    if (!labels) {
        return;
    }

    const tbody = labels.querySelector("tbody");

    if (!tbody) {
        return;
    }

    const rows = tbody.querySelectorAll(".row2");

    rows.forEach(row => {
        const button =
            row.querySelector(".subtractRow");

        if (!button) {
            return;
        }

        const rowRect =
            row.getBoundingClientRect();

        const labelsRect =
            labels.getBoundingClientRect();

        button.style.top =
            (
                rowRect.top -
                labelsRect.top +
                rowRect.height / 2 -
                button.offsetHeight / 2
            ) + 6 + "px";

        button.style.left =
            (
                rowRect.left -
                labelsRect.left -
                button.offsetWidth -
                5
            ) + "px";
    });
}

function addTableRow(value) {
    const labels = getEl("labels");

    if (!labels) {
        return;
    }

    let tbody =
        labels.querySelector("tbody");

    if (!tbody) {
        tbody = d.createElement("tbody");
        labels.appendChild(tbody);
    }

    const row = d.createElement("tr");
    row.className = "row2";

    const cell = d.createElement("td");
    cell.className = "td2";

    cell.textContent = value;

    const button = d.createElement("div");

    button.className =
        "subtractRow";

    button.addEventListener(
        "click",
        () => {
            row.remove();
            updateSubtractRows();
        }
    );

    cell.appendChild(button);
    row.appendChild(cell);
    tbody.appendChild(row);

    requestAnimationFrame(
        updateSubtractRows
    );
}

function urlBase64ToUint8Array(
    base64String
) {
    const padding =
        "=".repeat(
            (4 -
                base64String.length % 4) %
                4
        );

    const base64 =
        (
            base64String +
            padding
        )
            .replace(/-/g, "+")
            .replace(/_/g, "/");

    const rawData =
        atob(base64);

    const output =
        new Uint8Array(
            rawData.length
        );

    for (
        let i = 0;
        i < rawData.length;
        i++
    ) {
        output[i] =
            rawData.charCodeAt(i);
    }

    return output;
}

async function setupPushNotifications() {
    try {
        if (!("serviceWorker" in navigator)) {
            console.error("Service Workers are not supported.");
            return false;
        }

        if (!("PushManager" in window)) {
            console.error("Push notifications are not supported.");
            return false;
        }

        if (!("Notification" in window)) {
            console.error("Notifications are not supported.");
            return false;
        }

        await navigator.serviceWorker.register("/sw.js", {
            scope: "/"
        });

        const registration = await navigator.serviceWorker.ready;

        let permission = Notification.permission;

        if (permission === "default") {
            permission = await Notification.requestPermission();
        }

        if (permission !== "granted") {
            console.error("Notification permission was not granted.");
            return false;
        }

        const keyResponse = await fetch("/api/vapid-public-key");

        if (!keyResponse.ok) {
            throw new Error(
                `Could not get VAPID public key: HTTP ${keyResponse.status}`
            );
        }

        const keyData = await keyResponse.json();

        if (!keyData.publicKey) {
            throw new Error("Server did not return a VAPID public key.");
        }

        function urlBase64ToUint8Array(base64String) {
            const padding = "=".repeat(
                (4 - base64String.length % 4) % 4
            );

            const base64 = (
                base64String +
                padding
            )
                .replace(/-/g, "+")
                .replace(/_/g, "/");

            const rawData = atob(base64);

            return Uint8Array.from(
                [...rawData].map(char => char.charCodeAt(0))
            );
        }

        const applicationServerKey =
            urlBase64ToUint8Array(keyData.publicKey);

        let subscription =
            await registration.pushManager.getSubscription();

        if (!subscription) {

            subscription =
                await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey
                });
        } else {
        }

        const subscribeResponse = await fetch("/api/subscribe", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(subscription.toJSON())
        });

        const subscribeData = await subscribeResponse.json();

        if (!subscribeResponse.ok) {
            throw new Error(
                subscribeData.error ||
                `Subscription failed: HTTP ${subscribeResponse.status}`
            );
        }

        return true;
    } catch (error) {
        console.error(
            "Push notification setup failed:",
            error
        );

        return false;
    }
}

async function disablePushNotifications() {
    if (
        !("serviceWorker" in navigator)
    ) {
        return false;
    }

    try {
        const registration =
            await navigator.serviceWorker.getRegistration(
                "/"
            );

        if (!registration) {
            return false;
        }

        const subscription =
            await registration.pushManager.getSubscription();

        if (!subscription) {
            return true;
        }

        await subscription.unsubscribe();

        return true;
    } catch (error) {
        console.error(
            "Could not disable push notifications:",
            error
        );

        return false;
    }
}

async function pushNotificationsEnabled() {
    if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
    ) {
        return false;
    }

    try {
        const registration =
            await navigator.serviceWorker.getRegistration(
                "/"
            );

        if (!registration) {
            return false;
        }

        const subscription =
            await registration.pushManager.getSubscription();

        return !!subscription;
    } catch {
        return false;
    }
}

async function showNotification(
    body,
    iconURL,
    id,
    el
) {
    if (
        !("Notification" in window) ||
        Notification.permission !==
            "granted"
    ) {
        return;
    }

    try {
        const response = await fetch("/api/reminders/all");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const reminders = await response.json();

    } catch (error) {
        console.error("Could not get reminders:", error);
	const reminders = [];
    }

    const reminder = reminders.find(r => r.id === reminderId);

    if (!reminder.triggered) {
    	const notification =
    	    new Notification(
    	        "Reminder",
    	        {
    	            body,
    	            icon: iconURL,
    	            tag: id,
    	            requireInteraction: true
    	        }
    	    );
	
	    if (el) {
	        el.relatedNotification =
	            notification;
	    }
	
	    notification.onclick = () => {
	        window.focus();
	        notification.close();
	    };
    }
}

function showNotification1(
    body,
    iconURL,
    id,
    el
) {
    if (
        !("Notification" in window) ||
        Notification.permission !==
            "granted"
    ) {
        return;
    }

    const options = {
        body,
        icon: iconURL,
        tag: id,
        requireInteraction: true,
        vibrate: [
            100,
            200,
            300,
            200,
            100
        ]
    };

    const notification =
        new Notification(
            "Reminder",
            options
        );

    Notification1 =
        notification;

    if (el) {
        el.relatedNotification =
            notification;

        el.id = id;
    }

    notification.onclose = () => {
        const element =
            getEl(id);

        if (element) {
            element.remove();
        }

        if (
            typeof saveTables ===
            "function"
        ) {
            saveTables();
        }

        if (
            typeof fitTables ===
            "function"
        ) {
            fitTables();
        }
    };

    notification.onclick = () => {
        window.focus();

        notification.close();

        const element =
            getEl(id);

        if (element) {
            element.remove();
        }

        if (
            typeof saveTables ===
            "function"
        ) {
            saveTables();
        }

        if (
            typeof fitTables ===
            "function"
        ) {
            fitTables();
        }
    };
}

function confirmFunction(e) {
    const el = e.target;

    if (
        el.parentElement &&
        el.parentElement.parentElement &&
        el.parentElement.parentElement.parentElement
    ) {
        el.parentElement.parentElement.parentElement.remove();
    }

    if (confirm) {
        confirm.removeEventListener(
            "click",
            confirmFunction
        );

        confirm.classList.add(
            "hidden"
        );
    }

    if (
        typeof fitTables ===
        "function"
    ) {
        fitTables();
    }
}

function rejectFunction() {
    if (!confirm) {
        return;
    }

    confirm.removeEventListener(
        "click",
        rejectFunction
    );

    confirm.classList.add(
        "hidden"
    );

    if (
        typeof fitTables ===
        "function"
    ) {
        fitTables();
    }
}

function addAnimation(el) {
    if (!el || el.triggered) {
        return;
    }

    if (
        typeof fitTables ===
        "function"
    ) {
        fitTables();
    }

    el.className = "table2";

    if (el.parentElement) {
        el.parentElement.removeChild(
            el
        );
    }

    b.appendChild(el);

    el.style.position =
        "absolute";

    const ID =
        crypto.randomUUID();

    showNotification(
        el.querySelector(
            ".row"
        )?.children?.[0]
            ?.textContent || "Reminder",
        "",
        ID,
        el
    );

    el.id = ID;

    el.style.animation =
        "ringing 4s infinite ease-out";

    el.style.transition =
        "transform 1s ease, background 1s ease";

    el.style.left =
        (
            window.innerWidth / 2 -
            el.getBoundingClientRect()
                .width *
                2
        ) + "px";

    el.style.top = "40%";

    E = el;

    el.style.height =
        "fit-content";

    const timeRow =
        el.querySelector(
            ".timeRow"
        );

    if (timeRow) {
        timeRow.remove();
    }

    if (
        el.children[0]
    ) {
        el.children[0].style.height =
            el.getBoundingClientRect()
                .height *
            2 +
            "px";

        el.children[0].style.width =
            "fit-content";

        if (
            el.children[0]
                .children[0] &&
            el.children[0]
                .children[0]
                .children[0]
        ) {
            el.children[0]
                .children[0]
                .children[0]
                .style.maxWidth =
                "500px";
        }

        el.children[0].style.borderRadius =
            "20px";

        if (
            el.children[0]
                .children[0]
        ) {
            el.children[0]
                .children[0]
                .style.borderRadius =
                "20px";
        }
    }

    el.style.transform =
        "translateX(-50%)";

    d.body.style.setProperty(
        "--delete-animation",
        "ringing2 4s infinite linear"
    );

    el.triggered = true;

    el.removeEventListener(
        "click",
        clickListener2
    );

    el.addEventListener(
        "click",
        () => {
            if (
                el.relatedNotification
            ) {
                el.relatedNotification.close();
            }

            el.style.animation =
                "none";

            el.remove();

            if (
                typeof saveTables ===
                "function"
            ) {
                saveTables();
            }

            if (
                typeof fitTables ===
                "function"
            ) {
                fitTables();
            }
        }
    );
}

function clickListener(target) {
    if (!confirm) {
        return;
    }

    confirm.classList.remove(
        "hidden"
    );

    confirm.children[0]
        .addEventListener(
            "click",
            () => {
                confirmFunction(
                    target
                );
            }
        );

    confirm.children[1]
        .addEventListener(
            "click",
            rejectFunction
        );

    if (
        typeof fitTables ===
        "function"
    ) {
        fitTables();
    }
}

function clickListener2(e) {
    if (e.target.parentElement) {
        e.target.parentElement.remove();
    }

    e.target.remove();

    tables =
        d.querySelectorAll(
            ".table"
        );

    if (tables.length === 0) {
        return;
    }

    if (
        typeof fitTables ===
        "function"
    ) {
        fitTables();
    }
}

async function syncRemindersToServer() {
	try {
		const tables = Array.from(
			getEl("table").querySelectorAll(".table")
		);

		for (const table of tables) {
			const time = table.dataset.time;

			if (!time) {
				continue;
			}

			const match = time.match(
				/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
			);

			if (!match) {
				continue;
			}

			let hour = Number(match[1]);
			const minute = Number(match[2]);
			const period = match[3].toUpperCase();

			if (period === "AM" && hour === 12) {
				hour = 0;
			} else if (period === "PM" && hour !== 12) {
				hour += 12;
			}

			const serverTime =
				String(hour).padStart(2, "0") +
				":" +
				String(minute).padStart(2, "0");

			const rows = Array.from(
				table.querySelectorAll("tbody .row")
			).map(row => ({
				text:
					row.querySelector("td")?.textContent ||
					""
			}));

			if (rows.length === 0) {
				continue;
			}

			await fetch("/api/reminders", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					time: serverTime,
					rows
				})
			});
		}

		console.log(
			"Reminders synchronized with server."
		);

		return true;
	} catch (error) {
		console.error(
			"Could not synchronize reminders:",
			error
		);

		return false;
	}
}