// Cosmo Clock 
// Last Update: January 2026 
// MIT License

let scenarioData = []; 
let currentFrame = 0;
let isPlaying = false;
let playButton, restartButton, speedSlider, speedLabel;
let frameCounter = 0;
let isDragging = false;
let controlBar;

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
const P_26 = Rp_26_10 * P_10; 
const P_36 = Rp_36_10 * P_10; 

// saturation inventories
const N10_SAT = P_10 / L_10;
const N26_SAT = P_26 / L_26;
const N36_SAT = P_36 / L_36;

// time step 
const DT_YEARS = 5000;

// precompute step factors to avoid per-iteration exp calls
const DECAY_10 = Math.exp(-L_10 * DT_YEARS);
const DECAY_26 = Math.exp(-L_26 * DT_YEARS);
const DECAY_36 = Math.exp(-L_36 * DT_YEARS);
const EXPOSURE_STEP_10 = (P_10 / L_10) * (1 - DECAY_10);
const EXPOSURE_STEP_26 = (P_26 / L_26) * (1 - DECAY_26);
const EXPOSURE_STEP_36 = (P_36 / L_36) * (1 - DECAY_36);

// --- FIXED INITIAL CONDITION ---
const INITIAL_STATE = {
  t_cumulative_years: 5000,   
  N10: 19975.27,
  N26: 139662.19,
  N36: 59655.90
};

// display units
const AGE_UNIT = 1e3;
const AGE_UNIT_LABEL = "[kyr]";

const BOTTOM_PANEL_SHIFT_PX = 40; 

// scenario bar
let barX, barY, barW, barH;

// Colors matching the bar
const COLOR_EXPO = [230, 38, 38];   // Red
const COLOR_BURIAL = [0, 92, 255];  // Blue

// Settings (Default: 0.5 -> 1.0 -> 0.5)
let scenarioSettings = {
  exposureMyr: 0.5,     
  burialMyr: 1.0,
  reExposureMyr: 0.5
};

// Helper Math Functions
function stepExposure(N0, decayFactor, productionStep) {
  return productionStep + N0 * decayFactor;
}

function stepBurial(N0, decayFactor) {
  return N0 * decayFactor;
}

function buildRow(t, status, N10, N26, N36, Rburial26, Rburial36) {
  const R_26_10 = N26 / N10;
  const R_36_10 = N36 / N10;
  return {
    t_cumulative: t,
    status,
    N10,
    N26,
    N36,
    R_26_10,
    R_36_10,
    Rbase_26_10: Rburial26,
    Rbase_36_10: Rburial36
  };
}

