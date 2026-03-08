# Submission for farm

This directory contains the submission for the problem **farm**.

## CSV Summary

| Field | Value |
|-------|-------|
| Problem | farm |
| Submitter | Daniel Hinderink (hiq-lab) |
| Date | 8. Mar. 2026 |
|======||
| Reference | https://arvak.io |
|======||
| Best Objective Value | -10 |
| Optimality Bound | -10 |
|======||
| Modeling Approach | QUBO |
| # Decision Variables | 17 |
| # Binary Variables | 17 |
| # Integer Variables | 0 |
| # Continuous Variables | 0 |
| # Non-Zero Coefficients | 95 |
| Coefficients Type | Integer |
| Coefficients Range | {-1, 2} |
|======||
| Workflow | 1) QUBO loaded from .qs file. 2) Parity-Correlation Encoding (PCE) compresses 17 variables to 5 qubits using dense parity masks. 3) COBYLA optimizer drives parameterized quantum circuit on statevector simulator (2048 shots/eval). 4) Best decoded bitstring returned. |
| Algorithm Type | Stochastic |
| # Runs | 1 |
| # Feasible Runs | 1 |
| # Successful Runs | 1 |
| Success Threshold | 0 |
|======||
| Hardware Specifications | Apple M3 Pro (statevector simulation) |
|======||
| Total Runtime | 0.4 |
| CPU Runtime | 0.4 |
| GPU Runtime | N/A |
| QPU Runtime | N/A |
| Other HW Runtime | N/A |
|======||
| Remarks | Runtime in seconds. PCE dense encoding compresses 17 binary variables to 5 qubits (3.4x compression). Finds brute-force-verified optimal solution. Compiled with Arvak v1.9.3. |
