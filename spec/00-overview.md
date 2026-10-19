# BitFlag protocol overview

This repository defines the contract between the BitFlag service and everything that evaluates its configuration: the application, the PHP and JavaScript evaluators, and the SDKs built on them.

## Contents

| Path | Purpose |
| --- | --- |
| `spec/` | The written specification. One numbered file per topic. |
| `schemas/v1/` | JSON Schemas (draft 2020-12) for snapshots, results and events. |
| `fixtures/` | Known-answer conformance fixtures and their checksummed manifest. |
| `tools/` | Node tooling that compiles the schemas and maintains the manifest. |

## Conventions

- The evaluation context names the subject category `kind`, never `type`.
- Bucketing uses the algorithm `bucket-sha256-v1` over 100,000 buckets.
- Schemas use stable URN identifiers (`urn:bitflag:protocol:v1:…`) and reference shared definitions in `common.schema.json`.

## Consumption

Consumers never read this repository's `main` branch. They pin a released fixture and schema artifact by version and checksum. The fixture manifest carries an aggregate checksum for that purpose.

Releases are prereleases (`0.x`) until both evaluators pass the same fixtures with identical results.

## Verification

`npm run validate` compiles every schema and checks that `fixtures/manifest.json` matches the fixture files.
