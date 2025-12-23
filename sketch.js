// Cosmo Clock
// Last Update: December 2025
// MIT License

let scenarioData = []; // array of {t_cumulative, status, N10, N26, N36, R_26_10, R_36_10}
let currentFrame = 0;
let isPlaying = false;
let playButton, restartButton, speedSlider, speedLabel;
let frameCounter = 0;
let isDragging = false;

// UI: scenario picker
let scenarioButton, scenarioSummary;
let scenarioModal, exposureInput, burialInput, reExposureInput, closeModalButton, applyModalButton;

// decay constants (λ = ln(2) / t1/2)
const L_10 = Math.log(2) / 1.4e6;
const L_26 = Math.log(2) / 0.717e6;
const L_36 = Math.log(2) / 0.301e6;

// production ratios (P_x / P_10)
const Rp_26_10 = 7.0;
const Rp_36_10 = 3.0;

// production rates (atoms / g / yr)
const P_10 = 4.0;
const P_26 = Rp_26_10 * P_10; // 28
const P_36 = Rp_36_10 * P_10; // 12

// time step 
const DT_YEARS = 5000;

// display units
const AGE_UNIT = 1e3;
const AGE_UNIT_LABEL = "[kyr]";

// scenario bar
let barX, barY, barW, barH;

// scenario settings (Myr)
let scenarioSettings = {
  exposureMyr: 0.5,     // user-controlled exposure AFTER baseline
  burialMyr: 1.0,
  reExposureMyr: 0.5
};

// from Lal 1990
function stepExposure(N0, P, lambda, dtYears) {
  // N(t) = (P/lambda) * (1 - e^{-lambda t}) + N0 * e^{-lambda t}
  const e = Math.exp(-lambda * dtYears);
  return (P / lambda) * (1 - e) + N0 * e;
}

function stepBurial(N0, lambda, dtYears) {
  // N(t) = N0 * e^{-lambda t}  (P = 0 during burial)
  return N0 * Math.exp(-lambda * dtYears);
}

function safeRatio(num, den, fallback) {
  if (!isFinite(num) || !isFinite(den) || den <= 0) return fallback;
  const r = num / den;
  return isFinite(r) ? r : fallback;
}
// add in 0.5 Ma baseline exposure to initialize nuclide concentrations
function initializeBaselineExposure(baselineMyr) {
  let years = baselineMyr * 1e6;
  let steps = Math.round(years / DT_YEARS);

  let N10 = 0;
  let N26 = 0;
  let N36 = 0;

  for (let i = 0; i < steps; i++) {
    N10 = stepExposure(N10, P_10, L_10, DT_YEARS);
    N26 = stepExposure(N26, P_26, L_26, DT_YEARS);
    N36 = stepExposure(N36, P_36, L_36, DT_YEARS);
  }

  return { N10, N26, N36 };
}
// Build scenario time series for: Exposure → Burial → Re-exposure
function generateScenarioData(exposureMyr, burialMyr, reExposureMyr) {
  const exposureYears = Math.max(0, exposureMyr) * 1e6;
  const burialYears = Math.max(0, burialMyr) * 1e6;
  const reExposureYears = Math.max(0, reExposureMyr) * 1e6;

  // ---- BASELINE INITIALIZATION (0.5 Ma, not shown on timeline) ----
  const baseline = initializeBaselineExposure(0.5);
  let N10 = baseline.N10;
  let N26 = baseline.N26;
  let N36 = baseline.N36;

  let t = 0;
  const rows = [];

  // initial visible frame (t = 0 AFTER baseline)
  rows.push({
    t_cumulative: 0,
    status: "EXPOSURE",
    N10,
    N26,
    N36,
    R_26_10: N26 / N10,
    R_36_10: N36 / N10
  });

  const phases = [
  { status: "EXPOSURE", years: exposureYears, exposed: true },
  { status: "BURIAL", years: burialYears, exposed: false },
  { status: "EXPOSURE", years: reExposureYears, exposed: true }
];

  for (const phase of phases) {
    const steps = Math.round(phase.years / DT_YEARS);
    for (let i = 0; i < steps; i++) {
      if (phase.exposed) {
        N10 = stepExposure(N10, P_10, L_10, DT_YEARS);
        N26 = stepExposure(N26, P_26, L_26, DT_YEARS);
        N36 = stepExposure(N36, P_36, L_36, DT_YEARS);
      } else {
        N10 = stepBurial(N10, L_10, DT_YEARS);
        N26 = stepBurial(N26, L_26, DT_YEARS);
        N36 = stepBurial(N36, L_36, DT_YEARS);
      }

      t += DT_YEARS;

      rows.push({
        t_cumulative: t,
        status: phase.status,
        N10,
        N26,
        N36,
        R_26_10: safeRatio(N26, N10, 0),
        R_36_10: safeRatio(N36, N10, 0)
      });
    }
  }

  // ensure we have at least 2 frames so the UI behaves 
  if (rows.length < 2) rows.push({ ...rows[0], t_cumulative: DT_YEARS });

  return rows;
}

