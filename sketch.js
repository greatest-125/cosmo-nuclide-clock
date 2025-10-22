let clockData; // This will hold our CSV data
let currentFrame = 0;
let isPlaying = false;
let playButton;

// --- Define physics constants in JS for age calculation ---
const L_10 = Math.log(2) / 1.4e6;
const L_26 = Math.log(2) / 0.717e6;
const L_36 = Math.log(2) / 0.301e6;
const Rp_26_10 = 7.0;
const Rp_36_10 = 3.0;

// 1. Load the data from your CSV
function preload() {
  // 'csv' = file has a header, 'header' = use the header names
  clockData = loadTable('calculated_clock_data.csv', 'csv', 'header');
}

// 2. Setup runs once
function setup() {
  createCanvas(800, 600);
  textAlign(CENTER, CENTER);
  frameRate(30);

  playButton = createButton('Start / Stop');
  playButton.position(10, 10);
  playButton.mousePressed(togglePlay);

  noLoop(); // Start paused
  drawFrame(); // Draw the initial frame
}

// 3. Function to toggle play/pause
function togglePlay() {
  isPlaying = !isPlaying;
  if (isPlaying) {
    loop();
  } else {
    noLoop();
  }
}

// 4. Draw loop (only runs when isPlaying is true)
function draw() {
  drawFrame(); // Draw the current frame

  // Advance frame
  if (isPlaying && currentFrame < clockData.getRowCount() - 1) {
    currentFrame++;
  } else if (currentFrame >= clockData.getRowCount() - 1) {
    isPlaying = false;
    noLoop();
  }
}

// 5. Function to draw a single frame
function drawFrame() {
  background(240);
  let row = clockData.getRow(currentFrame);

  // Get data for this frame from the CSV columns
  let R_26_10 = row.getNum('R_26_10');
  let R_36_10 = row.getNum('R_36_10');
  let cumulativeTimeMyr = row.getNum('t_cumulative_Myr');
  let status = row.getString('status');

  // --- Calculate Apparent Burial Age (in kyrs) ---
  // This calculation happens here, using the current ratio
  let t_app_26_yr = Math.log(Rp_26_10 / R_26_10) / (L_26 - L_10);
  let t_app_36_yr = Math.log(Rp_36_10 / R_36_10) / (L_36 - L_10);

  let t_app_26_kyr = t_app_26_yr / 1000;
  let t_app_36_kyr = t_app_36_yr / 1000;

  // --- Draw the two clocks ---
  // Pass the calculated apparent age to the draw function
  drawClock(200, 300, '26Al / 10Be Clock (Long Memory)', R_26_10, 7.0, t_app_26_kyr, cumulativeTimeMyr);
  drawClock(600, 300, '36Cl / 10Be Clock (Short Memory)', R_36_10, 3.0, t_app_36_kyr, cumulativeTimeMyr);

  // --- Draw the STATUS indicator ---
  textSize(32);
  fill(0);
  noStroke();
  text('Scenario:', 400, 50);
  if (status === 'BURIAL') {
    fill(0, 0, 200); // Blue
    text('BURIAL', 400, 100);
  } else {
    fill(200, 0, 0); // Red
    text('EXPOSURE', 400, 100);
  }
}

// 6. Helper function to draw one clock
// Now takes apparentAgeKyr as an argument
function drawClock(x, y, title, currentRatio, prodRatio, apparentAgeKyr, cumulativeTimeMyr) {
  let clockMin = 0;
  let clockMax = prodRatio;

  // --- Draw Clock Face ---
  noFill();
  stroke(0);
  strokeWeight(4);
  circle(x, y, 250);

  // --- Draw Ticks and Numbers ---
  for (let ratio = 0; ratio <= clockMax; ratio += 0.5) {
    let tickAngle = map(ratio, 0, clockMax, 90, -90); // 0 at bottom, max at top
    let rad = radians(tickAngle);

    let x1 = x + cos(rad) * 125;
    let y1 = y + sin(rad) * 125;
    let x2 = x + cos(rad) * 115;
    let y2 = y + sin(rad) * 115;

    strokeWeight(1);
    if (ratio % 1 === 0) strokeWeight(3);
    line(x1, y1, x2, y2);

    if (ratio % 1 === 0) {
      let x_num = x + cos(rad) * 95;
      let y_num = y + sin(rad) * 95;
      noStroke();
      fill(0);
      textSize(14);
      text(ratio.toFixed(0), x_num, y_num);
    }
  }

  // --- Draw Clock Title ---
  textSize(16);
  fill(0);
  noStroke();
  text(title, x, y - 150);

  // --- Draw DUAL Readouts ---

  // Readout 1: Apparent Burial Age (in kyrs) - Now uses the argument
  if (isNaN(apparentAgeKyr) || apparentAgeKyr < 0 || !isFinite(apparentAgeKyr)) {
      apparentAgeKyr = 0; // Clean NaN, negative, or infinite values
  }
  textSize(20);
  fill(0, 0, 150); // Blue for age
  noStroke();
  text('Apparent Burial Age', x, y + 30);
  textSize(28);
  text(apparentAgeKyr.toFixed(0) + ' kyrs', x, y + 60);

  // Readout 2: Scenario Time (in Myrs)
  textSize(16);
  fill(100); // Gray for scenario time
  noStroke();
  text('Scenario Time', x, y + 150);
  textSize(20);
  text(cumulativeTimeMyr.toFixed(2) + ' Myr', x, y + 175);

  // --- Draw Clock Hand (based on ratio) ---
  if (isNaN(currentRatio)) currentRatio = 0; // Fix potential NaN
  // Ensure ratio stays within bounds for mapping
  currentRatio = constrain(currentRatio, clockMin, clockMax); 
  let handAngle = map(currentRatio, 0, clockMax, 90, -90);
  let handRad = radians(handAngle);

  stroke(200, 0, 0); // Red hand
  strokeWeight(4);
  line(x, y, x + cos(handRad) * 110, y + sin(handRad) * 110);

  // Center pin
  fill(0);
  noStroke();
  circle(x, y, 10);
}
