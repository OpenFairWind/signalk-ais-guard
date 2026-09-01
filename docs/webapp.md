# Companion WebApp

The bundled WebApp is a read-only analytical view over `/plugins/signalk-ais-guard/targets`. Collision and prediction algorithms remain server-side.

Each target exposes identity, range, analytical CPA/TCPA, ensemble median predicted CPA/TCPA/confidence, final risk source, vote counts, SOG/COG, observation age, and an array of standardized per-predictor reports. The table displays ensemble vote counts as `A/W/N` alongside the source so disagreement is visible.

Sorting remains available by risk, distance, analytical CPA/TCPA, predicted CPA/TCPA, prediction confidence, name, MMSI, speed, and age. Search and risk filters affect presentation only.

`predictionConfidence` is the median engineering confidence of eligible reports; it is not collision probability. `predictedCpaNm` and `predictedTcpaMinutes` are ensemble descriptive medians and do not themselves determine the majority decision.


## Chartplotter integration

The standalone companion WebApp and the Freeboard-SK Plotter Extension are separate presentation surfaces over the same server-side assessments. See `freeboard_extension.md` for chart overlay semantics and activation.
