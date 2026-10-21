# Changelog

All notable changes to the protocol are recorded here.

## Unreleased

- Repository skeleton: tooling, shared schema file and an empty fixture manifest.
- Specification: overview, context (`01`), snapshot (`02`) and evaluation (`03`).
- Schemas: shared definitions, context, snapshot and result with trace. Fixtures follow in the next change.
- Fixture format (`fixture.schema.json`), fixture validation, snapshot checksum tool, `snapshots/basic-boolean.json` and the first `precedence` and `fallback` fixtures.
- Bucketing: `spec/05-bucketing.md`, `bucket-vectors.schema.json`, `tools/bucket.mjs` and 240 `bucket-sha256-v1` vectors, including the worked example, NFC/NFD pairs and buckets 0, 51,615, 51,616 and 99,999.