function applyScenario(exposureMyr, burialMyr, reExposureMyr) {
  scenarioSettings.exposureMyr = exposureMyr;
  scenarioSettings.burialMyr = burialMyr;
  scenarioSettings.reExposureMyr = reExposureMyr;

  scenarioData = generateScenarioData(exposureMyr, burialMyr, reExposureMyr);

  currentFrame = 0;
  isPlaying = false;
  frameCounter = 0;
  noLoop();
  updateScenarioSummary();
  drawFrame();
}

// ---------- p5 setup ----------
function setup() {
  createCanvas(850, 760);
  textAlign(CENTER, CENTER);
  frameRate(30);
  textFont("Helvetica, Arial, sans-serif");

  // control bar
  let controlBar = createDiv();
  controlBar.id("control-bar");
  controlBar.style("position", "fixed");
  controlBar.style("top", "10px");
  controlBar.style("left", "50%");
  controlBar.style("transform", "translateX(-50%)");
  controlBar.style("background", "rgba(255,255,255,0.9)");
  controlBar.style("backdrop-filter", "blur(6px)");
  controlBar.style("padding", "8px 16px");
  controlBar.style("border-radius", "12px");
  controlBar.style("box-shadow", "0 2px 12px rgba(0,0,0,0.12)");
  controlBar.style("display", "flex");
  controlBar.style("align-items", "center");
  controlBar.style("gap", "12px");
  controlBar.style("font-size", "14px");
  controlBar.style("z-index", "1000");

  // play/pause
  playButton = createButton("Play / Pause");
  styleButton(playButton, "#2e7d32");
  playButton.parent(controlBar);
  playButton.mousePressed(togglePlay);

  // restart
  restartButton = createButton("Restart");
  styleButton(restartButton, "#0277bd");
  restartButton.parent(controlBar);
  restartButton.mousePressed(restartAnimation);

  // scenario button + summary
  scenarioButton = createButton("Scenario…");
  styleButton(scenarioButton, "#6a1b9a");
  scenarioButton.parent(controlBar);
  scenarioButton.mousePressed(() => showScenarioModal(true));

  scenarioSummary = createSpan("");
  scenarioSummary.style("margin-left", "4px");
  scenarioSummary.style("color", "#333");
  scenarioSummary.parent(controlBar);

  // speed
  speedLabel = createSpan("Speed 1.0×");
  speedLabel.style("margin-left", "6px");
  speedLabel.parent(controlBar);

  speedSlider = createSlider(0.1, 5, 1, 0.1);
  speedSlider.parent(controlBar);
  speedSlider.style("width", "120px");
  speedSlider.input(() => {
    speedLabel.html(`Speed ${speedSlider.value().toFixed(1)}×`);
  });

  // scenario bar geometry
  barW = 700;
  barH = 26;
  barX = (width - barW) / 2;
  barY = height - 90;

  // modal UI (scenario picker)
  buildScenarioModal();

  // compute default scenario (0.5 Ma exposure baseline)
  applyScenario(scenarioSettings.exposureMyr, scenarioSettings.burialMyr, scenarioSettings.reExposureMyr);

  // show scenario picker on load (user can close if they want defaults)
  showScenarioModal(true);

  noLoop();
  drawFrame();
}

function styleButton(btn, color) {
  btn.style("font-size", "13px");
  btn.style("padding", "6px 12px");
  btn.style("border", "none");
  btn.style("border-radius", "8px");
  btn.style("color", "white");
  btn.style("background-color", color);
  btn.style("cursor", "pointer");
  btn.mouseOver(() => btn.style("opacity", "0.85"));
  btn.mouseOut(() => btn.style("opacity", "1"));
}

