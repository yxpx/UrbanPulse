## 0. Common Background (same baseline as before, repeated so this file stands alone)

Baseline = standard STGCN (Yu, Yin & Zhu, IJCAI 2018): ST-Conv "sandwich" block
`gated temporal conv (GLU) → spatial graph conv (Chebyshev, order K) → gated temporal conv`,
two blocks, a final temporal layer, a linear output layer.

| Symbol | Meaning |
| --- | --- |
| `N` | number of sensors (nodes); 207 for METR-LA, 325 for PEMS-BAY |
| `T_in = 12`, `T_out = 12` |f	 input / output length in 5-minute steps (1 h → 1 h) |
| `x_i(t)` | observed speed at sensor `i`, time `t` (mph) |
| `X_t ∈ R^{N×C}` | node features at time `t`, `C` channels (vanilla: `C = 1`) |
| `d_ij` | road-network distance from sensor `i` to `j` (metres) |
| `W ∈ R^{N×N}` | weighted adjacency |
| `D_ii = Σ_j W_ij`, `L = I − D^{−1/2} W D^{−1/2}`, `L̃ = L − I` | degree, normalized and rescaled Laplacian |
| `θ_k` | learnable Chebyshev coefficients |

**Vanilla spatial convolution**

```
Θ ∗_G x = Σ_{k=0}^{K−1} θ_k T_k(L̃) x ,    T_0 = I, T_1 = L̃, T_k = 2L̃T_{k−1} − T_{k−2}
```

**Vanilla adjacency (thresholded Gaussian kernel)**

```
W_ij = exp(−d_ij² / θ²)   if i ≠ j and exp(−d_ij²/θ²) ≥ ε ,   else 0            (Eq. 0)
```

with `θ`, `ε` fixed constants and `W` symmetric and time-invariant.

**Vanilla preprocessing.** Z-score with **one global** mean/std:
`x̃_i(t) = (x_i(t) − μ) / s`, `μ, s` computed over the whole training set. Missing values (METR-LA has
~8 %) are zero-filled and masked out of the loss. Loss = masked MAE.

**Standard protocol used by all five proposals.** METR-LA (and optionally PEMS-BAY), 70 / 10 / 20
chronological split, 12 → 12 steps, report masked MAE / RMSE / MAPE at 15 / 30 / 60 min,
**5 random seeds, mean ± std**, Adam, early stopping on validation MAE.

**Baselines for all five (keep it small).** Historical Average (per sensor, per time-of-day, per
day-type), ARIMA (or a per-sensor seasonal naive, which is more honest and much cheaper),
**vanilla ST-GCN retrained by you under an identical protocol** (this is the comparison the reviewer
cares about), and **one** established graph model taken from published numbers (DCRNN or Graph
WaveNet) purely for context.


# Proposal — Free-Flow Travel-Time Adjacency

### 1. Proposed Title

**"From Metres to Minutes: Travel-Time-Based Graph Construction for Spatio-Temporal Graph
Convolutional Traffic Forecasting"**

### 2. Core Innovation

> **What does vanilla ST-GCN do?**
> It weights every edge by a Gaussian kernel of **road distance in metres** (Eq. 0). Two sensors 2 km
> apart get the same edge weight whether they are on a 65 mph freeway or a 25 mph signalised arterial.

> **What is the ONE small thing we change?**
> We replace distance `d_ij` in the kernel by the **free-flow travel time** `τ_ij = d_ij / v_ij`, where
> `v_ij` is the free-flow speed estimated directly from the data (e.g. the 95th percentile of observed
> speeds on the two endpoint sensors). The kernel, the thresholding, the normalization, the Laplacian
> and the whole network stay exactly as they are — only the number inside the exponential changes
> units, from metres to minutes.

### 3. Traffic Motivation

What actually couples two sensors is not how far apart they are but **how long it takes traffic — and
therefore information — to travel between them**. A perturbation propagates along the road at a finite
speed. On a freeway, a disturbance 3 km away reaches you in about 2 minutes and is highly relevant to
your next 5-minute prediction; on a congested arterial with signals, the same 3 km is 8–10 minutes away
and is nearly irrelevant at that horizon. Distance-based kernels systematically over-connect slow roads
and under-connect fast ones. Measuring separation in minutes aligns the graph's notion of "near" with
the model's 5-minute time step — a genuinely nice property to state in a paper: *the spatial and
temporal axes of a spatio-temporal model finally use compatible units.*

