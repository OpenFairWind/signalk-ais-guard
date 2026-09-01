# Configuration

![AIS Guard configuration schema rendered by Signal K](screenshots/configuration.png)

## Principle

Configuration is part of the computational method. Every schema property has a default to support deterministic Signal K registry activation. Internally, Signal K navigation values remain SI; operator-facing thresholds use nautical miles, knots, minutes, and degrees where appropriate.

## Analytical parameters

`evaluationIntervalSeconds` controls evaluation cadence. `targetStaleSeconds` excludes old navigation observations. `maxTargetRangeNm` bounds monitoring. `warnCpaNm`, `alarmCpaNm`, and `immediateRangeNm` define the risk envelope. `maxTcpaMinutes` defines the future horizon. `minimumTargetSpeedKnots` suppresses non-immediate predictive assessment for nearly stationary contacts.

## Notification parameters

`notificationMethods` supplies compatibility methods; `includePosition` controls managed-notification position inclusion; `repeatMinutes` controls repetition of unchanged hazards.

## Predictor-ensemble parameters

`predictiveAiEnabled` enables the AGTPI ensemble; it remains false by default. The historic property name is retained for configuration compatibility even though current built-ins are deterministic kinematic methods rather than trained AI.

`predictionPredictors` is the ordered set of registered predictor IDs selected for evaluation. Defaults are `constant-velocity`, `constant-turn-rate`, and `adaptive-turn-acceleration`. The schema accepts future registered IDs rather than hard-coding an enum.

`predictionMinimumVotes` defines quorum. The default is 2: fewer than two eligible reports causes analytical CPA/TCPA fallback. `predictionMinimumConfidence` controls report eligibility; a lower score abstains from voting.

`predictionHistorySeconds`, `predictionMinimumSamples`, and `predictionMinimumHistorySeconds` control admissible recent history. `predictionHorizonMinutes` and `predictionStepSeconds` control numerical projection. `predictionMaxTurnRateDegreesPerMinute` and `predictionMaxAccelerationMps2` bound learned kinematic terms.

## Tuning cautions

Reducing quorum or confidence increases ensemble availability but also increases dependence on fewer models. Increasing quorum can increase analytical fallbacks when AIS updates are sparse. Adding many highly correlated predictors may create the appearance of stronger consensus without adding independent information; predictor count should therefore not be treated as an evidence-quality metric by itself.


## Freeboard-SK visualization

`freeboardRiskOverlayEnabled` publishes or suppresses all GeoJSON features in the live `aisGuardRiskOverlay` ResourceSet. `freeboardOverlayOwnPath`, `freeboardOverlayRiskyPaths`, and `freeboardOverlayClosestApproachPoints` control representative own-vessel path, hazardous-target paths, and encounter-point markers respectively. These switches control publication; Freeboard-SK also requires the operator to enable the custom resource type/layer explicitly. Predictive intelligence must be enabled and have eligible path-bearing reports before path features exist.


## Anchor-watch and station-keeping parameters

`anchorWatchIntegrationEnabled` enables read-only interpretation of `navigation.anchor.state` and `navigation.anchor.position`. It is enabled by default.

`stationKeepingGuardEnabled` keeps collision assessment available when an explicit anchored/moored state is present even if own SOG/COG is unavailable. `stationKeepingSpeedThresholdKnots` defines the near-zero SOG threshold at which missing COG may be tolerated. `stationKeepingForceZeroOwnSpeed`, enabled by default, suppresses GPS-jitter motion in the effective own-vessel model when the vessel is explicitly anchored or moored.

These settings do not arm, configure, acknowledge, or clear an anchor-watch alarm. See `anchor_watch_integration.md`.
