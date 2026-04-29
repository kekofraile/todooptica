// Myopia simulator (educational): slider controls blur intensity.
const setupMyopiaSimulator = () => {
  const roots = document.querySelectorAll("[data-myopia-sim]");
  if (!roots.length) return;

  roots.forEach((root) => {
    const range = root.querySelector("[data-myopia-range]");
    const value = root.querySelector("[data-myopia-value]");
    const toggle = root.querySelector("[data-myopia-toggle]");
    if (!range) return;

    let corrected = false;

    const fmt = (v) => {
      const n = Math.max(0, Number(v) || 0);
      return n === 0 ? "0.00 D" : `-${n.toFixed(2)} D`;
    };

    const apply = () => {
      const v = Math.max(0, Number(range.value) || 0);
      const blurPx = corrected ? 0 : Math.min(14, v * 2.2);
      root.style.setProperty("--sim-blur", `${blurPx.toFixed(2)}px`);
      if (value) value.textContent = fmt(v);
      if (toggle) {
        toggle.setAttribute("aria-pressed", corrected ? "true" : "false");
        toggle.textContent = corrected
          ? "Volver a sin corrección"
          : "Ver con corrección";
      }
    };

    range.addEventListener("input", apply);
    if (toggle) {
      toggle.addEventListener("click", () => {
        corrected = !corrected;
        apply();
      });
    }

    apply();
  });
};

