# Submission for B13_13_7

This directory contains the submission for the problem **B13_13_7**.

| Field | Value 1 |
| --- | --- |
| Problem | B13_13_7 |
| Submitter | V. Valls |
| Affiliation | IBM Research Europe — Dublin |
| Date | 09/03/2025 |
| ====== |  |
| Reference | 10.1109/TNET.2021.3088327 https://github.com/vvalls/BirkhoffDecomposition.jl |
| Best Objective Value | 23 |
| Optimality Bound | N/A |
| ====== |  |
| Modeling Approach | First-order convex optimization based on Birkhoff's algorithm. Each iteration of the algorithm computes a permutation matrix and a weight. |
| # Decision Variables | 3910 |
| # Binary Variables | 3887 |
| # Integer Variables | 23 |
| # Continuous Variables | N/A |
| # Non-Zero Coefficients | 27 |
| Coefficients Type | integer |
| Coefficients Range | [0,1] (permutations), [0,1] (weights) |
| ====== |  |
| Workflow | Each algorithm iteration calls: 1) A linear solver to find a permutation matrix; 2) A linear solver to compute a weight for the permutation matrix selected in step 1 |
| Algorithm Type | Deterministic |
| Paradigm | Classical |
| # Runs | 1 |
| # Feasible Runs | 1 |
| # Successful Runs | 1 |
| Success Threshold | 1.00E-10 |
| ====== |  |
| Hardware Specifications | N/A |
| ====== |  |
| Total Runtime | 1.49E-02 |
| Time to Solution | N/A |
| CPU Runtime | 1.49E-02 |
| GPU Runtime | N/A |
| QPU Runtime | N/A |
| Other HW Runtime | N/A |
| ====== |  |
| Remarks | Decision variable breakdown: 3887 (permutations), 23 (weights). Decision variables range: [0,1] (permutations), [0,1] (weights). |
