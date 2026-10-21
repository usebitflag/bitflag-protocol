# Snapshot

A snapshot is the complete, immutable configuration of one environment at one revision. The JSON Schema is [`snapshot.schema.json`](../schemas/v1/snapshot.schema.json). Field names are camelCase.

Status of the limits and rules below: **proposed** for the `0.x` prereleases.

## Top level

| Field | Rule |
| --- | --- |
| `protocolVersion` | Integer `1`. |
| `algorithmVersion` | `"bucket-sha256-v1"`. |
| `environment` | `{ "id": "env_…", "key": "production" }`. |
| `revision` | Integer ≥ 0. `0` is the synthetic snapshot of a never-published environment and must have `flags: {}`. |
| `generation` | Integer ≥ 1. Changes only through an authenticated recovery; ordinary publication keeps it. |
| `projection` | `"server"` or `"public"`. |
| `publishedAt` | RFC 3339 instant in UTC. |
| `requiredCapabilities` | Unique capability names. Must equal the union of every flag's `requires`. |
| `flags` | Object keyed by flag key, `^[a-z][a-z0-9_-]{0,99}$`. |
| `segments` | Object keyed by segment key, `^[a-z][a-z0-9_-]{0,99}$`. |
| `checksum` | `sha256:` and 64 lowercase hexadecimal characters. Covers the canonical form of the rest of the snapshot. |

### Projections

- `server` carries the full configuration for trusted evaluators.
- `public` is for untrusted clients. Every flag has `overrides: []` and segments have no `include` or `exclude` lists. The schema enforces both.
- Two projections of one revision have different checksums.

## Flag

| Field | Rule |
| --- | --- |
| `type` | `boolean`, `string`, `number` or `json`. |
| `enabled` | Boolean. `false` serves `offVariation`. |
| `variations` | Non-empty object of variation key to value. Keys match `^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$`. Every value matches `type`; `json` values may be any JSON value of at most 32 KB in canonical form. |
| `offVariation`, `defaultVariation` | Keys that exist in `variations`. |
| `requires` | Optional unique capability names this flag needs. |
| `prerequisites` | At most 20 items: `{ "flagKey", "variations": [variation keys of that flag] }`. |
| `overrides` | At most 500 items: `{ "kind", "key", "variation", "expiresAt" }`. `expiresAt` is an RFC 3339 instant or `null`. `(kind, key)` is unique within a flag. |
| `rules` | At most 200 rules, evaluated in order. |

## Rule

| Field | Rule |
| --- | --- |
| `id` | 1 to 64 characters, stable across edits. |
| `enabled` | Optional boolean, default `true`. A disabled rule is skipped. |
| `match` | A condition group. |
| `serve` | A fixed variation or a rollout. |

Rule names are not part of the snapshot.

### Condition group

An object with exactly one key, `all` or `any`, holding an array of at most 50 conditions and groups. Nesting depth is at most 5. The schema cannot express depth; parsers enforce it. Group semantics are in `03-evaluation.md`.

### Condition

`{ "attribute", "op", "values", "ignoreCase" }`.

- `attribute` is a context attribute name, or `kind` or `key`. It is required for every operator except `in_segment` and `not_in_segment`, where it must be absent.
- `values` holds 1 to 1,000 scalar items. It is absent for `exists` and `not_exists`. Segment operators take 1 to 50 segment keys.
- Single-value operators (`eq`, `neq`, the numeric comparisons, `semver_*`, `before`, `after`) take exactly one value.
- `ignoreCase` is optional and affects only `starts_with`, `ends_with` and `contains`; it is ignored by every other operator.
- The operators and their matching rules are in `04-operators.md`.

### Serve

Either `{ "variation": "on" }` or `{ "rollout": { … } }`.

A rollout has:

| Field | Rule |
| --- | --- |
| `bucketBy` | `key`, or the name of a context attribute. |
| `salt` | 1 to 128 UTF-8 bytes. Unique per allocation. |
| `slots` | Non-empty array of `{ "variation", "weight" }`. |
| `remainderVariation` | Variation for buckets no slot covers. Required when the weights total less than 100,000. |
| `allocationId`, `experimentId` | Optional, present together. |

Each weight is an integer from 0 to 100,000. The weights total at most 100,000. The slot arithmetic is in `05-bucketing.md`.

## Segment

`{ "version", "match", "include", "exclude" }`. `version` is an integer ≥ 1. `match` is a condition group. `include` and `exclude` are optional arrays of `{ "kind", "key" }`, present in the `server` projection only.

## Rules the schema does not express

Parsers reject a snapshot with `MALFORMED_SNAPSHOT`, a JSON Pointer `path` and a `code` when:

- the JSON is invalid (including an escape that stands for an unpaired surrogate), nests deeper than 64 levels, exceeds 5 MiB, or contains a number whose value is an integer outside ±(2^53 − 1), however it is written, or one too large for binary64;
- a group nests deeper than 5 levels;
- rollout weights total more than 100,000, or total less without a `remainderVariation`;
- a string exceeds its limit in UTF-8 bytes, or is not valid UTF-8;
- a date or SemVer literal in a condition is invalid (a SemVer is at most 256 bytes);
- `(kind, key)` repeats within one flag's overrides;
- the checksum does not match (`CHECKSUM_MISMATCH`).

A snapshot with a `protocolVersion` other than `1` is `MALFORMED_SNAPSHOT`. One with an `algorithmVersion` other than `bucket-sha256-v1` is `UNSUPPORTED_CAPABILITY`. Either affects every flag, so the whole snapshot is rejected.

A **validator** reports, without rejecting the snapshot: a variation, segment or prerequisite reference that does not exist, a prerequisite cycle or depth over the ceiling, a `requiredCapabilities` list that is not the union of the flags' `requires`, and two allocations that share a salt. Affected flags evaluate to `INVALID_CONFIG`; publishing treats any issue as blocking.

Producers must not emit duplicate object keys. Consumers are not required to detect them.

## Limits

| Limit | Value |
| --- | --- |
| Snapshot size | 5 MiB (5,242,880 bytes) |
| JSON depth | 64 levels of arrays and objects, the top-level object being level 1 |
| Rules per flag | 200 |
| Overrides per flag | 500 |
| Prerequisites per flag | 20 |
| Items per group | 50 |
| Group nesting depth | 5 |
| Values per condition | 1,000 |
| Segment keys per segment condition | 50 |
| `json` variation value | 32 KiB (32,768 bytes) canonical |
| Rollout salt | 128 bytes |

Changing a limit is a protocol change with fixtures.
