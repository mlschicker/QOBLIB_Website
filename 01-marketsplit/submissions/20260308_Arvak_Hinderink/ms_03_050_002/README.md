# Submission for ms_03_050_002

This directory contains the submission for the problem **ms_03_050_002**.

| Field | Value 1 |
| --- | --- |
| Problem | ms_03_050_002 |
| Submitter | Daniel Hinderink |
| Affiliation | hiq-lab |
| Date | 8. Mar. 2026 |
| ====== |  |
| Reference | https://arvak.io |
| Best Objective Value | -201117 |
| Optimality Bound | N/A |
| ====== |  |
| Modeling Approach | QUBO |
| # Decision Variables | 20 |
| # Binary Variables | 20 |
| # Integer Variables | 0 |
| # Continuous Variables | 0 |
| # Non-Zero Coefficients | 211 |
| Coefficients Type | Integer |
| Coefficients Range | {-202539; 50000} |
| ====== |  |
| Workflow | PCE dense: 20 vars -> 5 qubits. COBYLA + statevector sim (2048 shots/eval). |
| Algorithm Type | Stochastic |
| Paradigm | Quantum Simulator |
| # Runs | 1 |
| # Feasible Runs | 0 |
| # Successful Runs | 0 |
| Success Threshold | 0 |
| ====== |  |
| Hardware Specifications | Apple M3 Pro (statevector simulation) |
| ====== |  |
| Total Runtime | 0.38 |
| Time to Solution | N/A |
| CPU Runtime | 0.38 |
| GPU Runtime | N/A |
| QPU Runtime | N/A |
| Other HW Runtime | N/A |
| ====== |  |
| Remarks | INFEASIBLE — all 3 rows violated. PCE compression (20->5 qubits) cannot reach any feasible solution; the encoding image contains 0 feasible points out of 32. Withdrawn. Arvak v1.9.3. |
