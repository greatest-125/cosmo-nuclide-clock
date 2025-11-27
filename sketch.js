// Cosmo Clock
// Last Update: November 2025
// Leel Dias
// MIT License 

let clockData;
let currentFrame = 0;
let isPlaying = false;
let playButton, restartButton, speedSlider, speedLabel;
let frameCounter = 0;
let isDragging = false;

// decay constants
const L_10 = Math.log(2) / 1.4e6;    
const L_26 = Math.log(2) / 0.717e6; 
const L_36 = Math.log(2) / 0.301e6; 

// production ratios from Joerg email
const Rp_26_10 = 7.0;
const Rp_36_10 = 3.0;

const AGE_UNIT = 1e3;
const AGE_UNIT_LABEL = "[kyr]";

// scenario bar 
let barX, barY, barW, barH;

function preload() {
  clockData = loadTable("calculated_clock_data.csv", "csv", "header");
}

function setup() {
  createCanvas(850, 760);
  textAlign(CENTER, CENTER);
  frameRate(30);
  textFont("Helvetica, Arial, sans-serif");

  // create the UI
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

  // play pause button
  playButton = createButton("Play / Pause");
  styleButton(playButton, "#2e7d32");
  playButton.parent(controlBar);
  playButton.mousePressed(togglePlay);

  // restart button
  restartButton = createButton("Restart");
  styleButton(restartButton, "#0277bd");
  restartButton.parent(controlBar);
  restartButton.mousePressed(restartAnimation);

  // speed slider
  speedLabel = createSpan("Speed 1.0×");
  speedLabel.style("margin-left", "6px");
  speedLabel.parent(controlBar);

  speedSlider = createSlider(0.1, 5, 1, 0.1);
  speedSlider.parent(controlBar);
  speedSlider.style("width", "120px");
  speedSlider.input(() => {
    speedLabel.html(`Speed ${speedSlider.value().toFixed(1)}×`);
  });

  // scenario bar setup
  barW = 700;
  barH = 26;
  barX = (width - barW) / 2;
  barY = height - 90;

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
  noLoop();
  drawFrame();
}

function draw() {
  drawFrame();

  if (!isPlaying && !isDragging) return;

  let speedFactor = speedSlider.value();
  let frameDelay = int(6 / speedFactor);
  if (frameDelay < 1) frameDelay = 1;

  frameCounter++;
  if (frameCounter >= frameDelay) {
    frameCounter = 0;
    if (currentFrame < clockData.getRowCount() - 1) {
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

  let row = clockData.getRow(currentFrame);
  let R_26_10 = row.getNum("R_26_10");
  let R_36_10 = row.getNum("R_36_10");
  let cumulativeTime = row.getNum("t_cumulative");
  let status = row.getString("status");

  // apparent burial ages 
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

  drawHalfLifePanel();

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


function drawHalfLifePanel() {
  let half_36_10 = Math.log(2) / (L_36 - L_10); // years
  let half_26_10 = Math.log(2) / (L_26 - L_10); // years

  let t_test = 2 * half_36_10;
  let frac_after_2_half = Math.exp(-(L_36 - L_10) * t_test);

  textAlign(CENTER, CENTER);
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

  // swiss railstation clock
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

  // central hand
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
  text("Burial Age " + AGE_UNIT_LABEL, x, y + 140); // pushed down slightly
  textSize(26);
  fill(10);
  text(apparentAgeDisp.toFixed(2), x, y + 170); // also pushed down

  textSize(14);
  fill(100);
  text("Total Scenario Time [kyr]", x, y + 200);
  textSize(18);
  text((cumulativeTime / AGE_UNIT).toFixed(0), x, y + 228);
}

// sennario bar
function drawScenarioBar() {
  push();
  rectMode(CORNER);
  noStroke();
  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = "rgba(0,0,0,0.12)";
  fill(255);
  rect(barX - 6, barY - 6, barW + 12, barH + 12, 10);
  drawingContext.shadowBlur = 0;

  // fill bar zones 
  let n = clockData.getRowCount();
  let segW = barW / n;

  for (let i = 0; i < n; i++) {
    let s = clockData.getRow(i).getString("status");
    if (s === "BURIAL") fill(0, 92, 255);
    else if (s === "EXPOSURE") fill(230, 38, 38);
    else fill(200);
    rect(barX + i * segW, barY, segW + 1, barH);
  }

  let arrowX = barX + map(currentFrame, 0, n - 1, 0, barW);
  fill("#FFD600");
  noStroke();
  triangle(arrowX - 9, barY - 14, arrowX + 9, barY - 14, arrowX, barY - 3);

  // label
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
  if (isDragging) {
    updateFrameFromMouse();
  }
}

function mouseReleased() {
  if (isDragging) {
    isDragging = false;
    if (isPlaying) loop();
  }
}

function updateFrameFromMouse() {
  let relX = constrain(mouseX - barX, 0, barW);
  let n = clockData.getRowCount();
  currentFrame = int(map(relX, 0, barW, 0, n - 1));
  drawFrame();
}

