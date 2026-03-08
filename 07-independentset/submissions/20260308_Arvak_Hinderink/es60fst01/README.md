# Submission for es60fst01

This directory contains the submission for the problem **es60fst01**.

## CSV Summary

| Field | Value |
|-------|-------|
| Problem | es60fst01 |
| Submitter | Daniel Hinderink (hiq-lab) |
| Date | 8. Mar. 2026 |
|======||
| Reference | https://arvak.io |
|======||
| Best Objective Value | -27 |
| Optimality Bound | N/A |
|======||
| Modeling Approach | QUBO |
| # Decision Variables | 123 |
| # Binary Variables | 123 |
| # Integer Variables | 0 |
| # Continuous Variables | 0 |
| # Non-Zero Coefficients | 441 |
| Coefficients Type | Integer |
| Coefficients Range | {-1, 2} |
|======||
| Workflow | 1) QUBO loaded from .qs file. 2) QAOA p=1 circuit built directly from QUBO (cx-rz-cx for quadratic terms, rz for linear, rx mixer). 3) COBYLA optimizer drives parameter optimization on QPU (23 iterations). 4) Final high-shot sampling with best parameters. |
| Algorithm Type | Stochastic |
| # Runs | 1 |
| # Feasible Runs | 1 |
| # Successful Runs | 1 |
| Success Threshold | 0 |
|======||
| Hardware Specifications | Apple M3 Pro (classical optimization) and IBM Quantum ibm_torino (Heron r2, 156 qubits) |
|======||
| Total Runtime | 779 |
| CPU Runtime | 10 |
| GPU Runtime | N/A |
| QPU Runtime | 669 |
| Other HW Runtime | N/A |
|======||
| Remarks | Runtime in seconds. 123 of 156 qubits used. 23 COBYLA iterations, each submitting one 123-qubit circuit with 2048 shots, plus one final 4096-shot sampling. Compiled with Arvak v1.9.3 quantum compiler. |
