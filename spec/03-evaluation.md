# Evaluation

Given a snapshot, a flag key, a requested type, a caller fallback, a context and an evaluation time, every evaluator returns the same result. The evaluator performs no I/O, reads no clock of its own except an injected one, and uses no randomness.

Status of the rules below: **proposed** for the `0.x` prereleases.

## Order

```text
evaluate(snapshot, flagKey, requestedType, fallback, context, at, options):
  assert typeOf(fallback) == requestedType            else throw FallbackTypeError
  ctx = normalize(context)                            invalid -> ERROR / INVALID_CONTEXT
  flag = snapshot.flags[flagKey]                      absent  -> FALLBACK / FLAG_NOT_FOUND
  flag.type == requestedType                          else    -> FALLBACK / TYPE_MISMATCH
  return evaluateFlag(flag, ctx, at, visiting = [flagKey])

evaluateFlag(flag, ctx, at, visiting):
  flag.requires ⊆ supported                           else    -> ERROR / UNSUPPORTED_CAPABILITY
  if !flag.enabled                                    -> OFF (offVariation)
  for p in flag.prerequisites (in order):
     if p.flagKey in visiting or |visiting| > 10      -> ERROR / INVALID_CONFIG
     pf = snapshot.flags[p.flagKey]                   absent -> ERROR / INVALID_CONFIG
     r = evaluateFlag(pf, ctx, at, visiting + p.flagKey)   (memoized per call)
     if r.reason == ERROR                             -> ERROR (propagate errorKind)
     if r.variationKey not in p.variations            -> PREREQUISITE (offVariation, prerequisiteKey = p.flagKey)
  for o in flag.overrides:
     if o.kind == ctx.kind and o.key == ctx.key and (o.expiresAt == null or at < o.expiresAt)
                                                      -> OVERRIDE (o.variation)
  for r in flag.rules where r.enabled:
     if matches(r.match, ctx):
        fixed variation                               -> RULE (ruleId)
        rollout: value = bucketByValue(r, ctx)        missing -> ERROR / MISSING_SUBJECT_KEY
                 b = bucket(salt, ctx.kind, value); serve slot or remainder -> RULE (ruleId, bucket)
  -> DEFAULT (defaultVariation)
```

Precedence, highest first: unusable input, absent or mistyped flag, disabled flag, unmet prerequisite, exact override, first matching enabled rule, default.

- A prerequisite is checked before overrides: an unmet prerequisite serves the off variation even for a subject that has an override.
- Prerequisite depth is the number of prerequisite links between the evaluated flag and the deepest flag it reaches, and is at most 10: a chain of 11 flags evaluates, a chain of 12 is `INVALID_CONFIG`. A cycle (including a flag that requires itself), a missing referenced flag and a depth overflow are `INVALID_CONFIG`. Each prerequisite flag is evaluated once per top-level call.
- A prerequisite that ends in `ERROR` makes the parent `ERROR` with the same `errorKind`. A broken graph is never read as an unmet prerequisite.
- A variation key that does not exist in `variations` (for `offVariation`, `defaultVariation`, an override, a slot or a remainder) is `ERROR / INVALID_CONFIG`. Invalid configuration never returns a truthy value by accident.
- Dangling references are detected **lazily**: the error is returned only when evaluation selects the dangling variation or evaluates the dangling segment or prerequisite. A reference that evaluation never reaches does not affect the result. Examples: a rule after the one that decided; a condition skipped by short-circuiting; an override that is expired or belongs to another subject; a slot or remainder the subject's bucket does not fall into; a disabled rule; anything on a disabled flag other than its `offVariation`. The snapshot validator reports every dangling reference regardless, so publication rejects them first.
- A reference to a segment that is absent from the snapshot is `ERROR / INVALID_CONFIG`.

## Typed reads and fallbacks

