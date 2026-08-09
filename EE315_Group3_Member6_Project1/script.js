const inputs = ['P', 'x', 'C1', 'R1', 'C2', 'R2'].reduce((acc, id) => {
  acc[id] = document.getElementById(id);
  return acc;
}, {});

const el = {
  baseLabel: document.getElementById('baseLabel'),
  baseCap: document.getElementById('baseCap'),
  peakLabel: document.getElementById('peakLabel'),
  peakCap: document.getElementById('peakCap'),
  h0Val: document.getElementById('h0Val'),
  peakHoursVal: document.getElementById('peakHoursVal'),
  dcVal: document.getElementById('dcVal'),
  pminVal: document.getElementById('pminVal'),
  warningNote: document.getElementById('warningNote'),
};

const HOURS_PER_YEAR = 8760;
const fmt = (v, d = 1) => Number(v).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 });

let ldcChart, costChart;

function readInputs() {
  return {
    P: parseFloat(inputs.P.value),
    x: parseFloat(inputs.x.value) / 100,
    C1: parseFloat(inputs.C1.value),
    R1: parseFloat(inputs.R1.value) / 100,   // paise -> rupees
    C2: parseFloat(inputs.C2.value),
    R2: parseFloat(inputs.R2.value) / 100,
  };
}

function compute({ P, x, C1, R1, C2, R2 }) {
  const warnings = [];

  // triangular LDC: average load = x * P = (Pmax + Pmin) / 2
  let Pmin = P * (2 * x - 1);
  if (Pmin < 0) {
    warnings.push('Load factor below 50% makes the triangular-LDC minimum negative; Pmin clamped to 0. Results are an approximation for this regime.');
    Pmin = 0;
  }

  // decide which plant is base (higher fixed cost, lower running cost)
  let base, peak, swapped = false;
  if (C1 >= C2 && R1 <= R2 && !(C1 === C2 && R1 === R2)) {
    base = { name: 'Plant 1', C: C1, R: R1 };
    peak = { name: 'Plant 2', C: C2, R: R2 };
  } else if (C2 >= C1 && R2 <= R1 && !(C1 === C2 && R1 === R2)) {
    base = { name: 'Plant 2', C: C2, R: R2 };
    peak = { name: 'Plant 1', C: C1, R: R1 };
    swapped = true;
  } else {
    // one plant is cheaper on both counts, or they're identical -> no economic split
    warnings.push('Neither plant strictly trades fixed cost for running cost against the other, so there is no economic crossover. Showing the lower-fixed-cost plant as peak by default.');
    if (C1 <= C2) { base = { name:'Plant 1', C:C1, R:R1 }; peak = { name:'Plant 2', C:C2, R:R2 }; }
    else { base = { name:'Plant 2', C:C2, R:R2 }; peak = { name:'Plant 1', C:C1, R:R1 }; swapped = true; }
  }

  let h0 = (base.C - peak.C) / (peak.R - base.R);
  if (!isFinite(h0) || h0 < 0) h0 = 0;
  const peakHours = Math.min(h0, HOURS_PER_YEAR);

  // demand level at t = h0 on the linear LDC
  let Dc = P - (P - Pmin) * (peakHours / HOURS_PER_YEAR);
  Dc = Math.min(Math.max(Dc, Pmin), P);

  const baseCap = Dc;
  const peakCap = P - Dc;

  return { Pmin, base, peak, swapped, h0, peakHours, Dc, baseCap, peakCap, warnings };
}

function ldcPoint(t, P, Pmin) {
  return P - (P - Pmin) * (t / HOURS_PER_YEAR);
}