function togglePlay() {
  isPlaying = !isPlaying;
  if (isPlaying) loop();
  else noLoop();
}

function restartAnimation() {
  currentFrame = 0;
  isPlaying = false;
  frameCounter = 0;
  noLoop();
  drawFrame();
}

// ---------- scenario modal ----------
function buildScenarioModal() {
  scenarioModal = createDiv();
  scenarioModal.id("scenario-modal");
  scenarioModal.style("position", "fixed");
  scenarioModal.style("inset", "0");
  scenarioModal.style("display", "none");
  scenarioModal.style("align-items", "center");
  scenarioModal.style("justify-content", "center");
  scenarioModal.style("background", "rgba(0,0,0,0.35)");
  scenarioModal.style("z-index", "2000");

  let card = createDiv();
  card.parent(scenarioModal);
  card.style("background", "white");
  card.style("border-radius", "16px");
  card.style("padding", "18px 18px 14px 18px");
  card.style("width", "460px");
  card.style("box-shadow", "0 12px 30px rgba(0,0,0,0.25)");
  card.style("font-family", "Helvetica, Arial, sans-serif");

  let title = createDiv("<b>Choose scenario (Exposure → Burial → Re-exposure)</b>");
  title.parent(card);
  title.style("font-size", "16px");
  title.style("margin-bottom", "8px");

  let note = createDiv(
  "Note: The clock starts <b>after</b> an initial <b>0.5 Ma exposure</b> " +
  "used to initialize all nuclide concentrations. " +
  "This baseline exposure is not shown on the timeline."
);

  note.parent(card);
  note.style("font-size", "13px");
  note.style("line-height", "1.25");
  note.style("color", "#333");
  note.style("margin-bottom", "14px");

  // form rows
  const rowStyle = (r) => {
    r.style("display", "grid");
    r.style("grid-template-columns", "1fr 140px");
    r.style("gap", "10px");
    r.style("align-items", "center");
    r.style("margin", "8px 0");
  };

  let r1 = createDiv(); r1.parent(card); rowStyle(r1);
  createDiv("Initial exposure duration (Ma)").parent(r1).style("font-size", "13px");
  exposureInput = createInput(String(scenarioSettings.exposureMyr));
  exposureInput.parent(r1);
  exposureInput.style("padding", "6px 8px");
  exposureInput.style("border", "1px solid #ddd");
  exposureInput.style("border-radius", "10px");

  let r2 = createDiv(); r2.parent(card); rowStyle(r2);
  createDiv("Burial duration (Ma)").parent(r2).style("font-size", "13px");
  burialInput = createInput(String(scenarioSettings.burialMyr));
  burialInput.parent(r2);
  burialInput.style("padding", "6px 8px");
  burialInput.style("border", "1px solid #ddd");
  burialInput.style("border-radius", "10px");

  let r3 = createDiv(); r3.parent(card); rowStyle(r3);
  createDiv("Re-exposure duration (Ma)").parent(r3).style("font-size", "13px");
  reExposureInput = createInput(String(scenarioSettings.reExposureMyr));
  reExposureInput.parent(r3);
  reExposureInput.style("padding", "6px 8px");
  reExposureInput.style("border", "1px solid #ddd");
  reExposureInput.style("border-radius", "10px");

  // buttons
  let btnRow = createDiv();
  btnRow.parent(card);
  btnRow.style("display", "flex");
  btnRow.style("gap", "10px");
  btnRow.style("justify-content", "flex-end");
  btnRow.style("margin-top", "14px");

  closeModalButton = createButton("Close");
  closeModalButton.parent(btnRow);
  closeModalButton.style("font-size", "13px");
  closeModalButton.style("padding", "6px 12px");
  closeModalButton.style("border", "1px solid #ddd");
  closeModalButton.style("border-radius", "10px");
  closeModalButton.style("background", "white");
  closeModalButton.style("cursor", "pointer");
  closeModalButton.mousePressed(() => showScenarioModal(false));

  applyModalButton = createButton("Apply");
  applyModalButton.parent(btnRow);
  styleButton(applyModalButton, "#2e7d32");
  applyModalButton.mousePressed(() => {
    const e = parseFloat(exposureInput.value());
    const b = parseFloat(burialInput.value());
    const r = parseFloat(reExposureInput.value());

    // basic validation (fallback to previous if invalid)
    const exp = isFinite(e) && e >= 0 ? e : scenarioSettings.exposureMyr;
    const bur = isFinite(b) && b >= 0 ? b : scenarioSettings.burialMyr;
    const rex = isFinite(r) && r >= 0 ? r : scenarioSettings.reExposureMyr;

    applyScenario(exp, bur, rex);
    showScenarioModal(false);
  });

  // close if clicking backdrop
  scenarioModal.mousePressed(() => {
    // only close if the click is on the overlay, not the card
    if (mouseX < 0 || mouseY < 0) return;
  });
}

