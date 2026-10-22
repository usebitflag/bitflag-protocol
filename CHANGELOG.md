# Changelog

All notable changes to the protocol are recorded here.

## Unreleased

- Repository skeleton: tooling, shared schema file and an empty fixture manifest.
- Specification: overview, context (`01`), snapshot (`02`) and evaluation (`03`).
- Schemas: shared definitions, context, snapshot and result with trace. Fixtures follow in the next change.
- Fixture format (`fixture.schema.json`), fixture validation, snapshot checksum tool, `snapshots/basic-boolean.json` and the first `precedence` and `fallback` fixtures.
- Bucketing: `spec/05-bucketing.md`, `bucket-vectors.schema.json`, `tools/bucket.mjs` and 240 `bucket-sha256-v1` vectors, including the worked example, NFC/NFD pairs and buckets 0, 51,615, 51,616 and 99,999.
- Canonical JSON: `spec/07-canonical-json-and-checksum.md`, `tools/canonical.mjs` and 18 canonical vectors, including the RFC 8785 sample, UTF-16 key ordering, ECMAScript number forms and the RFC's Appendix B number table.
