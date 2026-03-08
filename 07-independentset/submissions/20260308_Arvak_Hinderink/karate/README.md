# Submission for karate

This directory contains the submission for the problem **karate**.

## CSV Summary

| Field | Value |
|-------|-------|
| Problem | karate |
| Submitter | Daniel Hinderink (hiq-lab) |
| Date | 8. Mar. 2026 |
|======||
| Reference | https://arvak.io |
|======||
| Best Objective Value | -16 |
| Optimality Bound | N/A |
|======||
| Modeling Approach | QUBO |
| # Decision Variables | 34 |
| # Binary Variables | 34 |
| # Integer Variables | 0 |
| # Continuous Variables | 0 |
| # Non-Zero Coefficients | 191 |
| Coefficients Type | Integer |
| Coefficients Range | {-1, 2} |
|======||
| Workflow | 1) QUBO loaded from .qs file. 2) PCE dense encoding compresses 34 variables to 6 qubits. 3) COBYLA optimizer on statevector simulator (2048 shots/eval). 4) Best decoded bitstring returned. |
| Algorithm Type | Stochastic |
| # Runs | 1 |
| # Feasible Runs | 1 |
| # Successful Runs | 1 |
| Success Threshold | 0 |
|======||
| Hardware Specifications | Apple M3 Pro (statevector simulation) |
|======||
| Total Runtime | 0.6 |
| CPU Runtime | 0.6 |
| GPU Runtime | N/A |
| QPU Runtime | N/A |
| Other HW Runtime | N/A |
|======||
| Remarks | Runtime in seconds. PCE dense: 34 vars -> 6 qubits (5.7x compression). Arvak v1.9.3. |
