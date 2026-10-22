# Canonical JSON and checksum

A snapshot carries a checksum of its own content. Producers and consumers compute it over a canonical serialization so that every language arrives at the same bytes.

Status: the serialization is RFC 8785 and the checksum rule is stated below. Vectors are in [`fixtures/canonical/`](../fixtures/canonical/).

## Canonical form

The canonical form is the JSON Canonicalization Scheme, [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785), applied to a parsed JSON value:

- No insignificant whitespace.
- Object members are sorted by key, comparing the keys as sequences of UTF-16 code units. This order differs from byte order and from code point order: a key containing an astral character such as U+1F600 sorts before U+FB33, because its first code unit is a surrogate (U+D83D).
- Strings are written in UTF-8 with minimal escaping: `\"`, `\\`, `\b`, `\t`, `\n`, `\f`, `\r`, and `\u00xx` with lowercase hex for the remaining control characters U+0000 to U+001F. Everything else, including `/`, U+007F, U+2028 and U+2029, is written as itself.
- Numbers are written as ECMAScript `Number.prototype.toString` writes the IEEE 754 binary64 value: the shortest digits that round-trip, plain notation for magnitudes from `1e-6` up to but not including `1e21`, otherwise exponential notation with an explicit sign (`1e+21`, `1e-7`). Negative zero is written `0`. `1E2`, `1.0` and `100` are the same value and give `100`.
- Array order is kept. `null`, `true` and `false` are written as themselves.

Input that is not valid JSON, numbers outside the binary64 range, and strings that are not valid Unicode have no canonical form. Producers must not emit duplicate object keys. A consumer that sees a duplicate keeps the last one, as JavaScript and PHP both do; detecting duplicates is not required.

JavaScript's built-in number formatting already matches the scheme. Other languages need their own shortest round-trip formatter: PHP's `json_encode` writes `1.0e+25`, which is wrong here. The vectors include the number table from RFC 8785 Appendix B and the exponent boundaries `1e20`, `1e21`, `1e-6` and `1e-7`.

## Checksum

```text
checksum = "sha256:" ‖ lowercase hex(SHA-256(UTF-8(canonical(snapshot without the "checksum" member))))
```

- The checksum covers every other member, including `revision`, `generation`, `projection` and `publishedAt`.
- HTTP headers and ETags are outside it. Two projections of one revision have different checksums.
- A parser verifies the checksum after decoding and rejects a snapshot that does not match with `MALFORMED_SNAPSHOT` and code `CHECKSUM_MISMATCH`.
- A `checksum` member nested anywhere other than the top level is ordinary data and is not removed.

Every snapshot in the fixtures carries a correct checksum, except those fixtures that test a mismatch.

## Vectors

Each file in `fixtures/canonical/` is `{ "input", "canonical", "checksum" }`:

- `input` is the JSON value, kept as written so that forms such as `-0`, `1E2` and `4.50` reach the evaluator unnormalized.
- `canonical` is the exact canonical text.
- `checksum` is `sha256:` and the hex SHA-256 of the UTF-8 bytes of `canonical`.

An implementation conforms when, for every file, it parses `input`, produces `canonical` byte for byte, and computes `checksum` from it.
