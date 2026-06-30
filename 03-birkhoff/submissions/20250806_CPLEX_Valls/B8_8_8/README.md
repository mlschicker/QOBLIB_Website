# Submission for B8_8_8

This directory contains the submission for the problem **B8_8_8**.

| Field | Value 1 |
| --- | --- |
| Problem | B8_8_8 |
| Submitter | V. Valls |
| Affiliation | IBM Research Europe — Dublin |
| Date | 09/03/2025 |
| ====== |  |
| Reference | https://github.com/victor-ibm/birkhoff-cplex-benchmarking |
| Best Objective Value | 8 |
| Optimality Bound | N/A |
| ====== |  |
| Modeling Approach | Integer program that decomoposes a doubly stochastic matrix as the minimum decomposition of $k$ permutation matrices. The program runs for $k=1,2,\dots$ until it finds a solution. The runtime is limited to 1 hour. |
| # Decision Variables | 2304 |
| # Binary Variables | 2304 |
| # Integer Variables | 36 |
| # Continuous Variables | 0 |
| # Non-Zero Coefficients | 612 |
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
| Total Runtime | 6.37E+00 |
| Time to Solution | N/A |
| CPU Runtime | 6.37E+00 |
| GPU Runtime | N/A |
| QPU Runtime | N/A |
| Other HW Runtime | N/A |
| ====== |  |
| Remarks | Decision variable breakdown: 2304 (permutations), 0 (weights). Decision variables range: [0,1] (permutations), [0,10000] (weights). |
