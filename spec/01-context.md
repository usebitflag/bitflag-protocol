# Evaluation context

The context is the subject an evaluation is about. Every evaluator, SDK, the flag simulator and segment preview use this one shape. The JSON Schema is [`context.schema.json`](../schemas/v1/context.schema.json).

Status of the rules below: **proposed** for the `0.x` prereleases. Changing one is a protocol change with fixtures.

## Shape

```json
{
  "kind": "user",
  "key": "u_20931",
  "attributes": { "country": "PH", "plan": "pro", "appVersion": "4.2.0" }
}
```

| Field | Rule |
| --- | --- |
| `kind` | Required. Matches `^[a-z][a-z0-9_-]{0,63}$`. The category of the subject: `user`, `organization`, `device`. The field is called `kind`, never `type`. |
| `key` | Optional string of 1 to 256 UTF-8 bytes. A number is invalid and is never coerced to a string. |
| `attributes` | Optional object with at most 100 entries. |

The context has no members other than `kind`, `key` and `attributes`; any other member, for example `type`, makes it invalid. An evaluation has exactly one context with exactly one kind. Multi-kind contexts are not part of version 1.

## Attributes

- A name is 1 to 128 UTF-8 bytes, case-sensitive, and is not `kind` or `key`. Those two names address the context fields themselves in conditions (see `04-operators.md`).
- A value is one of:
  - a string of at most 1,024 UTF-8 bytes,
  - a finite number (IEEE 754 binary64),
  - a boolean,
  - `null`,
  - an array of at most 100 items that all have the same scalar type (string, number or boolean). Arrays contain no `null`, no nested arrays and no objects.
- Objects are not valid attribute values.
- `null` is an explicit value and is distinct from an absent attribute.

## Validity

A context that violates any rule above is invalid. An evaluator returns `reason: "ERROR"` with `errorKind: "INVALID_CONTEXT"` and the caller's fallback; it does not repair, truncate or partially use the context.

A string that contains an unpaired surrogate has no UTF-8 form and makes the context invalid. Byte limits count UTF-8 bytes, not characters or UTF-16 code units. The schema counts characters, which is never stricter than the byte limit, so a schema-valid context can still be invalid on its byte length. Parsers enforce the byte limits.

Numbers in a context are IEEE 754 binary64. A number whose value is an integer outside ±(2^53 − 1), however it is written, is not an invalid context; it is a value of the wrong type for every numeric operator (see `04-operators.md`). Callers that need larger integers or exact decimals send strings and compare them with string operators.

## Subject identity

- Sticky rollouts and experiments need a stable `kind` and `key`. An evaluator never invents an identity and never assigns a random cohort.
- Callers without a logged-in identity use a persisted anonymous identifier as the key.
- A context without a `key` evaluates normally except where a rule needs one: a rollout that buckets by `key`, an exact override, and segment include and exclude lists (see `03-evaluation.md`).