// Myopia predictor: projection lines with/without control (educational).
const setupMyopiaPredictor = () => {
  const root = document.querySelector("[data-myopia-predictor]");
  if (!root) return;

  const ageInput = root.querySelector("[data-predictor-age]");
  const ageValue = root.querySelector("[data-predictor-age-value]");
  const myopiaValue = root.querySelector("[data-predictor-myopia]");
  const summary = root.querySelector("[data-predictor-summary]");
  const grid = root.querySelector("[data-predictor-grid]");
  const lineNo = root.querySelector("[data-predictor-line-no-control]");
  const lineYes = root.querySelector("[data-predictor-line-control]");
  const pointNo = root.querySelector("[data-predictor-point-no]");
  const pointYes = root.querySelector("[data-predictor-point-yes]");
  const myopiaRange = document.querySelector("[data-myopia-range]");

  if (!ageInput || !grid || !lineNo || !lineYes || !myopiaRange) return;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const MIN_AGE = 6;
  const MAX_AGE = 18;
  const CONTROL_FACTOR = 0.5;
  const CHART = {
    width: 640,
    height: 300,
    left: 48,
    right: 18,
    top: 18,
    bottom: 36,
  };
  const AGE_BASE_RATES = {
    6: 0.65,
    7: 0.58,
    8: 0.51,
    9: 0.44,
    10: 0.37,
    11: 0.3,
    12: 0.23,
    13: 0.16,
    14: 0.09,
  };

  const fmtD = (v) => `${v.toFixed(2)} D`;
  const fmtAxisD = (v) => {
    const text = v.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
    return v === 0 ? "0 D" : `-${text} D`;
  };

  const scaleX = (age, startAge) => {
    const span = Math.max(1, MAX_AGE - startAge);
    return (
      CHART.left +
      ((CHART.width - CHART.left - CHART.right) * (age - startAge)) / span
    );
  };

  const scaleY = (d, minDiopters, maxDiopters) =>
    CHART.height -
    CHART.bottom -
    ((CHART.height - CHART.top - CHART.bottom) * (d - minDiopters)) /
      Math.max(0.25, maxDiopters - minDiopters);

  const getCurrentMyopia = () => Math.max(0.5, Number(myopiaRange.value || 0));

  const getAgeBaseRate = (age) => {
    const wholeAge = clamp(Math.floor(age), MIN_AGE, MAX_AGE - 1);
    return AGE_BASE_RATES[wholeAge] ?? 0.05;
  };

  // Approximate baseline-severity adjustment from the French paediatric cohort.
  const getSeverityBoost = (startMyopia) => {
    if (startMyopia < 1) return 0;
    if (startMyopia < 2) return 0.05;
    if (startMyopia < 3) return 0.065;
    if (startMyopia < 4) return 0.07;
    return 0.075;
  };

  const buildSeries = (startAge, startMyopia, factor) => {
    const points = [{ age: startAge, d: -startMyopia }];
    const severityBoost = getSeverityBoost(startMyopia);
    let currentMyopia = startMyopia;

    for (let age = startAge; age < MAX_AGE; age += 1) {
      currentMyopia += (getAgeBaseRate(age) + severityBoost) * factor;
      points.push({ age: age + 1, d: -currentMyopia });
    }

    return points;
  };

  const getGridStep = (minDiopters, maxDiopters) => {
    const range = maxDiopters - minDiopters;
    if (range <= 2) return 0.5;
    if (range <= 4) return 1;
    return 2;
  };

  const roundUpToStep = (value, step) => Math.ceil(value / step) * step;

  const buildDiopterTicks = (minDiopters, maxDiopters) => {
    const step = getGridStep(minDiopters, maxDiopters);
    const ticks = [Number(minDiopters.toFixed(2))];
    let tick = roundUpToStep(minDiopters, step);

    if (Math.abs(tick - minDiopters) < 0.001) tick += step;

    for (; tick < maxDiopters; tick += step) {
      ticks.push(Number(tick.toFixed(2)));
    }

    if (Math.abs(ticks[ticks.length - 1] - maxDiopters) > 0.001) {
      ticks.push(Number(maxDiopters.toFixed(2)));
    }

    return ticks;
  };

  const getChartBounds = (startMyopia, ...series) => {
    const rawMax = Math.max(...series.flat().map((point) => Math.abs(point.d)));
    const step = getGridStep(startMyopia, rawMax);

    return {
      minDiopters: startMyopia,
      maxDiopters: roundUpToStep(rawMax + step * 0.25, step),
    };
  };

  const buildAgeTicks = (startAge) => {
    const ages = [startAge];
    for (let age = startAge + 2; age <= MAX_AGE; age += 2) ages.push(age);
    if (ages[ages.length - 1] !== MAX_AGE) ages.push(MAX_AGE);
    return ages;
  };

  const drawGrid = (startAge, bounds) => {
    const ages = buildAgeTicks(startAge);
    const diopters = buildDiopterTicks(bounds.minDiopters, bounds.maxDiopters);

    grid.innerHTML = "";

    ages.forEach((age) => {
      const x = scaleX(age, startAge);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("class", "predictor-grid-line");
      line.setAttribute("x1", x);
      line.setAttribute("y1", CHART.top);
      line.setAttribute("x2", x);
      line.setAttribute("y2", CHART.height - CHART.bottom);
      grid.appendChild(line);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("class", "predictor-axis-label");
      label.setAttribute("x", x);
      label.setAttribute("y", CHART.height - 12);
      label.setAttribute("text-anchor", "middle");
      label.textContent = `${age}`;
      grid.appendChild(label);
    });

    diopters.forEach((diopter) => {
      const y = scaleY(diopter, bounds.minDiopters, bounds.maxDiopters);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("class", "predictor-grid-line");
      line.setAttribute("x1", CHART.left);
      line.setAttribute("y1", y);
      line.setAttribute("x2", CHART.width - CHART.right);
      line.setAttribute("y2", y);
      grid.appendChild(line);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("class", "predictor-axis-label");
      label.setAttribute("x", CHART.left - 8);
      label.setAttribute("y", y + 4);
      label.setAttribute("text-anchor", "end");
      label.textContent = fmtAxisD(diopter);
      grid.appendChild(label);
    });
  };

  const pointsToAttr = (series, startAge, bounds) =>
    series
      .map(
        (p) =>
          `${scaleX(p.age, startAge)},${scaleY(
            Math.abs(p.d),
            bounds.minDiopters,
            bounds.maxDiopters,
          )}`,
      )
      .join(" ");

  const drawChart = (startAge, seriesNo, seriesYes, bounds) => {
    lineNo.setAttribute("points", pointsToAttr(seriesNo, startAge, bounds));
    lineYes.setAttribute("points", pointsToAttr(seriesYes, startAge, bounds));

    const lastNo = seriesNo[seriesNo.length - 1];
    const lastYes = seriesYes[seriesYes.length - 1];
    if (pointNo) {
      pointNo.setAttribute("cx", scaleX(lastNo.age, startAge));
      pointNo.setAttribute(
        "cy",
        scaleY(Math.abs(lastNo.d), bounds.minDiopters, bounds.maxDiopters),
      );
    }
    if (pointYes) {
      pointYes.setAttribute("cx", scaleX(lastYes.age, startAge));
      pointYes.setAttribute(
        "cy",
        scaleY(Math.abs(lastYes.d), bounds.minDiopters, bounds.maxDiopters),
      );
    }
  };

  const update = () => {
    const age = clamp(Number(ageInput.value || 9), MIN_AGE, 16);
    ageInput.value = String(age);
    if (ageValue) ageValue.textContent = `${age} años`;

    const myopia = getCurrentMyopia();
    if (myopiaValue) myopiaValue.textContent = fmtD(-myopia);

    const seriesNo = buildSeries(age, myopia, 1);
    const seriesYes = buildSeries(age, myopia, CONTROL_FACTOR);
    const chartBounds = getChartBounds(myopia, seriesNo, seriesYes);
    drawGrid(age, chartBounds);
    drawChart(age, seriesNo, seriesYes, chartBounds);

    if (summary) {
      const lastNo = seriesNo[seriesNo.length - 1];
      const lastYes = seriesYes[seriesYes.length - 1];
      summary.textContent = `A los ${lastNo.age} años: sin control ${fmtD(
        lastNo.d,
      )} · con control ${fmtD(lastYes.d)} (aprox.).`;
    }
  };

  ageInput.addEventListener("input", update);
  myopiaRange.addEventListener("input", update);
  myopiaRange.addEventListener("change", update);

  update();
};

setupMyopiaSimulator();
setupMyopiaPredictor();
