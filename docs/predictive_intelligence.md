# Predictive Intelligence and Ensemble Risk Assessment

## 1. Scientific purpose

AIS Guard augments analytical CPA/TCPA with a modular ensemble of short-horizon trajectory predictors. The objective is not to infer hidden navigational intent, but to test whether several explicitly documented motion models, applied to the same recent AIS evidence, converge on the same ordinal collision-risk state.

The implementation follows the [AIS Guard Trajectory Predictor Interface (AGTPI) v1](trajectory_predictor_interface.md). Predictors produce normalized CPA/TCPA/confidence reports; the core applies common thresholds; the final predictive state is obtained by majority rule. This separation supports reproducible algorithm comparison and future replacement or addition of predictors without changing the collision-notification layer.

## 2. Observation history

For vessel `i`, the bounded motion history is

\[
H_i = \{(t_k,\phi_k,\lambda_k,v_k,\chi_k)\}_{k=1}^{n},
\]

where `t` is observation time, `phi/lambda` are latitude/longitude, `v` is SOG, and `chi` is true COG. Signal K SI conventions are retained internally. History is bounded by time and sample count to prevent unbounded memory growth and to limit influence from obsolete motion.

## 3. Built-in predictors

### 3.1 Constant velocity

`constant-velocity` holds the latest SOG and COG fixed and numerically propagates both vessels over the configured horizon. It is a transparent baseline closely related to classical CPA/TCPA, but evaluated through the same discrete trajectory-predictor pathway as other models.

### 3.2 Constant turn rate

`constant-turn-rate` estimates bounded recent angular course rate and propagates that turn rate while holding speed constant. This model can represent sustained manoeuvring but does not extrapolate longitudinal acceleration.

### 3.3 Adaptive turn and acceleration

`adaptive-turn-acceleration` estimates recent turn rate and longitudinal acceleration from successive observations. Course differences are unwrapped around north before division by elapsed time. The mean estimates are clamped to configurable physical-plausibility limits before propagation.

For each model, both vessels are propagated in a local east/north tangent plane. At discrete step `Delta t`, the predicted closest separation over the horizon defines predicted CPA and the corresponding elapsed time defines predicted TCPA.

The three built-ins are deterministic kinematic predictors. They are **not** trained AI/ML models, and their shared inputs/related assumptions mean their errors may be correlated.

## 4. Confidence and abstention

Each predictor reports confidence in `[0,1]`. In the current kinematic implementations this quantity summarizes factors such as observation freshness, history length, sample count, and motion-estimate stability. It is an engineering confidence indicator—not a collision probability, posterior probability, or calibrated confidence interval.

A report below `predictionMinimumConfidence` is excluded from voting. A predictor may also abstain explicitly when it lacks admissible evidence or geometry. Exceptions are converted into abstentions by the ensemble runner.

## 5. Majority decision

Every eligible predictor report is classified using exactly the same range/CPA/TCPA thresholds. With `N` eligible votes:

\[
R=\begin{cases}
\mathrm{alarm}, & n_{alarm} > N/2,\\
\mathrm{warn}, & n_{alarm}+n_{warn} > N/2,\\
\mathrm{none}, & n_{none} > N/2,\\
\mathrm{unknown}, & \text{otherwise (no strict majority)}.
\end{cases}
\]

This is an ordinal majority rule: alarm requires an alarm majority; warning requires a majority reporting at least warning severity; clear/none requires a strict none majority. An even split therefore produces `unknown` rather than being silently treated as clear. It avoids using a mean CPA as though predictors were exchangeable metric measurements.

If fewer than `predictionMinimumVotes` eligible reports remain, the ensemble lacks quorum; if quorum exists but no strict majority exists, it lacks an authoritative majority decision. In either case AIS Guard falls back to the classical analytical CPA/TCPA assessment. Thus a prediction subsystem failure becomes explicit `unknown/quorum` evidence rather than silently being interpreted as safe.

The API also exposes median predicted CPA, TCPA, and confidence as descriptive ensemble summaries. Those medians are **not** the voting mechanism.

## 6. Interpretation of majority agreement

Voting increases robustness only under assumptions about error diversity. If predictors share inputs, preprocessing, or model structure, their errors can be correlated. Therefore majority agreement must not be interpreted as independent corroboration. A 3/3 consensus is not equivalent to three independent sensors, and no vote ratio is currently mapped to probability of collision.

Future evaluation should quantify predictor disagreement, pairwise error correlation, quorum availability, abstention rates, and risk-class confusion matrices in addition to trajectory error.

## 7. Representative trajectory visualization

Majority voting produces a risk class, not a geometrically coherent trajectory. For cartographic visualization AIS Guard therefore selects, among eligible path-bearing predictor reports, the report with the greatest normalized confidence; predictor id provides deterministic tie breaking. The selected report is a representative hypothesis only. It is not a maximum-a-posteriori estimate unless a future predictor explicitly supplies calibrated probabilistic semantics.

