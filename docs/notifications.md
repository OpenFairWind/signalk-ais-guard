# Notifications

## Lifecycle

AIS Guard maps each target context to one logical Signal K collision-risk notification. Managed Signal K Notifications API calls are preferred; a compatibility delta path remains available. Notifications are deduplicated by severity and cleared only by the plugin instance that created them.

## Evidence

Messages retain current range and analytical CPA/TCPA. When an ensemble is available they also report the ensemble median CPA/TCPA and vote counts in `alarm/warn/none` order. Structured data carry `riskSource`, `predictionVotes`, and ensemble summary fields. The read-only API contains the fuller per-predictor reports.

`riskSource: prediction-ensemble` means quorum was reached and the majority decision was authoritative for predictive mode. If quorum is not reached, the final state uses analytical CPA/TCPA and the reason identifies ensemble fallback.

## Interpretation

Vote counts are counts of model reports, not probabilities and not independent sensor confirmations. A warning/alarm indicates that the configured categorical criterion was met by the active decision path; it is not a manoeuvre instruction or assertion that collision is certain.
