# Submission for es60fst02

Clean QOBLIB-style artifacts generated from the QDC 2025 QAOA MIS reduction notebook.

- Best objective value: 80 (best known is 88, approximation ratio 0.909)
- Solution format: index list of selected 1-based graph vertices
- Source experiment: `experiments/quantum/ibm_qpu/07-independentset/es60fst02/20251127_qdc2025_qaoa_mis_reduction`

- Source bitstring: largest valid sampled independent set from the last retrieved experiment (105 of 20,000 shots are valid), delta index 16 (beta=0.7, gamma=0.1). Archived QDC bitstring is not used.

- Postprocessing: reduced samples are unfolded back to the original graph and filtered for MIS feasibility; **no constraint repair is applied**. A uniform-random sampler followed by the previously used repair matches the repaired QAOA result (88), while random sampling alone yields 0 valid samples in 20,000 shots — so the reported solution reflects the QAOA sampler's own output.