The representative report may expose sampled own-vessel and target trajectories plus the two predicted positions at closest approach. The Freeboard-SK overlay marks the midpoint of those two positions as the predicted closest-approach encounter locus. For non-zero CPA the point is not occupied by either vessel and must not be described as a guaranteed collision point. See `freeboard_extension.md`.

## 8. Relation to AIS trajectory-prediction research

AIS trajectory prediction spans kinematic/statistical methods, Kalman filtering, Gaussian processes, classical machine learning, recurrent neural networks, sequence-to-sequence models, and Transformer architectures. Li, Jiao, and Yang benchmarked multiple machine-learning/deep-learning approaches and showed strong scenario dependence in performance [1]. Their systematic review emphasizes that no single model is uniformly superior across data and operating regimes [2]. Jiang et al. review continuing methodological evolution and highlight generalizability, interpretability, data quality, and real-time constraints as open challenges [3].

These results support an interface-and-ensemble architecture: new predictors can be evaluated against fixed baselines and common thresholds rather than replacing the safety path monolithically. However, ensemble diversity itself must be measured rather than assumed.

A future trained predictor should declare its training corpus, feature construction, train/validation/test separation, geographic and vessel-type coverage, horizon-specific ADE/FDE or other appropriate trajectory metrics, uncertainty calibration, out-of-distribution behavior, computational profile, checkpoint provenance, and licensing/privacy constraints before scientific performance claims are made.

## 9. AIS limitations

AIS is supplementary navigational information. Received data may be delayed, incomplete, erroneous, spoofed, or absent, and some hazards do not transmit AIS. IMO guidance therefore requires AIS information to be interpreted together with other available navigational information [4,5]. No trajectory predictor can recover future manoeuvres that have not yet manifested in the observations.

The ensemble does not infer helm orders, voyage plan, give-way/stand-on status, VTS instructions, pilot intent, shallow-water constraints, or COLREG-compliant action. It provides advisory risk evidence only.

## 10. Offline experimental framework

Version 1.5.0 includes a dependency-free research harness that executes the production AGTPI implementations outside Signal K. It standardizes source normalization, causal history/future case construction, leakage-resistant splitting, predictor and ensemble metrics, and provenance capture. This makes algorithm changes falsifiable against fixed datasets rather than relying on screenshots or live-vessel anecdotes. The complete protocol is defined in `reproducibility.md`; tool semantics are documented in `../research/README.md`.

The harness reports CPA/TCPA error, ADE/FDE for own and target trajectories, coverage/abstention and ordinal risk confusion. These metrics are complementary: trajectory error alone does not characterize alert quality, and risk confusion alone can hide geometrically poor forecasts. AIS future observations are reference evidence rather than perfect physical ground truth.

## 11. Validation programme

Predictor development should be evaluated at four levels: numerical verification of geometry and propagation; encounter-level validation on synthetic and recorded AIS tracks; predictor-level comparison on fixed datasets; and ensemble-level analysis of majority decisions, abstention/quorum behavior, error dependence, false alarms, and missed alerts.

A new predictor should not be enabled by default merely because it reduces average trajectory error. Its effect on risk classification, failure behavior, computational load, and ensemble correlation must also be measured.

## 12. References

[1] H. Li, H. Jiao, and Z. Yang, “AIS data-driven ship trajectory prediction modelling and analysis based on machine learning and deep learning methods,” *Transportation Research Part E: Logistics and Transportation Review*, vol. 175, 103152, 2023. https://doi.org/10.1016/j.tre.2023.103152

[2] H. Li, H. Jiao, and Z. Yang, “Ship trajectory prediction based on machine learning and deep learning: A systematic review and methods analysis,” *Engineering Applications of Artificial Intelligence*, vol. 126, 107062, 2023. https://doi.org/10.1016/j.engappai.2023.107062

[3] Y. Jiang, Y. Chang, B. Zhang, Y. Ge, and X. Zhao, “A review of vessel trajectory prediction research: Methodological evolution, current challenges, and future directions,” *International Journal of Naval Architecture and Ocean Engineering*, vol. 18, 100754, 2026. https://doi.org/10.1016/j.ijnaoe.2026.100754

[4] International Maritime Organization, *Guidelines for the onboard operational use of shipborne automatic identification systems (AIS)*, Resolution A.1106(29), 2015.

[5] International Maritime Organization, “AIS transponders,” Maritime Safety information resource, accessed 2026-09-01.

[6] T. G. Dietterich, “Ensemble Methods in Machine Learning,” in *Multiple Classifier Systems*, Lecture Notes in Computer Science 1857, 2000, pp. 1–15. https://doi.org/10.1007/3-540-45014-9_1
