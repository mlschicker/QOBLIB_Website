This folder contains the Birkhoff+ benchmarking results of V. Valls (IBM Research Europe — Dublin)
for the Birkhoff decomposition problem. See Section 4.3.3 in https://arxiv.org/pdf/2504.03832.

Each subfolder B{X}_{Y}_{Z} holds the result for one instance:
- X is the size of the doubly stochastic matrix (e.g., X = 4 for a 4x4 matrix).
- Y is the density, i.e., the number of permutation matrices used to generate the matrix.
  Sparse matrices have Y = X; dense matrices have Y = X^2.
- Z is the instance id (1-10).

This submission was split out of the original combined "20250806_Classic_Valls" baseline
(which bundled Birkhoff+, Blended Frank-Wolfe, and an IP/CPLEX formulation) and converted to
the canonical per-instance submission format. No solution files were provided with the original
baseline, so only the summary metrics are reported here.
