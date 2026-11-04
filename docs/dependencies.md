# Dependency review — November 4, 2026

The launch dependency update uses Next.js 16.4.5, React 19.3.1, OpenAI 7.50.0,
Sharp 0.35.5 and EmailJS Browser 5.0.3. ESLint remains on 9.39.5 because the
installed import, React and accessibility plugins support ESLint 9; forcing
ESLint 10 produces invalid peer dependencies.

The production audit recorded **zero vulnerabilities** on November 4:

```sh
npm audit --omit=dev --audit-level=moderate
```

CI repeats this check. This is a dated result, not a guarantee against future
advisories. Run the full `npm audit` as well when reviewing development tools.

## Remaining development-tool findings

The full audit still flags these transitive development dependencies:

| Dependency | Installed path | Remaining advisory and patched version |
| --- | --- | --- |
| `glob@10.5.0` | Tailwind CSS → Sucrase | [AbortSignal cancellation bypass](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4); fixed in `14.0.2` |
| `minimatch@9.0.9` | Tailwind CSS → Sucrase → glob | [Glob-parts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249); fixed in `11.0.1` |
| `minimatch@10.2.6` | Next.js ESLint config → TypeScript ESLint | The same minimatch advisory; fixed in `11.0.1` |
| `minimatch@3.1.5` | ESLint and its configuration/plugins | The advisory's published range also includes this branch |

These packages process repository files and configured build/lint patterns;
the public chat route does not pass visitor input to them. They are development
dependencies, and the production-only audit excludes them. They still need
upstream fixes and review when accepting untrusted repository changes.

Compatible updates have already installed `brace-expansion@2.1.7`,
`picomatch@2.3.2` and `yaml@2.9.1`; `glob@10.5.0` and `minimatch@9.0.9` also
include the available fixes within their existing major versions. Those updates
do not resolve the two newer advisories above.

## Why there are no forced major overrides

The remaining published fixes require major-version changes outside the
parents' supported dependency ranges. In particular, older ESLint consumers
call the CommonJS `minimatch` export as a function; minimatch 11 exposes a module
object instead. A global override would break that contract. Sucrase likewise
declares glob 10, not glob 14. Keep these dependencies compatible until their
parents adopt patched releases, or evaluate narrowly scoped replacements with
lint and build verification.

Do not use `npm audit fix --force` to accept npm's suggested ESLint 4 / Next.js
ESLint config 0.2.4 downgrade. It would replace the supported tooling with
incompatible obsolete versions. Recheck the full audit when upstream releases
are available; retain the production audit gate in the meantime.
