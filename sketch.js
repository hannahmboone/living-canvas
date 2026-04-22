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

  // Master gain — very quiet and calm
  gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.0, audioCtx.currentTime + 4.0);
  gainNode.connect(audioCtx.destination);

  // Soft reverb using convolver for bowl resonance
  let reverb = audioCtx.createConvolver();
  let reverbGain = audioCtx.createGain();
  reverbGain.gain.value = 0.4;
  reverbGain.connect(gainNode);

  // Create impulse response for reverb
  let rate = audioCtx.sampleRate;
  let length = rate * 3;
  let impulse = audioCtx.createBuffer(2, length, rate);
  for (let c = 0; c < 2; c++) {
    let d = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
    }
  }
  reverb.buffer = impulse;
  reverb.connect(reverbGain);

  // Three detuned sine waves — low, warm singing bowl frequencies
  oscA = audioCtx.createOscillator();
  oscB = audioCtx.createOscillator();
  oscC = audioCtx.createOscillator();

  oscA.type = 'sine'; oscA.frequency.value = 55;        // very low root
  oscB.type = 'sine'; oscB.frequency.value = 55 * 1.003; // subtle shimmer
  oscC.type = 'sine'; oscC.frequency.value = 82.5;      // low fifth

  // Soft individual gains
  let gA = audioCtx.createGain(); gA.gain.value = 0.6;
  let gB = audioCtx.createGain(); gB.gain.value = 0.3;
  let gC = audioCtx.createGain(); gC.gain.value = 0.15;

  oscA.connect(gA); gA.connect(gainNode); gA.connect(reverb);
  oscB.connect(gB); gB.connect(gainNode); gB.connect(reverb);
  oscC.connect(gC); gC.connect(gainNode); gC.connect(reverb);

  oscA.start(); oscB.start(); oscC.start();
}

function triggerGong() {
  if (!soundStarted || !audioCtx) return;
  // Pick a random pentatonic note — light and airy
  let notes = [261.6, 293.6, 329.6, 392, 440, 523.2];
  let freq = notes[Math.floor(Math.random() * notes.length)];

  let osc = audioCtx.createOscillator();
  let g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(gainNode);

  let t = audioCtx.currentTime;
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 2.5); // long soft decay

  osc.start(t);
  osc.stop(t + 2.5);
}
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
    // Frequency drifts very slowly — barely perceptible shift, like a bowl settling
    let baseFreq = 55 + 9 * Math.sin(colorT * 0.1);
    oscA.frequency.setTargetAtTime(baseFreq, audioCtx.currentTime, 3.0);
    oscB.frequency.setTargetAtTime(baseFreq * 1.003, audioCtx.currentTime, 3.0);
    oscC.frequency.setTargetAtTime(baseFreq * 1.5, audioCtx.currentTime, 3.0);

    // Volume breathes gently with particle flow, swells slightly with hand movement
    if (handX > 0) {
      let speed = Math.sqrt(handVX*handVX + handVY*handVY);
      let vol = Math.min(speed / 20, 1) * 0.22;
      gainNode.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.4);
      // Trigger gong on fast flick, max once every 30 frames
      if (speed > 18 && frameCount % 30 === 0) triggerGong();
    } else {
      gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2.0);
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
