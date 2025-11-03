let clockData;
let currentFrame = 0;
let isPlaying = false;
let playButton;
let restartButton;
let frameDelay = 6;   // <--- tweak to change the speed of the animation 
let frameCounter = 0;

// --- constants ---
const L_10 = Math.log(2) / 1.4e6;
const L_26 = Math.log(2) / 0.717e6;
const L_36 = Math.log(2) / 0.301e6;
const Rp_26_10 = 7.0;
const Rp_36_10 = 3.0;

const AGE_UNIT = 1e4; // 10^4 years
const AGE_UNIT_LABEL = "[10^4 years]";

function preload() {
  clockData = loadTable("calculated_clock_data.csv", "csv", "header");
}

function setup() {
  createCanvas(800, 650);
  textAlign(CENTER, CENTER);
  frameRate(30);

  playButton = createButton("Start / Stop");
  playButton.position(10, 10);
  playButton.mousePressed(togglePlay);

  restartButton = createButton("Restart");
  restartButton.position(110, 10);
  restartButton.mousePressed(restartAnimation);

  noLoop();
  drawFrame();
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

  // Only advance data every `frameDelay` visual frames
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
  background(245);
  let row = clockData.getRow(currentFrame);
  let R_26_10 = row.getNum("R_26_10");
  let R_36_10 = row.getNum("R_36_10");
  let cumulativeTimeMyr = row.getNum("t_cumulative_Myr");
  let status = row.getString("status");

  // apparent burial ages (yrs)
  let t_app_26 = Math.log(Rp_26_10 / R_26_10) / (L_26 - L_10);
  let t_app_36 = Math.log(Rp_36_10 / R_36_10) / (L_36 - L_10);

  t_app_26 = isFinite(t_app_26) && t_app_26 > 0 ? t_app_26 : 0;
  t_app_36 = isFinite(t_app_36) && t_app_36 > 0 ? t_app_36 : 0;

  let t_app_26_disp = t_app_26 / AGE_UNIT;
  let t_app_36_disp = t_app_36 / AGE_UNIT;

  // text
  textSize(32);
  fill(0);
  text("Scenario:", width / 2, 120);
  if (status === "BURIAL") {
    fill(0, 0, 200);
    text("BURIAL", width / 2, 160);
  } else if (status === "EXPOSURE") {
    fill(200, 0, 0);
    text("EXPOSURE", width / 2, 160);
  }

  drawClock(
    200,
    370,
    "26Al / 10Be Clock (Long Memory)",
    R_26_10,
    7.0,
    t_app_26_disp,
    cumulativeTimeMyr
  );
  drawClock(
    600,
    370,
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

  noFill();
  stroke(0);
  strokeWeight(4);
  circle(x, y, 250);

  for (let ratioTick = 0; ratioTick <= clockMaxRatio; ratioTick += 0.5) {
    let tickAngle = map(ratioTick, 0, clockMaxRatio, 90, -90);
    let rad = radians(tickAngle);
    let x1 = x + cos(rad) * 125;
    let y1 = y + sin(rad) * 125;
    let x2 = x + cos(rad) * 115;
    let y2 = y + sin(rad) * 115;
    strokeWeight(ratioTick % 1 === 0 ? 3 : 1);
    line(x1, y1, x2, y2);
    if (ratioTick % 1 === 0) {
      let x_num = x + cos(rad) * 95;
      let y_num = y + sin(rad) * 95;
      noStroke();
      fill(0);
      textSize(14);
      text(ratioTick.toFixed(0), x_num, y_num);
    }
  }

  textSize(12);
  fill(100);
  noStroke();
  text("Ratio", x, y - 70);

  textSize(16);
  fill(0);
  text(title, x, y - 150);

  textSize(20);
  fill(0, 0, 150);
  text("Burial Age " + AGE_UNIT_LABEL, x, y + 150);
  textSize(28);
  text(apparentAgeDisp.toFixed(2), x, y + 180);

  textSize(16);
  fill(100);
  text("Total Scenario Time [10^4 years]", x, y + 210);
  textSize(20);
  text((cumulativeTimeMyr * 1e6 / 1e4).toFixed(0), x, y + 235);

  let handAngle = map(currentRatio, 0, clockMaxRatio, 90, -90);
  let handRad = radians(handAngle);
  stroke(200, 0, 0);
  strokeWeight(4);
  line(x, y, x + cos(handRad) * 110, y + sin(handRad) * 110);

  fill(0);
  noStroke();
  circle(x, y, 10);
}


