#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUT=${1:-"$ROOT/research/output/reproducible"}
mkdir -p "$OUT"
node "$ROOT/research/bin/generate-synthetic.js" --output "$OUT/observations.jsonl" --seed 42
node "$ROOT/research/bin/validate-dataset.js" --input "$OUT/observations.jsonl" > "$OUT/validation.json"
node "$ROOT/research/bin/dataset-stats.js" --input "$OUT/observations.jsonl" --output "$OUT/stats.json"
node "$ROOT/research/bin/build-cases.js" --input "$OUT/observations.jsonl" --output "$OUT/cases.jsonl" --history-seconds 180 --horizon-seconds 600 --anchor-stride-seconds 60 --sync-tolerance-seconds 5 --max-range-nm 6 --minimum-history-samples 4
node "$ROOT/research/bin/split-cases.js" --input "$OUT/cases.jsonl" --output "$OUT/splits" --seed ais-guard-paper-v1 --train 0.6 --validation 0.2 --test 0.2
node "$ROOT/research/bin/benchmark.js" --input "$OUT/splits/test.jsonl" --output "$OUT/benchmark-test.json" --config "$ROOT/research/config/synthetic-benchmark.json"
node "$ROOT/research/bin/manifest.js" --output "$OUT/manifest.json" --files "$OUT/observations.jsonl,$OUT/cases.jsonl,$OUT/splits/split.json,$OUT/splits/test.jsonl,$OUT/benchmark-test.json,$ROOT/research/config/synthetic-benchmark.json" --command "research/reproduce-synthetic.sh"
printf '%s\n' "Reproducible experiment written to $OUT"
