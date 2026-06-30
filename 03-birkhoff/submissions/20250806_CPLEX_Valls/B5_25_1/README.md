# Submission for B5_25_1

This directory contains the submission for the problem **B5_25_1**.

| Field | Value 1 |
| --- | --- |
| Problem | B5_25_1 |
| Submitter | V. Valls |
| Affiliation | IBM Research Europe — Dublin |
| Date | 09/03/2025 |
| ====== |  |
| Reference | https://github.com/victor-ibm/birkhoff-cplex-benchmarking |
| Best Objective Value | 9 |
| Optimality Bound | N/A |
| ====== |  |
| Modeling Approach | Integer program that decomoposes a doubly stochastic matrix as the minimum decomposition of $k$ permutation matrices. The program runs for $k=1,2,\dots$ until it finds a solution. The runtime is limited to 1 hour. |
| # Decision Variables | 1125 |
| # Binary Variables | 1125 |
| # Integer Variables | 45 |
| # Continuous Variables | 0 |
| # Non-Zero Coefficients | 495 |
| Coefficients Type | integer |
| Coefficients Range | [0,1] (permutations), [0,10000] (weights) |
| ====== |  |
| Workflow | Each algorithm iteration calls CPLEX to solve an integer program. |
| Algorithm Type | Deterministic |
| Paradigm | Classical |
| # Runs | 1 |
| # Feasible Runs | 1 |
| # Successful Runs | 1 |
| Success Threshold | 1.00E-10 |
| ====== |  |
| Hardware Specifications | N/A |
| ====== |  |
| Total Runtime | 3.65E+03 |
| Time to Solution | N/A |
| CPU Runtime | 3.65E+03 |
| GPU Runtime | N/A |
| QPU Runtime | N/A |
| Other HW Runtime | N/A |
| ====== |  |
| Remarks | Decision variable breakdown: 1125 (permutations), 0 (weights). Decision variables range: [0,1] (permutations), [0,10000] (weights). |