function render() {
  const raw = readInputs();
  if (Object.values(raw).some(v => Number.isNaN(v))) return;

  const r = compute(raw);

  el.baseLabel.textContent = r.base.name;
  el.baseCap.textContent = `${fmt(r.baseCap)} MW · runs ${HOURS_PER_YEAR} h/yr`;
  el.peakLabel.textContent = r.peak.name;
  el.peakCap.textContent = `${fmt(r.peakCap)} MW`;
  el.h0Val.textContent = `${fmt(r.h0)} h`;
  el.peakHoursVal.textContent = `${fmt(r.peakHours)} h / yr`;
  el.dcVal.textContent = `${fmt(r.Dc)} MW`;
  el.pminVal.textContent = `${fmt(r.Pmin)} MW`;
  el.warningNote.textContent = r.warnings.join(' ');

  updateCharts(raw, r);
}

function updateCharts(raw, r) {
  const isDark = true;
  const muted = '#8b9198';
  const grid = '#2c3238';

  const ldcPoints = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = (HOURS_PER_YEAR / steps) * i;
    ldcPoints.push({ x: Math.round(t), y: ldcPoint(t, raw.P, r.Pmin) });
  }
  const basePoints = ldcPoints.map(p => ({ x: p.x, y: Math.min(p.y, r.baseCap) }));

  const ldcData = {
    datasets: [
      { label: 'Base load', data: basePoints, borderColor: '#4fd1c5', backgroundColor: 'rgba(79,209,197,0.18)', borderWidth: 2, pointRadius: 0, fill: 'origin', tension: 0 },
      { label: 'Total demand (LDC)', data: ldcPoints, borderColor: '#f0a93e', backgroundColor: 'rgba(240,169,62,0.12)', borderWidth: 2, pointRadius: 0, fill: 0, tension: 0 },
    ],
  };

  if (ldcChart) {
    ldcChart.data = ldcData;
    ldcChart.update();
  } else {
    ldcChart = new Chart(document.getElementById('ldcChart'), {
      type: 'line',
      data: ldcData,
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { type: 'linear', title: { display: true, text: 'Hours per year', color: muted, font: { size: 12 } }, ticks: { color: muted, font: { size: 11 } }, grid: { color: grid } },
          y: { title: { display: true, text: 'Demand (MW)', color: muted, font: { size: 12 } }, ticks: { color: muted, font: { size: 11 } }, grid: { color: grid }, min: 0 },
        },
      },
    });
  }

  const hoursAxis = [0, r.h0 || 1, HOURS_PER_YEAR].sort((a, b) => a - b);
  const uniqueHours = [...new Set(hoursAxis.map(h => Math.round(h)))];
  const costOf = (C, R) => uniqueHours.map(h => ({ x: h, y: C + R * h }));

  const costData = {
    datasets: [
      { label: r.base.name + ' (base)', data: costOf(r.base.C, r.base.R), borderColor: '#4fd1c5', backgroundColor: '#4fd1c5', borderWidth: 2, pointRadius: 0, tension: 0 },
      { label: r.peak.name + ' (peak)', data: costOf(r.peak.C, r.peak.R), borderColor: '#f0a93e', backgroundColor: '#f0a93e', borderWidth: 2, pointRadius: 0, tension: 0 },
      { label: 'Crossover', type: 'scatter', data: [{ x: r.h0, y: r.base.C + r.base.R * r.h0 }], showLine: false, pointRadius: 6, pointBackgroundColor: '#e7e5dc', pointBorderColor: '#14171a', pointBorderWidth: 2 },
    ],
  };

  if (costChart) {
    costChart.data = costData;
    costChart.update();
  } else {
    costChart = new Chart(document.getElementById('costChart'), {
      type: 'line',
      data: costData,
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { type: 'linear', title: { display: true, text: 'Hours of use per year', color: muted, font: { size: 12 } }, ticks: { color: muted, font: { size: 11 } }, grid: { color: grid } },
          y: { title: { display: true, text: '₹ per kW per year', color: muted, font: { size: 12 } }, ticks: { color: muted, font: { size: 11 } }, grid: { color: grid } },
        },
      },
    });
  }
}

Object.values(inputs).forEach(inp => inp.addEventListener('input', render));
render();
