# Fixtures

Known-answer conformance fixtures that both evaluators run. `manifest.json` lists every file in this directory (except itself) with its SHA-256 checksum and carries one aggregate checksum, which consumers pin.

Regenerate the manifest after any change with `npm run manifest`. `npm run validate` fails when the manifest is out of date.

## Layout

| Path | Contents |
| --- | --- |
| `snapshots/*.json` | Snapshots shared by several fixtures. Each carries a correct `checksum`. |
| `evaluation/<category>/<name>.json` | Evaluation fixtures. The fixture ID is `<category>/<name>`. |
| `snapshot/<name>.json` | Snapshot-level fixtures that check acceptance or rejection (ID `snapshot/<name>`). |

A fixture file has an ID, a description, a snapshot (inline `snapshot` or `snapshotRef` relative to this directory) and cases. A case may override the snapshot with its own `snapshotRef`, which is how before-and-after fixtures compare two snapshots. The format is [`fixture.schema.json`](../schemas/v1/fixture.schema.json).

Each case lists the fields every evaluator must match exactly in `expect`; omitted fields are not compared and numbers compare numerically. `expectTrace` is a partial match. A programming-error case uses `expect: { "throws": "FALLBACK_TYPE_ERROR" }`.

## Tooling

- `npm run checksum` rewrites the `checksum` of every fixture snapshot (canonical JSON, SHA-256, excluding the `checksum` member). `npm run validate` fails when one is stale.
- `npm run validate` also checks every fixture against the schema, that IDs match paths and are unique, that every `snapshotRef` exists, and that every snapshot that must be accepted satisfies the snapshot schema.
