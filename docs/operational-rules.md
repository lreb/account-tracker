# Operational Rules & Deployment Procedures

Guidelines for managing development workflows, releases, deployments, and production operations.

---

## Development Workflow

### Branch Strategy

- **main**: Production-ready code; every commit represents a release
- **release/vX.Y.Z**: Release candidate branches; stabilization and hotfixes
- **feature/**:  Feature development; branched from `main`, PR'd back to `main`
- **bugfix/**:  Bug fixes; PR'd to `main` or current release branch
- **docs/**:  Documentation updates; can be merged directly or via PR

**Branch Naming Convention**:
```
feature/transaction-search
bugfix/category-rename-issue
docs/update-security-guide
release/v1.1.0
```

### Pull Request (PR) Process

1. **Create PR** from feature branch to `main`
2. **Code Review**: At least 1 maintainer review required
3. **Checks Pass**:
   - ESLint: zero warnings
   - TypeScript: `tsc --noEmit` passes
   - Unit tests: 100% passing
   - Pre-commit hook: no lint violations
4. **Approval**: Reviewer approves PR
5. **Squash Merge**: Combine commits into single message (keep history clean)
6. **Delete Branch**: Clean up after merge

### Commit Message Format

```
type(scope): brief description (max 50 chars)

Optional longer explanation (max 72 chars per line).
Mention related issues: "Fixes #123", "Relates to #456"

- Bullet point for changes
- Another bullet point
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring (no behavior change)
- `docs`: Documentation update
- `test`: Test additions/updates
- `style`: Formatting/whitespace (no behavior change)
- `chore`: Dependency updates, build config, etc.

**Examples**:
```
feat(transactions): add transaction search by description

Implement full-text search on transaction descriptions and notes.
Uses Dexie's compound index on (accountId, date, description).

Fixes #42
```

```
fix(budgets): calculate budget usage at read time only

Prevent stale derived state by removing pre-computed consumption field.
Consumption now calculated from transaction sum on each dashboard render.

Relates to #128
```

---

## Release Management

### Versioning (Semantic Versioning)

**Format**: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (data model changes, API incompatibility)
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes only (backward compatible)

**Examples**:
- `v1.0.0` → `v1.1.0`: New feature (e.g., vehicle fuel tracking)
- `v1.1.0` → `v1.1.1`: Bug fix
- `v1.1.1` → `v2.0.0`: Breaking change (e.g., Dexie schema restructure)

### Release Checklist

**Pre-Release (1 week before)**:
- [ ] Update version number in `package.json`
- [ ] Update `CHANGELOG.md` with all changes
- [ ] Review all merged PRs since last release
- [ ] Run full test suite: `npm test`
- [ ] Run linting: `npm run lint`
- [ ] Build production: `npm run build`

**Release Day**:
- [ ] Create `release/vX.Y.Z` branch
- [ ] Tag commit: `git tag vX.Y.Z`
- [ ] Push tag: `git push origin vX.Y.Z`
- [ ] Create GitHub release with changelog
- [ ] Deploy to GitHub Pages (static site)
- [ ] Announce release on project channels

**Post-Release**:
- [ ] Monitor error logs (if applicable)
- [ ] Be ready to patch if critical issues found
- [ ] Merge release branch back to `main`
- [ ] Update documentation with new features

### Hotfix Process

For critical bugs in production:

1. Create `hotfix/vX.Y.Z` branch from `main`
2. Fix bug and commit with descriptive message
3. Test thoroughly: `npm test && npm run build`
4. Bump patch version in `package.json`
5. Merge to `main` and create release tag
6. Document fix in changelog

---

## Environment & Build Configuration

### Environment Variables

**Development** (`.env.development`):
```
VITE_GOOGLE_CLIENT_ID=your-dev-client-id
VITE_APP_MODE=development
```

**Production** (`.env.production`):
```
VITE_GOOGLE_CLIENT_ID=your-prod-client-id
VITE_APP_MODE=production
```

**Build Time**:
- Variables prefixed `VITE_` are injected at build time
- Available in code via `import.meta.env.VITE_*`
- Never commit `.env` files; use `.env.example` as template

### Build Configurations

**Development**:
```bash
npm run dev           # Vite dev server with HMR
npm run build:dev    # Dev build with sourcemaps (if created)
```

**Production**:
```bash
npm run build         # Type-check + optimized build
npm run preview       # Preview production build locally
```

### PWA Deployment

**Local Network (Intranet)**:
```powershell
npm run publish:intranet  # Helper script
# or manual steps:
npm install
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

**GitHub Pages** (public):
1. Build: `npm run build`
2. Output in `dist/`
3. Push to `gh-pages` branch or configure in Actions
4. App available at `https://lreb.github.io/account-tracker/`

---

## CI/CD Pipeline (Planned)

### Automated Checks

**On Every PR**:
```yaml
- ESLint: npm run lint
- TypeScript: npx tsc --noEmit
- Unit Tests: npm run test
- Build: npm run build
```

**On Merge to main**:
```yaml
- All above checks
- Integration tests (future)
- Build production bundle
- Generate source maps
```

**On Release Tag**:
```yaml
- All above checks
- Create release asset (dist.zip)
- Deploy to GitHub Pages
- Create GitHub release draft
```

### GitHub Actions (Future)

```yaml
name: CI

on: [pull_request, push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

---

## Monitoring & Logging

### Development Logging

- **Console Logging**: Use `console.log()`, `console.error()`, `console.warn()`
- **No Sensitive Data**: Never log financial amounts, API keys, user PII
- **Structured Logging** (future): JSON format for parsing

**Safe Examples**:
```typescript
console.log('Transaction created', { id: txId, type: 'expense' });
console.error('Failed to save', { reason: 'Network timeout' });
```

**Unsafe Examples** (avoid):
```typescript
console.log('User data:', user); // Might contain PII
console.log('API response:', response); // Might contain sensitive info
```

### Error Tracking (Optional, Future)

If error tracking is implemented (v1.2+):
- Must be **optional**, opt-in per user
- Never auto-send error reports
- Scrub sensitive data before transmission
- Allow users to review before sending

**Candidates**: Sentry, Rollbar, Airbrake (self-hosted preferred)

### Performance Monitoring

**Metrics to Track**:
- Initial load time (< 2 seconds)
- Time to interactive (< 3 seconds)
- Bundle size (target: < 300 KB gzipped)
- List rendering performance (1000+ items < 100ms)

**Tools**:
- Lighthouse (built into Chrome DevTools)
- Web Vitals API (LCP, FID, CLS)
- Browser Performance API: `performance.mark()`, `performance.measure()`

---

## Backup & Recovery

### Database Backups

**User-Initiated Backups** (Recommended):
- Export JSON via Settings → Export Data
- Store in cloud (Google Drive, Dropbox) or local
- Frequency: Weekly minimum, or after large data changes

**App-Level Backup**:
- IndexedDB is browser-specific; backup if switching browsers
- No automatic backup (user controls via export)

### Recovery Procedures

**From JSON Backup**:
1. Settings → Import Data
2. Select backup file
3. Confirm (will wipe current data)
4. Import completes; app restarts

**From Cloud (Google Drive / Dropbox)**:
1. Settings → Cloud Sync
2. Select "Restore from backup"
3. Choose backup file from cloud
4. Confirm restore

**Browser Data Loss**:
- Clear browser cache → IndexedDB lost (unless backed up)
- Use password manager recovery if needed
- Manual export before OS updates recommended

---

## Incident Response

### Critical Issues

**Definition**: Data loss, security breach, app crash affecting all users

**Response Steps**:
1. Immediately assess impact and severity
2. Create issue on GitHub (private if security-related)
3. Assign to on-call engineer
4. Develop hotfix (target: < 4 hours)
5. Test thoroughly in staging
6. Deploy hotfix to production
7. Notify users of issue and fix
8. Post-mortem: root cause analysis within 24 hours

### High Priority Issues

**Definition**: Feature broken, significant data inconsistency, user-facing errors

**Response Steps**:
1. Create GitHub issue
2. Assign to next developer
3. Develop fix within sprint
4. Merge via normal PR process
5. Deploy in next release

### Regular Issues

**Definition**: Minor bugs, UX improvements, documentation

**Response Steps**:
1. Create GitHub issue
2. Add to backlog
3. Prioritize in next sprint planning
4. Implement and deploy in regular release

---

## Code Ownership & Responsibilities

| Area | Owner | Backup |
|------|-------|--------|
| Core (db, stores, types) | @lreb | Community |
| Transactions module | @lreb | @contributor1 |
| Vehicles module | @contributor2 | @contributor3 |
| Reports module | @contributor3 | @lreb |
| Insights module | @contributor1 | @lreb |
| Settings module | @lreb | @contributor2 |
| Security & Privacy | @lreb | Legal team |
| DevOps & CI/CD | @lreb | @contributor1 |
| Documentation | @lreb | @contributor4 |

**Responsibilities**:
- Review PRs in owned area
- Fix critical bugs in owned area
- Maintain test coverage (80%+ minimum)
- Update documentation for changes

---

## Deployment Platforms

### GitHub Pages (Current)

- **URL**: https://lreb.github.io/account-tracker/
- **Method**: Static site hosting from `gh-pages` branch
- **Performance**: CDN-backed, global distribution
- **SSL/TLS**: Automatic with HTTPS

### Android App (Planned)

- **Platform**: Google Play Store
- **Build**: Capacitor + native Android build
- **Signing**: App signing key (kept secure)
- **Releases**: Aligned with version tags

### Progressive Web App (Current)

- **Installable**: On Android, iOS (limited), Windows, Mac
- **Install**: "Add to Home Screen" via browser menu
- **Updates**: Service worker auto-updates in background
- **Offline**: Full functionality without internet

---

## Performance & Optimization

### Build Optimization

**Webpack/Vite Settings**:
- Code splitting by route (automatic with React Router)
- Tree-shaking unused code
- Minification & compression
- Asset optimization (images, fonts)

**Bundle Analysis**:
```bash
npm run build  # Check output size
```

**Target Metrics**:
- Main bundle: < 200 KB gzipped
- Total app: < 300 KB gzipped
- Initial load: < 2 seconds on 4G

### Runtime Optimization

- Virtual lists for 1000+ items
- `useDeferredValue` for heavy computations
- Memoization of expensive calculations
- Service worker caching strategy (cache-first for assets, network-first for APIs)

---

## Support & Maintenance

### User Support

- **GitHub Discussions**: User questions, feature requests
- **GitHub Issues**: Bug reports, feature proposals
- **Documentation**: README, guides, troubleshooting
- **Email**: For private issues (security, data loss)

### Community Contributions

- **Welcome**: Bug fixes, translations, documentation
- **Process**: Fork → feature branch → PR to `main`
- **Code Review**: Maintainers review for quality, security, tests
- **Acknowledgment**: Contributors listed in CHANGELOG

### Long-Term Maintenance

- **Security Updates**: Apply within 2 weeks of disclosure
- **Dependency Updates**: Monthly or as needed
- **Backwards Compatibility**: Maintain data format across versions
- **Deprecation**: 2 release cycles notice before removing features

---

## Troubleshooting Operational Issues

### Build Fails

1. Check Node.js version: `node -v` (should be ≥ 20)
2. Clear cache: `rm -r node_modules package-lock.json`
3. Reinstall: `npm install`
4. Rebuild: `npm run build`
5. Check logs for errors

### Tests Fail

1. Run in watch mode: `npm run test:watch`
2. Identify failing test
3. Check test file for issues
4. Ensure test data is valid
5. Debug with breakpoints in DevTools

### Lint Errors Block Commit

1. Run: `npm run lint:fix` (auto-fixes what it can)
2. Manually fix remaining errors
3. Commit: `git commit -m "..."`

### PWA Not Updating on Users' Devices

1. Service worker cache issue
2. Increment version in `vite.config.ts` PWA plugin
3. Users can force refresh (Ctrl+Shift+R on desktop, long-press refresh on mobile)
4. New app version auto-detected after rebuild + redeploy

---

## Contacts & Escalation

| Role | Contact | Escalation |
|------|---------|-----------|
| Lead Maintainer | @lreb | Project decision-making |
| Security Contact | See SECURITY.md | Vulnerability reports |
| Community Manager | GitHub Discussions | Feature requests |
| Translator Coordinator | Contributing.md | New language support |

---

## References

- [Git Workflow Guide](https://git-scm.com/book/en/v2)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Release Management](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
