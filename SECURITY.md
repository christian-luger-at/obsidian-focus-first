# Security Policy

Focus First is a source-available Obsidian plugin maintained by a single person.
It runs entirely inside Obsidian on your own device: it reads the Markdown files
in your vault, writes task lines back to them, and (when enabled) calls the
Tasks plugin's public API. It has no backend, sends no telemetry, and makes no
network requests of its own. Security reports are still very welcome.

## Supported versions

Only the latest released version receives security fixes. Please reproduce any
issue on the current release before reporting it.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| Older releases | No |

## Reporting a vulnerability

**Please do not open a public issue for a security vulnerability.**

Report it privately using either channel:

1. **GitHub private vulnerability reporting (preferred).** Go to the
   [Security tab](https://github.com/christian-luger-at/obsidian-focus-first/security)
   of the repository and choose **Report a vulnerability**. This keeps the
   report private until a fix is available.
2. **Email.** Write to **christian@luger.digital** with `SECURITY` in the
   subject line.

To help triage, please include where practical:

- The plugin version and your Obsidian version and platform (desktop or mobile).
- Whether the Tasks plugin is installed and enabled.
- A description of the issue and its impact.
- Steps to reproduce, ideally with a minimal example note or task line.
- Any proof-of-concept, logs, or screenshots.

## What to expect

As a single-maintainer project, response times are best-effort:

- **Acknowledgement:** within 5 business days.
- **Assessment and triage:** within 10 business days of acknowledgement.
- **Fix:** valid, in-scope issues are addressed as quickly as is practical and
  released in a patch version. You will be credited in the release notes unless
  you prefer to stay anonymous.

Please practice coordinated disclosure: give a reasonable window to ship a fix
before disclosing the issue publicly.

## Scope

Because the plugin runs locally against your own vault, the security-relevant
surface is small. Examples of **in-scope** reports:

- Writing to or deleting files outside the intended task line or outside the
  vault (path traversal, unexpected file mutation, or data loss/corruption).
- Executing arbitrary code or commands as a result of rendering a crafted task
  line, note, or code-block input.
- Leaking vault contents off the device (any unexpected network activity).
- Mishandling of the Tasks plugin API that corrupts task data.

Examples of **out of scope** reports:

- Vulnerabilities in Obsidian itself, the Tasks plugin, or any other third-party
  plugin or dependency. Report those to the respective project. If a dependency
  advisory affects this plugin, a Dependabot alert or an issue is enough.
- Issues that require an already-compromised device, a malicious Obsidian
  plugin, or physical access.
- Social engineering, and problems in your own vault content or configuration.
- Missing hardening that has no demonstrated impact (best-practice suggestions
  are welcome as normal issues, not security reports).

## No bug bounty

There is no paid bug-bounty program. Credit in the release notes is offered as
thanks for responsible disclosure.
