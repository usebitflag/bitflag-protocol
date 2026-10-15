# Specification and Fixtures

## Schemas

- JSON Schema draft 2020-12, validated with Ajv. Schemas live in `schemas/v1/`; a breaking change needs a new major directory.
- Reuse definitions from `common.schema.json`. Do not copy them.
- Keep schemas strict: `additionalProperties: false` unless the spec says a field set is open.

## Specification

- Write behavior in `spec/` as testable statements. Anything an evaluator must do identically in PHP and
  JavaScript needs an exact algorithm and a fixture.
- Bucketing is `bucket-sha256-v1`: SHA-256 over length-prefixed fields (`bitflag-bucket-v1`, salt, kind, bucketBy value),
  first 8 digest bytes as an unsigned big-endian integer, modulo 100000 (decision R15).
- Missing, null and wrong-type attribute handling is defined in the spec before it is implemented anywhere.

## Fixtures

- A fixture is input plus expected output, with a stable ID. Cover every result reason, every operator, missing/null/wrong-type
  cases, Unicode, bucket edges, prerequisites and expired overrides.
- The manifest lists every fixture with its checksum. `npm run validate` fails when the manifest is stale.
- Both evaluators run every fixture. A fixture that only one language can pass is a spec bug.

## Releases

- Prereleases are `0.x-alpha`. Tag and publish the artifact with its checksum; consumers pin that checksum.
- Update `CHANGELOG.md` for every change that affects consumers.
