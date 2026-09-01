# Reproducible Predictor Research Protocol

## 1. Scope and reproducibility objective

This protocol defines how to reproduce AIS Guard trajectory-predictor experiments outside Signal K. Reproducibility means that a third party possessing the same legally available source data, mapping, source revision, configuration, and software revision can reconstruct the same normalized observations, encounter partitions and deterministic predictor outputs within the numerical precision of the declared platform.

The protocol distinguishes **computational reproducibility** from **scientific validity**. Re-running a command and obtaining the same numbers proves neither that AIS observations are unbiased nor that an encounter sample represents operational traffic. Dataset representativeness, sampling bias, geographic transferability and model validity require separate analysis.

## 2. Prerequisites

Use Node.js 20 or later. No Python environment, database or research-only npm dependency is required. Begin from a clean repository checkout and record the Git commit. Do not benchmark edited copies of predictor code outside `plugin/predictors/`; the harness intentionally imports production AGTPI implementations directly.

Run the software quality baseline first:

```sh
npm ci --ignore-scripts
npm test
npm run lint
```

## 3. Verify the reference pipeline

Before using an external dataset, run the deterministic synthetic experiment:

```sh
./research/reproduce-synthetic.sh
```

The command creates `research/output/reproducible/` containing normalized observations, validation and descriptive statistics, encounter cases, deterministic splits, the test benchmark and a SHA-256 manifest. This dataset is intentionally synthetic and must not be used to claim real-world predictive performance; its purpose is pipeline verification and regression testing.

To test byte-level repeatability of deterministic artifacts, run the script twice into different directories and compare hashes of `observations.jsonl`, `cases.jsonl`, `splits/*.jsonl`, and `benchmark-test.json` after ignoring the report's `generatedAt` field. The provenance manifest itself contains a creation time and is therefore not byte-identical by design.

## 4. Acquire and document a real AIS dataset

Do not place an undocumented AIS dump directly into the benchmark. Record at minimum the data provider, release/version or acquisition interval, geographic coverage, sampling characteristics, licence/terms, access date, and any filtering already applied by the provider. If the data are not redistributable, publish the acquisition procedure and checksums where licensing permits.

Raw AIS may contain privacy-sensitive or commercially sensitive movement histories. Apply institutional governance and applicable legal requirements. Pseudonymizing MMSI does not anonymize a trajectory by itself because space-time movement can remain identifying.

## 5. Define an explicit source mapping

Create a mapping file based on `research/config/example-mapping.json`. The mapping must identify timestamp, MMSI, latitude, longitude, SOG, COG and units. Example source conventions use knots and degrees; the canonical research representation uses SI speed and radians.

```sh
cp research/config/example-mapping.json research/config/my-dataset-mapping.json
```

Edit the copy and commit it when licensing permits. The mapping is part of the experimental method.

## 6. Normalize the source data

For CSV:

```sh
node research/bin/prepare-dataset.js \
  --input /path/to/source.csv \
  --mapping research/config/my-dataset-mapping.json \
  --source "provider-release-id" \
  --output research/data/my-dataset.jsonl
```

JSONL sources are accepted by the same command. Normalization converts timestamps to epoch milliseconds, SOG to metres per second, COG to radians, validates geodetic bounds, sorts observations, and removes duplicate `(MMSI,time)` observations.

If pseudonymization is required, prefer `--pseudonym-salt-file /secure/path/salt.txt`; `--pseudonym-salt` is provided for disposable experiments but can leak into shell history. Keep the salt outside publications and source control when re-identification resistance matters. This facility does not remove coordinates or times.

## 7. Register dataset identity and integrity

After normalization, add the dataset to an experiment catalogue:

```sh
node research/bin/catalog.js \
  --catalog research/datasets.json \
  --add research/data/my-dataset.jsonl \
  --name my-dataset-v1 \
  --source "provider-release-id" \
  --license "dataset licence/terms"

node research/bin/catalog.js --catalog research/datasets.json --verify
```

The catalogue stores the SHA-256 digest and byte size so accidental replacement of a named dataset becomes detectable. The catalogue does not copy data and is not a substitute for institutional data governance.

## 8. Validate and characterize the normalized dataset

```sh
node research/bin/validate-dataset.js \
  --input research/data/my-dataset.jsonl \
  > research/output/my-validation.json

node research/bin/dataset-stats.js \
  --input research/data/my-dataset.jsonl \
  --output research/output/my-stats.json
```

A failed validation must be resolved upstream; benchmark code must not silently coerce invalid latitude, speed or timestamp values. Inspect vessel counts, coverage interval and per-vessel observation counts before building encounters. Scientific studies should add domain-specific quality analysis such as sampling-gap distributions, impossible accelerations, duplicate receivers, terrestrial/space AIS mixing and known message-decoding limitations.