### 4. Methodology

1. **Dataset:** METR-LA (`distances_la_2012.csv` gives `(from, to, distance)`).
2. **Free-flow speed estimation (training split only):** for each sensor `i`,
   `v_i = quantile_{0.95}{ x_i(t) : t ∈ train, observed }` (the 95th percentile is a standard, robust
   proxy for free flow; also try the night-time 00:00–05:00 mean as a robustness check).
3. **Edge travel time:** `v_ij = (v_i + v_j)/2` (harmonic mean is the more physically correct
   alternative — report both, one line of code).
4. **Graph construction:** Eq. 6 below, then symmetrize and threshold exactly as vanilla does.
5. **Model / training / prediction:** completely unchanged vanilla ST-GCN.
6. **Evaluation:** standard protocol.

### 5. Exact Mathematical / Architectural Modification

Vanilla (Eq. 0): `W_ij = exp(−d_ij²/θ²) · 1[· ≥ ε]`. Proposed:

```
τ_ij = d_ij / v_ij ,      v_ij = ½ ( v_i + v_j ) ,      v_i = Q_{0.95}{ x_i(t) : t ∈ train }

W^tt_ij = exp( − τ_ij² / θ_t² )   if i ≠ j and exp(−τ_ij²/θ_t²) ≥ ε ,   else 0             (Eq. 6)
```

Variables: `d_ij` road distance (m); `v_i` free-flow speed at sensor `i` (m/s, after unit conversion);
`τ_ij` free-flow travel time (s or min); `θ_t` the kernel bandwidth **now in time units** — set it to
the standard deviation of the non-zero `τ_ij`, exactly mirroring how the vanilla implementation sets
`θ` to the std of the non-zero `d_ij`, so the choice is not a hidden tuning advantage. `ε` unchanged
(keep the same value so the two graphs have comparable sparsity — and **report the edge counts of both
graphs**, because a reviewer will ask whether you simply made the graph denser).

Everything downstream — `D`, `L`, `L̃`, Chebyshev, ST-Conv blocks, loss — is untouched.

### 6. Dataset Strategy

METR-LA only; **no external data of any kind** (the free-flow speeds come from the same speed matrix
you already have). Variables: speed matrix, timestamps, distance CSV. One input channel. Horizon 12
steps. Split 70/10/20 chronological. PEMS-BAY replication needs zero new code and is a strong second
table, since the Bay Area network mixes freeway speeds differently from LA.

### 7. Baselines

HA, seasonal naive/ARIMA, vanilla ST-GCN with the distance graph, one published graph model for
context. **Plus two graph controls** (these *are* the paper): a binary-connectivity graph, and a
distance graph re-tuned so that its edge count matches the travel-time graph.

### 8. Experiments

* **E1 — Main:** distance graph vs travel-time graph, 5 seeds, 15/30/60 min.
* **E2 — Sparsity control:** match the number of edges between the two graphs by adjusting `ε`, and
  re-run. This kills the "you just used a denser graph" objection, which is the single most likely
  reviewer complaint.
* **E3 — Where the gain is:** split test sensors into "fast" (high `v_i`) and "slow" (low `v_i`)
  groups and report the error change for each. Predicted result: slow/arterial sensors improve most,
  because they are the ones the distance kernel over-connects. Stating this prediction in advance and
  confirming it makes the paper.
* **E4 — Ablation:** `v_ij` as arithmetic vs harmonic mean; `Q_{0.95}` vs `Q_{0.85}` vs night-time
  mean for free-flow estimation; travel time vs distance with an equally re-tuned bandwidth.
* **E5:** a two-panel figure of the two adjacency matrices / their edge-weight histograms.

### 9. Expected Contribution

> "A travel-time-based graph construction for ST-GCN that measures sensor proximity in propagation
> minutes rather than metres, requires no additional data, and an edge-count-controlled evaluation
> showing which sensors benefit and why."

### 10. Difficulty Rating

**1 / 5.** The change is roughly ten lines in the graph-construction script and *zero* lines in the
model. All the effort goes into the controls (E2, E3), which is exactly the right effort profile for a
6–8-week project.