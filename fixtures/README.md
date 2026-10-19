# Fixtures

Known-answer conformance fixtures that both evaluators run. `manifest.json` lists every file in this directory (except itself) with its SHA-256 checksum and carries one aggregate checksum, which consumers pin.

Regenerate the manifest after any change with `npm run manifest`. `npm run validate` fails when the manifest is out of date.
