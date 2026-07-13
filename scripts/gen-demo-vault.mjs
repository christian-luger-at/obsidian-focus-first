// Demo-vault generator for the Focus First Obsidian plugin.
// PARA structure, PM-flavoured content, 400+ docs, exactly 100 tasks
// (open/done only), dates relative to today, all priorities/sizes + value tags.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = process.argv[2] || 'demo-vault';
rmSync(ROOT, { recursive: true, force: true });

// ---- deterministic RNG so re-runs are stable -------------------------------
let seed = 20260713;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// ---- dates -----------------------------------------------------------------
const BASE = new Date();
BASE.setHours(0, 0, 0, 0);
const addDays = (n) => { const d = new Date(BASE); d.setDate(d.getDate() + n); return d; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

let docCount = 0;
const write = (rel, body) => {
	const full = join(ROOT, rel);
	mkdirSync(dirname(full), { recursive: true });
	writeFileSync(full, body.replace(/\n+$/, '') + '\n');
	docCount++;
};
const fm = (obj) => {
	const lines = ['---'];
	for (const [k, v] of Object.entries(obj)) {
		if (Array.isArray(v)) lines.push(`${k}: [${v.map((x) => `"${x}"`).join(', ')}]`);
		else lines.push(`${k}: ${v}`);
	}
	lines.push('---', '');
	return lines.join('\n');
};

// ---- content pools ---------------------------------------------------------
const PRODUCTS = ['Atlas Analytics', 'Beacon Mobile', 'Cirrus Billing', 'Delta CRM', 'Echo Notifications', 'Forge API Platform'];
const firstNames = ['Anna', 'Ben', 'Carla', 'David', 'Elena', 'Farid', 'Grace', 'Hiro', 'Ines', 'Jonas', 'Kira', 'Liam', 'Maya', 'Noah', 'Olga', 'Pablo', 'Quinn', 'Rosa', 'Sven', 'Tara', 'Umar', 'Vera', 'Wes', 'Xenia', 'Yara', 'Zack', 'Amir', 'Bea', 'Cem', 'Dana', 'Ravi', 'Sofia', 'Tom', 'Ulla', 'Nils', 'Petra', 'Katja', 'Lars', 'Mira', 'Timo', 'Nina', 'Paul', 'Rita', 'Sami', 'Tessa'];
const lastNames = ['Meyer', 'Novak', 'Costa', 'Klein', 'Schulz', 'Haddad', 'Owens', 'Tanaka', 'Rossi', 'Berg', 'Petrov', 'Walsh', 'Devi', 'Frost', 'Ivanov', 'Reyes', 'Doyle', 'Marin', 'Ek', 'Singh', 'Cohn', ' Portas'.trim(), 'Blum', 'Aziz', 'Falk', 'Mai', 'Roth', 'Vogel', 'Weber', 'Kraus', 'Bauer', 'Lang', 'Simon', 'Wolf', 'Arndt', 'Beck', 'Groß', 'Horn', 'Jung', 'Kern', 'Lenz', 'Metz', 'Otto', 'Sauer', 'Thiel'];
const roles = ['Engineering Lead', 'Senior Engineer', 'Product Designer', 'UX Researcher', 'Data Scientist', 'Data Analyst', 'Engineering Manager', 'Head of Sales', 'Account Executive', 'Customer Success Manager', 'Support Lead', 'Marketing Manager', 'Growth PM', 'Group PM', 'VP Product', 'CTO', 'CEO', 'Design Lead', 'QA Engineer', 'Solutions Architect', 'Key Customer', 'Prospect', 'Analyst (Gartner)', 'Founder (partner)', 'Legal Counsel'];

const BOOKS = [
	['Inspired', 'Marty Cagan', 'Product management foundations, empowered teams'],
	['Empowered', 'Marty Cagan & Chris Jones', 'Leading product teams'],
	['Continuous Discovery Habits', 'Teresa Torres', 'Opportunity solution trees, weekly touchpoints'],
	['Escaping the Build Trap', 'Melissa Perri', 'Outcomes over output'],
	['The Lean Startup', 'Eric Ries', 'Build-measure-learn, MVP'],
	['Hooked', 'Nir Eyal', 'Habit-forming products'],
	['Shape Up', 'Ryan Singer', 'Appetite, betting, six-week cycles'],
	['User Story Mapping', 'Jeff Patton', 'Shared understanding, backbone'],
	['Measure What Matters', 'John Doerr', 'OKRs'],
	['The Mom Test', 'Rob Fitzpatrick', 'Customer interviews without bias'],
	['Sprint', 'Jake Knapp', 'Five-day design sprint'],
	['Lean Analytics', 'Alistair Croll & Benjamin Yoskovitz', 'The one metric that matters'],
	['Thinking, Fast and Slow', 'Daniel Kahneman', 'System 1 / System 2 biases'],
	['Obviously Awesome', 'April Dunford', 'Product positioning'],
	['Crossing the Chasm', 'Geoffrey Moore', 'Technology adoption lifecycle'],
	['The Innovators Dilemma', 'Clayton Christensen', 'Disruptive innovation'],
	['Competing Against Luck', 'Clayton Christensen', 'Jobs to be done'],
	['Badass', 'Kathy Sierra', 'Making users awesome'],
	['Dont Make Me Think', 'Steve Krug', 'Usability'],
	['The Design of Everyday Things', 'Don Norman', 'Affordances, signifiers'],
	['Radical Focus', 'Christina Wodtke', 'OKRs and cadence'],
	['Product-Led Growth', 'Wes Bush', 'PLG motion'],
	['Trustworthy Online Controlled Experiments', 'Kohavi, Tang, Xu', 'A/B testing rigor'],
	['Good Strategy Bad Strategy', 'Richard Rumelt', 'Kernel of strategy'],
	['Play Bigger', 'Al Ramadan et al.', 'Category design'],
	['Working Backwards', 'Bryar & Carr', 'Amazon PR/FAQ'],
	['Deep Work', 'Cal Newport', 'Focused productivity'],
	['Never Split the Difference', 'Chris Voss', 'Negotiation'],
	['Team Topologies', 'Skelton & Pais', 'Team cognitive load'],
	['Accelerate', 'Forsgren, Humble, Kim', 'DORA metrics'],
	['The Making of a Manager', 'Julie Zhuo', 'New manager guide'],
	['Build', 'Tony Fadell', 'Making things worth making'],
];

const FRAMEWORKS = [
	['RICE prioritization', 'Reach, Impact, Confidence, Effort scoring for the backlog'],
	['Kano model', 'Basic, performance and delight attributes of features'],
	['Jobs to be Done', 'Framing demand around the job the customer hires the product for'],
	['Opportunity Solution Tree', 'Mapping desired outcome to opportunities and experiments'],
	['North Star Framework', 'One leading metric that captures value delivered'],
	['OKRs', 'Objectives and Key Results for quarterly focus'],
	['Story Mapping', 'Slicing releases along the user journey'],
	['A/B testing', 'Randomised controlled experiments to measure causal impact'],
	['Now-Next-Later roadmap', 'Confidence-based roadmap without false date precision'],
	['Eisenhower matrix', 'Urgency vs importance to decide what to do first'],
	['Value vs Effort matrix', 'Quick wins, big bets, fill-ins and time sinks'],
	['AARRR pirate metrics', 'Acquisition, activation, retention, revenue, referral'],
	['HEART framework', 'Happiness, engagement, adoption, retention, task success'],
	['Product discovery', 'De-risking value, usability, feasibility and viability'],
	['MoSCoW', 'Must, Should, Could, Wont prioritisation'],
	['Impact mapping', 'Goal, actors, impacts, deliverables'],
	['User personas', 'Archetypes representing user segments'],
	['Customer journey mapping', 'End-to-end experience across touchpoints'],
	['Assumption mapping', 'Sorting assumptions by importance and evidence'],
	['Wizard of Oz prototyping', 'Faking the backend to test demand'],
	['Cohort analysis', 'Retention and behaviour by signup cohort'],
	['Funnel analysis', 'Step-by-step conversion diagnosis'],
	['Feature flags', 'Decoupling deploy from release'],
	['Dual-track agile', 'Parallel discovery and delivery tracks'],
	['PR/FAQ (working backwards)', 'Writing the press release before building'],
	['Kanban WIP limits', 'Limiting work in progress to improve flow'],
	['Design sprint', 'One-week structured problem solving'],
	['Tree testing', 'Validating information architecture'],
	['Usability testing', 'Observing users complete tasks'],
	['Willingness to pay', 'Van Westendorp price sensitivity'],
	['SUS score', 'System Usability Scale survey'],
	['Retention curve', 'Reading the shape of retention over time'],
	['North star input metrics', 'Decomposing the north star into drivers'],
	['Feature adoption tracking', 'Instrumentation and adoption reporting'],
	['Beta program design', 'Recruiting and managing early access'],
	['Sales enablement', 'Equipping sales with product knowledge'],
	['Churn prediction', 'Leading indicators of account risk'],
	['Pricing & packaging', 'Tiers, metrics and fences'],
	['Onboarding activation', 'Time-to-value and aha moments'],
	['Experiment guardrails', 'Metrics that must not regress'],
	['Roadmap communication', 'Aligning stakeholders without over-committing'],
	['Stakeholder mapping', 'Power/interest grid'],
	['Discovery interview guide', 'Non-leading question structure'],
	['Metric tree', 'Hierarchy of connected metrics'],
	['Definition of done', 'Shared quality bar for delivery'],
];

const PROJECTS = [
	'Q3 Onboarding Redesign', 'Self-Serve Checkout', 'Enterprise SSO', 'Mobile Offline Mode',
	'Pricing V2', 'GDPR Data Deletion', 'Search Relevance', 'Design System 2.0',
	'In-App Notifications', 'Billing Dunning Flow', 'Usage-Based Metering', 'Admin Audit Log',
	'Data Export API', 'Native Dark Mode', 'Real-Time Dashboards', 'SSO SCIM Provisioning',
	'Referral Program', 'Localization (DE/FR)', 'Accessibility Audit', 'Webhooks V2',
	'Trial Extension Experiment', 'Zapier Integration', 'AI Summaries Beta', 'SLA Uptime Page',
	'Customer Health Score',
];
const BIG_PROJECTS = ['Q3 Onboarding Redesign', 'Enterprise SSO', 'Pricing V2'];

const INSIGHT_TOPICS = [
	'Users abandon onboarding at the workspace-creation step',
	'Enterprise buyers require SSO before evaluating',
	'Mobile users mostly read, rarely create',
	'Trial-to-paid conversion peaks on day 3, not day 14',
	'Support tickets spike after each billing email',
	'Power users rely on keyboard shortcuts we never documented',
	'Admins distrust bulk actions without an undo',
	'Search fails silently on typos, driving support load',
	'Notification fatigue reduces weekly active use',
	'Pricing page confusion around per-seat vs usage',
	'Champions leave and adoption stalls without a second owner',
	'Data export is a top reason enterprises churn',
	'Dark mode is the #1 unprompted feature request',
	'Activation correlates with inviting a second teammate',
	'Free users hit the value moment only after 5 actions',
	'Latency over 400ms noticeably drops task completion',
	'Localized UI lifts DACH conversion materially',
	'Screen-reader users cannot complete checkout',
	'Webhook reliability is a hidden trust factor',
	'AI summaries are trusted only with visible sources',
];

const MEETING_TYPES = ['Weekly Standup', 'Sprint Review', 'Sprint Planning', 'Backlog Refinement', 'Product Trio', 'Discovery Sync', 'Roadmap Review', '1:1', 'Design Critique', 'Customer Interview', 'Stakeholder Update', 'Metrics Review', 'Incident Retro', 'Go-to-Market Sync', 'Leadership Review'];

// ---- build people & books first (needed for links) -------------------------
const people = [];
for (let i = 0; i < 45; i++) {
	const name = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
	people.push({ name, role: roles[i % roles.length] });
}
const peopleNames = people.map((p) => p.name);

// =============================================================================
// TASKS — exactly 100, open/done only, PM action items
// =============================================================================
const TASK_VERBS = ['Draft', 'Review', 'Ship', 'Spec out', 'Investigate', 'Prototype', 'Analyse', 'Prepare', 'Write up', 'Schedule', 'Follow up on', 'Validate', 'Instrument', 'Prioritise', 'Estimate', 'Align on', 'Fix', 'Roll out', 'Document', 'Present'];
const TASK_OBJECTS = [
	'the onboarding funnel report', 'the pricing experiment plan', 'the SSO technical spike',
	'the churn risk dashboard', 'the discovery interview guide', 'the Q3 OKR draft',
	'the mobile offline sync design', 'the data export API spec', 'the accessibility fixes',
	'the notification preferences UX', 'the search relevance eval', 'the beta recruitment email',
	'the roadmap one-pager', 'the metric tree for activation', 'the billing dunning copy',
	'the webhook retry logic', 'the dark mode tokens', 'the localization glossary',
	'the competitor teardown', 'the persona refresh', 'the north star definition',
	'the experiment guardrails', 'the release notes', 'the stakeholder update deck',
	'the usability test script', 'the RICE scoring for the backlog', 'the SLA uptime page',
	'the customer health score model', 'the referral program mechanics', 'the trial extension test',
	'the incident postmortem', 'the feature flag cleanup', 'the analytics instrumentation',
	'the pricing tiers proposal', 'the design critique notes', 'the sales enablement guide',
	'the data deletion workflow', 'the admin audit log schema', 'the AI summaries source display',
	'the activation email sequence',
];
const linkTargets = [...PROJECTS, ...PRODUCTS];
const prios = ['🔺', '⏫', '🔼', '🔽', '⏬'];
const sizes = ['#s', '#m', '#l'];

const tasks = [];
for (let i = 0; i < 100; i++) {
	const text = `${TASK_VERBS[i % TASK_VERBS.length]} ${TASK_OBJECTS[i % TASK_OBJECTS.length]}`;
	const done = i % 10 < 3; // 30 done, 70 open
	// due bucket
	let due = null;
	const b = i % 10;
	if (b < 2) due = addDays(-1 - Math.floor(rnd() * 13));          // overdue
	else if (b < 5) due = addDays(Math.floor(rnd() * 5));           // today..+4 (this week)
	else if (b < 7) due = addDays(14 + Math.floor(rnd() * 15));     // upcoming
	// else: no date
	const prio = (i % 7 >= 5) ? '' : prios[i % 5];                  // ~28% none
	const size = (i % 4 === 3) ? '' : sizes[i % 3];                 // 25% none
	let value = '';
	if (i % 13 === 0) value = '#highvalue';
	else if (i % 13 === 7) value = '#lowvalue';
	const link = linkTargets[i % linkTargets.length];
	const doneDate = done ? (due && due < BASE ? due : addDays(-1 - Math.floor(rnd() * 5))) : null;
	tasks.push({ text, done, due, prio, size, value, link, doneDate });
}
const renderTask = (t) => {
	let s = `- [${t.done ? 'x' : ' '}] ${t.text} [[${t.link}]]`;
	if (t.prio) s += ` ${t.prio}`;
	if (t.due) s += ` 📅 ${iso(t.due)}`;
	if (t.size) s += ` ${t.size}`;
	if (t.value) s += ` ${t.value}`;
	if (t.done && t.doneDate) s += ` ✅ ${iso(t.doneDate)}`;
	return s;
};

// Assign tasks to hosts (meetings + projects + inbox), round-robin.
const taskHostKeys = [];
for (let i = 0; i < 44; i++) taskHostKeys.push(`meeting:${i}`);   // first 44 meetings
for (let i = 0; i < 20; i++) taskHostKeys.push(`project:${i}`);   // first 20 projects
for (let i = 0; i < 5; i++) taskHostKeys.push(`inbox:${i}`);
const tasksByHost = new Map();
tasks.forEach((t, i) => {
	const key = taskHostKeys[i % taskHostKeys.length];
	if (!tasksByHost.has(key)) tasksByHost.set(key, []);
	tasksByHost.get(key).push(t);
});
const hostTasks = (key) => (tasksByHost.get(key) || []).map(renderTask).join('\n');

// =============================================================================
// WRITE DOCS
// =============================================================================

// ---- Root readme -----------------------------------------------------------
write('README - Start here.md', `${fm({ type: 'index', tags: ['moc'] })}
# Focus First — PM Demo Vault

A synthetic product-management vault organised with **PARA**. Open it in Obsidian with the **Focus First** plugin enabled.

## Structure
- \`0 Inbox/\` — quick capture
- \`1 Projects/\` — time-bound efforts with an end
- \`2 Areas/\` — ongoing responsibilities (Product Management, Products, Product Ops)
- \`3 Resources/\` — Knowledge, Insights, People, Books, Meetings
- \`4 Archive/\` — finished / dropped work
- \`Maps/\` — maps of content (start browsing here)

## Tasks
There are **100 tasks** (open and done) spread across meeting notes, projects and the inbox — with due dates, priorities (🔺⏫🔼🔽⏬), sizes (#s/#m/#l) and some #highvalue/#lowvalue tags. Open the Focus First view to see them classified.

> Everything here is fictional.
`);

// ---- Maps of content -------------------------------------------------------
write('Maps/Home.md', `${fm({ type: 'moc', tags: ['moc'] })}
# Home

- [[Products MOC]]
- [[Projects MOC]]
- [[Knowledge MOC]]
- [[People MOC]]
- [[Books MOC]]
`);
write('Maps/Products MOC.md', `${fm({ type: 'moc', tags: ['moc', 'product'] })}
# Products MOC\n\n${PRODUCTS.map((p) => `- [[${p}]]`).join('\n')}\n`);
write('Maps/Projects MOC.md', `${fm({ type: 'moc', tags: ['moc', 'project'] })}
# Projects MOC\n\n## Active\n${PROJECTS.map((p) => `- [[${p}]]`).join('\n')}\n`);
write('Maps/People MOC.md', `${fm({ type: 'moc', tags: ['moc', 'person'] })}
# People MOC\n\n${peopleNames.map((n) => `- [[${n}]]`).join('\n')}\n`);
write('Maps/Books MOC.md', `${fm({ type: 'moc', tags: ['moc', 'book'] })}
# Books MOC\n\n${BOOKS.map(([t]) => `- [[${t}]]`).join('\n')}\n`);
write('Maps/Knowledge MOC.md', `${fm({ type: 'moc', tags: ['moc', 'knowledge'] })}
# Knowledge MOC\n\n${FRAMEWORKS.map(([t]) => `- [[${t}]]`).join('\n')}\n`);

// ---- Inbox -----------------------------------------------------------------
const inboxTitles = ['Quick note - competitor launched usage billing', 'Idea - inline onboarding checklist', 'Question - can we expose webhooks in trial?', 'Reminder - renew analytics contract', 'Capture - user quote about dark mode'];
for (let i = 0; i < 5; i++) {
	write(`0 Inbox/${inboxTitles[i]}.md`, `${fm({ type: 'note', created: iso(addDays(-i)), tags: ['inbox'] })}
# ${inboxTitles[i]}

Captured on ${iso(addDays(-i))}. To triage into a project or resource.

## Tasks
${hostTasks(`inbox:${i}`)}
`);
}

// ---- People ----------------------------------------------------------------
people.forEach((p, i) => {
	const relProducts = shuffle(PRODUCTS).slice(0, 1 + (i % 2));
	write(`3 Resources/People/${p.name}.md`, `${fm({ type: 'person', role: p.role, tags: ['person'] })}
# ${p.name}

- **Role:** ${p.role}
- **Works on:** ${relProducts.map((x) => `[[${x}]]`).join(', ')}

## Notes
${pick(['Reliable, prefers async updates.', 'Strong opinions, weakly held.', 'Deep domain knowledge; loop in early.', 'Time-zone: CET. Best reached mornings.', 'Key stakeholder for enterprise deals.', 'Great at unblocking engineering.'])}

## Related
- [[People MOC]]
`);
});

// ---- Books -----------------------------------------------------------------
BOOKS.forEach(([title, author, gist]) => {
	const fw = shuffle(FRAMEWORKS).slice(0, 2).map(([t]) => `[[${t}]]`);
	write(`3 Resources/Books/${title}.md`, `${fm({ type: 'book', author, tags: ['book', 'reference'] })}
# ${title}

- **Author:** ${author}
- **One-liner:** ${gist}

## Key takeaways
- ${gist}.
- ${pick(['Bias to outcomes over output.', 'Talk to customers weekly.', 'Small bets beat big plans.', 'Instrument before you optimise.', 'Positioning changes everything.'])}

## Connects to
${fw.map((x) => `- ${x}`).join('\n')}
- [[Books MOC]]
`);
});

// ---- Knowledge (frameworks) ------------------------------------------------
FRAMEWORKS.forEach(([title, gist], i) => {
	const book = pick(BOOKS)[0];
	write(`3 Resources/Knowledge/${title}.md`, `${fm({ type: 'knowledge', tags: ['knowledge', 'framework'] })}
# ${title}

${gist}.

## When to use
Use during ${pick(['discovery', 'prioritisation', 'planning', 'delivery', 'strategy'])}. ${pick(['Keep it lightweight.', 'Revisit each quarter.', 'Pair with data.', 'Beware false precision.'])}

## Related
- Source: [[${book}]]
- See also: [[${FRAMEWORKS[(i + 1) % FRAMEWORKS.length][0]}]], [[${FRAMEWORKS[(i + 3) % FRAMEWORKS.length][0]}]]
- [[Knowledge MOC]]
`);
});

// ---- Insights --------------------------------------------------------------
INSIGHT_TOPICS.forEach((topic, i) => {
	// two dated variants each -> 40 insight docs
	for (let v = 0; v < 2; v++) {
		const d = addDays(-(7 * i + v * 3 + 2));
		const product = pick(PRODUCTS);
		write(`3 Resources/Insights/${iso(d)} ${topic.slice(0, 48)}.md`, `${fm({ type: 'insight', date: iso(d), confidence: pick(['low', 'medium', 'high']), tags: ['insight', 'research'] })}
# ${topic}

**Product:** [[${product}]] · **Date:** ${iso(d)} · **Source:** ${pick(['5 user interviews', 'funnel analysis', 'support ticket review', 'A/B test', 'survey (n=210)'])}

## Evidence
${pick(['Observed repeatedly across sessions.', 'Statistically significant at p<0.05.', 'Consistent with prior quarter.', 'Qualitative signal, needs quant follow-up.'])}

## Implication
Consider ${pick(['reordering the onboarding steps', 'adding an undo affordance', 'surfacing sources', 'reducing notification volume', 'clarifying pricing'])}.

## Related
- [[Continuous Discovery Habits]]
- [[Opportunity Solution Tree]]
`);
	}
});

// ---- Areas: Product Management ---------------------------------------------
const pmArea = [
	['North Star Metric', 'Weekly active teams creating value.'],
	['Product Strategy 2026', 'Win mid-market with self-serve + enterprise readiness.'],
	['Company OKRs — Q3', 'O: Accelerate activation. KR1, KR2, KR3.'],
	['Product OKRs — Q3', 'O: Reduce time-to-value. KR: activation +8pt.'],
	['Now-Next-Later Roadmap', 'Confidence-based roadmap across products.'],
	['Prioritisation Policy', 'How we score with [[RICE prioritization]].'],
	['Discovery Cadence', 'Weekly [[Product discovery]] touchpoints.'],
	['Metrics Glossary', 'Definitions for activation, retention, MRR.'],
	['Team Rituals', 'Standup, review, planning, retro.'],
	['Stakeholder Map', 'Power/interest across the org.'],
];
pmArea.forEach(([title, gist]) => {
	write(`2 Areas/Product Management/${title}.md`, `${fm({ type: 'area', tags: ['area', 'product-management'] })}
# ${title}

${gist}

## Details
${pick(['Reviewed monthly.', 'Owned by the product trio.', 'Aligns with [[Product Strategy 2026]].', 'Backed by [[Measure What Matters]].'])}

## Related
- [[Home]]
`);
});

// ---- Areas: Product Ops ----------------------------------------------------
['Release Process', 'Experiment Review Board', 'Beta Program', 'Analytics Instrumentation Standards', 'Incident Management', 'Customer Feedback Pipeline'].forEach((title) => {
	write(`2 Areas/Product Ops/${title}.md`, `${fm({ type: 'area', tags: ['area', 'ops'] })}
# ${title}

Ongoing operational responsibility.

## Standard
- Owner defined, SLA documented, review cadence set, dashboard in place.

## Related
- [[Team Rituals]]
`);
});

// ---- Areas: Products (6 x 6 docs) ------------------------------------------
PRODUCTS.forEach((prod, i) => {
	const dir = `2 Areas/Products/${prod}`;
	write(`${dir}/${prod}.md`, `${fm({ type: 'product', status: pick(['growth', 'mature', 'incubating']), tags: ['product'] })}
# ${prod}

**Owner:** [[${peopleNames[i % peopleNames.length]}]] · **Stage:** ${pick(['Growth', 'Mature', 'Incubating'])}

## Overview
${pick(['B2B SaaS module used daily by ops teams.', 'Self-serve product with a PLG motion.', 'Enterprise-grade platform capability.'])}

## Sub-pages
- [[${prod} — Personas]]
- [[${prod} — Metrics & KPIs]]
- [[${prod} — Competitors]]
- [[${prod} — Roadmap]]
- [[${prod} — Changelog]]

## Related
- [[Products MOC]]
`);
	write(`${dir}/${prod} — Personas.md`, `${fm({ type: 'product-doc', tags: ['product', 'persona'] })}
# ${prod} — Personas

- **Primary:** ${pick(['Ops manager', 'Team admin', 'Individual contributor', 'Finance lead'])} — [[User Personas]]
- **Secondary:** ${pick(['Executive sponsor', 'Developer', 'Analyst'])}

Based on [[Jobs to be Done]].
`);
	write(`${dir}/${prod} — Metrics & KPIs.md`, `${fm({ type: 'product-doc', tags: ['product', 'metrics'] })}
# ${prod} — Metrics & KPIs

| Metric | Now | Target |
| --- | --- | --- |
| Activation | ${30 + i * 3}% | ${45 + i * 3}% |
| WAU | ${5 + i}k | ${8 + i}k |
| Net retention | ${100 + i}% | ${115 + i}% |

North star via [[North Star Framework]].
`);
	write(`${dir}/${prod} — Competitors.md`, `${fm({ type: 'product-doc', tags: ['product', 'competition'] })}
# ${prod} — Competitors

- Competitor A — strong ${pick(['pricing', 'UX', 'integrations'])}
- Competitor B — weak ${pick(['support', 'mobile', 'API'])}

Positioning per [[Obviously Awesome]].
`);
	write(`${dir}/${prod} — Roadmap.md`, `${fm({ type: 'product-doc', tags: ['product', 'roadmap'] })}
# ${prod} — Roadmap

## Now
- [[${pick(PROJECTS)}]]
## Next
- [[${pick(PROJECTS)}]]
## Later
- Exploration backlog

Format: [[Now-Next-Later roadmap]].
`);
	write(`${dir}/${prod} — Changelog.md`, `${fm({ type: 'product-doc', tags: ['product', 'changelog'] })}
# ${prod} — Changelog

- ${iso(addDays(-3))} — ${pick(['Perf improvements', 'Bug fixes', 'New export option'])}
- ${iso(addDays(-17))} — ${pick(['Dark mode beta', 'SSO groundwork', 'Search tweaks'])}
- ${iso(addDays(-40))} — Initial GA
`);
});

// ---- Projects --------------------------------------------------------------
PROJECTS.forEach((proj, i) => {
	const isBig = BIG_PROJECTS.includes(proj);
	const owner = peopleNames[(i * 2) % peopleNames.length];
	const product = PRODUCTS[i % PRODUCTS.length];
	const status = pick(['discovery', 'in delivery', 'in delivery', 'blocked', 'in review']);
	const body = `${fm({ type: 'project', status, owner, product, due: iso(addDays(7 + i * 2)), tags: ['project'] })}
# ${proj}

**Owner:** [[${owner}]] · **Product:** [[${product}]] · **Status:** ${status}

## Problem
${pick(INSIGHT_TOPICS)}.

## Approach
Guided by [[${pick(FRAMEWORKS)[0]}]] and [[${pick(FRAMEWORKS)[0]}]].

${(() => { const b = hostTasks(`project:${i}`); return b ? `## Tasks\n${b}\n` : ''; })()}
## Related
- [[Projects MOC]]
- Discovery: [[${pick(INSIGHT_TOPICS).slice(0, 40)}]]
`;
	if (isBig) {
		write(`1 Projects/${proj}/${proj}.md`, body);
		write(`1 Projects/${proj}/Spec.md`, `${fm({ type: 'project-doc', tags: ['project', 'spec'] })}
# ${proj} — Spec

## Goals & non-goals
## Requirements
- ${pick(['Auth', 'Data model', 'Migration', 'Rollout plan'])}
## Open questions
Uses [[PR/FAQ (working backwards)]].
`);
		write(`1 Projects/${proj}/Research.md`, `${fm({ type: 'project-doc', tags: ['project', 'research'] })}
# ${proj} — Research

Interviews with [[${pick(peopleNames)}]] and [[${pick(peopleNames)}]].
Method: [[The Mom Test]].
`);
		write(`1 Projects/${proj}/Retro.md`, `${fm({ type: 'project-doc', tags: ['project', 'retro'] })}
# ${proj} — Retro

- What went well
- What to improve
- Actions
`);
	} else {
		write(`1 Projects/${proj}.md`, body);
	}
});

// ---- Meetings (110) --------------------------------------------------------
for (let i = 0; i < 110; i++) {
	const d = addDays(-i * 2 - 1); // spread back in time
	const type = MEETING_TYPES[i % MEETING_TYPES.length];
	const attendees = shuffle(peopleNames).slice(0, 3 + (i % 4));
	const proj = PROJECTS[i % PROJECTS.length];
	const prod = PRODUCTS[i % PRODUCTS.length];
	const actionItems = hostTasks(`meeting:${i}`);
	write(`3 Resources/Meetings/${iso(d)} ${type}.md`, `${fm({ type: 'meeting', date: iso(d), meetingType: type, tags: ['meeting'] })}
# ${iso(d)} — ${type}

**Attendees:** ${attendees.map((n) => `[[${n}]]`).join(', ')}
**Related:** [[${proj}]], [[${prod}]]

## Agenda
- ${pick(['Status update', 'Metric review', 'Risk & blockers', 'Discovery findings', 'Prioritisation'])}
- ${pick(['Roadmap alignment', 'Customer feedback', 'Experiment results', 'Next steps'])}

## Notes
${pick(['Progressing on plan.', 'Blocked on dependency; escalating.', 'Positive customer signal.', 'Scope trimmed to hit date.', 'Experiment inconclusive; extend run.'])} ${pick(['See [[' + pick(INSIGHT_TOPICS).slice(0, 40) + ']].', 'Ref: [[' + pick(FRAMEWORKS)[0] + ']].', ''])}

## Decisions
- ${pick(['Ship behind a flag', 'Delay one sprint', 'Increase sample size', 'Cut scope', 'Green-light beta'])}

## Action items
${actionItems || '_No open action items._'}
`);
}

// ---- Archive (30) ----------------------------------------------------------
const archivedProjects = ['Legacy Import Tool', 'Old Pricing Page', 'V1 Mobile App', 'Deprecated Reports', 'Slack Classic Integration', 'Email Digest V1', 'Beta Feedback Widget', 'Onboarding Tour V1', 'Trial Banner Experiment', 'Referral V1'];
archivedProjects.forEach((p, i) => {
	write(`4 Archive/Projects/${p}.md`, `${fm({ type: 'project', status: 'archived', archived: iso(addDays(-90 - i * 5)), tags: ['project', 'archive'] })}
# ${p} (archived)

Closed ${iso(addDays(-90 - i * 5))}. Outcome: ${pick(['shipped, later deprecated', 'cancelled after discovery', 'merged into another project', 'inconclusive experiment'])}.

## Retro highlights
- ${pick(['Underestimated effort', 'Great learning', 'Wrong audience', 'Right idea, wrong time'])}
`);
});
for (let i = 0; i < 20; i++) {
	const d = addDays(-120 - i * 4);
	write(`4 Archive/Meetings/${iso(d)} ${MEETING_TYPES[i % MEETING_TYPES.length]}.md`, `${fm({ type: 'meeting', date: iso(d), tags: ['meeting', 'archive'] })}
# ${iso(d)} — ${MEETING_TYPES[i % MEETING_TYPES.length]} (archived)

Historical record. No open actions.
`);
}

// ---- report ----------------------------------------------------------------
const openCount = tasks.filter((t) => !t.done).length;
console.log(JSON.stringify({ docCount, tasks: tasks.length, open: openCount, done: tasks.length - openCount }, null, 2));
