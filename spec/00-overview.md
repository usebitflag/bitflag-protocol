# BitFlag protocol overview

This repository defines the contract between the BitFlag service and everything that evaluates its configuration: the application, the PHP and JavaScript evaluators, and the SDKs built on them.

## Contents

| Path | Purpose |
| --- | --- |
| `spec/` | The written specification. One numbered file per topic. |
| `schemas/v1/` | JSON Schemas (draft 2020-12) for snapshots, results and events. |
| `examples/` | Example documents that CI checks against the schemas. |
| `fixtures/` | Known-answer conformance fixtures and their checksummed manifest. |
| `tools/` | Node tooling that compiles the schemas, validates fixtures and maintains checksums and the manifest. |

## Specification files

| File | Topic |
| --- | --- |
| `01-context.md` | The evaluation context and its limits. |
| `02-snapshot.md` | The snapshot, flags, rules, segments and limits. |
| `03-evaluation.md` | Evaluation order, fallbacks, groups, segments, overrides and results. |
| `04-operators.md` | Operators, missing/null/wrong-type handling, string, number, SemVer and date rules. |
| `05-bucketing.md` | The `bucket-sha256-v1` algorithm, slots and the known-answer vectors. |
| `06-results-and-errors.md` | Reasons, error kinds, snapshot rejection codes and validation issues. |
| `07-canonical-json-and-checksum.md` | Canonical JSON (RFC 8785), the snapshot checksum and the canonical vectors. |
| `08-capabilities-and-versioning.md` | Protocol and algorithm versions, capabilities and what rejects a snapshot. |
| `09-telemetry.md` | The telemetry batch, event types and acknowledgement. |
| `10-conformance.md` | The release artifact, pinning, what runners compare and the conformance report. |

## Status

The rules in these files are **proposed** until both evaluators pass the same fixture release. Releases are `0.x` prereleases until then.

## Conventions

- The evaluation context names the subject category `kind`, never `type`.
- Bucketing uses the algorithm `bucket-sha256-v1` over 100,000 buckets.
- Schemas use stable URN identifiers (`urn:bitflag:protocol:v1:…`) and reference shared definitions in `common.schema.json`.

## Consumption

Consumers never read this repository's `main` branch. They pin a released fixture and schema artifact by version and checksum. The fixture manifest carries an aggregate checksum for that purpose.

Releases are prereleases (`0.x`) until both evaluators pass the same fixtures with identical results.

## Verification

`npm run validate` compiles every schema, validates every fixture, and checks that snapshot checksums and `fixtures/manifest.json` are current.
