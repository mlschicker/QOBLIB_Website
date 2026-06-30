# Submission for labs003

This directory contains the submission for the problem **labs003**.

| Field | Value 1 |
| --- | --- |
| Problem | labs003 |
| Submitter | Daniel Hinderink |
| Affiliation | hiq-lab |
| Date | 8. Mar. 2026 |
| ====== |  |
| Reference | https://arvak.io |
| Best Objective Value | 1 |
| Optimality Bound | N/A |
| ====== |  |
| Modeling Approach | QUBO |
| # Decision Variables | 6 |
| # Binary Variables | 6 |
| # Integer Variables | 0 |
| # Continuous Variables | 0 |
| # Non-Zero Coefficients | 21 |
| Coefficients Type | Integer |
| Coefficients Range | {-8; 12} |
| ====== |  |
| Workflow | PCE dense: 6 QUBO vars -> 3 qubits via parity masks. COBYLA + statevector sim (2048 shots/eval). Solution converted back to 3 original LABS variables. |
| Algorithm Type | Stochastic |
| Paradigm | Quantum Simulator |
| # Runs | 1 |
| # Feasible Runs | 1 |
| # Successful Runs | 1 |
| Success Threshold | 0 |
| ====== |  |
| Hardware Specifications | Apple M3 Pro (statevector simulation) |
| ====== |  |
| Total Runtime | 0.11 |
| Time to Solution | N/A |
| CPU Runtime | 0.11 |
| GPU Runtime | N/A |
| QPU Runtime | N/A |
| Other HW Runtime | N/A |
| ====== |  |
| Remarks | QUBO objective: -4 + offset 5 = LABS energy 1. 2.0x qubit compression via PCE. Arvak v1.9.3. |
