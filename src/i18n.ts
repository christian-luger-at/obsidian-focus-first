import { moment } from 'obsidian';

type Lang = 'en' | 'de';

interface Translations {
	ribbon: { tooltip: string };
	commands: {
		openView: { name: string };
		addTask: { name: string };
	};
	quickAdd: {
		title: string;
		placeholder: string;
		add: string;
		addTaskButton: string;
		focus: string;
		addedNotice: string;
		noActiveNote: string;
	};
	view: {
		title: string;
		refresh: string;
		searchPlaceholder: string;
		searchToggle: string;
		add: string;
		manualTag: string;
		scope: string;
		scopeAll: string;
		open: string;
		done: string;
		empty: string;
		tasksPluginWarning: string;
		tasksPluginWarningDismiss: string;
		filterToggle: string;
		focusSectionTitle: string;
		focusAdd: string;
		focusRemove: string;
		focusDone: string;
		hideTask: string;
		unhideTask: string;
		actions: {
			more: string;
			openNote: string;
			postpone: string;
			priority: string;
			postponePlusDay: string;
			postponePlusWeek: string;
			dueToday: string;
			dueTomorrow: string;
			priorityNone: string;
			priorityHighest: string;
			priorityHigh: string;
			priorityMedium: string;
			priorityLow: string;
			priorityLowest: string;
		};
		detail: {
			priority: string;
			due: string;
			start: string;
			scheduled: string;
			tags: string;
			note: string;
		};
		quadrants: {
			do: { title: string; subtitle: string; emptyState: string };
			schedule: { title: string; subtitle: string; emptyState: string };
			delegate: { title: string; subtitle: string; emptyState: string };
			eliminate: { title: string; subtitle: string; emptyState: string };
		};
	};
	settings: {
		setting1: { name: string; desc: string; placeholder: string };
		appearanceHeading: string;
		fontSize: { name: string; desc: string };
		taskSourcesHeading: string;
		taskScope: {
			name: string;
			desc: string;
			optionAll: string;
			optionFolder: string;
		};
		taskFolder: {
			name: string;
			desc: string;
			placeholder: string;
			error: string;
		};
		matrixHeading: string;
		urgencyDays: { name: string; desc: string; error: string };
		importantPriorities: { name: string; desc: string; error: string };
		focusHeading: string;
		focusTag: { name: string; desc: string };
		hideHeading: string;
		hideTag: { name: string; desc: string };
		futureTasksHeading: string;
		futureTasks: {
			name: string;
			desc: string;
			optionShow: string;
			optionDim: string;
			optionHide: string;
		};
		quickAddHeading: string;
		quickAddTarget: {
			name: string;
			desc: string;
			optionInbox: string;
			optionActive: string;
		};
		quickAddInbox: { name: string; desc: string; placeholder: string };
		matrixDesc: string;
		quadrantsHeading: string;
		quadrantColor: { name: string; desc: string; reset: string };
		quadrantTag: { name: string; desc: string };
		groupByPrimary: { name: string; desc: string };
		sortPrimary: { name: string; desc: string };
		sortSecondary: { name: string; desc: string };
		sortField: { priority: string; dueDate: string; alpha: string };
		resetHeading: string;
		resetAll: { name: string; desc: string; button: string };
		toggleSection: string;
	};
	groups: {
		noPriority: string;
		overdue: string;
		today: string;
		thisWeek: string;
		upcoming: string;
		later: string;
		noDate: string;
	};
	tasksBlock: {
		missing: string;
		invalidShow: string;
	};
}

