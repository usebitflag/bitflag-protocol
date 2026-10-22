# Conditions and operators

A condition tests one context attribute, or the context `kind` or `key`, against listed values. Evaluation is strict: no language coercion ever makes `"20"` equal `20`.

Status of the rules below: **proposed** for the `0.x` prereleases.

## Operators

| Operator | Attribute type | `values` | Match rule |
| --- | --- | --- | --- |
| `eq`, `neq` | string, number, boolean | exactly 1 | Same type, equal value. Numbers compare numerically. |
| `in`, `not_in` | string, number | 1 to 1,000, one type | The attribute equals any listed value. |
| `starts_with`, `ends_with`, `contains` | string | 1 to 1,000 strings | Any listed value is a prefix, suffix or substring. Byte-wise on UTF-8. |
| `gt`, `gte`, `lt`, `lte` | number | exactly 1 number | Numeric comparison of finite numbers. |
| `exists`, `not_exists` | any | none | Presence of the attribute name. |
| `semver_eq`, `semver_neq`, `semver_gt`, `semver_gte`, `semver_lt`, `semver_lte` | string | exactly 1 valid SemVer | SemVer 2.0.0 precedence. |
| `before`, `after` | string | exactly 1 RFC 3339 instant | Strictly earlier or later instant. |
| `in_segment`, `not_in_segment` | none | 1 to 50 segment keys | Membership of any listed segment (see `03-evaluation.md`). |

`attribute` names a context attribute. The names `kind` and `key` address the context's own fields: `kind` is always present, `key` is present only when the context has one. Segment operators take no `attribute`.

## Missing, null and wrong type

Each condition ends in one **outcome**, which a trace records:

| Outcome | When |
| --- | --- |
| `match` | The condition is true. |
| `no_match` | The attribute is present, not null and of the right type, and the condition is false. |
| `missing` | The attribute is absent. |
| `null` | The attribute is present and `null`. |
| `wrong_type` | The attribute is present but not of the type the operator needs, or is an array that contains such items. |
| `invalid_value` | A string attribute is not a valid SemVer or date, for `semver_*`, `before` and `after`, or an array contains such a string. |

The rules:

1. **Positive operators.** For every operator except the negated ones and `exists`/`not_exists`, the outcomes `missing`, `null`, `wrong_type` and `invalid_value` are all false.
2. **Negated operators** (`neq`, `not_in`, `semver_neq`) are the negation of their positive form **only** when the outcome would otherwise be `match` or `no_match`. For `missing`, `null`, `wrong_type` and `invalid_value` they are false too. A negated operator does not match an absent attribute.
3. **Arrays.** A positive operator matches when any element matches. A negated operator matches when no element matches. An empty array is present and of the right type for every operator, so a positive operator is false and a negated operator is true. An array with an item of the wrong type is `wrong_type`, and for the SemVer and date operators an array with an invalid string is `invalid_value`, even when another element would match.
4. **Existence.** `exists` is true for any present attribute, including `null`, `false`, `0`, `""` and `[]`. `not_exists` is exactly its negation. They never produce `missing`, `null` or `wrong_type`: the outcome is `match` or `no_match`.
5. **Segments.** `not_in_segment` is the plain negation of `in_segment`, because membership is always computable.

An invalid SemVer or date literal in a snapshot condition is a snapshot error, not an outcome.

## Equality and membership

- `eq` and `neq` compare a listed value of one type with an attribute of the same type: strings with strings, numbers with numbers, booleans with booleans. Any other pairing is `wrong_type`.
- `in` and `not_in` take values of one type, string or number. A boolean attribute is `wrong_type`.
- `ignoreCase` has no effect on these operators.

## String matching

- `starts_with`, `ends_with` and `contains` compare the UTF-8 bytes of the attribute with the UTF-8 bytes of each listed value. A listed empty string matches every string.
- `ignoreCase: true` folds the ASCII letters A to Z to a to z in both the attribute and the listed values before comparing. No other character is folded: É stays distinct from é, the Kelvin sign U+212A from `k`, and the dotted capital İ U+0130 and dotless ı U+0131 from `i`. `ignoreCase` has no effect on any other operator.

## Numbers

- Numbers are IEEE 754 binary64. `20`, `20.0` and `2e1` are the same value, and `-0` equals `0`.
- A number whose value is an integer with magnitude above 2^53 − 1, however it is written (`9007199254740993`, `9.007199254740992e15`, `1e300`), is outside the safe range. In a context it is `wrong_type` for every numeric operator, including `gt` and `neq`. In a snapshot it is invalid. Values that need more precision are sent as strings, to which no numeric operator applies.
- NaN and infinities cannot be written in JSON and are rejected if a language can construct them. A number literal too large for binary64, such as `1e999`, reads as infinity: in a context it makes the context invalid, and in a snapshot it is rejected with the code `UNSAFE_NUMBER`.

## Strings

- Strings must be valid UTF-8. They are compared byte for byte, without normalization or case folding: `José` in NFC and in NFD are different values.
- Lengths and limits count UTF-8 bytes.

## SemVer

- `MAJOR.MINOR.PATCH` with optional `-prerelease` and `+build`, following SemVer 2.0.0. No leading zeros in numeric identifiers, no `v` prefix, and every numeric identifier, including numeric pre-release identifiers, is at most 2^53 − 1. Identifiers use the ASCII letters, digits and hyphen only. `4.2` and `v4.2.0` are invalid.
- Precedence follows section 11 of SemVer 2.0.0: numeric identifiers compare as numbers, alphanumeric ones in ASCII order, numeric ones rank below alphanumeric ones, and a longer list of identifiers ranks above its prefix. Build metadata is ignored, so `1.0.0+a` equals `1.0.0`. A pre-release has lower precedence than its release.
- A SemVer string is at most 256 UTF-8 bytes; a longer string is not a valid SemVer, in a snapshot (`INVALID_VALUE`) and in a context (`invalid_value`).
- `semver_eq` and `semver_neq` compare by precedence. An attribute that is a string but not a valid SemVer has the outcome `invalid_value`, which is false for every `semver_*` operator, negated or not.

## Dates

- A date is an RFC 3339 instant: `YYYY-MM-DDTHH:MM:SS[.fraction](Z|±HH:MM)` with uppercase `T` and `Z`, seconds 00 to 59, and a fraction of 1 to 9 digits. The offset is `Z` or `±HH:MM` with hours 00 to 23 and minutes 00 to 59. The month and day must exist in the proleptic Gregorian calendar, including leap years. A date without a time or offset is invalid.
- Instants are converted to milliseconds since the Unix epoch with integer arithmetic, truncating the fraction to milliseconds by its digits (so `.9999` is `.999`, also before 1970), so that every language agrees without a date library.
- `before` is true when the attribute instant is strictly earlier than the listed instant, `after` when strictly later. Equal instants match neither. An attribute that is a string but not a valid date has the outcome `invalid_value`.