function showScenarioModal(show) {
  scenarioModal.style("display", show ? "flex" : "none");
  if (show) {
    exposureInput.value(String(scenarioSettings.exposureMyr));
    burialInput.value(String(scenarioSettings.burialMyr));
    reExposureInput.value(String(scenarioSettings.reExposureMyr));
  }
}

function updateScenarioSummary() {
  scenarioSummary.html(
    `E ${scenarioSettings.exposureMyr.toFixed(2)} Ma · ` +
    `B ${scenarioSettings.burialMyr.toFixed(2)} Ma · ` +
    `E ${scenarioSettings.reExposureMyr.toFixed(2)} Ma`
  );
}

// ---------- animation loop ----------
function draw() {
  drawFrame();

  if (!isPlaying && !isDragging) return;

  let speedFactor = speedSlider.value();
  let frameDelay = int(6 / speedFactor);
  if (frameDelay < 1) frameDelay = 1;

  frameCounter++;
  if (frameCounter >= frameDelay) {
    frameCounter = 0;
    if (currentFrame < scenarioData.length - 1) {
      currentFrame++;
    } else {
      isPlaying = false;
      noLoop();
    }
  }
}

// frame drawing
function drawFrame() {
  background(250);

  if (!scenarioData || scenarioData.length === 0) return;

  let row = scenarioData[currentFrame];
  let R_26_10 = row.R_26_10;
  let R_36_10 = row.R_36_10;
  let cumulativeTime = row.t_cumulative;
  let status = row.status;

  // calculate apparent burial ages
  // t = ln(R_measured / R_initial) / (λ10 - λx)
  let t_app_26 = Math.log(Rp_26_10 / R_26_10) / (L_26 - L_10);
  let t_app_36 = Math.log(Rp_36_10 / R_36_10) / (L_36 - L_10);
  t_app_26 = isFinite(t_app_26) && t_app_26 > 0 ? t_app_26 : 0;
  t_app_36 = isFinite(t_app_36) && t_app_36 > 0 ? t_app_36 : 0;

  let t_app_26_disp = t_app_26 / AGE_UNIT;
  let t_app_36_disp = t_app_36 / AGE_UNIT;

  // header
  textSize(34);
  fill(60);
  text("Scenario:", width / 2, 150);

  if (status === "BURIAL") {
    fill(0, 0, 200);
    text("BURIAL", width / 2, 180);
  } else if (status === "EXPOSURE") {
    fill(200, 0, 0);
    text("EXPOSURE", width / 2, 180);
  } else {
    fill(100);
    text("-", width / 2, 180);
  }

  // note on baseline exposure
  textSize(12);
  fill(90);
  text(
    `Initial concentrations: 0.5 Ma exposure for all nuclides.`,
    width / 2,
    210
  );

  // clocks
  drawClock(
    250,
    420,
    "26Al / 10Be Clock (Long Memory)",
    R_26_10,
    Rp_26_10,
    t_app_26_disp,
    cumulativeTime
  );
  drawClock(
    600,
    420,
    "36Cl / 10Be Clock (Short Memory)",
    R_36_10,
    Rp_36_10,
    t_app_36_disp,
    cumulativeTime
  );

  drawScenarioBar();
}

