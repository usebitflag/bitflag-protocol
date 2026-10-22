# Telemetry

SDKs send usage and outcome events to the service in batches. This file fixes the batch and acknowledgement formats. The schemas are [`telemetry-batch.schema.json`](../schemas/v1/telemetry-batch.schema.json) and [`telemetry-ack.schema.json`](../schemas/v1/telemetry-ack.schema.json); examples that CI validates are in [`examples/telemetry/`](../examples/telemetry/).

Status: **proposed** for the `0.x` prereleases. Telemetry does not take part in evaluation: the fixtures do not cover it, and a failure to send events never blocks a flag read.

## Batch

```json
{
  "batchId": "01J9ZQ0000000000000000BATC",
  "sentAt": "2026-10-06T08:52:11Z",
  "sdk": { "name": "bitflag-php", "version": "0.1.0", "protocolVersion": 1 },
  "events": [ … ]
}
```

| Field | Rule |
| --- | --- |
| `batchId` | 1 to 64 characters from `A-Z a-z 0-9 _ -`, for example a ULID. |
| `sentAt` | RFC 3339 instant in UTC. |
| `sdk` | `name` matches `^[a-z][a-z0-9_.-]{0,63}$`, `version` is a string of 1 to 64 characters, `protocolVersion` is `1`. |
| `events` | At most 500 events. May be empty. |

Limits the schema cannot express and the sender and the receiver enforce:

- A batch is at most 256 KB of JSON.
- Event IDs are unique per SDK instance. An SDK that retries a batch sends the same events with the same IDs, so a receiver can drop duplicates.
- Memory for queued events is bounded; when the queue is full, the SDK drops the oldest events and counts the loss.

## Events

Every event has an `id` (the same form as `batchId`) and a `type`.

### `evaluation_summary`

Counts identical outcomes over a window, so that high-volume reads cost one event, not one each.

| Field | Meaning |
| --- | --- |
| `windowStart`, `windowEnd` | The window, RFC 3339 UTC. |
| `flagKey`, `variationKey`, `reason`, `errorKind` | The outcome that was counted. `variationKey` and `errorKind` are `null` when they do not apply. |
| `revision`, `generation` | The snapshot used, or `null` when there was none. |
| `count` | Number of evaluations, at least 1. |

A summary carries no subject data. This is a rule, not a convention: a schema that allowed a `subject` here would let subject keys flow into aggregate counts.

### `exposure`

The application used a flag value for a subject, normally for an experiment.

| Field | Meaning |
| --- | --- |
| `occurredAt` | When the value was used. |
| `flagKey`, `variationKey`, `revision` | What was served. |
| `experimentId`, `allocationId` | Copied from the evaluation result of an experiment rule. |
| `subject` | `{ "kind", "key" }`. |

Evaluating a flag is not an exposure. An exposure is recorded only when the application uses the result, through an explicit SDK call or a documented render helper.

### `conversion`

A named outcome for a subject.

| Field | Meaning |
| --- | --- |
| `occurredAt` | When it happened. |
| `event` | The outcome name, matching `^[a-z][a-z0-9_.-]{0,127}$`, for example `checkout_completed`. |
| `subject` | `{ "kind", "key" }`. |
| `value` | Optional number, for example an order value. |

### `sdk_status`

A heartbeat that tells the service how current an SDK is.

| Field | Meaning |
| --- | --- |
| `occurredAt` | When it was taken. |
| `revision`, `generation` | The snapshot the SDK holds, or `null`. |
| `snapshotAgeMs` | Time since the snapshot was last validated, or `null` when there is none. |
| `errorCounts` | Counts per error kind since the last status event. Keys are error kinds from `06-results-and-errors.md`. |

## Acknowledgement

The service answers a batch with the fate of every event ID:

```json
{
  "accepted": ["01J9…A", "01J9…B"],
  "retryable": [{ "id": "01J9…C", "code": "RATE_LIMITED" }],
  "rejected": [{ "id": "01J9…D", "code": "UNKNOWN_FLAG" }]
}
```

- `accepted` events are stored. `retryable` events failed for a reason that may pass and are resent in a later batch. `rejected` events will never be accepted and are dropped.
- A `code` matches `^[A-Z][A-Z0-9_]{0,63}$`. The vocabulary is open. Codes in use are `RATE_LIMITED` and `TEMPORARY_FAILURE` for retryable events, and `INVALID_EVENT`, `UNKNOWN_FLAG` and `TOO_OLD` for rejected ones. SDKs treat an unknown code in `retryable` as retryable and in `rejected` as rejected.
- Transport failures (an HTTP error or no answer) are handled by the SDK with bounded retries and backoff; they are not part of this contract.

## Privacy

- Exposure and conversion events carry the subject's kind and key. Evaluation summaries and status events never do.
- Context attributes are never sent.
- Telemetry has bounded memory and payload size, and it must not delay or fail a flag read.
