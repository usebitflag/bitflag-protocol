# AGENTS.md

This file provides guidance for coding agents working in `bitflag-protocol`.

## Project Overview

`bitflag-protocol` owns the BitFlag delivery contract: JSON Schemas for snapshots, results and events, the
written specification (including the `bucket-sha256-v1` bucketing algorithm), and the canonical known-answer
fixtures that both evaluators must pass. It contains no application runtime code beyond fixture tooling.

Consumers: `bitflag-php`, `bitflag-js` and the `bitflag` application. Each pins a fixture release by checksum and
never builds against this repository's floating `main`.

Design context lives in the `bitflag` repository (`docs/evaluation-and-sdk-protocol.md`).

## Project Structure

```text
bitflag-protocol/
├── spec/         # Written specification, one numbered file per topic
├── schemas/v1/   # JSON Schema (2020-12): common, snapshot, result, events
├── fixtures/     # Known-answer fixtures and their manifest
├── tools/        # Node 22 tooling: validate, manifest
└── CHANGELOG.md
```

## Core Rules

- A schema or semantic change ships with fixtures in the same pull request.
- Released fixtures are immutable. A change creates a new fixture release with a new checksum.
- The evaluation context names the subject category `kind`, never `type`.
- Until both evaluators pass the same fixtures, releases are `0.x` prereleases.
- Every change goes through a pull request. See `.claude/rules/git-workflow.md`.

Detailed rules: `.claude/rules/spec-and-fixtures.md` and `.claude/rules/git-workflow.md`.

## Commands

Node 22 (see `.nvmrc`):

- `npm ci` installs the tooling.
- `npm run validate` compiles every schema, validates every fixture, and checks that snapshot checksums and the fixture manifest are current.
- `npm run checksum` rewrites the checksums of fixture snapshots after an edit.
- `npm run bucket` regenerates the bucket vectors; `validate` fails when they are not current or wrong.
- `npm run canonical` regenerates the canonical JSON vectors; `validate` fails when they are not current.
- `npm run manifest` regenerates `fixtures/manifest.json` after any fixture change.
- `npm run lint:md` lints the Markdown.
