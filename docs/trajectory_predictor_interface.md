# AIS Guard Trajectory Predictor Interface (AGTPI) v1.0

## Status and scope

The **AIS Guard Trajectory Predictor Interface (AGTPI)** is the project-defined, versioned software contract through which independent trajectory-prediction methods participate in collision-risk assessment. It is an internal open interface of `signalk-ais-guard`; it is not an IMO, IEC, IALA, NMEA, or Signal K normative standard. The explicit version identifier permits future incompatible revisions without silently changing the semantics of existing predictors.

The interface separates three concerns that must remain independent for reproducible comparison:

1. a predictor estimates a future closest-approach trajectory outcome from the same admissible observations;
2. AIS Guard applies the common collision-risk thresholds to every eligible predictor report;
3. the ensemble aggregates resulting ordinal risk reports by majority rule.

Predictors therefore do **not** choose warning/alarm thresholds and do not raise notifications directly.

## Interface identity

Every predictor object MUST expose:

```js
{
  interface: 'signalk-ais-guard.trajectory-predictor',
  interfaceVersion: '1.0.0',
  id: 'globally-unique-within-registry',
  version: 'predictor-semver',
  name: 'Human-readable name',
  description: 'Methodological summary',
  predict(input) { ... }
}
```

`id` is the stable algorithm identity used in configuration and reports. `version` identifies the implementation/model revision. Changing numerical semantics SHOULD change the predictor version even if the plugin package version also changes.

The registry rejects malformed predictors and duplicate IDs. Registration is available through `plugin.registerTrajectoryPredictor(predictor)` and returns an unregister function. `plugin.getTrajectoryPredictors()` exposes registered identities for inspection.

## Predictor input contract

`predict(input)` is synchronous in AGTPI v1 and receives:

```js
{
  own,      // bounded own-vessel state and history
  target,   // bounded target state and history
  options,  // common prediction configuration
  now       // evaluation epoch, Unix milliseconds
}
```

`own` and `target` use Signal K SI conventions internally. Current observations contain geographic position, SOG in m/s, true COG in radians, timestamps, and bounded history samples of the same quantities. A predictor MUST treat input as read-only and MUST NOT modify vessel state, configuration, or histories.

A predictor MUST be deterministic for identical input unless its documentation explicitly declares stochastic behavior and a reproducible random-seed mechanism. AGTPI v1 is intended for local bounded inference; network calls, unbounded blocking, or side effects are prohibited in the voting path.

## Predictor output contract

A predictor either reports an estimate or abstains.

Successful report:

```js
{
  status: 'ok',
  reason: 'method-specific-reason-code',
  cpaM: 426.3,
  tcpaSeconds: 312.0,
  confidence: 0.81,
  diagnostics: { /* optional auditable method data */ }
}
```

Abstention:

```js
{
  status: 'abstain',
  reason: 'insufficient-history'
}
```

For `status: 'ok'`, `cpaM` MUST be finite and non-negative; `tcpaSeconds` MUST be finite and non-negative; `confidence` MUST be finite and is normalized to `[0,1]`. `confidence` is an engineering evidence-quality score unless the specific predictor has separately demonstrated probabilistic calibration. It MUST NOT be presented as collision probability by default.

AIS Guard normalizes every result to report schema `signalk-ais-guard.trajectory-predictor/report@1`, attaches predictor identity, converts CPA/TCPA to nautical-mile/minute display units, catches predictor exceptions, and converts failures to abstentions. A faulty predictor therefore cannot terminate the ensemble evaluation loop.

## Common classification

For every eligible `ok` report, the core applies the same `classifyRisk()` function using current range plus that report's predicted CPA/TCPA. This is a methodological control: all predictors are compared under identical operational thresholds. A predictor cannot gain voting influence by defining a private alarm envelope.

Reports below `predictionMinimumConfidence` abstain from voting. `predictionMinimumVotes` defines the quorum. If quorum is not reached, the ensemble result is `unknown` and AIS Guard falls back to the classical analytical CPA/TCPA assessment.

