let clockData;
let currentFrame = 0;
let isPlaying = false;
let playButton, restartButton, speedSlider, speedLabel;
let frameCounter = 0;

// constants
const L_10 = Math.log(2) / 1.4e6;
const L_26 = Math.log(2) / 0.717e6;
const L_36 = Math.log(2) / 0.301e6;
const Rp_26_10 = 7.0;
const Rp_36_10 = 3.0;

const AGE_UNIT = 1e4;
const AGE_UNIT_LABEL = "[10^4 years]";

function preload() {
  clockData = loadTable("calculated_clock_data.csv", "csv", "header");
}

function setup() {
  createCanvas(850, 700);
  textAlign(CENTER, CENTER);
  frameRate(30);
  textFont("Helvetica, Arial, sans-serif");

  // ----- UI: Floating Control Bar -----
  let controlBar = createDiv();
  controlBar.id("control-bar");
  controlBar.style("position", "fixed");
  controlBar.style("top", "10px");
  controlBar.style("left", "50%");
  controlBar.style("transform", "translateX(-50%)");
  controlBar.style("background", "rgba(255,255,255,0.85)");
  controlBar.style("backdrop-filter", "blur(8px)");
  controlBar.style("padding", "8px 16px");
  controlBar.style("border-radius", "12px");
  controlBar.style("box-shadow", "0 2px 10px rgba(0,0,0,0.15)");
  controlBar.style("display", "flex");
  controlBar.style("align-items", "center");
  controlBar.style("gap", "12px");
  controlBar.style("font-size", "14px");
  controlBar.style("z-index", "1000");

  // Play / Pause button
  playButton = createButton("▶️ Play / ⏸ Pause");
  styleButton(playButton, "#2e7d32");
  playButton.parent(controlBar);
  playButton.mousePressed(togglePlay);

  // Restart button
  restartButton = createButton("🔁 Restart");
  styleButton(restartButton, "#0277bd");
  restartButton.parent(controlBar);
  restartButton.mousePressed(restartAnimation);

  // Speed slider and label
  speedLabel = createSpan("Speed 1.0×");
  speedLabel.style("margin-left", "6px");
  speedLabel.parent(controlBar);

  speedSlider = createSlider(0.1, 5, 1, 0.1);
  speedSlider.parent(controlBar);
  speedSlider.style("width", "120px");
  speedSlider.input(() => {
    speedLabel.html(`Speed ${speedSlider.value().toFixed(1)}×`);
  });

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
  btn.mouseOver(() => btn.style("opacity", "0.8"));
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

  if (!isPlaying) return;

  // frame delay controlled by slider
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

function drawFrame() {
  background(250);
  let row = clockData.getRow(currentFrame);
  let R_26_10 = row.getNum("R_26_10");
  let R_36_10 = row.getNum("R_36_10");
  let cumulativeTimeMyr = row.getNum("t_cumulative_Myr");
  let status = row.getString("status");

  // apparent burial ages
  let t_app_26 = Math.log(Rp_26_10 / R_26_10) / (L_26 - L_10);
  let t_app_36 = Math.log(Rp_36_10 / R_36_10) / (L_36 - L_10);
  t_app_26 = isFinite(t_app_26) && t_app_26 > 0 ? t_app_26 : 0;
  t_app_36 = isFinite(t_app_36) && t_app_36 > 0 ? t_app_36 : 0;

  let t_app_26_disp = t_app_26 / AGE_UNIT;
  let t_app_36_disp = t_app_36 / AGE_UNIT;

  // header text
  noStroke();
  fill(30);
  textSize(15);
  text(
    "Production ratio 26/10 = 7, 36/10 = 3 → Burial age = 0. " +
      "Burial age can never be negative (ratio ≤ production).",
    width / 2,
    70
  );

  textSize(34);
  fill(10);
  text("Burial → Exposure → Burial", width / 2, 110);

  textSize(22);
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

  // clocks
  drawClock(
    250,
    420,
    "26Al / 10Be Clock (Long Memory)",
    R_26_10,
    7.0,
    t_app_26_disp,
    cumulativeTimeMyr
  );
  drawClock(
    600,
    420,
    "36Cl / 10Be Clock (Short Memory)",
    R_36_10,
    3.0,
    t_app_36_disp,
    cumulativeTimeMyr
  );
}

function drawClock(x, y, title, currentRatio, prodRatio, apparentAgeDisp, cumulativeTimeMyr) {
  let clockMinRatio = 0;
  let clockMaxRatio = prodRatio;
  if (isNaN(currentRatio) || !isFinite(currentRatio)) currentRatio = 0;
  currentRatio = constrain(currentRatio, clockMinRatio, clockMaxRatio);

  // soft shadow card
  noStroke();
  fill(255);
  rectMode(CENTER);
  drawingContext.shadowBlur = 15;
  drawingContext.shadowColor = "rgba(0,0,0,0.2)";
  rect(x, y, 280, 340, 20);
  drawingContext.shadowBlur = 0;

  // clock face
  noFill();
  stroke(0);
  strokeWeight(3);
  circle(x, y, 220);

  for (let ratioTick = 0; ratioTick <= clockMaxRatio; ratioTick += 0.5) {
    let tickAngle = map(ratioTick, 0, clockMaxRatio, 90, -90);
    let rad = radians(tickAngle);
    let x1 = x + cos(rad) * 110;
    let y1 = y + sin(rad) * 110;
    let x2 = x + cos(rad) * 100;
    let y2 = y + sin(rad) * 100;
    strokeWeight(ratioTick % 1 === 0 ? 3 : 1);
    line(x1, y1, x2, y2);

    if (ratioTick % 1 === 0) {
      let x_num = x + cos(rad) * 85;
      let y_num = y + sin(rad) * 85;
      noStroke();
      fill(0);
      textSize(13);
      text(ratioTick.toFixed(0), x_num, y_num);
    }
  }

  // hand
  let handAngle = map(currentRatio, 0, clockMaxRatio, 90, -90);
  let handRad = radians(handAngle);
  stroke(200, 0, 0);
  strokeWeight(4);
  line(x, y, x + cos(handRad) * 95, y + sin(handRad) * 95);
  fill(0);
  noStroke();
  circle(x, y, 10);

  // labels
  noStroke();
  fill(0);
  textSize(16);
  text(title, x, y - 130);

  textSize(18);
  fill(0, 0, 150);
  text("Burial Age " + AGE_UNIT_LABEL, x, y + 120);
  textSize(26);
  text(apparentAgeDisp.toFixed(2), x, y + 150);

  textSize(14);
  fill(100);
  text("Total Scenario Time [10^4 years]", x, y + 180);
  textSize(18);
  text((cumulativeTimeMyr * 1e6 / 1e4).toFixed(0), x, y + 205);
}
