# Testing, Verification, and Validation

## Software verification

The automated suite covers plugin lifecycle/schema defaults, analytical geometry/risk thresholds, predictor kinematics, AGTPI registry conformance, duplicate-ID rejection, report normalization, confidence abstention, quorum, ordinal majority semantics, notifications, REST/OpenAPI exposure, and WebApp-facing snapshots.

Release candidates must pass `npm ci --ignore-scripts`, `npm run build`, `npm test`, `npm run lint`, `npm audit --audit-level=high`, and `npm pack --dry-run`.

The GitHub Actions CI workflow runs this quality gate for every pull request targeting `main` and every push to `main`.

## Local Signal K integration smoke test

Pack the workspace with `npm pack`, install that tarball into a disposable or development Signal K instance, and restart the server. In **Apps & Plugins → Configuration**, confirm that AIS Guard is enabled, its complete schema renders, and its initial status reports that it is waiting for navigation data. Open `/signalk-ais-guard/` and exercise sort direction, risk filtering, and search; the page must continue refreshing without browser console errors. Verify `/plugins/signalk-ais-guard/targets` through the WebApp or an authenticated read-only request.

The screenshots in this documentation were captured from this flow on Signal K Server 2.31.1 with Node.js 24.19.0. The default development endpoint is HTTP; `https://localhost:3000` is valid only when a TLS proxy or Signal K TLS configuration is present.

## Predictor conformance

Every AGTPI predictor requires deterministic fixtures for success and abstention, finite-unit checks, confidence bounds, malformed-history handling, and evidence that input is not mutated. Predictors with learned parameters additionally require versioned model provenance and validation artifacts.

## Ensemble validation

Testing the ensemble requires more than checking majority arithmetic. Research validation should measure quorum availability, abstention frequency, predictor disagreement, pairwise error correlation, confusion matrices for final risk states, false alarms, missed alerts, and sensitivity to thresholds. Comparisons should stratify by encounter geometry, vessel class/speed, AIS sampling pattern, and forecast horizon.

A majority ensemble should not be claimed superior solely because more algorithms agree. Correlated methods may reproduce the same failure mode.


## Plotter-extension and overlay verification

Automated tests verify manifest API version/capability declarations and verify that a predictive hazardous encounter produces a valid ResourceSet containing representative own and target LineStrings plus a closest-approach Point. Browser-host integration should additionally be exercised against a current Freeboard-SK instance to confirm discovery, custom-resource activation, style rendering, reload behaviour, and authentication boundaries.

## Research-harness verification

The software test suite additionally verifies canonical unit normalization, deterministic observation deduplication, strict causal separation between predictor history and future reference observations, group-level split integrity, and execution of the production AGTPI modules without a Signal K server. The reference research pipeline can be exercised with `npm run research:reproduce`.

Software tests establish implementation invariants; dataset benchmarks establish empirical behavior. A predictor change is not validated solely because unit tests pass, and an empirical improvement is not accepted if it breaks interface, safety, determinism, or abstention invariants. See `reproducibility.md`.


## Anchor-watch interoperability tests

The plugin tests cover modern `navigation.anchor.state`, legacy anchor-position-only operation, `navigation.state=moored`, and explicit anchor-off behavior. Changes to station-keeping detection or effective own-vessel motion MUST retain tests proving that position-only guarding is available only with explicit station-keeping evidence and that ordinary underway motion is not silently replaced with zero velocity.