const translations: Record<Lang, Translations> = {
	en: {
		ribbon: { tooltip: 'Focus first' },
		commands: {
			openView: { name: 'Open Focus First' },
			addTask: { name: 'Add task' },
		},
		quickAdd: {
			title: 'Add task',
			placeholder: 'e.g. Call the dentist 📅 2026-07-10 🔼 #do',
			add: 'Add',
			addTaskButton: 'Add task',
			focus: 'Focus',
			addedNotice: 'Task added',
			noActiveNote: 'No active note — add one to the inbox instead, or open a note.',
		},
		view: {
			title: 'Focus First',
			refresh: 'Refresh',
			searchPlaceholder: 'Search tasks…',
			searchToggle: 'Search',
			add: 'Add',
			manualTag: 'Manually assigned via tag',
			scope: 'Scope',
			scopeAll: 'Entire vault',
			open: 'open',
			done: 'done',
			empty: 'No open tasks found.',
			tasksPluginWarning: 'The Tasks plugin is not enabled. Focus First works with plain checkboxes, but the Tasks plugin makes adding due dates and priorities much easier.',
			tasksPluginWarningDismiss: 'Dismiss',
			filterToggle: 'More Filters',
			focusSectionTitle: 'Focus Tasks',
			focusAdd: 'Add to focus',
			focusRemove: 'Remove from focus',
			focusDone: 'Mark as done',
			hideTask: 'Hide task',
			unhideTask: 'Unhide task',
			actions: {
				more: 'More actions',
				openNote: 'Open note',
				postpone: 'Postpone',
				priority: 'Set priority',
				postponePlusDay: '+1 day',
				postponePlusWeek: '+1 week',
				dueToday: 'Due today',
				dueTomorrow: 'Due tomorrow',
				priorityNone: 'No priority',
				priorityHighest: '🔺 Highest',
				priorityHigh: '⏫ High',
				priorityMedium: '🔼 Medium',
				priorityLow: '🔽 Low',
				priorityLowest: '⏬ Lowest',
			},
			detail: {
				priority: 'Priority',
				due: 'Due',
				start: 'Start',
				scheduled: 'Scheduled',
				tags: 'Tags',
				note: 'Note',
			},
			quadrants: {
				do:       { title: 'Do',       subtitle: 'Urgent · Important',        emptyState: 'Nothing urgent right now' },
				schedule: { title: 'Schedule', subtitle: 'Not urgent · Important',     emptyState: 'No important tasks pending' },
				delegate: { title: 'Delegate', subtitle: 'Urgent · Not important',     emptyState: 'Nothing to delegate' },
				eliminate:{ title: 'Eliminate',subtitle: 'Not urgent · Not important', emptyState: 'Nothing to eliminate' },
			},
		},
		settings: {
			setting1: {
				name: 'Settings #1',
				desc: "It's a secret",
				placeholder: 'Enter your secret',
			},
			appearanceHeading: 'Appearance',
			fontSize: {
				name: 'Font size',
				desc: 'Adjust the text size used throughout the Focus First view.',
			},
			taskSourcesHeading: 'Task Sources',
			taskScope: {
				name: 'Scan scope',
				desc: 'Define where Focus First looks for tasks. Choose "Entire vault" to include all notes, or "Specific folder" to limit the search to one location.',
				optionAll: 'Entire vault',
				optionFolder: 'Specific folder',
			},
			taskFolder: {
				name: 'Folder',
				desc: 'Only tasks inside this folder (and its sub-folders) will appear in Focus First.',
				placeholder: 'e.g. Projects/Work',
				error: 'Please select a folder.',
			},
			matrixHeading: 'Eisenhower Matrix',
			urgencyDays: {
				name: 'Urgency threshold (days)',
				desc: 'A task is considered urgent when its due date is within this many days — or already past. Set to 0 to mark only overdue tasks as urgent.',
				error: 'Please enter a whole number between 0 and 364.',
			},
			importantPriorities: {
				name: 'Important priorities',
				desc: 'Tasks carrying any of the selected priority levels are placed in the "Important" axis of the matrix. Select at least one.',
				error: 'At least one priority must be selected.',
			},
			focusHeading: 'Focus Task',
			focusTag: {
				name: 'Focus tag',
				desc: 'Add this tag to any task to highlight it as a Focus Task. Focus Tasks are displayed prominently above the matrix.',
			},
			hideHeading: 'Hide Task',
			hideTag: {
				name: 'Hide tag',
				desc: 'Tasks carrying this tag are hidden from the matrix. Use the hide button on any task to toggle this tag.',
			},
			futureTasksHeading: 'Future Tasks',
			futureTasks: {
				name: 'Not-yet-started tasks',
				desc: 'How to treat tasks whose start (🛫) or scheduled (⏳) date is still in the future — they are not actionable yet. The due date still drives urgency and classification.',
				optionShow: 'Show',
				optionDim: 'Dim',
				optionHide: 'Hide',
			},
			quickAddHeading: 'Quick Add',
			quickAddTarget: {
				name: 'Add tasks to',
				desc: 'Where the quick-add dialog (the "+" button in the view header, or the "Add task" command) appends new tasks.',
				optionInbox: 'Inbox note',
				optionActive: 'Active note',
			},
			quickAddInbox: {
				name: 'Inbox note',
				desc: 'Path to the note that receives quick-added tasks when "Add tasks to" is set to the inbox. Created if it does not exist.',
				placeholder: 'Inbox.md',
			},
			matrixDesc: 'These rules determine how tasks are automatically placed into quadrants based on their due date and priority.',
			quadrantsHeading: 'Quadrants',
			quadrantColor: {
				name: 'Color',
				desc: 'Accent color shown at the top border of the quadrant.',
				reset: 'Reset to default',
			},
			quadrantTag: {
				name: 'Tag (manual override)',
				desc: 'Add this tag to any task to pin it to this quadrant, overriding the automatic classification.',
			},
			groupByPrimary: {
				name: 'Group by primary criterion',
				desc: 'When enabled, tasks in each quadrant are visually grouped by their primary sort field.',
			},
			sortPrimary: {
				name: 'Primary sort',
				desc: 'Main criterion used to order tasks within the quadrant.',
			},
			sortSecondary: {
				name: 'Secondary sort',
				desc: 'Tiebreaker applied when the primary criterion is equal.',
			},
			sortField: { priority: 'Priority', dueDate: 'Due date', alpha: 'Alphabetical' },
			resetHeading: 'Reset',
			resetAll: {
				name: 'Reset all settings',
				desc: 'Resets every Focus First setting to its default value. This cannot be undone.',
				button: 'Reset to defaults',
			},
			toggleSection: 'Expand or collapse this section',
		},
		groups: {
			noPriority: 'No priority',
			overdue: 'Overdue',
			today: 'Today',
			thisWeek: 'This week',
			upcoming: 'Next 14 days',
			later: 'Later',
			noDate: 'No due date',
		},
		tasksBlock: {
			missing: 'The Tasks plugin must be installed and enabled to use this block.',
			invalidShow: 'Unknown "show-focus" section. Use: focus, do, schedule, delegate, or eliminate.',
		},
	},
	de: {
		ribbon: { tooltip: 'Focus First' },
		commands: {
			openView: { name: 'Focus First öffnen' },
			addTask: { name: 'Aufgabe hinzufügen' },
		},
		quickAdd: {
			title: 'Aufgabe hinzufügen',
			placeholder: 'z. B. Zahnarzt anrufen 📅 2026-07-10 🔼 #do',
			add: 'Hinzufügen',
			addTaskButton: 'Aufgabe hinzufügen',
			focus: 'Fokus',
			addedNotice: 'Aufgabe hinzugefügt',
			noActiveNote: 'Keine aktive Notiz — stattdessen in die Inbox einfügen oder eine Notiz öffnen.',
		},
		view: {
			title: 'Focus First',
			refresh: 'Aktualisieren',
			searchPlaceholder: 'Aufgaben suchen…',
			searchToggle: 'Suchen',
			add: 'Hinzufügen',
			manualTag: 'Manuell per Tag zugewiesen',
			scope: 'Bereich',
			scopeAll: 'Gesamter Vault',
			open: 'offen',
			done: 'erledigt',
			empty: 'Keine offenen Aufgaben gefunden.',
			tasksPluginWarning: 'Das Tasks-Plugin ist nicht aktiviert. Focus First funktioniert auch mit normalen Checkboxen, aber mit dem Tasks-Plugin lassen sich Fälligkeitsdaten und Prioritäten viel einfacher setzen.',
			tasksPluginWarningDismiss: 'Ausblenden',
			filterToggle: 'Mehr Filter',
			focusSectionTitle: 'Fokus-Aufgaben',
			focusAdd: 'Zu Fokus hinzufügen',
			focusRemove: 'Aus Fokus entfernen',
			hideTask: 'Aufgabe ausblenden',
			unhideTask: 'Aufgabe einblenden',
			focusDone: 'Als erledigt markieren',
			actions: {
				more: 'Weitere Aktionen',
				openNote: 'Notiz öffnen',
				postpone: 'Verschieben',
				priority: 'Priorität setzen',
				postponePlusDay: '+1 Tag',
				postponePlusWeek: '+1 Woche',
				dueToday: 'Fällig heute',
				dueTomorrow: 'Fällig morgen',
				priorityNone: 'Keine Priorität',
				priorityHighest: '🔺 Höchste',
				priorityHigh: '⏫ Hoch',
				priorityMedium: '🔼 Mittel',
				priorityLow: '🔽 Niedrig',
				priorityLowest: '⏬ Niedrigste',
			},
			detail: {
				priority: 'Priorität',
				due: 'Fällig',
				start: 'Start',
				scheduled: 'Geplant',
				tags: 'Tags',
				note: 'Notiz',
			},
			quadrants: {
				do:       { title: 'Erledigen',  subtitle: 'Dringend · Wichtig',             emptyState: 'Aktuell nichts Dringendes' },
				schedule: { title: 'Einplanen',  subtitle: 'Nicht dringend · Wichtig',        emptyState: 'Keine wichtigen Aufgaben ausstehend' },
				delegate: { title: 'Delegieren', subtitle: 'Dringend · Nicht wichtig',        emptyState: 'Nichts zu delegieren' },
				eliminate:{ title: 'Eliminieren',subtitle: 'Nicht dringend · Nicht wichtig',  emptyState: 'Nichts zu eliminieren' },
			},
		},
		settings: {
			setting1: {
				name: 'Einstellung #1',
				desc: 'Das ist ein Geheimnis',
				placeholder: 'Geheimnis eingeben',
			},
			appearanceHeading: 'Erscheinungsbild',
			fontSize: {
				name: 'Schriftgröße',
				desc: 'Passt die Textgröße in der gesamten Focus-First-Ansicht an.',
			},
			taskSourcesHeading: 'Aufgabenquellen',
			taskScope: {
				name: 'Suchbereich',
				desc: 'Legt fest, wo Focus First nach Aufgaben sucht. „Gesamter Vault" durchsucht alle Notizen; „Bestimmter Ordner" begrenzt die Suche auf einen Bereich.',
				optionAll: 'Gesamter Vault',
				optionFolder: 'Bestimmter Ordner',
			},
			taskFolder: {
				name: 'Ordner',
				desc: 'Nur Aufgaben in diesem Ordner (und seinen Unterordnern) werden in Focus First angezeigt.',
				placeholder: 'z.B. Projekte/Arbeit',
				error: 'Bitte einen Ordner auswählen.',
			},
			matrixHeading: 'Eisenhower-Matrix',
			urgencyDays: {
				name: 'Dringlichkeitsschwelle (Tage)',
				desc: 'Eine Aufgabe gilt als dringend, wenn das Fälligkeitsdatum innerhalb dieser Anzahl von Tagen liegt oder bereits überschritten wurde. Wert 0 markiert nur überfällige Aufgaben als dringend.',
				error: 'Bitte eine ganze Zahl zwischen 0 und 364 eingeben.',
			},
			importantPriorities: {
				name: 'Wichtige Prioritäten',
				desc: 'Aufgaben mit einer der gewählten Prioritätsstufen werden auf der „Wichtig"-Achse der Matrix eingeordnet. Mindestens eine Priorität muss ausgewählt sein.',
				error: 'Es muss mindestens eine Priorität ausgewählt sein.',
			},
			focusHeading: 'Fokus-Aufgabe',
			focusTag: {
				name: 'Fokus-Tag',
				desc: 'Füge diesen Tag einer Aufgabe hinzu, um sie als Fokus-Aufgabe hervorzuheben. Fokus-Aufgaben werden prominent über der Matrix angezeigt.',
			},
			hideHeading: 'Aufgabe ausblenden',
			hideTag: {
				name: 'Ausblenden-Tag',
				desc: 'Aufgaben mit diesem Tag werden in der Matrix nicht angezeigt. Über den Ausblenden-Button an jeder Aufgabe kann der Tag gesetzt oder entfernt werden.',
			},
			futureTasksHeading: 'Zukünftige Aufgaben',
			futureTasks: {
				name: 'Noch nicht gestartete Aufgaben',
				desc: 'Wie mit Aufgaben umgegangen wird, deren Startdatum (🛫) oder geplantes Datum (⏳) noch in der Zukunft liegt — sie sind noch nicht bearbeitbar. Das Fälligkeitsdatum bestimmt weiterhin Dringlichkeit und Einordnung.',
				optionShow: 'Anzeigen',
				optionDim: 'Abschwächen',
				optionHide: 'Ausblenden',
			},
			quickAddHeading: 'Schnell hinzufügen',
			quickAddTarget: {
				name: 'Aufgaben hinzufügen zu',
				desc: 'Wohin der Schnell-Hinzufügen-Dialog (der „+"-Button im View-Header oder der Befehl „Aufgabe hinzufügen") neue Aufgaben anhängt.',
				optionInbox: 'Inbox-Notiz',
				optionActive: 'Aktive Notiz',
			},
			quickAddInbox: {
				name: 'Inbox-Notiz',
				desc: 'Pfad zur Notiz, die schnell hinzugefügte Aufgaben erhält, wenn „Aufgaben hinzufügen zu" auf die Inbox gesetzt ist. Wird erstellt, falls nicht vorhanden.',
				placeholder: 'Inbox.md',
			},
			matrixDesc: 'Diese Regeln bestimmen, wie Aufgaben anhand von Fälligkeitsdatum und Priorität automatisch in Quadranten eingeordnet werden.',
			quadrantsHeading: 'Quadranten',
			quadrantColor: {
				name: 'Farbe',
				desc: 'Akzentfarbe des oberen Rahmens im Quadranten.',
				reset: 'Auf Standard zurücksetzen',
			},
			quadrantTag: {
				name: 'Tag (manuelle Zuweisung)',
				desc: 'Füge diesen Tag einer Aufgabe hinzu, um sie diesem Quadranten zuzuweisen und die automatische Klassifizierung zu überschreiben.',
			},
			groupByPrimary: {
				name: 'Nach erstem Kriterium gruppieren',
				desc: 'Wenn aktiviert, werden Aufgaben in jedem Quadranten nach dem primären Sortierfeld visuell gruppiert.',
			},
			sortPrimary: {
				name: 'Primäre Sortierung',
				desc: 'Hauptkriterium für die Reihenfolge der Aufgaben im Quadranten.',
			},
			sortSecondary: {
				name: 'Sekundäre Sortierung',
				desc: 'Tiebreaker, der angewendet wird, wenn das primäre Kriterium gleich ist.',
			},
			sortField: { priority: 'Priorität', dueDate: 'Fälligkeitsdatum', alpha: 'Alphabetisch' },
			resetHeading: 'Zurücksetzen',
			resetAll: {
				name: 'Alle Einstellungen zurücksetzen',
				desc: 'Setzt alle Focus-First-Einstellungen auf ihre Standardwerte zurück. Dies kann nicht rückgängig gemacht werden.',
				button: 'Auf Standardwerte zurücksetzen',
			},
			toggleSection: 'Diesen Abschnitt ein- oder ausklappen',
		},
		groups: {
			noPriority: 'Keine Priorität',
			overdue: 'Überfällig',
			today: 'Heute',
			thisWeek: 'Diese Woche',
			upcoming: 'Nächste 14 Tage',
			later: 'Später',
			noDate: 'Kein Datum',
		},
		tasksBlock: {
			missing: 'Für diesen Block muss das Tasks-Plugin installiert und aktiviert sein.',
			invalidShow: 'Unbekannte "show-focus"-Sektion. Erlaubt: focus, do, schedule, delegate oder eliminate.',
		},
	},
};

function getLocale(): Lang {
	return moment.locale().startsWith('de') ? 'de' : 'en';
}

export function t(): Translations {
	return translations[getLocale()];
}
