# Collision-Risk Model

## Scope

AIS Guard computes advisory risk from current relative motion and, optionally, a majority ensemble of standardized trajectory predictors. The output states are `none`, `warn`, `alarm`, and `unknown`; they are operational categories, not probabilities.

## Analytical CPA/TCPA

Own ship and target are represented in a local east/north plane. SOG and true COG become velocity vectors. With relative position `r` and relative velocity `v`, analytical TCPA is `-(r·v)/||v||²`, and CPA is relative separation at that epoch. Negative TCPA denotes an opening encounter under the constant-velocity assumption.

## Common threshold classifier

The same classifier is applied to analytical metrics and to every eligible predictor report. Current range at or below `immediateRangeNm` is an alarm. Otherwise a future CPA within `maxTcpaMinutes` is `alarm` at or below `alarmCpaNm`, `warn` at or below `warnCpaNm`, and `none` outside those conditions. Slow contacts outside immediate range and contacts beyond the monitoring range are filtered according to configuration.

## Predictive majority

When predictive mode is enabled, each registered predictor estimates CPA/TCPA independently under AGTPI v1. After confidence gating, each report is classified by the common thresholds. For `N` eligible reports, the ensemble is alarm if more than half vote alarm; otherwise warning if more than half vote warning-or-alarm; otherwise none when a strict majority votes none. An even split produces no majority and uses analytical fallback. If eligible reports are fewer than `predictionMinimumVotes`, the analytical assessment is used as fallback.

Majority voting is categorical. The exposed median predicted CPA/TCPA does not determine risk.

## Validity limits

Analytical CPA/TCPA assumes constant velocity. Built-in predictors relax selected assumptions but remain extrapolations of observed motion. Majority voting cannot compensate for common-mode input errors or correlated model assumptions. A clear result therefore means only that the configured criteria were not satisfied by the admissible evidence at that instant.

Own-vessel and target navigation evidence is eligible only while it is within `targetStaleSeconds`. If own-vessel navigation becomes stale, AIS Guard abstains until fresh own-vessel data arrives; it does not reuse the last known motion to infer that an encounter is safe. Input timestamps ahead of the server clock are clamped to receipt time before freshness and predictor-history calculations.
