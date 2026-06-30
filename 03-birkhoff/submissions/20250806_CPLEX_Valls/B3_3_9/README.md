# Submission for B3_3_9

This directory contains the submission for the problem **B3_3_9**.

| Field | Value 1 |
| --- | --- |
| Problem | B3_3_9 |
| Submitter | V. Valls |
| Affiliation | IBM Research Europe — Dublin |
| Date | 09/03/2025 |
| ====== |  |
| Reference | https://github.com/victor-ibm/birkhoff-cplex-benchmarking |
| Best Objective Value | 2 |
| Optimality Bound | N/A |
| ====== |  |
| Modeling Approach | Integer program that decomoposes a doubly stochastic matrix as the minimum decomposition of $k$ permutation matrices. The program runs for $k=1,2,\dots$ until it finds a solution. The runtime is limited to 1 hour. |
| # Decision Variables | 27 |
| # Binary Variables | 27 |
| # Integer Variables | 3 |
| # Continuous Variables | 0 |
| # Non-Zero Coefficients | 21 |
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
| Total Runtime | 2.64E-02 |
| Time to Solution | N/A |
| CPU Runtime | 2.64E-02 |
| GPU Runtime | N/A |
| QPU Runtime | N/A |
| Other HW Runtime | N/A |
| ====== |  |
| Remarks | Decision variable breakdown: 27 (permutations), 0 (weights). Decision variables range: [0,1] (permutations), [0,10000] (weights). |
