# Architecture

## Design objective

Signal K AIS Guard is an advisory collision-risk research/engineering system whose architecture separates observation acquisition, analytical CPA/TCPA, trajectory prediction, predictor normalization, ensemble voting, notification lifecycle, and presentation. The separation is intended to make safety-relevant numerical behavior independently testable and methodologically traceable.

Runtime dependencies remain zero. `plugin/index.js` owns the Signal K lifecycle, vessel state/history, configuration, scheduling, risk orchestration, notifications, REST snapshot, and predictor registry. `plugin/risk.js` implements local-plane geometry and analytical CPA/TCPA. `plugin/predictors/` implements the versioned AGTPI contract, built-in predictors, report normalization, and ensemble voting. `plugin/predictor.js` remains a compatibility facade for v1.2-era consumers/tests.

## Data flow

`Signal K deltas -> bounded vessel histories -> analytical CPA/TCPA + registered AGTPI predictors -> common risk classifier -> majority ensemble -> notifications/API -> WebApp + Plotter Extension + ResourceSet overlay`

Own vessel and AIS contacts consume `navigation.position`, `navigation.speedOverGround`, and `navigation.courseOverGroundTrue`. Own vessel additionally consumes `navigation.anchor.state`, `navigation.anchor.position`, selected anchor-watch metadata, and `navigation.state` so collision guarding remains operational in anchored/moored station-keeping modes. Identity metadata (`name`, `mmsi`) is presentation-only. Navigation freshness is derived from navigation observation timestamps, not identity updates.

## Station-keeping adapter

Before analytical or predictive evaluation, AIS Guard constructs an effective own-vessel record. Underway operation uses measured SOG/COG unchanged. Explicit anchored/moored operation may use a zero-velocity own model at the latest GNSS position, preventing undefined/unstable COG and GPS jitter from disabling or distorting the guard. This adapter is read-only and independent from the anchor-watch alarm lifecycle. See `anchor_watch_integration.md`.

## Analytical baseline

The classical estimator maps relative geographic displacement to a local east/north plane and uses relative velocity. For relative position `r` and velocity `v`,

\[
t_{CPA}=-\frac{r\cdot v}{\|v\|^2}.
\]

CPA is separation at that time. The analytical estimate remains available at all times and is the fallback whenever the predictive ensemble is disabled or cannot form the configured quorum.

## Predictor subsystem

AGTPI v1 specifies a synchronous, local, side-effect-free predictor object with stable identity/version and a `predict()` method. Predictors return either a normalized closest-approach estimate plus confidence or an explicit abstention. They never set thresholds, mutate state, or publish notifications.

A per-plugin registry validates predictor conformance and rejects duplicate IDs. Three transparent built-ins are registered by default: constant velocity, constant turn rate, and adaptive turn/acceleration. Future predictors may register through `plugin.registerTrajectoryPredictor()` without changing ensemble code.

## Majority ensemble

The core applies the common `classifyRisk()` function to each eligible report. Reports below the confidence threshold abstain. If quorum is met, the final predictive risk is the ordinal majority: alarm requires an alarm majority; warning requires a majority at least warning; otherwise the result is none only with a strict none majority; an even split produces `unknown` and analytical fallback. If quorum is not met, the analytical CPA/TCPA result is used.

This architecture intentionally avoids averaging model-specific CPA values into a synthetic probability. Median ensemble CPA/TCPA/confidence are exposed only as descriptive summaries.

## Failure containment

Each predictor executes behind validation and exception containment. Invalid outputs, exceptions, insufficient evidence, and low confidence become abstentions. A single predictor cannot terminate evaluation. Unavailable quorum is explicit and results in analytical fallback. Histories are bounded, prediction horizons are bounded, and AGTPI v1 prohibits network calls in the voting path.

## Presentation

The read-only WebApp consumes `/plugins/signalk-ais-guard/targets`. It does not reproduce collision mathematics. The API exposes analytical metrics, ensemble summary, vote counts, per-predictor reports, and representative trajectory data so model disagreement remains inspectable rather than hidden.

Freeboard-SK integration is host-API conservative. AIS Guard registers a Plotter Extensions API v1 manifest for its widget/panel/button and separately publishes predicted geometry as a read-only `aisGuardRiskOverlay` ResourceSet. The extension does not reach into Freeboard OpenLayers internals and does not misuse the live-route API for ephemeral prediction graphics. See `freeboard_extension.md`.

## Reproducibility

Any numerical change to a predictor requires a predictor-version change when semantics materially change, deterministic tests, methodological documentation, and changelog entry. Ensemble algorithm changes require dedicated voting tests and documentation because risk output may change even when every predictor is unchanged.

## Offline research architecture

The `research/` tree is intentionally outside the Signal K runtime but imports predictor modules directly from `plugin/predictors/`. The offline flow is:

`source AIS -> explicit mapping/unit normalization -> canonical JSONL -> validation/statistics -> causal encounter cases -> group-level split -> production AGTPI predictors -> trajectory/risk metrics -> provenance manifest`.

This prevents research-only copies of predictor mathematics from drifting away from operational code. Dataset adapters and evaluation code may evolve independently of the plugin lifecycle, while predictor identity/version and AGTPI report semantics remain shared. Research outputs are artifacts, not plugin state, and should not be packaged as authoritative model claims without the protocol in `reproducibility.md`.
