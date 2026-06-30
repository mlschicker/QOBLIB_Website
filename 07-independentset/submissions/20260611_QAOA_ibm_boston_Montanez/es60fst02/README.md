# IBM Boston submission for es60fst02

Clean QOBLIB-style artifacts generated from the QDC 2025 QAOA MIS notebook and submitted as the IBM Quantum `ibm_boston` run.

- Best objective value: 80 (best known is 88, approximation ratio 0.909)
- Solution format: index list of selected 1-based graph vertices
- Source experiment: `https://github.com/alejomonbar/qoblib-solutions/blob/main/experiments/quantum/ibm_qpu/07-independentset/es60fst02/20251127_qdc2025_qaoa_mis_reduction/maximum-independent-set-clean.ipynb`

- Source bitstring: largest valid sampled independent set from the last retrieved experiment (105 of 20,000 shots are valid), delta index 16 (beta=0.7, gamma=0.1).

- Postprocessing: reduced samples are unfolded back to the original graph and filtered for MIS feasibility.
