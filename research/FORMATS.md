# Research Artifact Formats

## Versioning principle

Research artifacts carry an explicit `schema` identifier. Readers must reject unknown major formats rather than inferring semantics from field names. Additive fields may be introduced within a format revision when existing fields retain meaning; incompatible semantic changes require a new schema revision.

## Canonical observation — `signalk-ais-guard.research-observation/1`

Required fields are `t` (Unix epoch milliseconds), `mmsi` (string), `position.latitude` and `position.longitude` (WGS-84 decimal degrees), `speed` (SOG, m/s), `course` (true COG, radians), and `source`. Optional source metadata may be retained. Records are sorted by time and MMSI; duplicate `(mmsi,t)` keys resolve deterministically to the last source record during preparation.

## Encounter case — `signalk-ais-guard.research-case/1`

A case contains `id`, `groupId`, `anchorTime`, `own`, `target`, and `truth`. Each vessel contains `history` at or before the anchor and `future` strictly after the anchor. `truth.cpaM` and `truth.tcpaSeconds` are derived only from synchronized observed future samples within the case horizon. They are empirical reference quantities, not error-free physical truth.

## Split manifest — `signalk-ais-guard.split/1`

The split manifest records seed, requested ratios, realized case counts, and grouping policy. Complete `groupId` units are assigned to exactly one of `train`, `validation`, or `test`.

## Benchmark report — `signalk-ais-guard.benchmark/1`

A benchmark report records the predictor configuration, per-predictor identity/version, case count, coverage, abstentions, CPA/TCPA MAE, trajectory ADE/FDE, risk confusion matrices, and ensemble decision coverage. `generatedAt` is provenance metadata and intentionally makes the report non-byte-identical across runs.

## Dataset catalog — `signalk-ais-guard.dataset-catalog/1`

Catalog entries provide a study-local name, path, SHA-256 digest, byte size, source declaration, licence declaration and optional notes. The catalog is not a storage or access-control mechanism.

## Reproducibility manifest — `signalk-ais-guard.reproducibility-manifest/1`

The manifest records artifact paths, byte sizes and SHA-256 digests together with Node version, platform/architecture, Git commit when available, creation time and a declared command. Secrets must not be placed in the command field.
