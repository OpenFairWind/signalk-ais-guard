# Anchor-watch and station-keeping integration

## Objective

AIS Guard MUST remain an active traffic guard when own vessel is anchored or moored. A stationary vessel can still be exposed to collision risk from moving traffic, and the absence or instability of own-vessel course over ground at zero speed is not evidence that risk assessment should stop.

The integration is deliberately read-only. AIS Guard neither arms nor disarms an anchor alarm, changes an anchor radius, nor writes `navigation.state`. It consumes station-keeping evidence published by other Signal K components and uses that evidence only to choose an appropriate own-vessel motion model.

## Recognized Signal K evidence

AIS Guard recognizes the modern anchor-watch convention `navigation.anchor.state` together with `navigation.anchor.position`. An active state such as `on`, `active`, or `watching` declares an anchored guard condition. For compatibility with anchor-watch implementations that expose no explicit state, a non-null `navigation.anchor.position` is treated as anchor-set evidence unless an explicit off/raised state is present.

AIS Guard also consumes `navigation.state`. Values `anchored` and `moored` are treated as explicit station-keeping states. This enables direct interoperability with state-estimation plugins such as `@meri-imperiumi/signalk-autostate` without introducing a plugin-specific API dependency.

`navigation.anchor.currentRadius`, `navigation.anchor.maxRadius`, and `notifications.navigation.anchor` are observed for integration/provenance but do not alter AIS collision thresholds. Anchor-drag risk and AIS collision risk remain separate safety functions.

## Effective own-vessel model

When an explicit anchored or moored state is present and `stationKeepingForceZeroOwnSpeed=true`, the collision engine evaluates incoming AIS traffic against an effective own-vessel velocity of zero at the latest own position. The course is set to a neutral numerical value because course is undefined at zero velocity and has no effect on the analytical velocity vector.

For trajectory predictors, recent own-vessel history is transformed into a stationary-motion history while preserving observation times and positions. This prevents GPS-jitter SOG/COG from being interpreted as intentional own-vessel manoeuvring while retaining temporal evidence for predictor confidence calculations. Target trajectories remain unchanged.

This is a modelling assumption, not a statement that the vessel cannot swing, sheer, drag, or move within a mooring/anchor watch zone. The latest GNSS position is continuously used, so movement appears through subsequent evaluation cycles.

## Near-stationary fallback

When no explicit anchored/moored state exists, normal SOG/COG is used whenever available. If SOG is at or below `stationKeepingSpeedThresholdKnots`, AIS Guard may tolerate an unavailable COG by using a zero-velocity own-vessel model. It does not synthesize station keeping from position alone unless an explicit anchored/moored signal exists.

This conservative distinction prevents an underway vessel with missing motion data from being silently classified as stationary.

## Failure semantics

An explicit `navigation.anchor.state=off`/`raised` overrides a lingering or absent anchor-state inference. If neither complete own motion nor explicit station-keeping evidence is available, AIS Guard reports own vessel as not ready and does not manufacture CPA/TCPA values.

Loss or failure of the anchor-watch plugin does not disable AIS Guard when ordinary own position/SOG/COG remains available. Conversely, loss of SOG/COG while a valid anchored/moored state remains available does not disable AIS traffic guarding.

## Operational interpretation

Anchor-watch alarms answer a different question from AIS Guard. Anchor watch asks whether own vessel remains inside its allowed anchoring/mooring geometry. AIS Guard asks whether surrounding AIS traffic presents an unacceptable predicted separation. Both may be active simultaneously and both notifications should be treated independently.

A vessel can be securely anchored yet threatened by an approaching vessel; it can also drag anchor while no AIS collision threat exists. Neither subsystem should suppress the other.

## Verification scenarios

The automated suite includes four integration cases: active anchor watch with position-only own data; `navigation.state=moored` with position-only own data; legacy anchor-position-only compatibility; and explicit anchor-off behavior proving that missing SOG/COG is not fabricated into a stationary state.
