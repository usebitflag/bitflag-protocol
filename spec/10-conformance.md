# Conformance

An implementation conforms to a protocol release when it passes every fixture, vector and example in that release. This file describes the release artifact, how consumers pin it, what a runner must compare, and the report format used to compare evaluators with each other.

Status: **proposed** for the `0.x` prereleases.

## The release artifact

A release is an immutable GitHub release named after its tag `vX.Y.Z` or `vX.Y.Z-pre`. It carries:

| File | Contents |
| --- | --- |
| `bitflag-protocol-X.Y.Z.tar.gz` | `spec/`, `schemas/`, `fixtures/`, `examples/`, `CHANGELOG.md` and `VERSION` under a top directory `bitflag-protocol-X.Y.Z/`. |
| `SHA256SUMS` | The SHA-256 of the archive. |

- The archive is reproducible: the same tree always gives the same bytes.
- A release is never replaced or edited. A change creates a new version with a new checksum.
- `fixtures/manifest.json` lists every fixture file with its SHA-256 and carries one aggregate checksum over them.

### Versions

- Until both evaluators pass the same fixtures with identical results, versions are `0.Y.Z-alpha.N`.
- A change to an expected result raises the minor version and is marked *result-affecting* in `CHANGELOG.md`.
- `protocolVersion` stays `1` and `algorithmVersion` stays `bucket-sha256-v1` during `0.x`. After the first stable release, a change that alters a result for an existing input needs a new algorithm or capability version (see `08-capabilities-and-versioning.md`).

## Pinning a release

A consumer never reads a floating branch. It records the release in `protocol.lock.json`:

```json
{
  "version": "0.1.0-alpha.1",
  "url": "https://github.com/usebitflag/bitflag-protocol/releases/download/v0.1.0-alpha.1/bitflag-protocol-0.1.0-alpha.1.tar.gz",
  "sha256": "…"
}
```

and fetches it by downloading the archive, verifying `sha256` before extracting anything, and failing the build on a mismatch. Upgrading is a deliberate change of the lock file.

## What a runner compares

A runner loads every fixture in `fixtures/evaluation/` and `fixtures/snapshot/` and runs each case.

**Evaluation cases.** The runner evaluates `flagKey` as `type` with `fallback`, `context` and `evaluatedAt`, against the case's `snapshotRef` or the fixture's snapshot, with the case's `options`. Then:

- Every field listed in `expect` must be equal. Omitted fields are not compared.
- Numbers compare numerically: `20` equals `20.0`.
- `value` is compared as JSON: objects by members regardless of order, arrays in order.
- With `throws`, the evaluator must raise the named programming error and return no result.
- `expectTrace` is a partial match. Each listed step must appear in the trace in the listed order, and within a step each listed field must be equal; for `conditions` each listed condition is matched by its `path`. Extra steps and fields are allowed, so languages may add detail.
- A case that sets `options.trace` or `options.details` asks for them; a case that does not must not be given a trace.

**Snapshot cases.** The runner parses `snapshot` or `snapshotRaw`. With `accept: true` the parser must accept it. With `accept: false` it must reject it with the stated `errorKind` and, when listed, the `path` and `code`. A `snapshot` fixture is encoded as written; `snapshotRaw` is parsed as the exact text.

**Vectors.** The bucket vectors (`fixtures/bucketing/bucket-sha256-v1.json`) and canonical vectors (`fixtures/canonical/*.json`) are checked as described in `05-bucketing.md` and `07-canonical-json-and-checksum.md`.

**Examples.** Documents in `examples/telemetry/valid` validate against the schema named by their file prefix; those in `invalid` do not.

A fixture that only one language can pass is a specification bug. The fix is a clarification in `spec/` and, where needed, a new fixture.

## Conformance report

To compare evaluators, a runner can write a report. The format is JSON:

```json
{
  "protocol": "0.1.0-alpha.1",
  "evaluator": { "name": "bitflag-php", "version": "0.1.0-alpha.1" },
  "results": [
    { "fixture": "precedence/override-beats-rules", "case": "override beats the plan rule",
      "result": { "value": true, "variationKey": "on", "reason": "OVERRIDE", "ruleId": null,
                  "prerequisiteKey": null, "errorKind": null, "revision": 42, "generation": 1,
                  "bucket": null, "experimentId": null, "allocationId": null } },
    { "fixture": "fallback/wrong-type-fallback-throws", "case": "string fallback for a boolean read",
      "threw": "FALLBACK_TYPE_ERROR" }
  ],
  "snapshots": [
    { "fixture": "snapshot/weights-over-100000", "accepted": false,
      "errorKind": "MALFORMED_SNAPSHOT", "path": "/flags/f/rules/0/serve/rollout/slots",
      "code": "WEIGHT_TOTAL_EXCEEDED" }
  ]
}
```

A report lists the **actual** outcome of every case, not only the compared fields. Two reports agree when, for every case, `value`, `variationKey`, `reason`, `ruleId`, `prerequisiteKey`, `errorKind`, `revision`, `generation`, `bucket`, `experimentId` and `allocationId` are equal, and for every snapshot fixture `accepted`, `errorKind`, `path` and `code` are equal. `tools/compare-reports.mjs` compares any number of reports.

The cross-language check runs each evaluator over one pinned release, writes its report and compares them. It gates every release after `alpha.1`.
