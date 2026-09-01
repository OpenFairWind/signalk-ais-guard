# Changelog

## [Unreleased]

### Documentation
- Added runtime, ensemble, predictor-interface, station-keeping, and research-pipeline diagrams.
- Replaced documentation images with screenshots captured from the packaged plugin running in Signal K Server 2.31.1.
- Documented the default local WebApp URL and clarified that HTTPS requires a configured TLS endpoint.

## [1.6.0] - 2026-09-01

### Added
- Read-only anchor-watch interoperability through `navigation.anchor.state`, `navigation.anchor.position`, anchor metadata, and `notifications.navigation.anchor`.
- `navigation.state=anchored|moored` interoperability for state-estimation plugins.
- Station-keeping effective own-vessel model that keeps CPA/TCPA and trajectory prediction available with position-only own data while explicitly anchored/moored.
- WebApp/API exposure of `ownVesselMode`, `anchorWatchActive`, and navigation state.
- Dedicated academic integration guide in `docs/anchor_watch_integration.md` and four automated interoperability scenarios.

### Safety
- Anchor-watch and AIS collision alarms remain independent; AIS Guard never controls or acknowledges the anchor-watch plugin.
- Missing underway motion data is never treated as stationary without explicit station-keeping evidence or measured near-zero SOG.


All notable changes to this project will be documented in this file.

## 1.5.0 - 2026-09-01

### Added
- Dependency-free `research` harness for AIS dataset normalization, validation, statistics, causal encounter-case generation, deterministic leakage-resistant splitting, predictor/ensemble benchmarking, experiment comparison, provenance manifests, and synthetic data generation.
- Step-by-step reproducibility protocol in `docs/reproducibility.md`.
- Deterministic synthetic reference experiment via `research/reproduce-synthetic.sh`.
- Research metrics for CPA/TCPA error, own/target ADE/FDE, coverage/abstention, ensemble decision coverage, and ordinal risk confusion matrices.
- Automated research-pipeline tests proving production AGTPI predictors can be evaluated without Signal K.

### Research methodology
- Predictor history and observed future reference are causally separated at each anchor time.
- Splits operate on vessel-pair/day groups to reduce temporal leakage; stronger study-specific grouping remains recommended where required.
- Reproducibility manifests record SHA-256 hashes, runtime/platform and Git commit when available.
- Documentation distinguishes AIS reference observations from error-free ground truth and computational reproducibility from scientific validity.

## [1.4.0] - 2026-09-01

### Added
- Signal K Plotter Extensions API v1 manifest with AIS Guard risk widget, inspection panel, and map-toolbar button.
- Dynamic read-only `aisGuardRiskOverlay` Freeboard ResourceSet with representative own-vessel path, hazardous-target paths, and predicted closest-approach encounter points.
- Optional AGTPI report geometry (`ownPath`, `targetPath`, CPA positions and encounter midpoint) with predictor provenance.
- Independent configuration switches for overlay publication, own path, risky target paths, and closest-approach points.
- Academic integration specification in `docs/freeboard_extension.md`.

### Methodology
- Final predictive risk remains the ordinal majority vote. Cartographic trajectory selection is separate: the highest-confidence eligible path-bearing predictor report is used as the representative visualization hypothesis with deterministic predictor-id tie breaking.
- The displayed encounter point is formally defined as the midpoint of predicted own/target positions at representative TCPA; it is not claimed to be a guaranteed collision location.

## [1.3.0] - 2026-09-01

### Added
- Versioned AIS Guard Trajectory Predictor Interface (AGTPI) v1 with validated predictor registration and normalized reports.
- Pluggable predictor registry exposed through `registerTrajectoryPredictor()` / `getTrajectoryPredictors()`.
- Three built-in conformant predictors: constant velocity, constant turn rate, and adaptive turn/acceleration.
- Confidence-based abstention, configurable predictor quorum, per-predictor API reports, and ensemble vote counts.
- Dedicated `docs/trajectory_predictor_interface.md` specification.

### Changed
- Predictive risk is now assessed by an ordinal majority of eligible predictor reports when quorum is available.
- Analytical CPA/TCPA is the explicit fallback when the predictor ensemble cannot form quorum.
- Predicted CPA/TCPA/confidence fields are descriptive medians of eligible reports rather than a single-model result.
- Documentation revised around ensemble methodology, correlated errors, conformance, provenance, and validation.

### Compatibility
- `plugin/predictor.js` remains as a compatibility facade for the v1.2 adaptive predictor API.

## [1.2.0] - 2026-09-01

### Added
- Optional local adaptive trajectory prediction for own vessel and every AIS target using bounded recent position/SOG/COG history.
- Explainable `adaptive-turn-acceleration-v1` predictor with learned turn-rate, learned acceleration, trajectory sampling, predicted CPA/TCPA and confidence scoring.
- Conservative risk fusion: prediction may escalate classical CPA/TCPA risk but never suppress it.
- Prediction fields and risk source in notifications, target API and companion WebApp.
- WebApp sorting by predicted CPA, predicted TCPA and prediction confidence.
- Dedicated predictive-intelligence documentation and predictor unit tests.

### Safety
- Predictive intelligence is disabled by default, runs locally with no network calls or model service, has confidence gating and automatic fallback to classical CPA/TCPA.
- No steering, maneuver recommendation or COLREG decision logic was added.

## [1.1.0] - 2026-09-01

### Added
- Companion read-only Signal K WebApp with live AIS target table and responsive marine display.
- Sorting by risk, distance, CPA, TCPA, name, MMSI, speed and data age, with ascending/descending order.
- Risk filters and name/MMSI/context search.
- `GET /plugins/signalk-ais-guard/targets` normalized target-risk snapshot API.
- OpenAPI 3.0 description for the companion API.
- WebApp documentation and API/route tests.

### Changed
- Package now advertises both Signal K plugin and WebApp capabilities.
- Browser display reuses plugin-side CPA/TCPA and classification results instead of duplicating collision logic.

## 1.0.0 - 2026-09-01

### Added
- Continuous AIS target monitoring through Signal K subscriptions.
- CPA/TCPA collision-risk model with warning, alarm, immediate-range and stale-target controls.
- Managed Signal K notification raise/clear lifecycle with compatibility fallback.
- Defensive schema defaults, lifecycle cleanup, status reporting and zero runtime dependencies.
- Node built-in test suite, documentation, screenshots, CI scaffold and `AGENTS.md`.
