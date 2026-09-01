# AIS Guard Research Harness

## Purpose

The `research/` tree is a dependency-free experimental environment for preparing AIS trajectory datasets and evaluating AGTPI predictors independently of a running Signal K server. It separates data engineering, encounter construction, predictor execution, metric calculation, and provenance capture so that an experiment can be repeated from declared inputs rather than reconstructed from plugin runtime state.

The harness deliberately imports the production predictor modules from `plugin/predictors/`. Consequently, an algorithm evaluated here is the same implementation used by the plugin; research and operational code paths do not maintain duplicate mathematical models.

## Canonical observation format

Prepared datasets are newline-delimited JSON (`JSONL`). Each line conforms to `signalk-ais-guard.research-observation/1` and contains epoch-millisecond time `t`, MMSI, WGS-84 position, SOG in metres per second, and true COG in radians. Optional source-specific fields may be retained. Normalization at the dataset boundary prevents unit conventions from leaking into predictor code.

## Tools

`bin/prepare-dataset.js` converts CSV or JSONL source records using an explicit mapping; `validate-dataset.js` checks schema and numerical admissibility; `dataset-stats.js` produces descriptive inventory; `catalog.js` records named dataset versions, licences/sources and SHA-256 integrity; `build-cases.js` creates strictly separated history/future encounter cases; `split-cases.js` performs deterministic group-level train/validation/test partitioning; `benchmark.js` runs production AGTPI predictors and the ensemble; `compare.js` compares two benchmark reports; `manifest.js` records SHA-256 hashes, Node/platform information, Git commit when available, and the declared command; `generate-synthetic.js` creates a deterministic public test fixture.

`reproduce-synthetic.sh` executes the entire reference experiment in one command.

## Dataset preparation

A source mapping is data provenance, not boilerplate. Copy `config/example-mapping.json` and explicitly identify the source timestamp, MMSI, latitude, longitude, SOG and COG columns and their units. Do not silently assume knots versus metres per second or degrees versus radians.

Example:

```sh
node research/bin/prepare-dataset.js \
  --input raw/ais.csv \
  --mapping research/config/example-mapping.json \
  --source "declared-dataset-release" \
  --output research/data/observations.jsonl
```

For restricted data, the optional `--pseudonym-salt` or safer `--pseudonym-salt-file` argument replaces MMSI with stable experiment-local pseudonyms. This is only a minimization aid; trajectory coordinates and times may remain identifying and must still be handled according to the source licence, ethics approval, institutional policy, and applicable law.

## Encounter cases and leakage control

`build-cases.js` creates an anchor time, a past-only history for each vessel, and a future-only reference trajectory. The future is never supplied to the predictor. Cases carry `groupId = vessel-pair + UTC day`. `split-cases.js` assigns complete groups to one partition using a deterministic seed. Thus adjacent windows from the same pair/day are not randomly distributed between training and test data.

For learned predictors, additional grouping (for example by voyage, geographic region, vessel identity, or time block) may be scientifically necessary. The built-in pair/day grouping is a minimum anti-leakage policy, not a universal guarantee of independence.

## Metrics

For each predictor the benchmark reports coverage/abstention, CPA mean absolute error, TCPA mean absolute error, own-vessel ADE/FDE, target ADE/FDE, and an ordinal risk confusion matrix. The same risk thresholds are applied to every predictor. Ensemble output reports decision coverage, no-decision count and its confusion matrix.

Trajectory ADE/FDE are computed against observed future AIS positions by interpolating the predictor's sampled path. Observed AIS is treated as reference evidence, not perfect ground truth; sensor, timestamp, transmission and preprocessing error remain sources of uncertainty.

## Reproducibility contract

A publishable experiment should retain: raw-data release identifier and licence; mapping file; preparation command; normalized dataset checksum; case-construction parameters; split seed and split manifest; predictor IDs/versions and AGTPI version; benchmark configuration; Node version and host platform; source Git commit; benchmark outputs; and a generated SHA-256 manifest.

See `docs/reproducibility.md` for the complete step-by-step protocol.

## Dataset catalogue

Register a prepared dataset and its provenance metadata:

```sh
node research/bin/catalog.js --catalog research/datasets.json --add research/data/observations.jsonl --name study-v1 --source "provider/release" --license "declared terms"
node research/bin/catalog.js --catalog research/datasets.json --verify
```

The catalogue is an integrity/provenance index, not a data warehouse. It stores paths and hashes and never copies the source dataset.
