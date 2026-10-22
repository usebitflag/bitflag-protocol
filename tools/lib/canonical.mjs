// RFC 8785 (JSON Canonicalization Scheme) for values parsed by JSON.parse.
// JavaScript already formats numbers and escapes strings as the scheme requires; only key order needs work.
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  // Default string sort compares UTF-16 code units, which is the order the scheme specifies.
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}
