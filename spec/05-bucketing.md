# Bucketing

Percentage rollouts and weighted assignments place each subject in one of 100,000 integer buckets, numbered 0 through 99,999. A 20% allocation occupies 20,000 buckets. The algorithm is `bucket-sha256-v1`. The same inputs give the same bucket in every language, every process and every release.

Status: the algorithm and its inputs are settled. The vector file is [`fixtures/bucketing/bucket-sha256-v1.json`](../fixtures/bucketing/bucket-sha256-v1.json), described by [`bucket-vectors.schema.json`](../schemas/v1/bucket-vectors.schema.json).

## Algorithm

```text
field(s)  = u32be(byteLength(utf8(s))) ‖ utf8(s)
input     = field("bitflag-bucket-v1") ‖ field(salt) ‖ field(kind) ‖ field(bucketByValue)
digest    = SHA-256(input)
n         = unsigned 64-bit big-endian integer from digest[0..7]
bucket    = n mod 100000
```

- `u32be` is a four-byte unsigned big-endian integer. Length prefixes remove any delimiter ambiguity: `("ab", "c")` and `("a", "bc")` hash differently.
- Strings are hashed as their UTF-8 bytes exactly as given. There is no case folding and no Unicode normalization: `José` in NFC and in NFD are different subjects with different buckets.
- Lengths are byte lengths, not characters or UTF-16 code units.
- Nothing else is hashed. Revision, flag key, project, environment, names and slugs are not inputs, so ordinary publication never reshuffles subjects. The salt carries the identity of the allocation.
- Language-specific string hashes are never used.

### Inputs

| Input | Source |
| --- | --- |
| `salt` | The rollout's `salt`. Random, unique per allocation, 1 to 128 bytes. |
| `kind` | Always the context `kind`, also when bucketing by an attribute. |
| `bucketByValue` | The context `key` when the rollout's `bucketBy` is `key`; otherwise the value of the named attribute. |

`bucketByValue` must be a non-empty string. When it is absent, empty, `null` or not a string, the evaluation returns `ERROR` with `errorKind: "MISSING_SUBJECT_KEY"` and the caller's fallback. No random or default cohort is ever assigned, and a number is never converted to a string.

## Slots

A rollout lists slots in order. Slot *i* covers the half-open interval `[sum of earlier weights, sum including its own weight)`.

- A bucket inside a slot's interval gets that slot's variation.
- A bucket at or beyond the total weight gets `remainderVariation`. The remainder is required when the total is below 100,000.
- A slot of weight 0 covers nothing.
- The result's `bucket` and a trace's `slot` `{ variation, start, end }` report the bucket and the interval that contained it.

Raising only the first slot's weight keeps every subject already in it, because the interval grows at its upper edge. Changing several weights, reordering slots or rules, editing the audience or changing the salt can move subjects.

## Worked vector

| Input | Value |
| --- | --- |
| salt, kind, value | `s_9f2c`, `user`, `u_20931` |
| hashed bytes (hex) | `00000011 626974666c61672d6275636b65742d7631 00000006 735f39663263 00000004 75736572 00000007 755f3230393331` |
| `digest[0..7]` | `9f9eda90f9168dca` (n = 11501870814539976138) |
| bucket | 76138 |
| same salt and kind, value `José` in NFC and in NFD | 60341 and 99140 |

## Modulo bias

`2^64 mod 100000` is 51,616, so buckets 0 to 51,615 each have one more preimage than the others, out of about 1.8 × 10^14. The resulting bias is far below 10^-9 per bucket and is accepted. The vector file includes buckets 0, 51,615, 51,616 and 99,999.

## Implementation notes

- JavaScript uses `BigInt` or equivalent exact 64-bit arithmetic. A `Number` cannot hold the 64-bit integer.
- A language without an unsigned 64-bit integer computes the same value from two 32-bit halves: `hi = u32be(digest[0..3])`, `lo = u32be(digest[4..7])`, `bucket = ((hi mod 100000) × 67296 + lo) mod 100000`, where 67,296 is `2^32 mod 100000`. Every intermediate fits in a signed 64-bit integer. The vector file contains digests with the top bit set and clear.

## Vectors

Each entry has `salt`, `kind`, `value`, `inputHex` (the hashed bytes), `digestPrefixHex` (the first 8 digest bytes) and `bucket`. The file covers ASCII keys, keys of 1 to 1,024 bytes, multibyte text, emoji, combining marks and look-alike characters, NFC and NFD pairs, strings that collide without length prefixes, and values that land on buckets 0, 51,615, 51,616 and 99,999 and on common slot edges. An evaluator conforms when it reproduces `bucket` for every entry; `inputHex` and `digestPrefixHex` help locate a disagreement.
