const NUM_PARTICLES = 2500;
let particles = [];
let attractors = [];
let video, handPose, poses = [];
let poseActive = false;
let colorT = 0;
let prevHandPos = {};
let statusMsg = 'click to enable camera';

function setup() {
  createCanvas(windowWidth, windowHeight);
  for (let i = 0; i < NUM_PARTICLES; i++) particles.push(new Particle());
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
      handPose.on('predict', results => {
        poses = results;
        if (results.length > 0) statusMsg = '✦ tracking';
        else statusMsg = 'show your hand to the camera';
      });
    });
  });
}

function getCurrentColor(lag) {
  colorMode(HSB, 360, 100, 100, 255);
  let h = ((colorT + lag) * 60) % 360;
  let s = 55 + 20 * sin((colorT + lag) * 0.7);
  let b = 65 + 15 * sin((colorT + lag) * 0.4);
  let c = color(h, s, b);
  colorMode(RGB, 255, 255, 255, 255);
  return [red(c), green(c), blue(c)];
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

  for (let p of particles) {
    p.update();
    p.draw();
  }

  // Status text
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
  constructor() { this.reset(true); }

  reset(init) {
    this.pos = createVector(
      width/2 + random(-200, 200),
      height/2 + random(-200, 200)
    );
    this.vel = p5.Vector.random2D().mult(random(0.1, 0.4));
    this.acc = createVector(0, 0);
    this.size = random(2, 4.5);
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

    for (let a of attractors) {
      let d = dist(this.pos.x, this.pos.y, a.x, a.y);
      if (d < 300 && d > 1) {
        let strength = (300 - d) / 300;
        this.acc.add(createVector(a.vx, a.vy).mult(strength * 4.0));
      }
    }

    let center = createVector(width/2, height/2);
    let toCenter = p5.Vector.sub(center, this.pos);
    let d = toCenter.mag();
    if (d > 150) {
      toCenter.normalize().mult((d - 150) * 0.001);
      this.acc.add(toCenter);
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
    let col = getCurrentColor(this.colorLag);
    let fade = sin(PI * (this.age / this.life));
    noStroke();
    fill(col[0], col[1], col[2], this.alpha * fade);
    circle(this.pos.x, this.pos.y, this.size);
  }
}
