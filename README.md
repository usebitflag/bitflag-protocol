# bitflag-protocol

Delivery schemas, event contracts, the bucketing algorithm specification and canonical conformance fixtures. No application runtime code beyond fixture tooling.

Part of BitFlag. Technical documentation lives in [usebitflag/bitflag](https://github.com/usebitflag/bitflag/tree/main/docs).

## Development

Requires Node 22.

```bash
npm ci
npm run validate
npm run lint:md
```

## Releasing

Consumers never read this repository's `main`. They pin a published release, so a release is the only way a change reaches the evaluators and the application. Releases are immutable: a published version is never replaced, a fix is a new version.

1. Merge every change through a pull request. Check `main` before tagging; the tag cannot be taken back.
2. Optional: run the `cross-language` workflow (Actions → cross-language → Run workflow) with the tags or branches of `bitflag-php` and `bitflag-js`. It runs both evaluators over the fixtures of `main`, compares their reports, and runs the differential fuzz test with the given seed.
3. In `CHANGELOG.md`, put the entries under a heading `## <version>`, for example `## 0.1.0-alpha.2`, with an empty `## Unreleased` above it. Merge that through a pull request.
4. Tag `main` and push the tag:

   ```bash
   git checkout main && git pull
   git tag v0.1.0-alpha.2
   git push origin v0.1.0-alpha.2
   ```

   The `release` workflow checks the tag format and the changelog heading, runs `npm run validate` and `npm run lint:md`, builds the reproducible archive and `SHA256SUMS` with `tools/pack.mjs`, and publishes them as a GitHub Release (a prerelease when the version has a suffix such as `-alpha.1`).
5. Tell the consumers. Each evaluator adopts the release with `scripts/pin-protocol.sh <version>` and fixes whatever the new fixtures expose (see its README). The application then updates its own lock.

An evaluator may stay on an older release for a while. A snapshot that needs a newer feature lists it in `requiredCapabilities`, and an evaluator that does not know it returns `UNSUPPORTED_CAPABILITY`. Before publishing snapshots that use a new feature, run the `cross-language` workflow with both evaluators on the release that has it.

### Secrets

The `cross-language` workflow reads the private evaluator repositories with the `EVALUATOR_READ_TOKEN` secret: a fine-grained personal access token with read-only Contents access to `usebitflag/bitflag-php` and `usebitflag/bitflag-js`. Tokens expire; replace the secret when a run fails with `Not Found` while checking out an evaluator.
