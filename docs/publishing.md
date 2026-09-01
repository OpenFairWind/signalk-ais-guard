# Publishing and Research Traceability

A release is both an npm/Signal K package and a versioned computational method. Any change to predictor semantics, AGTPI contract, confidence eligibility, quorum, or majority aggregation requires a semantic-version review, changelog entry, tests, and synchronized methodological documentation.

Before publication, verify schema defaults and `start({})`, run the complete quality gate in `testing.md`, inspect `npm pack --dry-run`, and confirm packaging of `plugin/predictors/`, OpenAPI, WebApp, `plotterext/`, screenshots, tests, and documentation. The Freeboard release check should also verify `plotterExtensions` discovery and `aisGuardRiskOverlay` ResourceSet rendering against a current Freeboard-SK host.

Publishing a non-prerelease GitHub Release triggers the npm deployment workflow. The release tag must be `v` followed by the exact `package.json` version (for example, `v1.6.0`), and the protected `npm` GitHub environment must provide an `NPM_TOKEN` secret authorized to publish this package. The workflow repeats the complete quality gate and publishes with npm provenance; prereleases are not published automatically.

Predictor identities and predictor versions are part of research provenance. A paper, benchmark, or recorded evaluation should report plugin version, enabled predictor IDs/versions, configuration, data source, sampling characteristics, horizon, quorum/confidence settings, and dataset/metric definitions.

AGTPI v1 is a project interface, not an external maritime standard. Documentation and publications must not imply endorsement or standardization by IMO, IEC, IALA, NMEA, or Signal K.
