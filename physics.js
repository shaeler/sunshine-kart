export const ROAD = 7.2;
export const WALL = 9.55;
export const BOOST_TIME = 2.5;
export const STEP = 1 / 120;
export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

const points = [
  [-43,-66], [-10,-66], [35,-66], [66,-53], [76,-32], [67,-11],
  [44,-5], [21,-11], [7,-2], [10,17], [32,28], [60,38], [76,55],
  [64,76], [28,82], [-14,84], [-57,76], [-78,58], [-81,34], [-66,12],
  [-53,-8], [-60,-25], [-84,-38], [-84,-56], [-68,-66]
];

function catmull(a, b, c, d, t) {
  return 0.5 * (2 * b + (-a + c) * t + (2*a - 5*b + 4*c - d) * t*t + (-a + 3*b - 3*c + d) * t*t*t);
}

function makeTrack() {
  const nodes = [];
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    const [a,b,c,d] = [-1,0,1,2].map(offset => points[(i + offset + points.length) % points.length]);
    for (let j = 0; j < 16; j++) {
      const t = j / 16;
      const x = catmull(a[0],b[0],c[0],d[0],t);
      const z = catmull(a[1],b[1],c[1],d[1],t);
      const prev = nodes.at(-1);
      if (prev) length += Math.hypot(x-prev.x,z-prev.z);
      nodes.push({x,z,s:length});
    }
  }
  length += Math.hypot(nodes[0].x-nodes.at(-1).x,nodes[0].z-nodes.at(-1).z);
  return {nodes,length};
}
export const {nodes, length: trackLength} = makeTrack();

function between(index, t) {
  const a = nodes[index], b = nodes[(index + 1) % nodes.length];
  const end = b.s || trackLength;
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = end - a.s;
  return {x:a.x + dx*t,z:a.z + dz*t,s:a.s + len*t,tx:dx/len,tz:dz/len,i:index};
}

export function atDistance(s) {
  s = ((s % trackLength) + trackLength) % trackLength;
  let lo = 0, hi = nodes.length;
  while (lo+1 < hi) {
    const mid = (lo+hi) >> 1;
    if (nodes[mid].s > s) hi = mid;
    else lo = mid;
  }
  return between(lo, (s-nodes[lo].s)/((nodes[hi]?.s ?? trackLength)-nodes[lo].s));
}

export function closest(x, z, hint) {
  let bestIndex = 0, bestT = 0, bestDistance = Infinity;
  const start = hint === undefined ? 0 : hint - 11;
  const count = hint === undefined ? nodes.length : 23;
  for (let j = 0; j < count; j++) {
    const i = (start + j + nodes.length) % nodes.length;
    const a = nodes[i], b = nodes[(i+1)%nodes.length];
    const dx = b.x-a.x, dz = b.z-a.z;
    const t = clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
    const dist = (x-a.x-dx*t)**2+(z-a.z-dz*t)**2;
    if (dist < bestDistance) {
      bestDistance = dist;
      bestIndex = i;
      bestT = t;
    }
  }
  const point = between(bestIndex, bestT);
  point.offset = (x-point.x)*point.tz - (z-point.z)*point.tx;
  return point;
}

export function newKart() {
  const point = atDistance(0);
  const angle = Math.atan2(point.tx,point.tz);
  return {x:point.x,z:point.z,angle,travel:angle,speed:0,steer:0,drifting:false,charge:0,boost:0,collision:false,progress:point};
}

export function drive(kart, input, dt) {
  const {throttle, brake, steer, drift, boost} = input;
  const direction = Math.sign(kart.speed) || 1;
  const offRoad = Math.abs(kart.progress.offset ?? 0) > ROAD;
  if (boost && kart.charge >= 1 && kart.boost <= 0) {
    kart.boost = BOOST_TIME;
    kart.charge = 0;
  }
  kart.boost = Math.max(0,kart.boost-dt);
  kart.steer += (steer-kart.steer)*(1-Math.exp(-14*dt));
  kart.drifting = drift && kart.speed > 8 && !offRoad && (Math.abs(kart.steer) > .18 || (kart.drifting && Math.abs(wrapAngle(kart.angle-kart.travel)) > .08));
  const speedLimit = offRoad ? 13 : kart.boost > 0 ? 45 : kart.drifting ? 26 : 34;
  const acceleration = kart.boost > 0 ? 22 : 13;
  if (throttle || kart.boost > 0) kart.speed += acceleration*dt;
  if (brake) kart.speed -= (kart.speed > 0 ? 27 : 8)*dt;
  if (!throttle && !brake && kart.boost <= 0) {
    kart.speed *= Math.exp(-1.05*dt);
    if (Math.abs(kart.speed)<.05) kart.speed = 0;
  }
  if (kart.speed > speedLimit) kart.speed += (speedLimit-kart.speed)*(1-Math.exp(-(offRoad ? 6 : 3)*dt));
  kart.speed = clamp(kart.speed,-7,speedLimit+2.2);
  const moving = Math.min(1,Math.abs(kart.speed)/6);
  const turnRate = kart.drifting ? 2.35 : 1.48 - .45*clamp(Math.abs(kart.speed)/36,0,1);
  kart.angle = wrapAngle(kart.angle - kart.steer*turnRate*moving*direction*dt);
  const slip = wrapAngle(kart.angle-kart.travel);
  kart.travel = wrapAngle(kart.travel + slip*(1-Math.exp(-(kart.drifting ? 3.8 : 12)*dt)));
  if (kart.drifting && kart.boost <= 0) {
    kart.charge = Math.min(1,kart.charge+dt*(.26+.6*Math.min(1,Math.abs(slip)*2))*Math.min(1,kart.speed/15));
  }
  kart.x += Math.sin(kart.travel)*kart.speed*dt;
  kart.z += Math.cos(kart.travel)*kart.speed*dt;
  kart.progress = closest(kart.x,kart.z,kart.progress.i);
  kart.collision = Math.abs(kart.progress.offset) >= WALL;
  if (kart.collision) {
    const p = kart.progress;
    const side = Math.sign(p.offset);
    const forward = Math.sin(kart.travel)*p.tx+Math.cos(kart.travel)*p.tz;
    kart.x = p.x + p.tz*side*(WALL-.15);
    kart.z = p.z - p.tx*side*(WALL-.15);
    kart.speed *= Math.abs(forward) < .75 ? .82 : .97;
    const tangent = Math.atan2(p.tx,p.tz)+(forward < 0 ? Math.PI : 0);
    kart.travel = wrapAngle(kart.travel+wrapAngle(tangent-kart.travel)*.32);
  }
}

export function newLap() {
  return {time:0,gate:1,previous:0};
}

export function updateLap(lap, kart, dt) {
  lap.time += dt;
  const s = kart.progress.s;
  const step = trackLength / 4;
  if (lap.gate < 4 && lap.previous < step*lap.gate && s >= step*lap.gate && s-lap.previous < 3) lap.gate++;
  const crossedStart = s < 3 && lap.previous > trackLength-3;
  const finished = lap.gate === 4 && crossedStart;
  if (crossedStart) lap.gate = 1;
  if (s > trackLength-3 && lap.previous < 3 && lap.gate > 1) lap.gate = 1;
  if (s < lap.previous && lap.previous-s < 3 && lap.gate > 1 && s < step*(lap.gate-1)) lap.gate--;
  lap.previous = s;
  return finished;
}
