// Cosmo Clock
// Updated: May 2026
// MIT License

let scenarioData = [];
let currentFrame = 0;
let isPlaying = false;
let playButton, restartButton, speedSlider, speedLabel;
let frameCounter = 0;
let isDragging = false;
let controlBar;
let advancedBar;

// UI: scenario picker
let scenarioButton, scenarioSummary;
let scenarioModal, exposureInput, burialInput, reExposureInput, closeModalButton, applyModalButton;

// decay constants (lambda = ln(2) / t1/2)
const L_10 = Math.log(2) / 1.4e6;
const L_36 = Math.log(2) / 0.301e6;

// production rates (atoms / g / yr)
const P_10 = 4.0;
const P_3 = 100.0;
const P_36 = 12.0;

// production ratios retained as raw reference values
const Rp_3_10 = P_3 / P_10;
const Rp_3_36 = P_3 / P_36;

// time step
const DT_YEARS = 5000;

// precompute step factors to avoid per-iteration exp calls
const DECAY_10 = Math.exp(-L_10 * DT_YEARS);
const DECAY_36 = Math.exp(-L_36 * DT_YEARS);
const EXPOSURE_STEP_10 = (P_10 / L_10) * (1 - DECAY_10);
const EXPOSURE_STEP_3 = P_3 * DT_YEARS;
const EXPOSURE_STEP_36 = (P_36 / L_36) * (1 - DECAY_36);

// --- FIXED INITIAL CONDITION ---
const INITIAL_STATE = {
  t_cumulative_years: 5000,
  N10: 19975.27,
  N3: 500000.00,
  N36: 59655.90
};

// display units
const AGE_UNIT = 1e3;
const AGE_UNIT_LABEL = "kyr";

// canvas/layout
const CANVAS_W = 1250;
const CANVAS_H = 900;

// scenario bar geometry
let barX, barY, barW, barH;

// Colors matching the bar
const COLOR_EXPO = [230, 38, 38];
const COLOR_BURIAL = [0, 92, 255];
const COLOR_CARD = [255, 255, 255];
const COLOR_TEXT = [29, 36, 51];
const COLOR_MUTED = [90, 98, 115];

// Settings (Default: 0.5 -> 1.0 -> 0.5)
let scenarioSettings = {
  exposureMyr: 0.5,
  burialMyr: 1.0,
  reExposureMyr: 0.5
};

// ---------- model helpers ----------
function stepExposure(N0, decayFactor, productionStep) {
  return productionStep + N0 * decayFactor;
}

function stepBurial(N0, decayFactor) {
  return N0 * decayFactor;
}

function stepExposureStable(N0, productionStep) {
  return N0 + productionStep;
}

