# Capabilities and versioning

Status: **proposed** for the `0.x` prereleases.

## Versions

- `protocolVersion` is the version of the snapshot and result formats. This specification is version 1.
- `algorithmVersion` names the bucketing algorithm. Version 1 uses `bucket-sha256-v1`.
- A snapshot with a `protocolVersion` other than 1 is rejected as `MALFORMED_SNAPSHOT` (code `UNSUPPORTED_VERSION`). A snapshot with another `algorithmVersion` is rejected as `UNSUPPORTED_CAPABILITY` (code `UNSUPPORTED_ALGORITHM`). Both affect every flag, so the whole snapshot is rejected, and a rejected snapshot never replaces an accepted one.
- Changing a rule so that an existing input gives a different result needs a new algorithm or capability version, not an edit.

## Capabilities

A capability names a group of behavior. Capabilities known to version 1:

| Capability | Covers |
| --- | --- |
| `operators.v1` | Equality, membership, string, numeric and existence operators. |
| `semver.v1` | The `semver_*` operators. |
| `dates.v1` | The `before` and `after` operators. |
| `segments.v1` | Segments and the `in_segment` and `not_in_segment` operators. |
| `prerequisites.v1` | Flag prerequisites. |
| `rollouts.v1` | Weighted rollouts and `bucket-sha256-v1`. |
| `experiments.v1` | `experimentId` and `allocationId` on rollouts. |

- A flag lists in `requires` the capabilities it needs. `requiredCapabilities` of the snapshot is the union of all flags' `requires`.
- An evaluator supports a fixed set of capabilities. A flag whose `requires` names an unsupported one evaluates to `ERROR / UNSUPPORTED_CAPABILITY`, and so does any flag that reaches it through a prerequisite. All other flags in the same snapshot evaluate normally.
- A capability name that the evaluator does not know is not a parse error: the snapshot is accepted, so an old evaluator keeps serving the flags it understands.
- Capability names match `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*\.v[1-9][0-9]*$`.

## Evolving the protocol

- During `0.x`, any rule can change, with new fixtures and a new prerelease. A change to an expected result is marked result-affecting in the changelog.
- After the first stable release, a change that alters a result for an existing input is not allowed under the same algorithm or capability version.
