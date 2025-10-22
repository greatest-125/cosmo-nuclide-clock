let animationData;
let currentFrame = 0;
let isPlaying = false; 
let playButton;

// 1. Load the data from MATLAB
function preload() {
  animationData = loadJSON('animation_data.json');
}

// 2. Setup runs once
function setup() {
  createCanvas(800, 600);
  textAlign(CENTER, CENTER);
  frameRate(30); 
  
  // Create the Start/Stop button
  playButton = createButton('Start / Stop');
  playButton.position(10, 10);
  playButton.mousePressed(togglePlay); 

  // *** FLICKER FIX ***: Start paused
  noLoop(); 
  // Draw the initial frame (frame 0)
  drawFrame(); 
}

// 3. Function to toggle play/pause
function togglePlay() {
  isPlaying = !isPlaying; 
  if (isPlaying) {
    loop(); // Start the draw loop
  } else {
    noLoop(); // Stop the draw loop
  }
}

// 4. Draw loop (only runs when isPlaying is true)
function draw() {
  drawFrame(); // Draw the current frame
  
  // Advance frame
  let data = Object.values(animationData);
  if (isPlaying && currentFrame < data.length - 1) {
    currentFrame++;
  } else if (currentFrame >= data.length - 1) {
    // If at the end, stop
    isPlaying = false;
    noLoop();
  }
}

// 5. NEW: Function to draw a single frame
// This keeps the screen stable when paused
function drawFrame() {
  background(240); // Light gray background
  let data = Object.values(animationData);
  
  // Handle the very first frame where ratios are NaN
  if (currentFrame === 0) {
    frameData = { R_26_10: 0, R_36_10: 0, t_cumulative: 0, status: 'EXPOSURE' };
  } else {
    frameData = data[currentFrame];
  }

  // Get data for this frame
  let R_26_10 = frameData.R_26_10;
  let R_36_10 = frameData.R_36_10;
  // *** NEW ***: Get the cumulative time
  let cumulativeTimeYr = frameData.t_cumulative;
  let status = frameData.status;

  // --- Draw the two clocks ---
  // Arguments: x, y, title, current_ratio, production_ratio, cumulative_time
  drawClock(200, 300, '26Al / 10Be Clock', R_26_10, 7.0, cumulativeTimeYr);
  drawClock(600, 300, '36Cl / 10Be Clock', R_36_10, 3.0, cumulativeTimeYr);

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

// 6. *** REDESIGNED *** Helper function to draw one clock
function drawClock(x, y, title, currentRatio, prodRatio, cumulativeTimeYr) {
  let clockMin = 0; // Minimum ratio on clock
  let clockMax = prodRatio; // Maximum ratio (7 or 3)

  // --- Draw Clock Face ---
  noFill();
  stroke(0);
  strokeWeight(4);
  circle(x, y, 250); // Clock outline
  
  // --- Draw Ticks and Numbers ---
  for (let ratio = 0; ratio <= clockMax; ratio += 0.5) {
    // Map ratio to angle. 
    // prodRatio (7 or 3) is at the top (-90 deg).
    // 0 is at the bottom (90 deg).
    let tickAngle = map(ratio, 0, clockMax, 90, -90); 
    let rad = radians(tickAngle);
    
    let x1 = x + cos(rad) * 125;
    let y1 = y + sin(rad) * 125;
    let x2 = x + cos(rad) * 115;
    let y2 = y + sin(rad) * 115;
    
    strokeWeight(1);
    if (ratio % 1 === 0) strokeWeight(3);
    line(x1, y1, x2, y2); // Draw tick
    
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
  textSize(18);
  fill(0);
  noStroke();
  text(title, x, y - 150);
  
  // --- *** NEW *** Draw Master Time Readout (Bottom of clock) ---
  let cumulativeTimeMyr = cumulativeTimeYr / 1e6;
  if (isNaN(cumulativeTimeMyr)) cumulativeTimeMyr = 0;
  
  textSize(20);
  fill(0);
  noStroke();
  text('Scenario Time', x, y + 150);
  textSize(24);
  text(cumulativeTimeMyr.toFixed(2) + ' Myr', x, y + 180);
  
  // --- Draw Clock Hand (based on ratio) ---
  if (isNaN(currentRatio)) currentRatio = 0; // Fix for frame 0
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