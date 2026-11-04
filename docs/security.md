# Security and Privacy

## Data classification
Financial records, descriptions, notes, account names, backups, OAuth tokens and API keys are sensitive.

## Local storage
Financial data is stored unencrypted in IndexedDB. Protection depends on browser-origin isolation, device access control and OS-level disk encryption. Integer cents provide numerical precision, not encryption.

## Data transmission
No data leaves the device without an explicit user action. Approved transmissions are:
- currency code/date requests to Frankfurter;
- user-triggered backup or restore with the selected cloud provider;
- sanitized aggregate AI analysis;
- user-triggered export.

## AI keys
AI keys are stored locally in IndexedDB settings. They are excluded from exports, backups, logs, diagnostics and UI error messages. They are sent only as authorization material to the configured provider.

## OAuth
Use OAuth 2.0 Authorization Code with PKCE for public clients. Do not embed client secrets. Prefer in-memory access tokens and platform secure storage for refresh tokens when available. Never store refresh tokens in localStorage as a project default.

## Coding controls
- Validate external and user input with Zod.
- Rely on React escaping and prohibit `dangerouslySetInnerHTML` unless a future reviewed ADR permits a narrowly sanitized use.
- Prohibit `eval` and `Function`.
- Use HTTPS, except explicit localhost development integrations.
- Sanitize errors before user display and logging.
- Do not add telemetry, analytics or remote error reporting without an explicit opt-in ADR.

## Logging
Permitted logs contain technical operation names and non-sensitive identifiers when needed. Prohibited logs include record payloads, amounts, names, descriptions, notes, tokens, keys and provider responses containing user data.

## Backup
Backups contain sensitive financial data and are unencrypted unless an explicit encryption feature is used. Exclude all credentials and tokens. Validate imports before atomic restore.

## Dependency review
Before adding a dependency, verify maintenance status, license, bundle impact, known vulnerabilities and transitive dependencies. Run `npm audit` as evidence, not as the sole security evaluation.

## Release security gate
- no hardcoded secrets;
- no sensitive logs;
- HTTPS external endpoints;
- validated inputs;
- credentials excluded from export;
- AI sanitizer tests passing;
- dependency review completed for additions.
