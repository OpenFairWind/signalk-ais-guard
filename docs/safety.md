# Safety, Validity, and Operational Limitations

AIS Guard is experimental/advisory software, not a certified collision-avoidance, ARPA, conning, or autonomous navigation system. It never commands helm/autopilot output and does not prescribe COLREG manoeuvres.

AIS can be delayed, incomplete, erroneous, spoofed, or absent; non-AIS hazards remain invisible. Both analytical and predictive results therefore inherit source-data limitations.

Stale own-vessel navigation disables risk assessment until fresh evidence is received. Stale or future-dated evidence is never interpreted as proof of a clear encounter; future timestamps are bounded to server receipt time.

The predictor ensemble adds methodological diversity but not sensor diversity. The built-ins share AIS inputs and related kinematic assumptions. Majority agreement is consequently consensus among models, not independent confirmation and not a collision probability. A common-mode data error can affect every predictor simultaneously.

When predictor quorum is unavailable, AIS Guard falls back to analytical CPA/TCPA. This fallback preserves deterministic operation but does not imply that analytical assumptions are valid during manoeuvring.

Maintain proper lookout and use all available means appropriate to the circumstances, including radar/ARPA where fitted. A `none`/clear state proves only that configured criteria were not met by admissible evidence at the current evaluation instant.


## Cartographic prediction overlays

Predicted paths are extrapolations and must be visually distinguished from observed tracks, intended routes, and commanded trajectories. The Freeboard closest-approach marker is an encounter midpoint, not a guaranteed collision position. It is unsafe to infer that a vessel will pass through the drawn line, that the target has declared that intent, or that a displayed avoidance geometry satisfies COLREG obligations.


## Anchored and moored operation

Being anchored or moored does not remove collision exposure. AIS Guard therefore continues monitoring moving AIS contacts during station keeping. Its zero-velocity own-vessel model is an approximation: an anchored vessel may swing, sheer, drag, or move within a mooring field. Anchor-watch notifications and AIS collision notifications represent different hazards and neither is used to suppress the other.

If the anchor watch reports dragging, operators must not infer that AIS Guard's traffic assessment accounts for the future drag trajectory. The collision engine uses the latest observed own position and reevaluates on subsequent cycles.
