async function syncReminderToServer(table) {
    try {
        if (!table) {
            return null;
        }

        let serverId = table.dataset.serverReminderId;

        if (!serverId) {
            serverId = crypto.randomUUID();
            table.dataset.serverReminderId = serverId;
        }

        const time = table.dataset.time;

        if (!time) {
            return null;
        }

        const match = time.match(
            /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
        );

        if (!match) {
            console.error(
                "Invalid reminder time:",
                time
            );
            return null;
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
        )
            .map(row => ({
                text:
                    row.querySelector("td")?.textContent
                        ?.trim() || ""
            }))
            .filter(row => row.text);

        if (rows.length === 0) {
            return null;
        }

        const response = await fetch(
            "/api/reminders",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id: serverId,
                    time: serverTime,
                    rows
                })
            }
        );

        if (!response.ok) {
            const errorText =
                await response.text();

            throw new Error(
                `HTTP ${response.status}: ${errorText}`
            );
        }

        const reminder =
            await response.json();

        table.dataset.serverReminderId =
            reminder.id;

        console.log(
            "Reminder synchronized:",
            reminder
        );

        return reminder;
    } catch (error) {
        console.error(
            "Could not synchronize reminder:",
            error
        );

        return null;
    }
}