## Ordinal majority rule

The risk states are ordered

\[
\mathrm{none} < \mathrm{warn} < \mathrm{alarm}.
\]

Let `N` be the number of eligible reports. The ensemble evaluates threshold majorities rather than averaging CPA values:

- `alarm` if more than `N/2` reports vote `alarm`;
- otherwise `warn` if more than `N/2` reports vote at least `warn` (`warn` or `alarm`);
- otherwise `none` only if more than `N/2` reports vote `none`;
- if no side has a strict majority (possible with an even number of eligible reports), the ensemble result is `unknown` and the analytical CPA/TCPA fallback is used.

This rule is equivalent to an ordinal majority decision over nested severity thresholds. It avoids assigning artificial metric distances between categorical states. The median CPA/TCPA/confidence exposed by the API is descriptive only; it does **not** determine the vote.

For example, votes `[alarm, warn, none]` yield `warn`, because two of three predictors report at least warning severity. Votes `[alarm, alarm, warn]` yield `alarm`. Votes `[alarm, none, none]` yield `none`.

## Independence and interpretation

Majority agreement is **not** statistical independence. Predictors that consume the same AIS observations, use related kinematic assumptions, or share preprocessing may exhibit strongly correlated errors. Consequently, a 3/3 vote is consensus among implementations, not a calibrated probability and not three independent sensor confirmations.

Scientific evaluation of an ensemble SHOULD report not only individual accuracy but error correlation, disagreement rate, abstention rate, quorum availability, false-alarm/missed-alert behavior, and performance stratified by encounter type and prediction horizon.

## Built-in predictors

Version 1.3.0 registers three AGTPI v1 predictors:

- `constant-velocity` v1.0.0 — numerical propagation of the latest SOG/COG without manoeuvre terms;
- `constant-turn-rate` v1.0.0 — propagation using bounded recent turn-rate while holding speed constant;
- `adaptive-turn-acceleration` v1.0.0 — bounded recent turn-rate and longitudinal-acceleration propagation.

These methods intentionally form a transparent baseline ensemble. They are not claimed to be statistically independent and none is a trained ML model.

## Conformance requirements for new predictors

A new predictor is conformant only if it passes interface validation and has tests demonstrating: valid success output, explicit abstention for insufficient evidence, finite bounded numerics, deterministic behavior for a fixed fixture, no input mutation, bounded execution, and graceful handling of malformed/incomplete vessel histories.

Research-oriented predictors SHOULD additionally document model class, features, training data (if any), parameters/checkpoint identity, geographic and vessel-type scope, horizon-specific validation metrics, uncertainty calibration, out-of-distribution behavior, computational cost, and licensing/privacy constraints.

## Compatibility policy

Additive diagnostics are allowed within AGTPI v1. Changes to required input semantics, mandatory output fields, unit conventions, synchronous execution, or confidence interpretation require a new interface version. The plugin may support multiple interface versions in the future through explicit adapters; silent coercion between incompatible versions is prohibited.

## Optional trajectory geometry

AGTPI v1 reports may additionally provide `ownPath`, `targetPath`, `ownCpaPosition`, `targetCpaPosition`, and `closestApproachPoint`. These fields are optional, backward-compatible report extensions used for inspection and visualization; they do not participate in majority voting. A predictor that cannot provide path geometry remains fully conformant when it reports valid CPA/TCPA/confidence.

A path is an ordered array of `{ seconds, position: { latitude, longitude } }` samples relative to the prediction epoch. `closestApproachPoint` should describe the midpoint of the predicted own/target positions at the reported TCPA when the predictor supplies both positions. Consumers must treat these coordinates as model output, not navigational intent.

The ensemble may select an eligible path-bearing report as a representative visualization hypothesis. Representative-path selection is deliberately separate from risk voting and must preserve predictor identity/version provenance.
