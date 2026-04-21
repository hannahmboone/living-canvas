
const NUM_PARTICLES = 1200; // per flock
let flockA = [], flockB = [];
let attractors = [];
let video, handPose, poses = [];
let poseActive = false;
let colorT = 0;
let prevHandPos = {};
let statusMsg = 'click to enable camera';

function setup() {
  createCanvas(windowWidth, windowHeight);
  for (let i = 0; i < NUM_PARTICLES; i++) {
    flockA.push(new Particle('A'));
    flockB.push(new Particle('B'));
  }
  attractors = [{ x: width/2, y: height/2, vx: 0, vy: 0 }];
}

function mousePressed() {
  if (!poseActive) startCamera();
}

function startCamera() {
  poseActive = true;
  statusMsg = 'starting camera...';
  video = createCapture(VIDEO, () => {
    video.hide();
    video.size(640, 480);
    statusMsg = 'loading hand tracking...';
    handPose = ml5.handpose(video, { flipHorizontal: true, maxNumHands: 2 }, () => {
      statusMsg = 'move your hand!';
      // Only detect every 5 frames to reduce CPU load
      setInterval(() => {
        handPose.predict(video, results => {
          poses = results;
          if (results.length > 0) statusMsg = '✦ tracking';
          else statusMsg = 'show your hand to the camera';
        });
      }, 80); // ~12 times per second instead of 60
    });
  });
}

function getCurrentColor(lag, flock) {
  let h = ((colorT + lag) * 60) % 360;
  // Flock B is offset by 180 degrees on the color wheel
  if (flock === 'B') h = (h + 180) % 360;
  let s = 55 + 20 * sin((colorT + lag) * 0.7);
  let b = 65 + 15 * sin((colorT + lag) * 0.4);
  let hh = h / 60;
  let i = Math.floor(hh);
  let f = hh - i;
  let sv = s / 100, bv = b / 100;
  let p = bv * (1 - sv);
  let q = bv * (1 - sv * f);
  let t = bv * (1 - sv * (1 - f));
  let r, g, bl;
  if (i === 0) { r=bv; g=t; bl=p; }
  else if (i === 1) { r=q; g=bv; bl=p; }
  else if (i === 2) { r=p; g=bv; bl=t; }
  else if (i === 3) { r=p; g=q; bl=bv; }
  else if (i === 4) { r=t; g=p; bl=bv; }
  else { r=bv; g=p; bl=q; }
  return [r*255, g*255, bl*255];
}

function draw() {
  background(255, 255, 255, 40);
  colorT += 0.003;

  if (poses.length > 0) {
    attractors = [];
    let landmarks = poses[0].landmarks || poses[0].keypoints;
    let keyIndices = [8];
    for (let i of keyIndices) {
      if (!landmarks[i]) continue;
      let lm = landmarks[i];
      let rawX = Array.isArray(lm) ? lm[0] : lm.x;
      let rawY = Array.isArray(lm) ? lm[1] : lm.y;
      let x = map(rawX, 0, 640, 0, width);
      let y = map(rawY, 0, 480, 0, height);
      let prev = prevHandPos[i] || { x, y };
      let vx = (x - prev.x) * 6.0;
      let vy = (y - prev.y) * 6.0;
      attractors.push({ x, y, vx, vy });
      prevHandPos[i] = { x, y };
    }
  } else {
    let vx = mouseX - pmouseX;
    let vy = mouseY - pmouseY;
    attractors = [{ x: mouseX, y: mouseY, vx, vy }];
  }

  for (let p of flockA) { p.update(); p.draw(); }
  for (let p of flockB) { p.update(); p.draw(); }

  fill(0, 0, 0, 60);
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
    // Two flocks spawn in slightly different areas
    let offsetX = this.flock === 'A' ? -250 : 250;
    let offsetY = this.flock === 'A' ? -100 : 100;
    this.pos = createVector(
      width/2 + offsetX + random(-180, 180),
      height/2 + offsetY + random(-180, 180)
    );
    this.vel = p5.Vector.random2D().mult(random(0.1, 0.4));
    this.acc = createVector(0, 0);
    this.baseSize = random(2, 4.5);
    this.size = this.baseSize;
    this.alpha = random(120, 210);
    this.maxSpeed = random(0.3, 2.5);
    this.life = random(0.6, 1.0);
    this.age = init ? random(1) : 0;
    this.colorLag = random(-0.2, 0.2);
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

    // Reset size each frame then grow if near attractor
    this.size = this.baseSize;

    for (let a of attractors) {
      // Pull entire flock toward finger
      let target = createVector(a.x, a.y);
      let toFinger = p5.Vector.sub(target, this.pos);
      let d = toFinger.mag();
      if (d > 1) {
        toFinger.normalize().mult(0.8);
        this.acc.add(toFinger);
      }
      // Velocity push
      if (d < 500 && d > 1) {
        let strength = (500 - d) / 500;
        this.acc.add(createVector(a.vx, a.vy).mult(strength * 4.0));
      }
      // Size grows near finger
      if (d < 150) {
        let grow = map(d, 0, 150, 3.5, 0);
        this.size = this.baseSize + grow;
      }
    }

    // Center pull — each flock pulled to its own center
    let offsetX = this.flock === 'A' ? -250 : 250;
    let offsetY = this.flock === 'A' ? -100 : 100;
    let home = createVector(width/2 + offsetX, height/2 + offsetY);
    let toHome = p5.Vector.sub(home, this.pos);
    let d = toHome.mag();
    if (d > 150) {
      toHome.normalize().mult((d - 150) * 0.001);
      this.acc.add(toHome);
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
    let col = getCurrentColor(this.colorLag, this.flock);
    let fade = sin(PI * (this.age / this.life));
    noStroke();
    fill(col[0], col[1], col[2], this.alpha * fade);
    circle(this.pos.x, this.pos.y, this.size);
  }
}
