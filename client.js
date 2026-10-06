if (window.innerWidth > 600) {

	function parseTime12Hour(time) {
		if (!time) return null;

		time = String(time).trim().toUpperCase();

		const match12 = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);

		if (match12) {
			let hour = parseInt(match12[1], 10);
			const minute = parseInt(match12[2], 10);
			const period = match12[3];

			if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
				return null;
			}

			if (period === "AM") {
				if (hour === 12) hour = 0;
			} else {
				if (hour !== 12) hour += 12;
			}

			return hour * 60 + minute;
		}

		const match24 = time.match(/^(\d{1,2}):(\d{2})$/);

		if (match24) {
			const hour = parseInt(match24[1], 10);
			const minute = parseInt(match24[2], 10);

			if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
				return null;
			}

			return hour * 60 + minute;
		}

		return null;
	}

	function formatTime12Hour(value) {
		if (!value) return '';

		value = String(value).trim().toUpperCase();

		const match12 = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);

		if (match12) {
			let hour = parseInt(match12[1], 10);
			const minute = parseInt(match12[2], 10);
			const period = match12[3];

			if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
				return '';
			}

			return `${hour}:${String(minute).padStart(2, '0')} ${period}`;
		}

		const match24 = value.match(/^(\d{1,2}):(\d{2})$/);

		if (match24) {
			let hour = parseInt(match24[1], 10);
			const minute = parseInt(match24[2], 10);

			if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
				return '';
			}

			const period = hour >= 12 ? 'PM' : 'AM';
			const hour12 = hour % 12 || 12;

			return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
		}

		return '';
	}

	function currentTime12Hour(date = new Date(), includeSeconds = true) {
		return date.toLocaleTimeString(undefined, {
			hour: "numeric",
			minute: "2-digit",
			...(includeSeconds ? { second: "2-digit" } : {}),
			hour12: true
		});
	}

	function fitTables() {
		tables = Array.from(d.querySelectorAll('.table'));

		tables.sort((a, b) => {
			const timeA = parseTime12Hour(a.dataset.time);
			const timeB = parseTime12Hour(b.dataset.time);

			if (timeA === null && timeB === null) return 0;
			if (timeA === null) return 1;
			if (timeB === null) return -1;

			return timeA - timeB;
		});

		const container = getEl('table');

		for (const table of tables) {
			container.appendChild(table);
		}

		tables = d.querySelectorAll('.table');

		for (let i = 0; i < tables.length; i++) {
			let totalWidth = 0;

			for (let j = 0; j < i; j++) {
				totalWidth += tables[j].getBoundingClientRect().width - 1;
			}

			tables[i].style.left = (totalWidth + 7) + "px";
		}

		if (tables.length === 0) {
			return;
		}

		for (const table of tables) {
			table.style.borderTopLeftRadius = "0px";
			table.style.borderBottomLeftRadius = "0px";
			table.style.borderTopRightRadius = "0px";
			table.style.borderBottomRightRadius = "0px";

			for (const child of table.children) {
				child.style.borderTopLeftRadius = "0px";
				child.style.borderBottomLeftRadius = "0px";
				child.style.borderTopRightRadius = "0px";
				child.style.borderBottomRightRadius = "0px";

				for (const child1 of child.children) {
					child1.style.borderTopLeftRadius = "0px";
					child1.style.borderBottomLeftRadius = "0px";
					child1.style.borderTopRightRadius = "0px";
					child1.style.borderBottomRightRadius = "0px";

					for (const child2 of child1.children) {
						child2.style.borderTopLeftRadius = "0px";
						child2.style.borderBottomLeftRadius = "0px";
						child2.style.borderTopRightRadius = "0px";
						child2.style.borderBottomRightRadius = "0px";
					}
				}
			}
		}

		const first = tables[0];
		const last = tables[tables.length - 1];

		first.style.left = "7px";

		first.style.borderTopLeftRadius = "5px";
		first.style.borderBottomLeftRadius = "5px";

		first.children[0].children[0].children[0].style.borderTopLeftRadius = "5px";

		first.children[
			first.children[0].children[0].children.length - 1
		].children[
			first.children[first.children.length - 1].children.length - 1
		].children[0].style.borderBottomLeftRadius = "5px";

		last.style.borderTopRightRadius = "5px";
		last.style.borderBottomRightRadius = "5px";

		last.children[0].children[0].children[0].style.borderTopRightRadius = "5px";

		last.children[
			first.children[0].children[0].children.length - 1
		].children[
			first.children[first.children.length - 1].children.length - 1
		].children[0].style.borderBottomRightRadius = "5px";
		
		saveTables();
	}

	newTable.addEventListener('click', (() => {
		if (getEl('tableSettings').classList.contains('hidden')) {
			d.querySelector('.addTableAfter').style.transform = 'rotate(45deg)';
			getEl('tableSettings').classList.remove('hidden');
			tableInput.focus();

			getEl('tableSettings').children[2].children[0].children[0].remove();

			let settingsTable = d.createElement('tbody');
			getEl('tableSettings').children[2].children[0].appendChild(settingsTable);
		} else {
			d.querySelector('.addTableAfter').style.transform = '';
			getEl('tableSettings').classList.add('hidden');

			getEl('tableSettings').children[2].children[0].children[0].remove();

			let settingsTable = d.createElement('tbody');
			getEl('tableSettings').children[2].children[0].appendChild(settingsTable);
		}
	}));

	tableInput.addEventListener('keypress', ((e) => {
		if (e.key === 'Enter') {
			e.preventDefault();

			if (e.shiftKey) {
				confirmButton.click();
				return;
			}

			if (tableInput.value !== '') {
				addTableRow(tableInput.value);
				tableInput.value = '';
			}
		}
	}));

	confirmButton.addEventListener('click', async () => {
		const settings = getEl('tableSettings');
		const timeInput = getEl('timeInput');
		const labels = getEl('labels');
		const tableContainer = getEl('table');

		let selectedTime = timeInput.value;

		if (!selectedTime) {
			return;
		}

		selectedTime = formatTime12Hour(selectedTime);

		if (!selectedTime) {
			return;
		}

		E = selectedTime;

		const labelRows = labels.querySelectorAll('.row2');

		if (labelRows.length === 0) {
			return;
		}

		let existingTable = Array.from(
			tableContainer.querySelectorAll('.table')
		).find(table => {
			return formatTime12Hour(table.dataset.time) === selectedTime;
		});

		if (existingTable) {
			existingTable.dataset.time = selectedTime;

			const tbody = existingTable.querySelector('tbody');

			const timeCell = existingTable.querySelector('.timeRow td');

			if (timeCell) {
				timeCell.textContent = selectedTime;
			}

			for (const oldRow of labelRows) {
				const row = d.createElement('tr');
				row.className = 'row';

				const cell = d.createElement('td');

				cell.textContent =
					oldRow.querySelector('.td2')?.childNodes[0]?.textContent || '';

				row.appendChild(cell);
				tbody.appendChild(row);
			}
		} else {
			const newTable = d.createElement('table');

			newTable.classList.add('table');
			newTable.dataset.time = selectedTime;

			const tbody = d.createElement('tbody');
			tbody.classList.add('tbody');

			const timeRow = d.createElement('tr');
			timeRow.className = 'timeRow';

			const timeCell = d.createElement('td');
			timeCell.textContent = selectedTime;

			timeRow.appendChild(timeCell);
			tbody.appendChild(timeRow);

			timeCell.addEventListener('click', ((e) => {
				clickListener(e);
			}));

			for (const oldRow of labelRows) {
				const row = d.createElement('tr');
				row.className = 'row';

				const cell = d.createElement('td');

				const text =
					oldRow.querySelector('.td2')?.childNodes[0]?.textContent || '';

				cell.textContent = text;

				row.appendChild(cell);
				tbody.appendChild(row);
			}

			newTable.appendChild(tbody);
			tableContainer.appendChild(newTable);
		}

		labels.querySelector('tbody').innerHTML = '';

		tableInput.value = '';
		timeInput.value = '';

		settings.classList.add('hidden');
		d.querySelector('.addTableAfter').style.transform = '';

		saveTables();
		fitTables();
		await syncRemindersToServer();
	});

	let now = new Date();

	setInterval(() => {
		const tableContainer = getEl('table');

		now = new Date();

		const currentTime = currentTime12Hour(now, true);

		const currentHourMinute = now.toLocaleTimeString(undefined, {
			hour: "numeric",
			minute: "2-digit",
			hour12: true
		});

		const timeHas = Array.from(
			tableContainer.querySelectorAll('.table')
		).find(table => {
			return formatTime12Hour(table.dataset.time).trim() ===
				currentHourMinute.trim();
		});

		/*cl(
			(timeHas !== undefined ? true : false) +
			" " +
			currentHourMinute
		);*/

		if (timeHas !== undefined && !timeHas.triggered) {
			setTimeout(() => {
				addAnimation(timeHas);
			}, 0);
		}

		if (timeHas !== undefined) {
			fitTables();
		}

		const milliseconds = String(
			now.getMilliseconds()
		).padStart(3, "0");

		const [timePart, period] = currentTime.split(' ');

		yearDiv.textContent =
			`${timePart}.${milliseconds.slice(0, 2)} ${period}`;
	}, 1);

	function saveTables() {
		const tables = Array.from(
			getEl('table').querySelectorAll('.table')
		);

		const data = tables.map(table => ({
			time: formatTime12Hour(table.dataset.time),
			rows: Array.from(
				table.querySelectorAll('tbody .row')
			).map(row => ({
				text: row.querySelector('td')?.textContent || ''
			}))
		}));

		localStorage.setItem('tables', JSON.stringify(data));
	}

	function loadTables() {
		const saved = localStorage.getItem('tables');

		if (!saved) {
			return;
		}

		let data;

		try {
			data = JSON.parse(saved);
		} catch {
			localStorage.removeItem('tables');
			return;
		}

		const tableContainer = getEl('table');

		tableContainer.querySelectorAll('.table').forEach(table => {
			table.remove();
		});

		for (const tableData of data) {
			const normalizedTime = formatTime12Hour(tableData.time);

			if (!normalizedTime) {
				continue;
			}

			const table = d.createElement('table');

			table.classList.add('table');
			table.dataset.time = normalizedTime;

			const tbody = d.createElement('tbody');
			tbody.classList.add('tbody');

			const timeRow = d.createElement('tr');
			timeRow.className = 'timeRow';

			const timeCell = d.createElement('td');
			timeCell.textContent = normalizedTime;

			timeRow.appendChild(timeCell);
			tbody.appendChild(timeRow);

			timeCell.addEventListener('click', ((e) => {
				clickListener(e);
			}));

			for (const rowData of tableData.rows || []) {
				const row = d.createElement('tr');
				row.className = 'row';

				const cell = d.createElement('td');
				cell.textContent = rowData.text || '';

				row.appendChild(cell);
				tbody.appendChild(row);
			}

			table.appendChild(tbody);
			tableContainer.appendChild(table);
		}

		saveTables();
		fitTables();
	}

	window.addEventListener('load', (() => {
		loadTables();
		fitTables();
		(async () => {
			await setupPushNotifications();
		})();
	}));

} else {
	b.remove();

	body1 = d.createElement('body');

	body1.innerHTML = `
		<div class="uhOh">
			<h1>Uh Oh!</h1>
			<p>We're so sorry, but this website is for desktop only</p>
		</div>
	`;

	d.children[0].appendChild(body1);

	d.querySelector('.uhOh').children[0].style.fontSize =
		(window.innerWidth / 4) + "px";

	d.querySelector('.uhOh').children[1].style.fontSize =
		(window.innerWidth / 13) + "px";

	window.onresize = function() {
		d.querySelector('.uhOh').children[0].style.fontSize =
			(window.innerWidth / 4) + "px";

		d.querySelector('.uhOh').children[1].style.fontSize =
			(window.innerWidth / 13) + "px";
	}
}