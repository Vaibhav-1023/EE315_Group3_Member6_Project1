# Plant Mix Optimizer

A static web portal that identifies the base-load and peak-load plant for a
region given its maximum demand and load factor, and computes how many hours
per year the peak plant needs to run.

Built for the Power Systems assignment — generalized two-plant economic
dispatch problem (base vs. peak load plant selection).

## Live demo

Open `index.html` in any browser — no server, build step, or install
required. All computation runs client-side in `script.js`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Input form, results readout, and chart canvases |
| `style.css` | Dashboard styling (dark theme, cyan = base plant, amber = peak plant) |
| `script.js` | Core logic: plant selection, breakeven-hours calculation, load duration curve split, and live Chart.js rendering |

## How to run

1. Clone the repo:
   ```
   git clone https://github.com/your-username/your-repo.git
   ```
2. Open the folder and double-click `index.html` — or serve it locally:
   ```
   cd your-repo
   python -m http.server
   ```
   then visit `http://localhost:8000`.
3. Enter your system's values in the input panel:
   - Maximum demand, P (MW)
   - Load factor, x (%)
   - Plant 1 and Plant 2 fixed cost (₹/kW/yr) and running cost (paise/kWh)
4. Results and both charts update instantly as you type — no submit button.

## What it computes

Given max demand `P`, load factor `x`, and each plant's fixed cost `C` and
running cost `R`:

1. **Plant identification** — the plant with the higher fixed cost *and*
   lower running cost is assigned as base load; the other as peak load. If
   neither condition holds (one plant is cheaper on both counts), the tool
   flags that there is no economic split and assigns the lower-fixed-cost
   plant as peak by default.
2. **Breakeven hours**, `h0 = (C_base − C_peak) / (R_peak − R_base)` — the
   number of hours per year the peak plant should run.
3. **Load duration curve** — modeled as a straight line from `P` down to
   `Pmin = P(2x − 1)` over 8760 hours (clamped to 0 if the load factor is
   below 50%, since the straight-line model breaks down there).
4. **Capacity split** — the demand level on the load duration curve
   corresponding to `h0` hours gives the base plant's capacity; the
   remainder is the peak plant's capacity.

## Notes and assumptions

- The load duration curve is approximated as linear (triangular). For a more
  accurate split, replace the synthetic curve in `script.js` with real hourly
  load data, sorted descending.
- All costs are treated as ₹/kW/year (fixed) and paise/kWh converted to
  ₹/kWh (running) internally.