- The caller states the type it expects and supplies a fallback of that type. A fallback of the wrong type is a programming error: the evaluator raises a `FallbackTypeError` (the language's invalid-argument error) and never converts it into a result.
- `FALLBACK` and `ERROR` results return the caller's fallback as `value` and `null` as `variationKey`. Every other reason returns a variation from the snapshot.
- Disabling a flag serves its off variation (`OFF`). Archiving a flag removes it from the snapshot, so reads return the caller's fallback (`FALLBACK / FLAG_NOT_FOUND`). These are different outcomes.

## Groups

- `all` is true when every member is true. An empty `all` is true; it is how an "everyone" rule is written.
- `any` is true when at least one member is true. An empty `any` is false.
- Members are evaluated in order and evaluation short-circuits. A trace records skipped members as `not_evaluated`.

## Segments

- A segment contains a subject when, in this order: the subject is in `exclude` (not a member); else the subject is in `include` (member); else the segment's `match` group is true.
- Include and exclude compare `(kind, key)` exactly. A context without a `key` never matches either list.
- Segment membership is always computable, so `not_in_segment` is the plain negation of `in_segment`.
- Membership of a segment is computed at most once per call, because the context does not change within a call. An implementation must not evaluate a segment again each time it is referenced: segments that refer to several segments each would otherwise take exponential time.
- A segment's conditions may use `in_segment` and `not_in_segment` to refer to other segments. A segment that leads back to itself, directly or through others, is `ERROR / INVALID_CONFIG` when evaluation reaches the cycle.

## Overrides and time

- An override matches on exact `(kind, key)`. The context must have a `key`.
- An override is active when `expiresAt` is `null` or the evaluation time is strictly before it. At exactly `expiresAt` it is expired and evaluation falls through to the rules.
- The evaluation time is supplied by the caller (fixtures, the simulator) or read from an injected clock. The result's `evaluatedAt` is always that instant, so a fixed clock reproduces a result.

## Capabilities

- A flag whose `requires` names a capability the evaluator does not support evaluates to `ERROR / UNSUPPORTED_CAPABILITY`. Other flags in the same snapshot still evaluate. The check applies to every flag the evaluation visits, so a flag that has such a prerequisite also evaluates to `ERROR / UNSUPPORTED_CAPABILITY`.
- Capabilities in version 1: `operators.v1`, `semver.v1`, `dates.v1`, `segments.v1`, `prerequisites.v1`, `rollouts.v1`, `experiments.v1`. Their meaning, and what rejects a whole snapshot, is in `08-capabilities-and-versioning.md`.

## Results

The result schema is [`result.schema.json`](../schemas/v1/result.schema.json).

| Field | Notes |
| --- | --- |
| `flagKey` | The flag that was read. |
| `value` | The served value, or the caller's fallback for `FALLBACK` and `ERROR`. |
| `variationKey` | `null` when the fallback was returned. |
| `reason` | `OFF`, `PREREQUISITE`, `OVERRIDE`, `RULE`, `DEFAULT`, `FALLBACK`, `ERROR`. |
| `ruleId` | Set exactly for `RULE`. |
| `prerequisiteKey` | The first prerequisite, in order, that is not met; set exactly for `PREREQUISITE`. |
| `revision`, `generation` | From the snapshot; `null` only when no snapshot was usable. |
| `bucket` | The bucket 0 to 99,999. Set only when a rollout decided and the caller asked for details. |
| `experimentId`, `allocationId` | Copied from the deciding rollout when it has them. |
| `errorKind` | Set exactly for `FALLBACK` and `ERROR`. |
| `evaluatedAt` | The evaluation instant, RFC 3339 UTC. |
| `trace` | Optional; see below. |

Error kinds, and when each applies, are in `06-results-and-errors.md`.

### Details and traces

- `bucket` and `trace` are off by default and requested per call. Clients that evaluate on untrusted or public paths must not offer them.
- A trace is the list of steps taken for the **evaluated flag**, in order. The steps of its prerequisite flags are not part of it. Every step has a name and an `outcome`:

  | Step | When it is recorded | Outcome | Other fields |
  | --- | --- | --- | --- |
  | `capability` | The flag has `requires` | `supported` or `unsupported` | |
  | `off` | The flag is disabled | `served` | |
  | `prerequisite` | A prerequisite is checked | `met` or `unmet` | `prerequisitePath`: a list holding the key of the prerequisite that was checked (the list could hold a deeper path; evaluators record the direct prerequisite only) |
  | `override` | An override exists for the context's kind and key | `applied` or `expired` | `overrideExpiresAt`, when the override has an expiry |
  | `rule` | An enabled rule is evaluated | `matched` or `not_matched` | `ruleId`; `conditions`; for a rollout that decided: `bucket` and `slot` |
  | `rule` | A disabled rule is passed | `disabled` | `ruleId` |
  | `default` | No rule matched | `served` | |

  Checking stops at the first step that decides, so no step is recorded after it.
- A rule step lists its conditions with a `path` (a JSON Pointer relative to the rule's `match`, such as `/all/1/any/0`), the operator, the attribute or segment and an outcome of `match`, `no_match`, `missing`, `null`, `wrong_type`, `invalid_value` or `not_evaluated`. Conditions that a short-circuiting group skipped are listed as `not_evaluated`, also those nested in a skipped group. A rollout step names the bucket and the interval that contained it as `slot: { variation, start, end }`; the remainder is reported as the interval up to 100,000.
- Steps recorded before an error stay in the trace of the `ERROR` result.
- A trace names attributes and outcomes, never context values, so it can be logged without leaking subject data.
- A fixture compares a trace as a partial match: each listed step and field must appear in order, and extra content is allowed.

## Evaluating every flag

`evaluateAll(context)` has no caller fallback to validate. It evaluates each flag in the snapshot as that flag's declared type and returns `{ results, revision, generation }`, where `results` maps each flag key to a bulk result.

- A bulk result has the fields of a result, except that `value` and `variationKey` are `null` whenever `reason` is `ERROR`, because there is no fallback to substitute.
- `FALLBACK` cannot occur, because only flags present in the snapshot are listed.
- Bulk values are for bootstrapping and debugging. They must not be fed into typed reads; a typed read always goes through `evaluate` with a typed fallback.
