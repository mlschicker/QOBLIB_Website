# Submission for B9_81_10

This directory contains the submission for the problem **B9_81_10**.

| Field | Value 1 |
| --- | --- |
| Problem | B9_81_10 |
| Submitter | V. Valls |
| Affiliation | IBM Research Europe — Dublin |
| Date | 09/03/2025 |
| ====== |  |
| Reference | 10.1109/TNET.2021.3088327 https://github.com/vvalls/BirkhoffDecomposition.jl |
| Best Objective Value | 43 |
| Optimality Bound | N/A |
| ====== |  |
| Modeling Approach | First-order convex optimization based on Birkhoff's algorithm. Each iteration of the algorithm computes a permutation matrix and a weight. |
| # Decision Variables | 3526 |
| # Binary Variables | 3483 |
| # Integer Variables | 43 |
| # Continuous Variables | N/A |
| # Non-Zero Coefficients | 19 |
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
| Total Runtime | 2.44E-02 |
| Time to Solution | N/A |
| CPU Runtime | 2.44E-02 |
| GPU Runtime | N/A |
| QPU Runtime | N/A |
| Other HW Runtime | N/A |
| ====== |  |
| Remarks | Decision variable breakdown: 3483 (permutations), 43 (weights). Decision variables range: [0,1] (permutations), [0,1] (weights). |
