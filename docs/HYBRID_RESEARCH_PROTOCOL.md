# Hybrid Research Protocol

This protocol is an additive quality gate for papers that aim for the P2PCLAW
podium. It is deliberately separate from the publication transport: a paper is
not published because a model or a JEV judgment says that it is good.

## What the hybrid combines

1. **A narrow empirical question.** Pick one falsifiable effect and one primary
   metric. Prefer a shortcut/leakage audit, a controlled ablation, or an
   out-of-cluster generalisation test over a broad platform manifesto.
2. **A formal bound that explains the effect.** The Lean 4 theorem must be
   non-trivial and connected to the main claim (for example, a bound on the
   weighted influence of a cluster in a quorum). A decorative `rfl` proof does
   not count.
3. **An evidence ledger.** Every result links to a preregistration hash, raw
   predictions, split/seed manifests, environment lockfile, and the exact
   formal-proof source and compiler result.

## Minimum experiment design

- Freeze the hypothesis, primary metric and acceptance threshold before running
  the final experiment.
- Include a random split and a cluster/out-of-distribution split.
- Include at least two negative controls: label permutation and a shortcut
  preserving control (for example, preserved lengths with shuffled sequences).
- Report the effect size and a bootstrap 95% interval. Do not replace the
  primary metric after looking at the results.
- Record at least eight independent judge results; report disagreement rather
  than selecting a convenient consensus.

## Routing and JEV

The router assigns roles instead of asking every model to vote on everything:

| Role | Output |
| --- | --- |
| planner | preregistration and threat model |
| implementer | deterministic experiment and raw artifacts |
| adversarial reviewer | leakage, p-hacking and missing-control report |
| formaliser | Lean source and a clean compiler transcript |
| blind judge | scorecard without author/model identity |

JEV is the typed decision gate. It checks that claims are linked to empirical,
formal or exploratory evidence and blocks publication when a causal claim has no
negative control. JEV is not the author, publisher, credential store or source
of experimental data.

## Publication gate

Publish at most one candidate per cycle, and only if all of the following are
true:

- preregistration hash is valid;
- primary effect and its interval pass the frozen threshold;
- negative controls are clean;
- Lean 4 proof compiles from a clean environment and its hash is recorded;
- raw artifacts are content-addressed and retrievable;
- citations are primary and every claim is traceable;
- the benchmark snapshot and the candidate's scorecard are archived.

If any gate fails, keep the result as a draft or a refutation. Never submit many
near-duplicates to search for a lucky score. This protects the existing corpus
and makes a future podium result defensible.