function generateScenarioData(exposureMyr, burialMyr, reExposureMyr) {
  const exposureYears = Math.max(0, exposureMyr) * 1e6;
  const burialYears   = Math.max(0, burialMyr) * 1e6;
  const reExposureYears = Math.max(0, reExposureMyr) * 1e6;

  let N10 = INITIAL_STATE.N10;
  let N26 = INITIAL_STATE.N26;
  let N36 = INITIAL_STATE.N36;
  let t   = INITIAL_STATE.t_cumulative_years;
  let burialStarted = false;
  let Rburial_26 = null;
  let Rburial_36 = null;

  const rows = [];
  
  // Initial frame
  rows.push(buildRow(t, "EXPOSURE", N10, N26, N36, null, null));

  const phases = [
    { status: "EXPOSURE", years: exposureYears, exposed: true },
    { status: "BURIAL",   years: burialYears,   exposed: false },
    { status: "EXPOSURE", years: reExposureYears, exposed: true }
  ];

  for (const phase of phases) {
    if (phase.years <= 0) continue;
    const steps = Math.max(1, Math.round(phase.years / DT_YEARS));

    for (let i = 0; i < steps; i++) {
      if (phase.exposed) {
        N10 = stepExposure(N10, DECAY_10, EXPOSURE_STEP_10);
        N26 = stepExposure(N26, DECAY_26, EXPOSURE_STEP_26);
        N36 = stepExposure(N36, DECAY_36, EXPOSURE_STEP_36);
      } else {
        N10 = stepBurial(N10, DECAY_10);
        N26 = stepBurial(N26, DECAY_26);
        N36 = stepBurial(N36, DECAY_36);
      }
      if (phase.status === "BURIAL" && !burialStarted) {
        burialStarted = true;
        Rburial_26 = N26 / N10;
        Rburial_36 = N36 / N10;
      }

      t += DT_YEARS;

      rows.push(
        buildRow(
          t,
          phase.status,
          N10,
          N26,
          N36,
          burialStarted ? Rburial_26 : null,
          burialStarted ? Rburial_36 : null
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

// ---------- p5 setup ----------
function setup() {
  createCanvas(1250, 860 + BOTTOM_PANEL_SHIFT_PX);
  textAlign(CENTER, CENTER);
  frameRate(30);
  textFont("Helvetica, Arial, sans-serif");

  // control bar
  controlBar = createDiv();
  controlBar.id("control-bar");
  controlBar.addClass("control-bar");

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
  scenarioButton = createButton("Scenario Settings");
  styleButton(scenarioButton, "#6a1b9a");
  scenarioButton.parent(controlBar);
  scenarioButton.mousePressed(() => showScenarioModal(true));

  scenarioSummary = createSpan("");
  scenarioSummary.addClass("scenario-summary");
  scenarioSummary.parent(controlBar);

  // speed
  speedLabel = createSpan("Speed 1.0×");
  speedLabel.addClass("speed-label");
  speedLabel.parent(controlBar);

  speedSlider = createSlider(0.1, 5, 1, 0.1);
  speedSlider.parent(controlBar);
  speedSlider.addClass("speed-slider");
  speedSlider.input(() => {
    speedLabel.html(`Speed ${speedSlider.value().toFixed(1)}×`);
  });

  // scenario bar geometry
  barW = 700;
  barH = 26;
  barX = (width - barW) / 2;
  barY = height - 90;
  
  // Build the modal for customization
  buildScenarioModal();

  // Initial Scenario
  applyScenario(scenarioSettings.exposureMyr, scenarioSettings.burialMyr, scenarioSettings.reExposureMyr);

  noLoop();
  drawFrame();
}

function styleButton(btn, color) {
  btn.addClass("ui-button");
  btn.style("background-color", color);
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

  // form rows
  const rowStyle = (r) => {
    r.addClass("modal-row");
  };

  let r1 = createDiv(); r1.parent(card); rowStyle(r1);
  createDiv("Initial exposure duration (Ma)").parent(r1).style("font-size", "13px");
  exposureInput = createInput(String(scenarioSettings.exposureMyr));
  exposureInput.parent(r1);
  exposureInput.addClass("modal-input");

  let r2 = createDiv(); r2.parent(card); rowStyle(r2);
  createDiv("Burial duration (Ma)").parent(r2).style("font-size", "13px");
  burialInput = createInput(String(scenarioSettings.burialMyr));
  burialInput.parent(r2);
  burialInput.addClass("modal-input");

  let r3 = createDiv(); r3.parent(card); rowStyle(r3);
  createDiv("Re-exposure duration (Ma)").parent(r3).style("font-size", "13px");
  reExposureInput = createInput(String(scenarioSettings.reExposureMyr));
  reExposureInput.parent(r3);
  reExposureInput.addClass("modal-input");

  // buttons
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

  scenarioModal.mousePressed(() => {
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

  const Rref_26 = isFinite(row.Rbase_26_10) ? row.Rbase_26_10 : Rp_26_10;
  const Rref_36 = isFinite(row.Rbase_36_10) ? row.Rbase_36_10 : Rp_36_10;

  let t_app_26 = Math.log(Rref_26 / R_26_10) / (L_26 - L_10);
  let t_app_36 = Math.log(Rref_36 / R_36_10) / (L_36 - L_10);

  if (!isFinite(t_app_26)) t_app_26 = 0;
  if (!isFinite(t_app_36)) t_app_36 = 0;

  let clockAge26 = 0;
  let clockAge36 = 0;
  
  if (status === "EXPOSURE" && row.Rbase_26_10 === null) {
    clockAge26 = 0;
    clockAge36 = 0;
  } else if (status === "BURIAL") {
    clockAge26 = t_app_26;
    clockAge36 = t_app_26;
  } else if (status === "EXPOSURE" && row.Rbase_26_10 !== null) {
    clockAge26 = t_app_26;
    clockAge36 = t_app_36;
  }
  
  // header
  textSize(34);
  fill(60);
  text("Scenario:", width / 2, 150);

  if (status === "BURIAL") {
    fill(COLOR_BURIAL);
    text("BURIAL", width / 2, 180);
  } else if (status === "EXPOSURE") {
    fill(COLOR_EXPO);
    text("EXPOSURE", width / 2, 180);
  }

  // note
  textSize(12);
  fill(90);
  text("Initialization uses surface inventories observed at 5 kyr.", width / 2, 206);

  // --- FIXED LAYOUT (Side-by-Side) ---
  const clock1_X = 300;
  const clock2_X = 650;
  const cartoon_X = 900;
  
  drawClock(
    clock1_X,
    420,
    "26Al / 10Be Clock",
    R_26_10,
    Rp_26_10,
    clockAge26 / AGE_UNIT,
    cumulativeTime
  );

  drawClock(
    clock2_X,
    420,
    "36Cl / 10Be Clock",
    R_36_10,
    Rp_36_10,
    clockAge36 / AGE_UNIT,
    cumulativeTime
  );

  drawLandscape(cartoon_X, 240, 300, 360, status);

  drawInventoryBars(row);
  drawScenarioBar();
}

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
  text("Apparent Burial Age " + AGE_UNIT_LABEL, x, y + 140);
  textSize(26);
  fill(10);
  let ageText = "—";
  if (typeof apparentAgeDisp === "number" && isFinite(apparentAgeDisp)) {
    ageText = apparentAgeDisp.toFixed(2);
  }
  text(ageText, x, y + 170);
}

// --- CARTOON MODULE (Updated Shape - FLUSH) ---
function drawLandscape(x, y, w, h, status) {
  push();
  translate(x, y);
  
  // Background card
  noStroke();
  fill(255);
  drawingContext.shadowBlur = 14;
  drawingContext.shadowColor = "rgba(0,0,0,0.12)";
  rectMode(CORNER);
  rect(0, 0, w, h, 18);
  drawingContext.shadowBlur = 0;
  
  // Clip area 
  let margin = 15;
  let contentW = w - margin*2;
  let contentH = h - margin*2;
  let contentX = margin;
  let contentY = margin;
  
  fill(30);
  textSize(16);
  textAlign(CENTER, TOP);
  text("Visual Scenario", w/2, 15);
  
  let sceneY = 50;
  let sceneH = h - 70;
  let groundY = sceneY + sceneH * 0.7; 
  
  // Sky
  fill(200, 230, 255);
  rect(contentX, sceneY, contentW, groundY - sceneY);
  
  // Bedrock - RED (Exposure color)
  fill(COLOR_EXPO); 
  rect(contentX, groundY, contentW, (sceneY + sceneH) - groundY);
  
  // Label: Bedrock
  fill(255, 255, 255, 190);
  textSize(14);
  text("Bedrock", w/2, groundY + 30);
  
  if (status === "BURIAL") {
    // --- BURIAL MODE ---
    // Ice Sheet - BLUE (Burial color)
    fill(0, 92, 255, 230); // Blue with transparency
    stroke(0, 60, 180);
    strokeWeight(2);
    
    // Parabolic/Log Slope Shape (Gentle rise)
    let iceTopY = sceneY + 15; // Summit height
    // Start height (Left) - significantly above ground to reduce steepness
    let iceLeftY = groundY - (groundY - sceneY) * 0.6;
    
    beginShape();
    // 1. Bottom Left (Flush)
    vertex(contentX, groundY);
    
    // 2. Top Left (High start)
    vertex(contentX, iceLeftY);
    
    // 3. The Curve: Gentle rise to summit
    bezierVertex(
      contentX + contentW * 0.25, iceTopY,   // CP1
      contentX + contentW * 0.6, iceTopY,    // CP2
      contentX + contentW, iceTopY + 2       // Top Right (Flush)
    );
    
    // 4. Bottom Right (Flush)
    vertex(contentX + contentW, groundY);
    
    endShape(CLOSE);
    
    noStroke();
    fill(255);
    text("Ice Sheet", w/2, sceneY + 60);
    
  } else {
    // --- EXPOSURE MODE ---
    stroke(255, 200, 0); // Yellow/Gold
    strokeWeight(2);
    
    let rayCount = 8;
    for(let i=0; i<rayCount; i++) {
        let xPos = contentX + (contentW * (i+1)/(rayCount+1));
        let offset = (frameCount * 3 + i * 20) % (groundY - sceneY); 
        let yPos = sceneY + offset;
        
        if(yPos < groundY) {
            line(xPos, yPos, xPos, yPos - 15);
            line(xPos, yPos, xPos - 3, yPos - 5);
            line(xPos, yPos, xPos + 3, yPos - 5);
        }
    }
    
    noStroke();
    fill(200, 100, 0);
    text("Cosmic Rays", w/2, sceneY + 30);
  }
  
  pop();
}

// --- UPDATED BAR with Ticks ---
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
    if (s === "BURIAL") fill(COLOR_BURIAL);
    else if (s === "EXPOSURE") fill(COLOR_EXPO);
    else fill(200);
    rect(barX + i * segW, barY, segW + 1, barH);
  }

  // Ticks & Labels
  if (n > 1) {
    let totalTime = scenarioData[n-1].t_cumulative;
    let maxMa = totalTime / 1e6;
    let tickIntervalMa = 0.5; 
    if (maxMa <= 1.0) tickIntervalMa = 0.25;
    if (maxMa > 3.0) tickIntervalMa = 1.0;
    
    fill(80);
    textSize(11);
    textAlign(CENTER, TOP);
    stroke(150);
    strokeWeight(1);
    
    for (let ma = 0; ma <= maxMa + 0.001; ma += tickIntervalMa) {
        let tYears = ma * 1e6;
        let xPos = map(tYears, 0, totalTime, barX, barX + barW);
        
        line(xPos, barY + barH, xPos, barY + barH + 6);
        noStroke();
        text(ma.toFixed(1) + " Ma", xPos, barY + barH + 8);
        stroke(150);
    }
  }

  let arrowX = barX + map(currentFrame, 0, n - 1, 0, barW);
  fill("#FFD600");
  noStroke();
  triangle(arrowX - 9, barY - 14, arrowX + 9, barY - 14, arrowX, barY - 3);

  pop();
}


function drawInventoryBars(row) {
  const panelW = 440;
  const panelH = 120;
  const panelX = width / 2;
  const panelY = barY - 90;

  push();
  rectMode(CENTER);
  noStroke();
  fill(255);
  drawingContext.shadowBlur = 12;
  drawingContext.shadowColor = "rgba(0,0,0,0.12)";
  rect(panelX, panelY, panelW, panelH, 14);
  drawingContext.shadowBlur = 0;

  fill(30);
  textSize(14);
  text("Nuclide inventory (atoms / g)", panelX, panelY - panelH / 2 + 18);

  const bars = [
    { label: "10Be", N: row.N10, Nmax: N10_SAT },
    { label: "26Al", N: row.N26, Nmax: N26_SAT },
    { label: "36Cl", N: row.N36, Nmax: N36_SAT }
  ];

  const barH = 56;
  const barW = 18;
  const baseY = panelY + 36; 
  const xs = [panelX - 130, panelX, panelX + 130];

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const frac = constrain(b.N / b.Nmax, 0, 1);
    const fillH = frac * barH;

    stroke(80);
    strokeWeight(1);
    noFill();
    rect(xs[i], baseY - barH / 2, barW, barH, 4);

    noStroke();
    fill(60, 60, 60, 170);
    rectMode(CORNER);
    rect(xs[i] - barW / 2, baseY - fillH, barW, fillH, 4);

    rectMode(CENTER);
    fill(20);
    textSize(12);
    text(b.label, xs[i], baseY + 24);

    fill(90);
    textSize(10);
    const valM = b.N / 1e6;
    text(`${valM.toFixed(2)}×10⁶`, xs[i], baseY + 38);
  }
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
