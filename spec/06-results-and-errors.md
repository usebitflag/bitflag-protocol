# Results and errors

Status: **proposed** for the `0.x` prereleases. The result shape is in `03-evaluation.md` and [`result.schema.json`](../schemas/v1/result.schema.json); this file fixes the reasons, the error kinds and the snapshot problem codes.

## Reasons

| Reason | Meaning | Variation | Fields set |
| --- | --- | --- | --- |
| `OFF` | The flag is disabled. | `offVariation` | |
| `PREREQUISITE` | A prerequisite is not met. | `offVariation` | `prerequisiteKey` |
| `OVERRIDE` | An exact subject override applied. | The override's | |
| `RULE` | A rule decided. | The rule's fixed variation, slot or remainder | `ruleId`; `bucket` and the experiment fields for a rollout |
| `DEFAULT` | No rule matched. | `defaultVariation` | |
| `FALLBACK` | The flag cannot be used and the caller's value is returned. | none | `errorKind` |
| `ERROR` | The configuration or the input is unusable and the caller's value is returned. | none | `errorKind` |

`FALLBACK` and `ERROR` return the caller's fallback as `value` and `null` as `variationKey`. Every other reason names a variation of the flag.

## Error kinds

| Error kind | Reason | When |
| --- | --- | --- |
| `FLAG_NOT_FOUND` | `FALLBACK` | The flag is absent from the snapshot or its projection. |
| `TYPE_MISMATCH` | `FALLBACK` | The flag's type differs from the requested type. |
| `MISSING_SUBJECT_KEY` | `ERROR` | A rollout needs a key or `bucketBy` attribute that is absent, empty or not a string. |
| `INVALID_CONFIG` | `ERROR` | A dangling variation, segment or prerequisite reference that evaluation reaches, a prerequisite cycle, a prerequisite depth overflow. |
| `INVALID_CONTEXT` | `ERROR` | The context breaks the rules in `01-context.md`. |
| `UNSUPPORTED_CAPABILITY` | `ERROR` | A visited flag requires a capability the evaluator does not support. |
| `MALFORMED_SNAPSHOT` | `ERROR` | Used by clients that hold no valid snapshot. |
| `SNAPSHOT_TOO_OLD` | `ERROR` | Produced by a client whose snapshot is older than its permitted offline age. |
| `CLIENT_NOT_READY` | `ERROR` | Produced by a client that has no snapshot yet. |
| `AUTHORIZATION_REJECTED` | `ERROR` | Produced by a client whose credential was rejected. |

The last four are defined here and in the schemas, and are produced by SDK clients rather than by the evaluator. A prerequisite that ends in `ERROR` makes the dependent flag `ERROR` with the same kind.

A fallback of the wrong type is a programming error. The evaluator raises `FallbackTypeError` and never turns it into a result.

## Rejecting a snapshot

A parser rejects a snapshot with an error kind, a JSON Pointer `path` and a `code`.

| Error kind | When |
| --- | --- |
| `MALFORMED_SNAPSHOT` | Anything wrong with the snapshot, including an unsupported `protocolVersion`. |
| `UNSUPPORTED_CAPABILITY` | An `algorithmVersion` the evaluator does not implement. |

Codes:

| Code | When | `path` points to |
| --- | --- | --- |
| `INVALID_JSON` | The text is not valid JSON, or a string holds an escape for an unpaired surrogate. | `""` |
| `TOO_DEEP` | JSON nesting exceeds 64 levels. | `""` |
| `TOO_LARGE` | The text exceeds 5 MiB. | `""` |
| `INVALID_TYPE` | A value has the wrong JSON type. | The value |
| `MISSING_FIELD` | A required member is absent. | The object that lacks it |
| `UNKNOWN_FIELD` | An object has a member the schema does not define. | The unknown member |
| `INVALID_VALUE` | A value of the right type is not allowed: a pattern, enum, range, date or SemVer literal, or a malformed key. | The value, or for a key the member holding it |
| `LIMIT_EXCEEDED` | A list or group exceeds its limit, or groups nest deeper than 5. | The list, or the group that is too deep |
| `UNSAFE_NUMBER` | An integer outside ±(2^53 − 1), or a number too large for binary64 (`1e999`). | The number |
| `UNSUPPORTED_VERSION` | `protocolVersion` is not 1. | `/protocolVersion` |
| `UNSUPPORTED_ALGORITHM` | `algorithmVersion` is not `bucket-sha256-v1`. | `/algorithmVersion` |
| `WEIGHT_TOTAL_EXCEEDED` | Rollout weights total more than 100,000. | The `slots` array |
| `MISSING_REMAINDER` | Weights total less than 100,000 and there is no `remainderVariation`. | The rollout |
| `DUPLICATE_OVERRIDE` | A `(kind, key)` pair repeats within one flag. | The later override |
| `PROJECTION_VIOLATION` | A `public` snapshot has overrides or include or exclude lists. | The offending list |
| `EMPTY_SNAPSHOT_REQUIRED` | Revision 0 with flags. | `/flags` |
| `CHECKSUM_MISMATCH` | The checksum does not match the content. | `/checksum` |

When one snapshot has several problems, parsers report the first one in document order. Conformance fixtures contain one problem each. Checks run in this order: JSON decoding, structure, then the checksum.

## Validation issues

The snapshot validator reports problems that do not stop a snapshot from loading. The issue codes are `DANGLING_VARIATION`, `DANGLING_SEGMENT`, `DANGLING_PREREQUISITE`, `PREREQUISITE_CYCLE`, `PREREQUISITE_DEPTH`, `SEGMENT_CYCLE`, `CAPABILITY_UNION_MISMATCH` and `DUPLICATE_SALT`. A prerequisite that lists a variation its flag does not have is reported as `DANGLING_VARIATION`; two rollouts may share a salt only when they share an `allocationId`. Publication treats any issue as blocking; evaluation reports `INVALID_CONFIG` only for those that it reaches.
