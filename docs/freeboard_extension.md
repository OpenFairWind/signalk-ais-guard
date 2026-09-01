# Freeboard-SK Plotter Extension and Risk Overlay

## Purpose and scope

AIS Guard 1.4.0 adds a standards-oriented integration for Freeboard-SK and other hosts implementing the Signal K Plotter Extensions API version 1. The integration has two distinct functions: a Plotter Extension supplies a compact risk widget, a risk panel, and a toolbar entry; a read-only `ResourceSet` named `AIS Guard live collision-risk overlay` supplies cartographic geometry for predicted hazardous encounters.

The separation is intentional. Plotter Extensions API v1 exposes viewport control (`map.getView`, `map.center`, `map.fitBounds`) but does not define arbitrary vector-layer insertion. AIS Guard therefore does not access Freeboard-SK's OpenLayers internals. Predicted geometry is published through the established Freeboard ResourceSet mechanism instead. This avoids a private host dependency and avoids representing predicted tracks as editable navigation routes.

## Discovery

When the plugin starts it registers a read-only `plotterExtensions` resource with id `signalk-ais-guard`. The manifest targets API version `1` and contributes:

- widget `risk-status`, a `1x1` glanceable hazardous-target count;
- panel `risk-panel`, an inspection view for active warning/alarm contacts;
- toolbar button `open-risk-panel`, which toggles the panel.

Extension assets are mounted below `/plotterext/signalk-ais-guard/`, not below `/plugins/`. This follows the Plotter Extensions provider model in which iframe assets are ordinary static content while discovery and navigation data remain governed by Signal K access control.

## Risk overlay resource

AIS Guard registers the custom resource type `aisGuardRiskOverlay`. It contains one dynamically generated resource, `live-risk-overlay`, with `type: "ResourceSet"` and a GeoJSON `FeatureCollection` in `values`.

The layer contains only warning/alarm encounters. Depending on configuration it may include:

1. one representative own-vessel trajectory;
2. one representative predicted trajectory for each hazardous AIS target;
3. one predicted closest-approach marker for each hazardous target.

The overlay is empty when `freeboardRiskOverlayEnabled=false`, when predictive intelligence is disabled, when no hazardous target has an eligible trajectory report, or when all corresponding portrayal options are disabled.

## Representative trajectory selection

Risk and visualization answer different questions and therefore use different ensemble operations. Final predictive risk is determined by the AGTPI ordinal majority vote. A drawable trajectory, however, must be internally coherent: independently taking the median latitude/longitude at every future time step can produce a synthetic path that no predictor actually generated.

AIS Guard consequently selects one *representative report* for visualization. Among eligible AGTPI reports that contain both own-vessel and target trajectories, the report with maximum normalized confidence is selected; predictor id is used as a deterministic tie-break. The overlay exposes the predictor identity and confidence in GeoJSON properties.

This selection rule does **not** mean that the path has posterior probability greater than 0.5, nor that it is statistically the maximum-a-posteriori trajectory. AGTPI confidence is an engineering confidence score unless a predictor explicitly documents calibrated probabilistic semantics. The phrase *representative predicted path* is therefore preferred in scientific documentation and UI text.

## Predicted closest-approach point

At the representative report's predicted TCPA, AIS Guard obtains the predicted position of own vessel and target. The displayed point is the geographic midpoint of those two predicted positions.

For a non-zero CPA this point is not occupied by either vessel. It is a compact portrayal of the predicted encounter locus. Only in the limiting case where CPA approaches zero does it approximate a collision location. API/resource metadata therefore uses the semantic label `predicted-closest-approach-midpoint`; documentation must not present it as a guaranteed collision point.

## Enabling the overlay in Freeboard-SK

Freeboard-SK treats user-defined resource paths as ResourceSets. Add `aisGuardRiskOverlay` as a custom resource type in Freeboard-SK Settings -> Resources (Custom), reload Freeboard if required, and enable `AIS Guard live collision-risk overlay` in Layers. The overlay remains optional even when the plugin and Plotter Extension are enabled.

Because resource-provider discovery is performed by the Signal K server/host lifecycle, a Freeboard tab that was already open when the plugin was first enabled may require a server restart and/or browser reload before the new Plotter Extension/resource type becomes visible.

## Portrayal

AIS Guard publishes style hints within the ResourceSet:

- own-vessel representative path: dashed blue line;
- warning target path: dashed amber line;
- alarm target path: dashed red line;
- warning encounter point: amber point;
- alarm encounter point: red point.

Colours are informative portrayal defaults rather than part of the collision-risk semantics. Consumers may render ResourceSets differently.

## Configuration

`freeboardRiskOverlayEnabled` is the master publication switch. `freeboardOverlayOwnPath`, `freeboardOverlayRiskyPaths`, and `freeboardOverlayClosestApproachPoints` independently control the three geometry classes. All default to `true`; the custom ResourceSet must still be enabled by the Freeboard user before it is drawn.

## Safety and epistemic status

The overlay visualizes extrapolated hypotheses, not surveyed tracks, route intent, helm commands, or COLREG-compliant manoeuvres. Predictor agreement is correlated model consensus because all built-in predictors use substantially the same AIS observations. A visually convergent set of lines must never be interpreted as independent sensor confirmation.

AIS Guard does not write predicted geometry into routes, waypoints, vessel navigation state, or autopilot paths. Removing or disabling the plugin removes the extension/resource provider without altering navigational resources.
