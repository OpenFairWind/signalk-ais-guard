# AGENTS.md

## Mission
Maintain `signalk-ais-guard` as a small, inspectable Signal K advisory collision-risk system with reproducible analytical and ensemble-prediction methods.

## Core invariants
- Preserve the Signal K plugin factory (`id`, `name`, `start`, `stop`, `schema`) and safe `start({})`/restart behavior.
- Keep navigation computation in SI units internally and use public Signal K APIs.
- Never add autonomous steering, manoeuvre recommendations, or claims of COLREG/certification compliance.
- Never treat stale, absent, predictor-abstained, or quorum-deficient evidence as proof of safety.
- Bound histories, horizons, execution, subscriptions, timers, and notifications.
- Keep `public` read-only; collision logic stays server-side.

## Predictor-interface invariants
- AGTPI v1 is `signalk-ais-guard.trajectory-predictor` / `1.0.0`. Do not alter its required semantics without a new interface version.
- Predictors report trajectory outcomes only; they MUST NOT define private risk thresholds or publish notifications.
- New predictors register through the validated registry and require stable `id` plus predictor `version`.
- Predictor failures, invalid output, insufficient evidence, and low confidence become abstentions.
- The ensemble applies the common classifier to every eligible report.
- Final predictive risk uses the documented ordinal majority rule; if `predictionMinimumVotes` quorum is absent, use analytical CPA/TCPA fallback.
- Do not describe vote ratios as probability or model agreement as independent evidence.

## Anchor-watch / station-keeping invariants
- AIS collision monitoring MUST remain available while explicit `navigation.anchor` or `navigation.state=anchored|moored` evidence is present, even if own SOG/COG is unavailable.
- Anchor-watch integration is read-only: never arm/disarm the anchor alarm, modify its radius/zone, acknowledge its notification, or write vessel state.
- Anchor-watch risk and AIS collision risk remain independent; never suppress one because the other is active.
- Never infer that an underway vessel is stationary from missing SOG/COG alone.
- Changes to station-keeping semantics require tests and updates to `docs/anchor_watch_integration.md`, configuration, architecture, and safety documentation.

## Scientific quality
Any change to CPA/TCPA, predictor dynamics, confidence, quorum, majority logic, thresholds, or staleness requires tests plus updates to `docs/risk_model.md`, `docs/predictive_intelligence.md`, `docs/trajectory_predictor_interface.md`, and `docs/safety.md` as applicable. Performance claims require a declared dataset, metrics, baselines, and reproducible procedure. Learned models require training/checkpoint provenance, data-split documentation, calibration/OOD analysis, computational profiling, and licensing/privacy review.

## Quality gate
Run `npm ci --ignore-scripts`, `npm run build`, `npm test`, `npm run lint`, `npm audit --audit-level=high`, and `npm pack --dry-run`. API changes require `plugin/openapi.json` updates and tests.


## Freeboard-SK / Plotter Extension rules

- Use the documented Signal K Plotter Extensions API and ResourceSet contracts; do not access Freeboard-SK DOM/OpenLayers internals.
- Never render predicted paths by creating fake editable routes or by writing predicted coordinates into vessel navigation state.
- Keep majority risk assessment independent from representative-path selection.
- Preserve predictor id/version/confidence provenance on visualization geometry.
- Describe the encounter marker as a predicted closest-approach midpoint unless CPA is explicitly zero within numerical tolerance; do not call it a guaranteed collision point.
- Changes to overlay geometry or AGTPI path fields require tests and corresponding updates to `docs/freeboard_extension.md` and `docs/trajectory_predictor_interface.md`.

## Research and reproducibility rules

- Keep `research` dependency-free unless a research dependency is scientifically necessary and explicitly isolated from plugin runtime dependencies.
- Offline benchmarks MUST import production AGTPI predictors rather than copy predictor algorithms.
- Canonical research observations use epoch-millisecond timestamps, WGS-84 positions, SI speed, and true course in radians. Source-unit assumptions MUST be explicit in a versioned mapping.
- Never permit future observations at or after the case cut to enter predictor history. Tests must protect this causal boundary.
- Dataset splits MUST operate on encounter groups or a stronger study-specific grouping; never randomly split adjacent trajectory windows across train and test.
- Preserve dataset provenance, licence/terms, mapping, checksums, case parameters, split seed, predictor/interface versions, benchmark configuration, source revision, and output artifacts for published experiments.
- Do not call recorded AIS perfect ground truth. State measurement/sampling limitations and distinguish computational reproducibility from scientific validity.
- Learned predictors require train/validation/test discipline; the test partition must not be used for tuning.
- Changes to research formats or metrics require tests and updates to `research/README.md` and `docs/reproducibility.md`.
