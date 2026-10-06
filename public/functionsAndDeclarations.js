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
        const button = row.querySelector(".subtractRow");

        if (!button) {
            return;
        }

        const rowRect = row.getBoundingClientRect();
        const labelsRect = labels.getBoundingClientRect();

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

    let tbody = labels.querySelector("tbody");

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
    button.className = "subtractRow";

    button.addEventListener("click", () => {
        row.remove();
        updateSubtractRows();
    });

    cell.appendChild(button);
    row.appendChild(cell);
    tbody.appendChild(row);

    requestAnimationFrame(updateSubtractRows);
}

function urlBase64ToUint8Array(base64String) {
    const padding =
        "=".repeat(
            (4 - base64String.length % 4) % 4
        );

    const base64 =
        (
            base64String +
            padding
        )
            .replace(/-/g, "+")
            .replace(/_/g, "/");

    const rawData = atob(base64);

    const output =
        new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i++) {
        output[i] =
            rawData.charCodeAt(i);
    }

    return output;
}

async function setupPushNotifications() {
    try {
        if (!("serviceWorker" in navigator)) {
            console.error(
                "Service Workers are not supported."
            );
            return false;
        }

        if (!("PushManager" in window)) {
            console.error(
                "Push notifications are not supported."
            );
            return false;
        }

        if (!("Notification" in window)) {
            console.error(
                "Notifications are not supported."
            );
            return false;
        }

        console.log(
            "Registering service worker..."
        );

        await navigator.serviceWorker.register(
            "/sw.js",
            {
                scope: "/"
            }
        );

        const registration =
            await navigator.serviceWorker.ready;

        console.log(
            "Service worker ready."
        );

        let permission =
            Notification.permission;

        if (permission === "default") {
            permission =
                await Notification.requestPermission();
        }

        if (permission !== "granted") {
            console.error(
                "Notification permission was not granted."
            );
            return false;
        }

        console.log(
            "Notification permission granted."
        );

        const keyResponse =
            await fetch(
                "/api/vapid-public-key",
                {
                    cache: "no-store"
                }
            );

        if (!keyResponse.ok) {
            throw new Error(
                `Could not get VAPID public key: HTTP ${keyResponse.status}`
            );
        }

        const keyData =
            await keyResponse.json();

        if (!keyData.publicKey) {
            throw new Error(
                "Server did not return a VAPID public key."
            );
        }

        const applicationServerKey =
            urlBase64ToUint8Array(
                keyData.publicKey
            );

        let subscription =
            await registration.pushManager.getSubscription();

        if (!subscription) {
            console.log(
                "Creating new push subscription..."
            );

            subscription =
                await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey
                });
        }

        console.log(
            "Push subscription:",
            subscription
        );

        const subscribeResponse =
            await fetch(
                "/api/subscribe",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify(
                            subscription.toJSON()
                        )
                }
            );

        let subscribeData = {};

        try {
            subscribeData =
                await subscribeResponse.json();
        } catch {
        }

        if (!subscribeResponse.ok) {
            throw new Error(
                subscribeData.error ||
                `Subscription failed: HTTP ${subscribeResponse.status}`
            );
        }

        console.log(
            "Push subscription registered with server."
        );

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

        if (!subscription) {
            return true;
        }

        try {
            await fetch(
                "/api/subscribe",
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify({
                            endpoint:
                                subscription.endpoint
                        })
                }
            );
        } catch (error) {
            console.warn(
                "Could not remove subscription from server:",
                error
            );
        }

        await subscription.unsubscribe();

        console.log(
            "Push notifications disabled."
        );

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
        Notification.permission !== "granted"
    ) {
        return;
    }

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

