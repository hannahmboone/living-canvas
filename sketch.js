
const NUM_PARTICLES = 1600;
let flockA = [], flockB = [];
let attractors = [];
let colorT = 0;
let prevHandPos = { x: 0, y: 0 };
let handX = -1, handY = -1, handVX = 0, handVY = 0;
let statusMsg = 'click to enable camera';
let cameraStarted = false;
let framesSinceDetect = 0;
let handsModel;
let colorCache = [0, 0, 0];

// Web Audio
let audioCtx, oscA, oscB, oscC, gainNode;
let soundStarted = false;

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
  pixelDensity(1);
  for (let i = 0; i < NUM_PARTICLES; i++) {
    flockA.push(new Particle('A'));
    flockB.push(new Particle('B'));
  }
  attractors = [];
}

function mousePressed() {
  if (!cameraStarted) {
    cameraStarted = true;
    startMediaPipe();
    startSound();
  }
}

function startMediaPipe() {
  statusMsg = 'starting camera...';
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
  camera.start().then(() => { statusMsg = 'move your hand!'; });
}

function startSound() {
  if (soundStarted) return;
  soundStarted = true;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 2.0);
  gainNode.connect(audioCtx.destination);
  oscA = audioCtx.createOscillator();
  oscB = audioCtx.createOscillator();
  oscC = audioCtx.createOscillator();
  oscA.type = 'sine'; oscA.frequency.value = 220;
  oscB.type = 'sine'; oscB.frequency.value = 220 * 1.004;
  oscC.type = 'sine'; oscC.frequency.value = 440;
  oscA.connect(gainNode);
  oscB.connect(gainNode);
  oscC.connect(gainNode);
  oscA.start();
  oscB.start();
  oscC.start();
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
  colorCache[0] = r*255;
  colorCache[1] = g*255;
  colorCache[2] = bl*255;
  return colorCache;
}

function draw() {
  background(0, 0, 0, 40);
  colorT += 0.003;

  // Update sound
  if (soundStarted && audioCtx) {
    let baseFreq = 220 + 220 * (0.5 + 0.5 * Math.sin(colorT * 0.5));
    oscA.frequency.setTargetAtTime(baseFreq, audioCtx.currentTime, 0.5);
    oscB.frequency.setTargetAtTime(baseFreq * 1.004, audioCtx.currentTime, 0.5);
    oscC.frequency.setTargetAtTime(baseFreq * 2.0, audioCtx.currentTime, 0.5);
    if (handX > 0) {
      let speed = Math.sqrt(handVX*handVX + handVY*handVY);
      let swell = Math.min(speed / 30, 1) * 0.05;
      gainNode.gain.setTargetAtTime(0.12 + swell, audioCtx.currentTime, 0.3);
    } else {
      gainNode.gain.setTargetAtTime(0.12, audioCtx.currentTime, 1.0);
    }
  }

  // Update attractors
  if (handX > 0) {
    attractors = [{ x: handX, y: handY, vx: handVX, vy: handVY }];
  } else if (!cameraStarted) {
    attractors = [{ x: mouseX, y: mouseY, vx: mouseX - pmouseX, vy: mouseY - pmouseY }];
  } else {
    attractors = [];
  }

  for (let p of flockA) { p.update(); p.draw(); }
  for (let p of flockB) { p.update(); p.draw(); }

  fill(255, 255, 255, 60);
  noStroke();
  textFont('monospace');
  textSize(11);
  textAlign(CENTER);
  text(statusMsg, width/2, height - 16);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

class Particle {
  constructor(flock) {
    this.flock = flock;
    this.reset(true);
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
    this.alpha = random(120, 200);
    this.maxSpeed = random(0.3, 2.0);
    this.life = random(0.6, 1.0);
    this.age = init ? random(1) : 0;
    this.colorLag = random(-0.2, 0.2);
    this.hueOffset = this.flock === 'B' ? 180 : 0;
  }

  update() {
    this.age += 0.002;
    if (this.age > this.life) this.reset(false);

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
        let inv = 0.8 / d;
        this.acc.x += dx * inv;
        this.acc.y += dy * inv;
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