function stepBurialStable(N0) {
  return N0;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function buildRow(t, status, N10, N3, N36, Rburial3_10, Rburial3_36, phaseIndex) {
  const R_3_10 = N3 / N10;
  const R_3_36 = N3 / N36;
  const Rnorm_3_10 = Rburial3_10 ? clamp01(Rburial3_10 / R_3_10) : 1;
  const Rnorm_3_36 = Rburial3_36 ? clamp01(Rburial3_36 / R_3_36) : 1;

  return {
    t_cumulative: t,
    status,
    phaseIndex,
    N10,
    N3,
    N36,
    R_3_10,
    R_3_36,
    Rnorm_3_10,
    Rnorm_3_36,
    Rbase_3_10: Rburial3_10,
    Rbase_3_36: Rburial3_36
  };
}

function generateScenarioData(exposureMyr, burialMyr, reExposureMyr) {
  const exposureYears = Math.max(0, exposureMyr) * 1e6;
  const burialYears = Math.max(0, burialMyr) * 1e6;
  const reExposureYears = Math.max(0, reExposureMyr) * 1e6;

  let N10 = INITIAL_STATE.N10;
  let N3 = INITIAL_STATE.N3;
  let N36 = INITIAL_STATE.N36;
  let t = INITIAL_STATE.t_cumulative_years;
  let burialStarted = false;
  let Rburial_3_10 = null;
  let Rburial_3_36 = null;

  const rows = [];
  rows.push(buildRow(t, "EXPOSURE", N10, N3, N36, null, null, 0));

  const phases = [
    { status: "EXPOSURE", years: exposureYears, exposed: true, phaseIndex: 0 },
    { status: "BURIAL", years: burialYears, exposed: false, phaseIndex: 1 },
    { status: "EXPOSURE", years: reExposureYears, exposed: true, phaseIndex: 2 }
  ];

  for (const phase of phases) {
    if (phase.years <= 0) continue;
    const steps = Math.max(1, Math.round(phase.years / DT_YEARS));

    for (let i = 0; i < steps; i++) {
      if (phase.exposed) {
        N10 = stepExposure(N10, DECAY_10, EXPOSURE_STEP_10);
        N3 = stepExposureStable(N3, EXPOSURE_STEP_3);
        N36 = stepExposure(N36, DECAY_36, EXPOSURE_STEP_36);
      } else {
        N10 = stepBurial(N10, DECAY_10);
        N3 = stepBurialStable(N3);
        N36 = stepBurial(N36, DECAY_36);
      }

      if (phase.status === "BURIAL" && !burialStarted) {
        burialStarted = true;
        Rburial_3_10 = N3 / N10;
        Rburial_3_36 = N3 / N36;
      }

      t += DT_YEARS;
      rows.push(
        buildRow(
          t,
          phase.status,
          N10,
          N3,
          N36,
          burialStarted ? Rburial_3_10 : null,
          burialStarted ? Rburial_3_36 : null,
          phase.phaseIndex
        )
      );
    }
  }

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

function computeStableExposureAge(N, productionRate) {
  return N / productionRate;
}

function computeApparentBurialAges(row) {
  const Rref_3_10 = isFinite(row.Rbase_3_10) ? row.Rbase_3_10 : Rp_3_10;
  const Rref_3_36 = isFinite(row.Rbase_3_36) ? row.Rbase_3_36 : Rp_3_36;

  let t_app_3_10 = Math.log(row.R_3_10 / Rref_3_10) / L_10;
  let t_app_3_36 = Math.log(row.R_3_36 / Rref_3_36) / L_36;

  if (!isFinite(t_app_3_10) || t_app_3_10 < 0) t_app_3_10 = 0;
  if (!isFinite(t_app_3_36) || t_app_3_36 < 0) t_app_3_36 = 0;

  if (row.status === "EXPOSURE" && row.Rbase_3_10 === null) {
    t_app_3_10 = 0;
    t_app_3_36 = 0;
  }

  return { t_app_3_10, t_app_3_36 };
}

// ---------- p5 setup ----------
function setup() {
  createCanvas(CANVAS_W, CANVAS_H);
  textAlign(CENTER, CENTER);
  frameRate(30);
  textFont("Helvetica, Arial, sans-serif");

  buildControlPanel();
  buildAdvancedPanel();

  // top scenario bar geometry
  barW = 930;
  barH = 28;
  barX = 160;
  barY = 95;

  buildScenarioModal();
  applyScenario(scenarioSettings.exposureMyr, scenarioSettings.burialMyr, scenarioSettings.reExposureMyr);

  noLoop();
  drawFrame();
}

function buildControlPanel() {
  controlBar = createDiv();
  controlBar.id("control-bar");
  controlBar.addClass("control-bar");
  controlBar.style("position", "fixed");
  controlBar.style("right", "18px");
  controlBar.style("top", "120px");
  controlBar.style("left", "auto");
  controlBar.style("transform", "none");
  controlBar.style("display", "flex");
  controlBar.style("flex-direction", "column");
  controlBar.style("align-items", "stretch");
  controlBar.style("gap", "10px");
  controlBar.style("width", "136px");
  controlBar.style("padding", "14px");

  playButton = createButton("Play / Pause");
  styleButton(playButton, "#2e7d32");
  playButton.parent(controlBar);
  playButton.mousePressed(togglePlay);

  restartButton = createButton("Restart");
  styleButton(restartButton, "#0277bd");
  restartButton.parent(controlBar);
  restartButton.mousePressed(restartAnimation);

  speedLabel = createSpan("Speed 1.0x");
  speedLabel.addClass("speed-label");
  speedLabel.parent(controlBar);
  speedLabel.style("font-weight", "600");
  speedLabel.style("text-align", "center");

  speedSlider = createSlider(0.1, 5, 1, 0.1);
  speedSlider.parent(controlBar);
  speedSlider.addClass("speed-slider");
  speedSlider.style("width", "100%");
  speedSlider.input(() => {
    speedLabel.html(`Speed ${speedSlider.value().toFixed(1)}x`);
  });
}

function buildAdvancedPanel() {
  advancedBar = createDiv();
  advancedBar.id("advanced-bar");
  advancedBar.addClass("control-bar");
  advancedBar.style("position", "fixed");
  advancedBar.style("left", "50%");
  advancedBar.style("bottom", "14px");
  advancedBar.style("top", "auto");
  advancedBar.style("transform", "translateX(-50%)");
  advancedBar.style("display", "flex");
  advancedBar.style("align-items", "center");
  advancedBar.style("gap", "12px");
  advancedBar.style("padding", "8px 14px");
  advancedBar.style("font-size", "12px");

  scenarioButton = createButton("Scenario Settings");
  styleButton(scenarioButton, "#6a1b9a");
  scenarioButton.parent(advancedBar);
  scenarioButton.mousePressed(() => showScenarioModal(true));

  scenarioSummary = createSpan("");
  scenarioSummary.addClass("scenario-summary");
  scenarioSummary.parent(advancedBar);
}

function styleButton(btn, color) {
  btn.addClass("ui-button");
  btn.style("background-color", color);
  btn.style("width", "100%");
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
  scenarioModal.addClass("modal");

  let card = createDiv();
  card.parent(scenarioModal);
  card.addClass("modal-card");

  let title = createDiv("<b>Choose scenario (Exposure → Burial → Re-exposure)</b>");
  title.parent(card);
  title.addClass("modal-title");

  const rowStyle = (r) => {
    r.addClass("modal-row");
  };

  let r1 = createDiv();
  r1.parent(card);
  rowStyle(r1);
  createDiv("Initial exposure duration (Ma)").parent(r1).style("font-size", "13px");
  exposureInput = createInput(String(scenarioSettings.exposureMyr));
  exposureInput.parent(r1);
  exposureInput.addClass("modal-input");

  let r2 = createDiv();
  r2.parent(card);
  rowStyle(r2);
  createDiv("Burial duration (Ma)").parent(r2).style("font-size", "13px");
  burialInput = createInput(String(scenarioSettings.burialMyr));
  burialInput.parent(r2);
  burialInput.addClass("modal-input");

  let r3 = createDiv();
  r3.parent(card);
  rowStyle(r3);
  createDiv("Re-exposure duration (Ma)").parent(r3).style("font-size", "13px");
  reExposureInput = createInput(String(scenarioSettings.reExposureMyr));
  reExposureInput.parent(r3);
  reExposureInput.addClass("modal-input");

  let btnRow = createDiv();
  btnRow.parent(card);
  btnRow.addClass("modal-actions");

  closeModalButton = createButton("Close");
  closeModalButton.parent(btnRow);
  closeModalButton.addClass("ui-button");
  closeModalButton.addClass("ui-button--ghost");
  closeModalButton.mousePressed(() => showScenarioModal(false));

  applyModalButton = createButton("Apply");
  applyModalButton.parent(btnRow);
  styleButton(applyModalButton, "#2e7d32");
  applyModalButton.mousePressed(() => {
    const e = parseFloat(exposureInput.value());
    const b = parseFloat(burialInput.value());
    const r = parseFloat(reExposureInput.value());

    const exp = isFinite(e) && e >= 0 ? e : scenarioSettings.exposureMyr;
    const bur = isFinite(b) && b >= 0 ? b : scenarioSettings.burialMyr;
    const rex = isFinite(r) && r >= 0 ? r : scenarioSettings.reExposureMyr;

    applyScenario(exp, bur, rex);
    showScenarioModal(false);
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
  if (!scenarioSummary) return;
  scenarioSummary.html(
    `E ${scenarioSettings.exposureMyr.toFixed(2)} Ma  |  ` +
    `B ${scenarioSettings.burialMyr.toFixed(2)} Ma  |  ` +
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

// ---------- frame drawing ----------
function drawFrame() {
  background(250);
  if (!scenarioData || scenarioData.length === 0) return;

  const row = scenarioData[currentFrame];
  const { t_app_3_10, t_app_3_36 } = computeApparentBurialAges(row);
  const t_exp_3 = computeStableExposureAge(row.N3, P_3);

  drawTitle();
  drawScenarioBar();
  drawLandscapeHeadliner(160, 145, 930, 185, row.status);

  drawFuelTank(80, 405, 280, 370, row, t_exp_3);

  drawBurialClockCard(
    405,
    395,
    330,
    390,
    "3He / 10Be",
    row.Rnorm_3_10,
    t_app_3_10 / AGE_UNIT,
    row.status
  );

  drawBurialClockCard(
    770,
    395,
    330,
    390,
    "3He / 36Cl",
    row.Rnorm_3_36,
    t_app_3_36 / AGE_UNIT,
    row.status
  );

  drawClockLinkageBadge(665, 800, t_app_3_10, t_app_3_36, row);
  drawCurrentTimeReadout(1080, 350, row);
}

function drawTitle() {
  noStroke();
  fill(COLOR_TEXT);
  textSize(28);
  textStyle(BOLD);
  text("Exposure → Burial → Re-exposure", width / 2, 43);
  textStyle(NORMAL);
}

function drawCard(x, y, w, h, r = 18) {
  push();
  rectMode(CORNER);
  noStroke();
  drawingContext.shadowBlur = 14;
  drawingContext.shadowColor = "rgba(0,0,0,0.12)";
  fill(COLOR_CARD);
  rect(x, y, w, h, r);
  drawingContext.shadowBlur = 0;
  pop();
}

// ---------- top scenario bar ----------
function drawScenarioBar() {
  push();
  rectMode(CORNER);
  drawCard(barX - 10, barY - 10, barW + 20, barH + 48, 12);

  const n = scenarioData.length;
  const totalTime = scenarioData[n - 1].t_cumulative;
  const segW = barW / n;

  noStroke();
  for (let i = 0; i < n; i++) {
    let s = scenarioData[i].status;
    if (s === "BURIAL") fill(COLOR_BURIAL);
    else fill(COLOR_EXPO);
    rect(barX + i * segW, barY, segW + 1, barH);
  }

  drawPhaseLabels(totalTime);
  drawTimeTicks(totalTime);

  const arrowX = barX + map(currentFrame, 0, n - 1, 0, barW);
  fill("#FFD600");
  noStroke();
  triangle(arrowX - 9, barY - 15, arrowX + 9, barY - 15, arrowX, barY - 3);

  pop();
}

function drawPhaseLabels(totalTime) {
  const durations = [
    Math.max(0, scenarioSettings.exposureMyr) * 1e6,
    Math.max(0, scenarioSettings.burialMyr) * 1e6,
    Math.max(0, scenarioSettings.reExposureMyr) * 1e6
  ];
  const labels = ["Exposure", "Burial", "Re-exposure"];
  const colors = [COLOR_EXPO, COLOR_BURIAL, COLOR_EXPO];

  let start = INITIAL_STATE.t_cumulative_years;
  textSize(13);
  textAlign(CENTER, BOTTOM);
  textStyle(BOLD);

  for (let i = 0; i < durations.length; i++) {
    if (durations[i] <= 0) continue;
    const phaseStart = start;
    const phaseEnd = start + durations[i];
    const x1 = map(phaseStart, INITIAL_STATE.t_cumulative_years, totalTime, barX, barX + barW);
    const x2 = map(phaseEnd, INITIAL_STATE.t_cumulative_years, totalTime, barX, barX + barW);
    const cx = (x1 + x2) / 2;

    fill(colors[i]);
    text(labels[i], cx, barY - 18);
    start = phaseEnd;
  }
  textStyle(NORMAL);
}

function drawTimeTicks(totalTime) {
  const maxMa = totalTime / 1e6;
  let tickIntervalMa = 0.5;
  if (maxMa <= 1.0) tickIntervalMa = 0.25;
  if (maxMa > 3.0) tickIntervalMa = 1.0;

  fill(80);
  textSize(10);
  textAlign(CENTER, TOP);
  stroke(150);
  strokeWeight(1);

  for (let ma = 0; ma <= maxMa + 0.001; ma += tickIntervalMa) {
    const tYears = ma * 1e6;
    const xPos = map(tYears, 0, totalTime, barX, barX + barW);
    line(xPos, barY + barH, xPos, barY + barH + 6);
    noStroke();
    text(ma.toFixed(1) + " Ma", xPos, barY + barH + 8);
    stroke(150);
  }
}

// ---------- bedrock / ice sheet headliner ----------
function drawLandscapeHeadliner(x, y, w, h, status) {
  drawCard(x, y, w, h, 18);

  push();
  translate(x, y);
  const margin = 18;
  const sceneX = margin;
  const sceneY = 22;
  const sceneW = w - margin * 2;
  const sceneH = h - margin * 2;
  const groundY = sceneY + sceneH * 0.66;

  // sky
  noStroke();
  fill(255);
  rect(sceneX, sceneY, sceneW, groundY - sceneY);

  // bedrock
  fill(COLOR_EXPO);
  rect(sceneX, groundY, sceneW, sceneY + sceneH - groundY, 0, 0, 10, 10);

  fill(255, 255, 255, 210);
  textSize(14);
  textStyle(BOLD);
  text("Bedrock", sceneX + sceneW / 2, groundY + 38);
  textStyle(NORMAL);

  if (status === "BURIAL") {
    drawIceSheet(sceneX, sceneY, sceneW, groundY);
  } else {
    drawCosmicRays(sceneX, sceneY, sceneW, groundY);
  }

  pop();
}

function drawIceSheet(sceneX, sceneY, sceneW, groundY) {
  fill(0, 92, 255, 230);
  stroke(0, 60, 180);
  strokeWeight(2);

  const iceTopY = sceneY + 14;
  const iceLeftY = groundY - (groundY - sceneY) * 0.45;

  beginShape();
  vertex(sceneX, groundY);
  vertex(sceneX, iceLeftY);
  bezierVertex(
    sceneX + sceneW * 0.22, iceTopY + 8,
    sceneX + sceneW * 0.55, iceTopY - 10,
    sceneX + sceneW, iceTopY + 12
  );
  vertex(sceneX + sceneW, groundY);
  endShape(CLOSE);

  noStroke();
  fill(255);
  textSize(16);
  textStyle(BOLD);
  text("Ice sheet", sceneX + sceneW / 2, sceneY + 55);
  textStyle(NORMAL);
}

function drawCosmicRays(sceneX, sceneY, sceneW, groundY) {
  stroke(255, 190, 0);
  strokeWeight(2);
  const rayCount = 13;

  for (let i = 0; i < rayCount; i++) {
    const xPos = sceneX + (sceneW * (i + 1)) / (rayCount + 1);
    const offset = (frameCount * 3 + i * 18) % (groundY - sceneY - 8);
    const yPos = sceneY + offset + 8;
    line(xPos, yPos, xPos, yPos - 22);
    line(xPos, yPos, xPos - 4, yPos - 7);
    line(xPos, yPos, xPos + 4, yPos - 7);
  }

  noStroke();
  fill(190, 100, 0);
  textSize(16);
  textStyle(BOLD);
  text("Cosmic rays", sceneX + sceneW / 2, sceneY + 48);
  textStyle(NORMAL);
}

// ---------- 3He fuel tank ----------
function drawFuelTank(x, y, w, h, row, exposureAgeYears) {
  drawCard(x, y, w, h, 18);

  push();
  translate(x, y);
  noStroke();
  fill(COLOR_TEXT);
  textSize(20);
  textStyle(BOLD);
  text("3He fuel tank", w / 2, 34);
  textStyle(NORMAL);

  fill(COLOR_MUTED);
  textSize(12);
  const caption = row.status === "BURIAL" ? "held constant under ice" : "fills during exposure";
  text(caption, w / 2, 58);

  const tankX = w / 2 - 58;
  const tankY = 88;
  const tankW = 116;
  const tankH = 220;
  const maxN3 = scenarioData[scenarioData.length - 1].N3;
  const frac = constrain(row.N3 / maxN3, 0, 1);
  const fillH = tankH * frac;

  // unit label for the tank scale
  fill(COLOR_MUTED);
  textSize(11);
  text("3He inventory", w / 2, 76);
  text("atoms / g rock", w / 2, 91);

  // tank shell
  stroke(35);
  strokeWeight(4);
  fill(255);
  rect(tankX, tankY, tankW, tankH, 22);

  // fill
  noStroke();
  fill(COLOR_EXPO[0], COLOR_EXPO[1], COLOR_EXPO[2], row.status === "BURIAL" ? 150 : 215);
  rect(tankX + 7, tankY + tankH - fillH + 7, tankW - 14, Math.max(0, fillH - 14), 0, 0, 15, 15);

  // level marks with units, shown as millions of atoms/g
  textAlign(LEFT, CENTER);
  stroke(80, 80, 80, 120);
  strokeWeight(1);
  for (let i = 0; i <= 5; i++) {
    const yy = tankY + tankH - (tankH * i) / 5;
    line(tankX + tankW + 8, yy, tankX + tankW + 25, yy);
    noStroke();
    fill(COLOR_MUTED);
    textSize(10);
    const labelM = (maxN3 * i / 5) / 1e6;
    text(`${labelM.toFixed(1)}M`, tankX + tankW + 30, yy);
    stroke(80, 80, 80, 120);
  }
  textAlign(CENTER, CENTER);

  noStroke();
  fill(COLOR_TEXT);
  textSize(13);
  text("exposure age", w / 2, h - 50);

  // intentionally no large numeric exposure-age readout here
  pop();
}

// ---------- clock cards ----------
function drawBurialClockCard(x, y, w, h, isotopeLabel, normalizedRatio, burialAgeKyr, status) {
  normalizedRatio = isFinite(normalizedRatio) ? constrain(normalizedRatio, 0, 1) : 1;
  burialAgeKyr = isFinite(burialAgeKyr) ? Math.max(0, burialAgeKyr) : 0;

  drawCard(x, y, w, h, 18);

  push();
  translate(x, y);

  fill(COLOR_TEXT);
  textSize(19);
  textStyle(BOLD);
  text(`Burial age from ${isotopeLabel}`, w / 2, 33);
  textStyle(NORMAL);

  drawAnalogDial(w / 2, 150, 105, normalizedRatio);
  drawDigitalRatio(w / 2, 285, normalizedRatio);
  drawBurialAgeReadout(w / 2, 352, burialAgeKyr, status);

  pop();
}

function drawAnalogDial(cx, cy, r, normalizedRatio) {
  // dial frame
  noFill();
  stroke(20);
  strokeWeight(6);
  circle(cx, cy, r * 2);

  stroke(180);
  strokeWeight(2);
  circle(cx, cy, r * 2 - 12);

  // ticks from 1 at top to 0 at bottom
  for (let tick = 0; tick <= 1.0001; tick += 0.1) {
    const isMajor = Math.abs((tick * 10) % 5) < 1e-6 || Math.abs(tick - 1) < 1e-6 || Math.abs(tick) < 1e-6;
    const angle = map(tick, 0, 1, 90, -90);
    const rad = radians(angle);
    const outR = r - 4;
    const inR = isMajor ? r - 27 : r - 17;
    stroke(20);
    strokeWeight(isMajor ? 3 : 1);
    line(cx + cos(rad) * outR, cy + sin(rad) * outR, cx + cos(rad) * inR, cy + sin(rad) * inR);
  }

  // numeric dial labels for the normalized ratio
  fill(30);
  noStroke();
  textStyle(BOLD);
  textSize(11);
  const dialLabels = [
    { value: 1.0, label: "1.0" },
    { value: 0.75, label: "0.75" },
    { value: 0.5, label: "0.50" },
    { value: 0.25, label: "0.25" },
    { value: 0.0, label: "0.0" }
  ];
  for (const item of dialLabels) {
    const angle = map(item.value, 0, 1, 90, -90);
    const rad = radians(angle);
    const labelR = r - 42;
    text(item.label, cx + cos(rad) * labelR, cy + sin(rad) * labelR);
  }
  textStyle(NORMAL);

  fill(COLOR_MUTED);
  textSize(10);
  text("normalized", cx, cy - 18);
  text("ratio", cx, cy - 5);

  const handAngle = map(normalizedRatio, 0, 1, 90, -90);
  const handRad = radians(handAngle);
  stroke(200, 30, 30);
  strokeWeight(5);
  line(cx, cy, cx + cos(handRad) * (r - 20), cy + sin(handRad) * (r - 20));

  fill(20);
  noStroke();
  circle(cx, cy, 12);
}

function drawDigitalRatio(cx, y, normalizedRatio) {
  const boxW = 178;
  const boxH = 54;
  push();
  rectMode(CENTER);
  noStroke();
  fill(22, 28, 38);
  rect(cx, y, boxW, boxH, 8);

  fill(110, 255, 150);
  textStyle(BOLD);
  textSize(34);
  text(normalizedRatio.toFixed(1), cx, y + 3);
  textStyle(NORMAL);

  fill(COLOR_MUTED);
  textSize(12);
  text("normalized ratio", cx, y - 42);
  pop();
}

function drawBurialAgeReadout(cx, y, burialAgeKyr, status) {
  fill(0, 0, 150);
  textSize(13);
  textStyle(BOLD);
  text("apparent burial age", cx, y - 20);
  textStyle(NORMAL);

  fill(COLOR_TEXT);
  textSize(26);
  textStyle(BOLD);
  text(`${burialAgeKyr.toFixed(0)} ${AGE_UNIT_LABEL}`, cx, y + 10);
  textStyle(NORMAL);

  if (status === "EXPOSURE") {
    fill(COLOR_EXPO);
  } else {
    fill(COLOR_BURIAL);
  }
  textSize(11);
  text(status === "BURIAL" ? "burial phase" : "exposure phase", cx, y + 43);
}

function drawClockLinkageBadge(cx, y, t10, t36, row) {
  const diffKyr = Math.abs(t10 - t36) / AGE_UNIT;
  const hasBurialStarted = row.Rbase_3_10 !== null;
  const isDivergent = hasBurialStarted && diffKyr > 20;
  const badge = !hasBurialStarted ? "before burial" : isDivergent ? "nonconcordant" : "concordant";

  push();
  rectMode(CENTER);
  noStroke();
  fill(255);
  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = "rgba(0,0,0,0.10)";
  rect(cx, y, 310, 54, 16);
  drawingContext.shadowBlur = 0;

  fill(isDivergent ? COLOR_EXPO : hasBurialStarted ? COLOR_BURIAL : COLOR_MUTED);
  textStyle(BOLD);
  textSize(18);
  text(badge, cx, y - 8);
  textStyle(NORMAL);

  fill(COLOR_MUTED);
  textSize(12);
  const sub = hasBurialStarted ? `clock difference: ${diffKyr.toFixed(0)} ${AGE_UNIT_LABEL}` : "burial clocks start after ice cover";
  text(sub, cx, y + 15);
  pop();
}

function drawCurrentTimeReadout(x, y, row) {
  push();
  rectMode(CORNER);
  drawCard(x, y, 110, 90, 16);
  fill(COLOR_MUTED);
  textSize(12);
  text("time", x + 55, y + 25);
  fill(COLOR_TEXT);
  textStyle(BOLD);
  textSize(22);
  text(`${(row.t_cumulative / 1e6).toFixed(2)}`, x + 55, y + 52);
  textStyle(NORMAL);
  fill(COLOR_MUTED);
  textSize(11);
  text("Ma", x + 55, y + 72);
  pop();
}

// ---------- bar interactive ----------
function mousePressed() {
  if (
    mouseX > barX &&
    mouseX < barX + barW &&
    mouseY > barY - 20 &&
    mouseY < barY + barH + 34
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
