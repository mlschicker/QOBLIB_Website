# Aer MPS submission for es60fst02

Clean QOBLIB-style artifacts generated from the QAOA MIS experiment simulated with Qiskit Aer matrix-product-state simulation.

- Best objective value: 88 (best known is 88, approximation ratio 1.000)
- Solution format: index list of selected 1-based graph vertices
- Source experiment: `https://github.com/alejomonbar/qoblib-solutions/blob/main/experiments/quantum/ibm_simulator/07-independentset/es60fst02/20260611_qaoa_mis_mps_simulation/maximum-independent-set-mps.ipynb`

- Source bitstring: largest valid sampled independent set from the Aer/MPS experiment, delta index 0 (beta=0.7, gamma=0.4).

- Postprocessing: reduced samples are unfolded back to the original graph and filtered for MIS feasibility.
