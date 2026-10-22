# Changelog

All notable changes to the protocol are recorded here.

## Unreleased

- Repository skeleton: tooling, shared schema file and an empty fixture manifest.
- Specification: overview, context (`01`), snapshot (`02`) and evaluation (`03`).
- Schemas: shared definitions, context, snapshot and result with trace. Fixtures follow in the next change.
- Fixture format (`fixture.schema.json`), fixture validation, snapshot checksum tool, `snapshots/basic-boolean.json` and the first `precedence` and `fallback` fixtures.
- Bucketing: `spec/05-bucketing.md`, `bucket-vectors.schema.json`, `tools/bucket.mjs` and 240 `bucket-sha256-v1` vectors, including the worked example, NFC/NFD pairs and buckets 0, 51,615, 51,616 and 99,999.
- Canonical JSON: `spec/07-canonical-json-and-checksum.md`, `tools/canonical.mjs` and 18 canonical vectors, including the RFC 8785 sample, UTF-16 key ordering, ECMAScript number forms and the RFC's Appendix B number table.
- Operators: `spec/04-operators.md` and fixtures for `eq`, `neq`, `in`, `not_in`, `starts_with`, `ends_with`, `contains`, `gt`, `gte`, `lt`, `lte`, `exists` and `not_exists` (match, no match, missing, null, wrong type, arrays), plus `numbers`, `strings-unicode`, `groups` and `context` fixtures.
- Clarified: numbers outside the safe integer range are recognized by value, not by how they are written; `ignoreCase` affects only the three string-matching operators; a context may not have members other than `kind`, `key` and `attributes`.
- SemVer and date fixtures for `semver_*`, `before` and `after`: pre-release precedence, build metadata, invalid forms, offsets, fractions, calendar validity and leap years.
- Clarified: numeric pre-release identifiers are limited to 2^53 - 1 like other SemVer numbers; an array containing an invalid SemVer or date string is `invalid_value` even if another element would match.
- Segment, override and rollout fixtures: include/exclude precedence, keyless contexts, missing segments, exact override matching and expiry boundaries, slot edges, remainder variations, bucketing by attribute and kind, `MISSING_SUBJECT_KEY`, and before-and-after snapshots for raising a rollout and reallocating a multivariate split.
- Prerequisite, capability and experiment fixtures; `invalid-config` fixtures for lazy detection of dangling references; 62 snapshot-level fixtures (accepted and rejected snapshots, limits at and over the boundary, checksum, projection and safe-number rules).
- `spec/06-results-and-errors.md` (reasons, error kinds, snapshot rejection codes and paths, validation issues) and `spec/08-capabilities-and-versioning.md`.
- Decided in `spec/03-evaluation.md`: dangling variation, segment and prerequisite references are detected lazily, only when evaluation selects or evaluates them. The capability check applies to every flag an evaluation visits, including prerequisites, before the enabled check. Prerequisite depth is at most ten links.
- Telemetry: `spec/09-telemetry.md`, `telemetry-batch.schema.json`, `telemetry-ack.schema.json` and example batches and acknowledgements that `npm run validate` checks.
