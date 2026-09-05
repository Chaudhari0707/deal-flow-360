# Dependencies

Load for every dependency add, removal, version change, or API migration.

1. Confirm the current selected version from the authoritative registry and read the upstream
   release notes or migration guide for breaking changes.
2. Explain why the platform, standard library, or an existing dependency is insufficient.
3. Check runtime support, license, maintenance, advisories, bundle/server impact, and peer
   dependencies.
4. Update `package.json` and `bun.lock` together through Bun. Do not hand-edit lockfile resolutions.
5. Run affected tests, typecheck, lint, and build. A failed migration is part of the dependency task,
   not unrelated noise.

Avoid drive-by upgrades in feature work unless required to complete the approved scope.