// clock viz
function drawClock(x, y, title, currentRatio, prodRatio, apparentAgeDisp, cumulativeTime) {
  let clockMinRatio = 0;
  let clockMaxRatio = prodRatio;

  if (isNaN(currentRatio) || !isFinite(currentRatio)) currentRatio = 0;
  currentRatio = constrain(currentRatio, clockMinRatio, clockMaxRatio);

  noStroke();
  fill(255);
  rectMode(CENTER);
  drawingContext.shadowBlur = 14;
  drawingContext.shadowColor = "rgba(0,0,0,0.12)";
  rect(x, y, 300, 360, 18);
  drawingContext.shadowBlur = 0;

  // swiss railway clock
  noFill();
  strokeWeight(6);
  stroke(20);
  circle(x, y, 232);

  strokeWeight(2);
  stroke(180);
  circle(x, y, 220);

  for (let ratioTick = 0; ratioTick <= clockMaxRatio; ratioTick += 0.25) {
    let isMajor = Math.abs(ratioTick % 1.0) < 1e-6;
    let tickAngle = map(ratioTick, 0, clockMaxRatio, 90, -90);
    let rad = radians(tickAngle);
    let outR = 110;
    let inR = isMajor ? 88 : 98;
    let x1 = x + cos(rad) * outR;
    let y1 = y + sin(rad) * outR;
    let x2 = x + cos(rad) * inR;
    let y2 = y + sin(rad) * inR;
    strokeWeight(isMajor ? 3 : 1);
    stroke(20);
    line(x1, y1, x2, y2);

    if (isMajor) {
      let x_num = x + cos(rad) * 72;
      let y_num = y + sin(rad) * 72;
      noStroke();
      fill(10);
      textSize(12);
      text(nf(ratioTick, 0, 0), x_num, y_num);
    }
  }

  // hand
  let handAngle = map(currentRatio, 0, clockMaxRatio, 90, -90);
  let handRad = radians(handAngle);
  stroke(200, 30, 30);
  strokeWeight(5);
  line(x, y, x + cos(handRad) * 95, y + sin(handRad) * 95);

  // hub
  fill(20);
  noStroke();
  circle(x, y, 12);

  push();
  fill(40);
  textSize(12);
  textAlign(LEFT, CENTER);
  let ratioLabelX = x - 90;
  let ratioLabelY = y - 20;
  text(`Ratio: ${currentRatio.toFixed(3)}`, ratioLabelX, ratioLabelY);
  textAlign(CENTER, CENTER);
  pop();

  noStroke();
  fill(20);
  textSize(16);
  text(title, x, y - 140);

  textSize(18);
  fill(0, 0, 150);
  text("Burial Age " + AGE_UNIT_LABEL, x, y + 140);
  textSize(26);
  fill(10);
  text(apparentAgeDisp.toFixed(2), x, y + 170);

  textSize(14);
  fill(100);
  text("Total Scenario Time [kyr]", x, y + 200);
  textSize(18);
  text((cumulativeTime / AGE_UNIT).toFixed(0), x, y + 228);
}

// scenario bar
function drawScenarioBar() {
  push();
  rectMode(CORNER);
  noStroke();
  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = "rgba(0,0,0,0.12)";
  fill(255);
  rect(barX - 6, barY - 6, barW + 12, barH + 12, 10);
  drawingContext.shadowBlur = 0;

  let n = scenarioData.length;
  let segW = barW / n;

  for (let i = 0; i < n; i++) {
    let s = scenarioData[i].status;
    if (s === "BURIAL") fill(0, 92, 255);
    else if (s === "EXPOSURE") fill(230, 38, 38);
    else fill(200);
    rect(barX + i * segW, barY, segW + 1, barH);
  }

  let arrowX = barX + map(currentFrame, 0, n - 1, 0, barW);
  fill("#FFD600");
  noStroke();
  triangle(arrowX - 9, barY - 14, arrowX + 9, barY - 14, arrowX, barY - 3);

  fill(50);
  textSize(16);
  text("Scenario Overview", width / 2, barY - 28);
  pop();
}

// bar interactive
function mousePressed() {
  if (
    mouseX > barX &&
    mouseX < barX + barW &&
    mouseY > barY - 18 &&
    mouseY < barY + barH + 18
  ) {
    isDragging = true;
    noLoop();
    updateFrameFromMouse();
  }
}

function mouseDragged() {
  if (isDragging) updateFrameFromMouse();
}

function mouseReleased() {
  if (isDragging) {
    isDragging = false;
    if (isPlaying) loop();
  }
}

function updateFrameFromMouse() {
  let relX = constrain(mouseX - barX, 0, barW);
  let n = scenarioData.length;
  currentFrame = int(map(relX, 0, barW, 0, n - 1));
  drawFrame();
}
