# Security & Privacy Guidelines

Security-first approach to protecting user financial data and ensuring privacy compliance.

---

## Core Security Principles

1. **Zero Data Transmission**: No financial data leaves the device without explicit user action
2. **Client-Side Processing**: All sensitive operations (encryption, PDF/CSV generation) happen locally
3. **No Analytics**: No tracking pixels, telemetry, or usage analytics
4. **Transparent Practices**: Users can audit the code to verify data handling
5. **Offline-First Design**: Network unavailability doesn't compromise functionality

---

## Data Storage Security

### Local Storage (IndexedDB)

- **Encryption at Rest**: Not implemented in MVP (user device's OS-level encryption assumed)
- **Browser Quota**: IndexedDB quota varies by browser (~50 MB on modern browsers)
- **No Plaintext Sensitive Data**: Financial amounts stored as integers (cents), not floating-point
- **Dexie.js Isolation**: Each app instance uses its own IndexedDB database namespace

### Storage Best Practices

- Users should enable device-level encryption (Windows BitLocker, macOS FileVault, etc.)
- PWA installable on Android — respects device's secure storage context
- Clear browser data/cache to remove IndexedDB on logout (if needed)
- No credentials stored in IndexedDB (API keys are transient)

---

## API & Authentication Security

### OAuth2 PKCE Flow (Google Drive / Dropbox Sync)

**Why PKCE?**
- No client secrets embedded in code
- Prevents authorization code interception attacks
- Suitable for public clients (browsers, mobile apps)

**Flow**:
1. App generates `code_verifier` (random 128 chars)
2. `code_challenge = base64url(sha256(code_verifier))`
3. User redirected to provider's OAuth consent screen
4. On callback, app exchanges `authorization_code` + `code_verifier` for tokens
5. No intermediate server; token exchange happens on client

**Token Storage**:
- Access tokens stored in memory (lost on page refresh)
- Refresh tokens stored in `localStorage` (persisted but not encrypted)
- For enhanced security: consider `sessionStorage` (cleared on browser close)

**Credential Handling**:
- Never log credentials or tokens to console/debugger
- OAuth tokens have limited lifetime (1 hour typical)
- Implement token refresh before expiry
- Revoke tokens on logout

### Frankfurter Exchange Rate API

- **Public API**: No authentication required
- **No Personal Data Transmitted**: Only currency codes and dates
- **HTTPS Only**: All requests must use HTTPS
- **Rate Limiting**: Unlikely for personal use; monitor for abuse

### External API Keys (AI, Cloud Services)

- **Google Client ID**: Required for Drive sync
  - Stored in `settings` table
  - Configured via `.env.example` (user supplies during setup)
  - Never hardcoded in source
  - Scoped to `https://www.googleapis.com/auth/drive.appdata`

- **OpenAI API Key** (v1.2+, Tier 2):
  - User-supplied API key stored in `settings`
  - Never transmitted unless user requests AI analysis
  - Only aggregated summaries sent (never raw transactions)
  - Security guard: validate only totals per category sent

---

## Code Security

### Secure Coding Practices

- **Input Validation**: All user input validated via `zod` schemas before processing
- **Output Encoding**: XSS prevention via React's auto-escaping (no `dangerouslySetInnerHTML`)
- **CSRF Protection**: N/A (no stateful server)
- **SQL Injection**: N/A (no database, using IndexedDB)
- **Dependency Audits**: Run `npm audit` regularly; update vulnerable packages
- **No Eval/Dynamic Code**: Never use `eval()` or `Function()` constructor
- **Secure Defaults**: Passwords/tokens never logged; errors sanitized before display

### Type Safety

- **TypeScript Strict Mode**: Catches null/undefined errors at compile time
- **No `any` Types**: Enforced via ESLint
- **Sealed Objects**: Use `as const` for configuration to prevent mutations

### Dependency Management

- **Minimal Dependencies**: Only essential packages included
- **Open Source Only**: Audit any new dependency before adding
- **Regular Updates**: Monthly security patches recommended
- **Transitive Dependency Review**: `npm ls` to check indirect dependencies

**Current Critical Dependencies**:
- `dexie` (IndexedDB) — well-maintained, mature
- `zustand` (State) — minimal, audited
- `react-hook-form` (Forms) — security-focused, no hidden state mutation
- `zod` (Validation) — type-safe, no eval

---

## Privacy Compliance

### GDPR (General Data Protection Regulation)

- **Data Residency**: Data remains on user's device (no GDPR data processing agreements needed)
- **Right to Delete**: Users can export/delete data via Settings → Factory Reset
- **Data Minimization**: No unnecessary personal info collected
- **Consent**: No implicit data collection; cloud sync is opt-in

### CCPA (California Consumer Privacy Act)

- **No Data Sales**: User data never sold to third parties
- **No Third-Party Sharing**: Except user's own cloud provider (Google Drive, Dropbox)
- **Transparency**: Clear explanation of data handling on app landing page
- **Opt-Out**: Users can disable cloud sync; data never auto-synced

### No Analytics, Tracking, or Telemetry

- ✅ **Allowed**: Error logging (optional, client-side only)
- ❌ **Not Allowed**: Google Analytics, Mixpanel, Sentry, Hotjar, etc.
- ❌ **Not Allowed**: Cookies for tracking (only session cookies for auth)
- ❌ **Not Allowed**: Beacon-based data collection
- ❌ **Not Allowed**: Cross-domain tracking pixels

---

## Mobile Security (Capacitor / Android)

### Permissions Model

- Request only necessary permissions:
  - `Camera` (future feature)
  - `File Storage` (for backups)
  - `Network` (cloud sync)
- Never request permissions not used
- Permissions can be revoked by user at OS level

### Android-Specific

- App should request `android:usesCleartextTraffic="false"` in manifest (HTTPS only)
- Store sensitive keys in Android Keystore (Capacitor can abstract this)
- Avoid hardcoding secrets; use environment variables + build-time injection
- Enable ProGuard/R8 code obfuscation in release builds

### iOS-Specific

- Use Keychain for storing tokens (Capacitor abstracts via `SecureStoragePlugin`)
- Enable App Transport Security (ATS) — HTTPS only
- Implement App Pinning if using certificate-based auth

---

## Cloud Sync Security

### Google Drive Sync

**Scope**: `https://www.googleapis.com/auth/drive.appdata`
- Limited to app's designated folder (`/appDataFolder`)
- User can revoke access at any time
- Google's TLS 1.2+ ensures transit encryption
- At-rest encryption is Google's responsibility

**Data Format**:
- Backup file is plain JSON (optional user-side encryption before upload)
- Consider adding user-supplied password option (v1.2+)

### Dropbox Sync

**Scope**: Similar scoped access to app's folder
**Data Format**: Same JSON backup structure

**Best Practice**:
- Users should enable two-factor authentication on cloud accounts
- Regularly review connected apps in cloud provider's security settings

---

## Error Handling & Logging

### Safe Error Messages

- User-facing errors: Generic messages (e.g., "Unable to save transaction")
- Console errors: Include stack traces (dev mode only)
- Never expose:
  - Filesystem paths
  - Internal API endpoints
  - Database schema details
  - User personal information

### Error Reporting (Future)

If error reporting is added (v1.2+):
- Must be **optional** and require **explicit user consent**
- Never auto-send error reports
- Scrub sensitive data before transmission
- Use HTTPS + signed requests
- Allow users to view report content before sending

---

## Incident Response

### Security Vulnerability Discovery

**Reporting**:
1. **Do not** open public GitHub issues for security bugs
2. Email security contact (see project README or LICENSE)
3. Allow 48 hours for acknowledgment, 90 days for patch
4. Provide:
   - Description of vulnerability
   - Steps to reproduce
   - Impact assessment
   - Suggested fix (if known)

### Disclosure Timeline

- **Day 1**: Researcher reports vulnerability
- **Day 2**: Team confirms and assesses
- **Days 3-90**: Team develops and tests fix
- **Day 90**: Public disclosure (unless embargo agreed)

---

## Data Retention & Cleanup

### Automatic Data Deletion

- Transactions older than 7 years (configurable) are auto-deleted
- This aligns with GDPR's storage limitation principle
- Users can adjust retention period or disable auto-delete
- Deleted data is permanent (except via backup restore)

### Backup Lifecycle

- Users control backup frequency and storage location
- Backups should be treated as sensitive (they contain all financial data)
- Recommend encryption of backup files before cloud upload
- Regularly delete old backups no longer needed

---

## Secure Development Practices

### Pre-Commit Checks

- Husky + lint-staged prevent commits with:
  - Unused imports (may contain debug code)
  - Syntax errors
  - Type errors
- No commits with hardcoded secrets (keys, tokens, passwords)

### Code Review

- All changes reviewed before merge
- Security-focused questions:
  - Does this transmit user data externally?
  - Are inputs validated?
  - Are errors safely logged?
  - Are dependencies up-to-date?

### Testing

- Unit tests cover security-critical paths:
  - Currency conversion (precision)
  - Budget calculations (correctness)
  - Category renaming (retroactive update)
  - Transfer balancing (debit-credit consistency)

---

## Dependency Security Checklist

Before adding a new package:

- [ ] Check npm Security Advisory database: `npm audit`
- [ ] Review package's GitHub stars, forks, last update date
- [ ] Check for open security issues in package's repo
- [ ] Verify package is actively maintained (< 6 months since last release)
- [ ] Review package size: avoid bloat
- [ ] Check transitive dependencies: `npm ls <package>`
- [ ] License compatibility: no GPL if building proprietary version

---

## Security Audit Checklist

Conduct security audit before each release:

- [ ] No hardcoded secrets in code or config
- [ ] No console.log statements with sensitive data
- [ ] All API calls use HTTPS
- [ ] OAuth tokens have expiry validation
- [ ] Form inputs are validated and escaped
- [ ] No `dangerouslySetInnerHTML` in components
- [ ] Dependencies are up-to-date and audited
- [ ] Error messages don't expose system details
- [ ] User data is not transmitted without consent
- [ ] Offline functionality works (no data loss on network failure)

---

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Web Application Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

## Questions & Reporting

For security questions or to report vulnerabilities:
- **GitHub Discussions**: Use for non-sensitive security topics
- **Email Security Contact**: Use for sensitive vulnerability reports
- **GitHub Security Advisories**: Available to maintainers