## 9. Construct causal encounter cases

Choose a history window and prediction horizon before inspecting test results. The following example uses 180 s of history and 600 s of future reference:

```sh
node research/bin/build-cases.js \
  --input research/data/my-dataset.jsonl \
  --output research/output/my-cases.jsonl \
  --history-seconds 180 \
  --horizon-seconds 600 \
  --anchor-stride-seconds 60 \
  --sync-tolerance-seconds 5 \
  --max-range-nm 6 \
  --minimum-history-samples 4
```

At every case anchor the predictor receives only observations at or before the anchor. Future observations exist only in the evaluation part of the case. The reference CPA is the minimum synchronized observed separation within the declared future horizon. Therefore case horizon and predictor benchmark horizon should normally match.

## 10. Produce deterministic leakage-resistant partitions

```sh
node research/bin/split-cases.js \
  --input research/output/my-cases.jsonl \
  --output research/output/my-splits \
  --seed study-v1 \
  --train 0.60 --validation 0.20 --test 0.20
```

The splitter hashes and orders **groups**, not individual windows, then applies deterministic quotas. All cases with the same vessel-pair/day `groupId` remain in the same partition. Keep `split.json` with the study artifacts.

For a learned model, use `train` for parameter fitting, `validation` for model/hyperparameter selection, and touch `test` only after the method is frozen. Kinematic built-ins require no fitting; retaining the same split nevertheless supports fair comparison with future learned predictors.

## 11. Freeze benchmark configuration

Copy the default configuration and change it before evaluating the test partition:

```sh
cp research/config/benchmark-defaults.json research/config/study-v1.json
```

Record trajectory horizon/step, motion-estimation bounds, confidence threshold, ensemble quorum, CPA/TCPA thresholds and immediate-range threshold. Do not tune these values on the final test set.

## 12. Benchmark individual predictors and ensemble behavior

```sh
node research/bin/benchmark.js \
  --input research/output/my-splits/test.jsonl \
  --config research/config/study-v1.json \
  --output research/output/study-v1-test.json
```

To isolate selected predictors:

```sh
node research/bin/benchmark.js \
  --input research/output/my-splits/test.jsonl \
  --config research/config/study-v1.json \
  --predictors constant-velocity,adaptive-turn-acceleration \
  --output research/output/study-v1-subset.json
```

The runner executes the production AGTPI modules. It reports predictor coverage/abstention, CPA MAE, TCPA MAE, own and target ADE/FDE, risk confusion matrices, and ensemble decision coverage. Report encounter counts alongside errors; low error computed on a small non-abstaining subset can otherwise be misleading.

## 13. Compare experiments

```sh
node research/bin/compare.js \
  research/output/study-v1-test.json \
  research/output/study-v2-test.json \
  > research/output/v1-v2-comparison.json
```

The comparison is descriptive. Statistical significance, confidence intervals, paired bootstrap analysis, stratification by encounter geometry, and multiple-comparison correction are study-specific and should be added before inferential claims.

## 14. Capture provenance and file integrity

```sh
node research/bin/manifest.js \
  --output research/output/study-v1-manifest.json \
  --files research/data/my-dataset.jsonl,research/output/my-cases.jsonl,research/output/my-splits/split.json,research/output/my-splits/test.jsonl,research/config/study-v1.json,research/output/study-v1-test.json \
  --command "node research/bin/benchmark.js ..."
```

The manifest records SHA-256 checksums, byte sizes, Node version, operating platform and Git commit when the working tree belongs to a Git checkout. Preserve the exact command line separately when secrets must not appear in the manifest.

## 15. Minimum report for a scientific publication

A predictor study should report dataset provenance and licence; exclusion/cleaning criteria; number of vessels, observations and encounter cases; spatial/temporal coverage; sampling characteristics; history and horizon; split unit, ratios and seed; predictor/interface versions; all predictor parameters; abstention and ensemble quorum rules; trajectory and risk metrics; per-class confusion; computational environment; code revision; and limitations concerning AIS as reference evidence.

For ensembles, additionally report pairwise predictor error correlations and disagreement. Majority voting is not evidence independence and vote fraction is not collision probability.

## 16. Replication checklist

A replication is complete only if another researcher can identify the source data, reproduce normalization, verify dataset checksums, regenerate the same encounter IDs and splits, execute the same production predictor versions, recover the published metric tables, and explain any non-deterministic or platform-dependent difference. Missing proprietary data should be clearly distinguished from missing methodological information.