function showNotification1(
    body,
    iconURL,
    id,
    el
) {
    if (
        !("Notification" in window) ||
        Notification.permission !== "granted"
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

async function deleteReminderFromServer(
    id
) {
    if (!id) {
        return false;
    }

    try {
        const response =
            await fetch(
                `/api/reminders/${encodeURIComponent(id)}`,
                {
                    method: "DELETE"
                }
            );

        if (
            !response.ok &&
            response.status !== 404
        ) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        console.log(
            "Server reminder deleted:",
            id
        );

        return true;
    } catch (error) {
        console.error(
            "Could not delete server reminder:",
            error
        );

        return false;
    }
}

function confirmFunction(e) {
    const el = e.target;

    const table =
        el.closest?.(".table");

    const serverReminderId =
        table?.dataset?.serverReminderId;

    if (serverReminderId) {
        deleteReminderFromServer(
            serverReminderId
        );
    }

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

    const serverReminderId =
        el.dataset.serverReminderId;

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
            ?.textContent ||
        "Reminder",
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

    if (el.children[0]) {
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
        async () => {
            if (
                el.relatedNotification
            ) {
                el.relatedNotification.close();
            }

            el.style.animation =
                "none";

            el.remove();

            if (serverReminderId) {
                await deleteReminderFromServer(
                    serverReminderId
                );
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
    const table =
        e.target.closest?.(".table");

    const serverReminderId =
        table?.dataset?.serverReminderId;

    if (serverReminderId) {
        deleteReminderFromServer(
            serverReminderId
        );
    }

    if (e.target.parentElement) {
        e.target.parentElement.remove();
    }

    e.target.remove();

    tables =
        d.querySelectorAll(
            ".table"
        );

    if (tables.length === 0) {
        if (
            typeof saveTables ===
            "function"
        ) {
            saveTables();
        }

        return;
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
}

function getServerTimeFromTable(
    table
) {
    const time =
        table?.dataset?.time;

    if (!time) {
        return null;
    }

    const match =
        time.match(
            /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
        );

    if (!match) {
        return null;
    }

    let hour =
        Number(match[1]);

    const minute =
        Number(match[2]);

    const period =
        match[3].toUpperCase();

    if (
        hour < 1 ||
        hour > 12 ||
        minute < 0 ||
        minute > 59
    ) {
        return null;
    }

    if (
        period === "AM" &&
        hour === 12
    ) {
        hour = 0;
    } else if (
        period === "PM" &&
        hour !== 12
    ) {
        hour += 12;
    }

    return (
        String(hour).padStart(2, "0") +
        ":" +
        String(minute).padStart(2, "0")
    );
}

function getRowsFromTable(
    table
) {
    return Array.from(
        table.querySelectorAll(
            "tbody .row"
        )
    ).map(row => ({
        text:
            row.querySelector("td")
                ?.textContent ||
            ""
    }));
}

async function syncReminderToServer(
    table
) {
    if (!table) {
        return false;
    }

    const serverTime =
        getServerTimeFromTable(
            table
        );

    if (!serverTime) {
        console.warn(
            "Could not synchronize table: invalid time.",
            table
        );

        return false;
    }

    const rows =
        getRowsFromTable(
            table
        );

    if (rows.length === 0) {
        return false;
    }

    if (
        !table.dataset.serverReminderId
    ) {
        table.dataset.serverReminderId =
            crypto.randomUUID();
    }

    const id =
        table.dataset.serverReminderId;

    try {
        const response =
            await fetch(
                "/api/reminders",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify({
                            id,
                            time: serverTime,
                            rows
                        })
                }
            );

        let data = {};

        try {
            data =
                await response.json();
        } catch {
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                `HTTP ${response.status}`
            );
        }

        if (data.id) {
            table.dataset.serverReminderId =
                data.id;
        }

        console.log(
            "Reminder synchronized:",
            table.dataset.serverReminderId
        );

        return true;
    } catch (error) {
        console.error(
            "Could not synchronize reminder:",
            error
        );

        return false;
    }
}

async function syncRemindersToServer() {
    const container =
        getEl("table");

    if (!container) {
        return false;
    }

    const tableElements =
        Array.from(
            container.querySelectorAll(
                ".table"
            )
        );

    let success = true;

    for (
        const table of tableElements
    ) {
        const result =
            await syncReminderToServer(
                table
            );

        if (!result) {
            success = false;
        }
    }

    if (success) {
        console.log(
            "All reminders synchronized with server."
        );
    }

    return success;
}

async function loadServerReminderState(
    table
) {
    if (!table) {
        return null;
    }

    const id =
        table.dataset.serverReminderId;

    if (!id) {
        return null;
    }

    try {
        const response =
            await fetch(
                "/api/reminders/all",
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const reminders =
            await response.json();

        return reminders.find(
            reminder =>
                reminder.id === id
        ) || null;
    } catch (error) {
        console.error(
            "Could not load server reminder state:",
            error
        );

        return null;
    }
}

async function syncExistingTables() {
    const container =
        getEl("table");

    if (!container) {
        return false;
    }

    const tableElements =
        Array.from(
            container.querySelectorAll(
                ".table"
            )
        );

    for (
        const table of tableElements
    ) {
        if (
            !table.dataset.serverReminderId
        ) {
            table.dataset.serverReminderId =
                crypto.randomUUID();
        }
    }

    if (
        typeof saveTables ===
        "function"
    ) {
        saveTables();
    }

    return await syncRemindersToServer();
}

window.addEventListener(
    "load",
    async () => {
        try {
            await setupPushNotifications();
        } catch (error) {
            console.error(
                "Could not initialize push notifications:",
                error
            );
        }

        setTimeout(
            async () => {
                try {
                    await syncExistingTables();
                } catch (error) {
                    console.error(
                        "Could not synchronize existing reminders:",
                        error
                    );
                }
            },
            1000
        );
    }
);
