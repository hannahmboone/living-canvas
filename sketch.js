
const NUM_PARTICLES = 1600;
let flockA = [], flockB = [];
let attractors = [];
let colorT = 0;
let prevHandPos = { x: 0, y: 0 };
let handX = -1, handY = -1, handVX = 0, handVY = 0;
let statusMsg = '';
let cameraStarted = false;
let framesSinceDetect = 0;
let handsModel;
let colorCache = [0, 0, 0];

// Sound
let audioCtx;
let soundStarted = false;
let lastVX = 0, lastVY = 0;
let gongCooldown = 0;

// Landing page state
let state = 'landing'; // 'landing' | 'dispersing' | 'canvas'
let disperseT = 0;
let landingParticles = [];
let btnX, btnY, btnW, btnH;
let font;

function preload() {
  handsModel = new Hands({
    locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${f}`
  });
  handsModel.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5
  });
  handsModel.onResults(results => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      statusMsg = '✦ tracking';
      let lm = results.multiHandLandmarks[0][8];
      let nx = (1 - lm.x) * width;
      let ny = lm.y * height;
      handVX = (nx - prevHandPos.x) * 5.0;
      handVY = (ny - prevHandPos.y) * 5.0;
      handX = nx;
      handY = ny;
      prevHandPos.x = nx;
      prevHandPos.y = ny;
    } else {
      statusMsg = 'show your hand!';
      handX = -1;
    }
  });
}

function setup() {
  createCanvas(windowWidth, windowHeight);


  // Init flocks off screen — they'll be called in during disperse
  for (let i = 0; i < NUM_PARTICLES; i++) {
    flockA.push(new Particle('A', true));
    flockB.push(new Particle('B', true));
  }
  attractors = [];

  // Button position
  btnW = 220; btnH = 52;
  btnX = width/2 - btnW/2;
  btnY = height/2 + 80;

  // Create landing particles — dense cluster that forms the title area
  for (let i = 0; i < NUM_PARTICLES * 2; i++) {
    landingParticles.push(new LandingParticle());
  }
}

function mousePressed() {
  if (state === 'landing') {
    startDisperse();
  } else if (state === 'canvas' && !cameraStarted) {
    cameraStarted = true;
    startMediaPipe();
    startSound();
  }
}

function startDisperse() {
  state = 'dispersing';
  disperseT = 0;
  startSound();
  // Trigger a gong on disperse
  setTimeout(() => triggerGong(), 100);
}

function startMediaPipe() {
  statusMsg = 'show your hand!';
  const videoEl = document.getElementById('input_video');
  const camera = new Camera(videoEl, {
    onFrame: async () => {
      framesSinceDetect++;
      if (framesSinceDetect >= 3) {
        framesSinceDetect = 0;
        await handsModel.send({ image: videoEl });
      }
    },
    width: 320,
    height: 240
  });
  camera.start();
}

function startSound() {
  if (soundStarted) return;
  soundStarted = true;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function triggerGong() {
  if (!audioCtx) return;
  let notes = [196, 220, 261.6, 293.6, 329.6, 392];
  let freq = notes[Math.floor(Math.random() * notes.length)];
  let osc = audioCtx.createOscillator();
  let osc2 = audioCtx.createOscillator();
  let g = audioCtx.createGain();
  let g2 = audioCtx.createGain();
  osc.type = 'sine'; osc.frequency.value = freq;
  osc2.type = 'sine'; osc2.frequency.value = freq * 2.756;
  g2.gain.value = 0.3;
  osc.connect(g); osc2.connect(g2); g2.connect(g);
  g.connect(audioCtx.destination);
  let t = audioCtx.currentTime;
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 3.0);
  osc.start(t); osc.stop(t + 3.0);
  osc2.start(t); osc2.stop(t + 3.0);
}

function hsbToRgb(h, s, b) {
  h = h % 360;
  let sv = s/100, bv = b/100;
  let hh = h/60, i = Math.floor(hh), f = hh - i;
  let p = bv*(1-sv), q = bv*(1-sv*f), t = bv*(1-sv*(1-f));
  let r, g, bl;
  if(i===0){r=bv;g=t;bl=p;}
  else if(i===1){r=q;g=bv;bl=p;}
  else if(i===2){r=p;g=bv;bl=t;}
  else if(i===3){r=p;g=q;bl=bv;}
  else if(i===4){r=t;g=p;bl=bv;}
  else{r=bv;g=p;bl=q;}
  colorCache[0]=r*255; colorCache[1]=g*255; colorCache[2]=bl*255;
  return colorCache;
}

function draw() {
  background(0, 0, 0, 40);

  if (state === 'landing') {
    drawLanding();
  } else if (state === 'dispersing') {
    drawDispersing();
  } else {
    drawCanvas();
  }
}

function drawLanding() {
  for (let p of landingParticles) {
    p.update();
    p.draw();
  }
}

function drawDispersing() {
  disperseT += 0.025;
  colorT += 0.003;
  // Hide HTML UI
  document.getElementById('landing-ui').style.opacity = Math.max(0, 1 - disperseT * 2);
  for (let p of landingParticles) { p.disperseUpdate(disperseT); p.draw(); }
  for (let p of flockA) { p.update(); p.draw(); }
  for (let p of flockB) { p.update(); p.draw(); }
  if (disperseT > 1.5) {
    state = 'canvas';
    document.getElementById('landing-ui').style.display = 'none';
    statusMsg = 'click to enable camera';
  }
}

function drawCanvas() {
  background(0, 0, 0, 40);
  colorT += 0.003;

  if (soundStarted && handX > 0) {
    gongCooldown--;
    let dot = handVX * lastVX + handVY * lastVY;
    let speed = Math.sqrt(handVX*handVX + handVY*handVY);
    if (dot < -4 && speed > 3 && gongCooldown <= 0) {
      triggerGong();
      gongCooldown = 10;
    }
    lastVX = handVX; lastVY = handVY;
  }

  if (handX > 0) {
    attractors = [{ x: handX, y: handY, vx: handVX, vy: handVY }];
  } else if (!cameraStarted) {
    attractors = [{ x: mouseX, y: mouseY, vx: mouseX - pmouseX, vy: mouseY - pmouseY }];
  } else {
    attractors = [];
  }

  for (let p of flockA) { p.update(); p.draw(); }
  for (let p of flockB) { p.update(); p.draw(); }

  if (statusMsg) {
    fill(255, 255, 255, 60);
    noStroke();
    textFont('monospace');
    textSize(11);
    textAlign(CENTER);
    text(statusMsg, width/2, height - 16);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  btnX = width/2 - btnW/2;
  btnY = height/2 + 80;
}

// ── Landing Particle ──
class LandingParticle {
  constructor() {
    this.reset();
    this.alpha = random(30, 130);
  }
  reset() {
    // Orbit loosely around the center title area
    let angle = random(TWO_PI);
    let r = random(20, 320);
    this.x = width/2 + cos(angle) * r;
    this.y = height/2 + sin(angle) * r * 0.5;
    this.vx = random(-0.3, 0.3);
    this.vy = random(-0.3, 0.3);
    this.size = random(1.5, 3.5);
    this.hue = random(360);
    this.alpha = random(30, 130);
    this.disperseVX = random(-8, 8);
    this.disperseVY = random(-12, -2);
  }
  update() {
    // Gentle drift
    this.vx += random(-0.02, 0.02);
    this.vy += random(-0.02, 0.02);
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.x += this.vx;
    this.y += this.vy;
    // Wrap
    if (this.x < 0) this.x = width;
    if (this.x > width) this.x = 0;
    if (this.y < 0) this.y = height;
    if (this.y > height) this.y = 0;
  }
  disperseUpdate(t) {
    this.x += this.disperseVX * t * 1.5;
    this.y += this.disperseVY * t * 1.5;
    this.alpha = max(0, 130 - t * 120);
  }
  draw() {
    colorMode(HSB, 360, 100, 100, 255);
    fill(this.hue, 50, 80, this.alpha);
    noStroke();
    circle(this.x, this.y, this.size);
    colorMode(RGB, 255, 255, 255, 255);
  }
}

// ── Flock Particle ──
class Particle {
  constructor(flock, init) {
    this.flock = flock;
    this.reset(init || false);
  }

  reset(init) {
    let ox = this.flock === 'A' ? -250 : 250;
    let oy = this.flock === 'A' ? -100 : 100;
    this.pos = createVector(
      width/2 + ox + random(-180, 180),
      height/2 + oy + random(-180, 180)
    );
    this.vel = p5.Vector.random2D().mult(random(0.1, 0.4));
    this.acc = createVector(0, 0);
    this.baseSize = random(2, 4);
    this.size = this.baseSize;
    this.alpha = init ? 0 : random(120, 200);
    this.targetAlpha = random(120, 200);
    this.maxSpeed = random(0.3, 2.0);
    this.life = random(0.6, 1.0);
    this.age = init ? random(1) : 0;
    this.colorLag = random(-0.2, 0.2);
    this.hueOffset = this.flock === 'B' ? 180 : 0;
  }

  update() {
    this.age += 0.002;
    if (this.age > this.life) this.reset(false);

    // Fade in during disperse
    if (state === 'dispersing') {
      this.alpha = min(this.targetAlpha, this.alpha + 1.5);
    }

    let angle = noise(
      this.pos.x * 0.0008,
      this.pos.y * 0.0008,
      frameCount * 0.001
    ) * TWO_PI * 2;
    this.acc.add(p5.Vector.fromAngle(angle).mult(0.10));

    this.size = this.baseSize;
    let a = attractors[0];
    if (a) {
      let dx = a.x - this.pos.x;
      let dy = a.y - this.pos.y;
      let d = Math.sqrt(dx*dx + dy*dy);
      if (d > 1) {
        this.acc.x += dx * 0.8 / d;
        this.acc.y += dy * 0.8 / d;
        if (d < 250) {
          let s = (250 - d) / 250 * 4.0;
          this.acc.x += a.vx * s;
          this.acc.y += a.vy * s;
        }
        if (d < 80) this.size = this.baseSize + (80 - d) / 80 * 3.5;
      }
    }

    let ox = this.flock === 'A' ? -250 : 250;
    let oy = this.flock === 'A' ? -100 : 100;
    let hx = width/2 + ox - this.pos.x;
    let hy = height/2 + oy - this.pos.y;
    let hd = Math.sqrt(hx*hx + hy*hy);
    if (hd > 150) {
      let f = (hd - 150) * 0.001 / hd;
      this.acc.x += hx * f;
      this.acc.y += hy * f;
    }

    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);

    if (this.pos.x < -10) this.pos.x = width + 10;
    if (this.pos.x > width + 10) this.pos.x = -10;
    if (this.pos.y < -10) this.pos.y = height + 10;
    if (this.pos.y > height + 10) this.pos.y = -10;
  }

  draw() {
    let h = ((colorT + this.colorLag) * 60 + this.hueOffset) % 360;
    let s = 55 + 20 * sin((colorT + this.colorLag) * 0.7);
    let b = 65 + 15 * sin((colorT + this.colorLag) * 0.4);
    let col = hsbToRgb(h, s, b);
    let fade = sin(PI * (this.age / this.life));
    noStroke();
    fill(col[0], col[1], col[2], this.alpha * fade);
    circle(this.pos.x, this.pos.y, this.size);
  }
}

