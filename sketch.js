let clockData; // This will hold our CSV data
let currentFrame = 0;
let isPlaying = false;
let playButton;
let restartButton; // <<< Restart button variable

// --- Define physics constants in JS for age calculation ---
const L_10 = Math.log(2) / 1.4e6;
const L_26 = Math.log(2) / 0.717e6;
const L_36 = Math.log(2) / 0.301e6;
const Rp_26_10 = 7.0;
const Rp_36_10 = 3.0;

// 1. Load the data from your CSV
function preload() {
  clockData = loadTable('calculated_clock_data.csv', 'csv', 'header');
}

// 2. Setup runs once
function setup() {
  createCanvas(800, 600);
  textAlign(CENTER, CENTER);
  frameRate(30);

  // Create the Start/Stop button
  playButton = createButton('Start / Stop');
  playButton.position(10, 10); // Top-left corner
  playButton.mousePressed(togglePlay);

  // <<< Create the Restart button >>>
  restartButton = createButton('Restart');
  restartButton.position(110, 10); // Position next to start/stop
  restartButton.mousePressed(restartAnimation); // Link to restart function

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

// <<< Function to restart the animation >>>
function restartAnimation() {
  currentFrame = 0;
  isPlaying = false;
  noLoop();
  drawFrame(); // Redraw the first frame
}


// 4. Draw loop (only runs when isPlaying is true)
function draw() {
  drawFrame(); // Draw the current frame

  // Advance frame
  if (isPlaying && currentFrame < clockData.getRowCount() - 1) {
    currentFrame++;
  } else if (currentFrame >= clockData.getRowCount() - 1) {
    // If at the end, stop
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
  // Still needed for the digital readout
  let t_app_26_yr = Math.log(Rp_26_10 / R_26_10) / (L_26 - L_10);
  let t_app_36_yr = Math.log(Rp_36_10 / R_36_10) / (L_36 - L_10);

  let t_app_26_kyr = t_app_26_yr / 1000;
  let t_app_36_kyr = t_app_36_yr / 1000;

  // --- Draw the two clocks ---
  // Pass the CURRENT RATIO for the HAND, and apparent age for digital readout
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

// 6. *** REDESIGNED *** Helper function to draw one clock (Ratio Ticks, Ratio Hand)
function drawClock(x, y, title, currentRatio, prodRatio, apparentAgeKyr, cumulativeTimeMyr) {
  let clockMinRatio = 0;
  let clockMaxRatio = prodRatio; // Max ratio on face (7 or 3)

    // --- Clean up ratio value ---
     if (isNaN(currentRatio) || !isFinite(currentRatio)) currentRatio = 0; // Fix potential NaN/Infinity at start
     currentRatio = constrain(currentRatio, clockMinRatio, clockMaxRatio); // Keep within bounds

    // --- Clean up age value (for digital display) ---
    if (isNaN(apparentAgeKyr) || apparentAgeKyr < 0 || !isFinite(apparentAgeKyr)) {
        apparentAgeKyr = 0;
    }


  // --- Draw Clock Face ---
  noFill();
  stroke(0);
  strokeWeight(4);
  circle(x, y, 250);

  // --- Draw Ticks and Numbers (representing RATIO) ---
  for (let ratioTick = 0; ratioTick <= clockMaxRatio; ratioTick += 0.5) {
    // Map RATIO to angle. prodRatio is at the top (-90 deg). 0 is at bottom (90 deg).
    let tickAngle = map(ratioTick, 0, clockMaxRatio, 90, -90);
    let rad = radians(tickAngle);

    let x1 = x + cos(rad) * 125;
    let y1 = y + sin(rad) * 125;
    let x2 = x + cos(rad) * 115;
    let y2 = y + sin(rad) * 115;

    strokeWeight(1);
    if (ratioTick % 1 === 0) strokeWeight(3); // Bolder ticks for whole numbers
    line(x1, y1, x2, y2);

    // Draw numbers for whole ratios
    if (ratioTick % 1 === 0) {
      let x_num = x + cos(rad) * 95;
      let y_num = y + sin(rad) * 95;
      noStroke();
      fill(0);
      textSize(14);
      text(ratioTick.toFixed(0), x_num, y_num); // e.g., "7", "6"..."0"
    }
  }
   // Add "Ratio" label near the ticks
    textSize(12);
    fill(100);
    noStroke();
    text("Ratio", x, y - 70); // Label for the clock face ticks


  // --- Draw Clock Title ---
  textSize(16);
  fill(0);
  noStroke();
  text(title, x, y - 150);

  // --- Draw DUAL Readouts Below Clock ---

  // Readout 1: Apparent Burial Age (precise value in kyrs)
  textSize(20);
  fill(0, 0, 150); // Blue for age
  noStroke();
  text('Apparent Burial Age', x, y + 150);
  textSize(28);
  text(apparentAgeKyr.toFixed(0) + ' kyrs', x, y + 180);

  // Readout 2: Scenario Time (in Myrs)
  textSize(16);
  fill(100); // Gray for scenario time
  noStroke();
  text('Scenario Time', x, y + 210);
  textSize(20);
  text(cumulativeTimeMyr.toFixed(2) + ' Myr', x, y + 235);

  // --- Draw Clock Hand (based on CURRENT RATIO) ---
  // Map the current ratio to the same angle as the ticks
  let handAngle = map(currentRatio, 0, clockMaxRatio, 90, -90);
  let handRad = radians(handAngle);

  stroke(200, 0, 0); // Red hand
  strokeWeight(4);
  line(x, y, x + cos(handRad) * 110, y + sin(handRad) * 110);

  // Center pin
  fill(0);
  noStroke();
  circle(x, y, 10);
}
