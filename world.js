import * as T from "./vendor/three.module.min.js";
import {ROAD, WALL, atDistance, clamp, closest, nodes, trackLength} from "./physics.js";

const color = value => new T.Color(value);
const flat = (value, options={}) => new T.MeshStandardMaterial({color:value,roughness:.85,...options});
const basic = (value, options={}) => new T.MeshBasicMaterial({color:value,...options});
const box = new T.BoxGeometry(1,1,1);
const sphere = new T.SphereGeometry(1,18,12);
const stone = new T.IcosahedronGeometry(1,0);
const cone = new T.ConeGeometry(1,1,9);
const cylinder = new T.CylinderGeometry(1,1,1,16);
const place = (object,x,y,z) => {object.position.set(x,y,z); return object;};

const gable = new T.Shape();
gable.moveTo(-3.79,0);
gable.lineTo(3.79,0);
gable.lineTo(0,2.18);
gable.closePath();
const roofGeometry = new T.ExtrudeGeometry(gable,{depth:6.05,bevelEnabled:false});
roofGeometry.translate(0,0,-3.025);

function mesh(parent, geometry, material, x,y,z,sx=1,sy=1,sz=1) {
  const object = new T.Mesh(geometry,material);
  place(object,x,y,z);
  object.scale.set(sx,sy,sz);
  parent.add(object);
  return object;
}

function randomSource(seed) {
  return () => {
    seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
    return seed/4294967296;
  };
}

function materialSet() {
  return {
    turf:flat(0x91cf56,{vertexColors:true}), sand:flat(0xffd590), shallow:flat(0x6cd6c0), ocean:flat(0x39aec8),
    road:flat(0x6a7586,{vertexColors:true}), shoulder:flat(0xf4bd7a), edge:flat(0xffedc4), dash:flat(0xd4dceb),
    curb:flat(0xffffff,{vertexColors:true}), fence:flat(0xfff0d5), post:flat(0x3c8192),
    pink:flat(0xee6647), gold:flat(0xffca3f), blue:flat(0x2b829d), navy:flat(0x143a60), light:flat(0xfff5d5),
    trunk:flat(0xaa7954), leaf:[0x3b9f65,0x4faf67,0x7bbb49,0x339770].map(v=>flat(v)),
    rock:[0xa1bb8f,0xc1c2a2,0x8ca991].map(v=>flat(v)), cloud:basic(0xfff8ee),
    wave:basic(0xb1ede0,{transparent:true,opacity:.76}), window:flat(0x489eaa), hill:[0x6fba6f,0x69b29c,0x72c3a3,0x80c1a2].map(v=>flat(v))
  };
}

function ribbon(parent, material, offset, width, y, tint, segments=0) {
  const positions=[], colors=[], indices=[];
  const count = segments || nodes.length;
  for (let i=0;i<=count;i++) {
    const p=atDistance(i*trackLength/count);
    for (const side of [-1,1]) {
      const d=offset+side*width/2;
      positions.push(p.x+p.tz*d,y,p.z-p.tx*d);
      if (tint) {
        const c=tint(i,side);
        colors.push(c.r,c.g,c.b);
      }
    }
    if(i<count) {
      const base=i*2;
      indices.push(base,base+2,base+1,base+1,base+2,base+3);
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute("position",new T.Float32BufferAttribute(positions,3));
  if(tint) geo.setAttribute("color",new T.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const road=new T.Mesh(geo,material);
  parent.add(road);
}

function trackTiles(parent, material, offset, width, y, spacing, length, palette) {
  const positions=[], colors=[];
  const count=Math.round(trackLength/spacing);
  for(let i=0;i<count;i++) {
    const a=atDistance(i*trackLength/count);
    const b=atDistance(i*trackLength/count+Math.min(length,trackLength/count));
    const corners=[
      [a,offset-width/2],[a,offset+width/2],[b,offset-width/2],[b,offset+width/2]
    ];
    const c=palette?.[i%palette.length];
    for(const index of [0,2,1,1,2,3]) {
      const [p,d]=corners[index];
      positions.push(p.x+p.tz*d,y,p.z-p.tx*d);
      if(c) colors.push(c.r,c.g,c.b);
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute("position",new T.Float32BufferAttribute(positions,3));
  if(palette) geo.setAttribute("color",new T.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();
  parent.add(new T.Mesh(geo,material));
}

function ground(parent, material, rx, rz, y, rough=false) {
  const vertices=[0,y,5], colors=[.87,.98,.88], indices=[];
  const count=128;
  for(let ring=1;ring<=5;ring++) {
    for(let i=0;i<count;i++) {
      const a=i/count*Math.PI*2;
      const coast=1+.035*Math.sin(a*7)+.023*Math.cos(a*11)+.034*Math.sin(a*3);
      vertices.push(rx*Math.cos(a)*coast*ring/5,y,5+rz*Math.sin(a)*coast*ring/5);
      const tint=rough ? .92+.07*Math.sin(a*8+ring*2.1)*Math.cos(a*13-ring) : 1;
      colors.push(tint,tint,Math.min(1,tint*.96));
      const v=1+(ring-1)*count+i, next=1+(ring-1)*count+(i+1)%count;
      if(ring===1) indices.push(0,next,v);
      else indices.push(v-count,next-count,v,v,next-count,next);
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute("position",new T.Float32BufferAttribute(vertices,3));
  geo.setAttribute("color",new T.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  parent.add(new T.Mesh(geo,material));
}

function signTexture(width,height, draw) {
  const canvas=document.createElement("canvas");
  canvas.width=width; canvas.height=height;
  draw(canvas.getContext("2d"),width,height);
  const tex=new T.CanvasTexture(canvas);
  tex.colorSpace=T.SRGBColorSpace;
  return tex;
}

function panel(parent, width,height, texture,x,y,z) {
  return mesh(parent,new T.PlaneGeometry(width,height),basic(0xffffff,{map:texture}),x,y,z);
}

function checker(ctx,x,y,cols,rows,size,dark="#183350",light="#fff7db") {
  for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
    ctx.fillStyle=(row+col)%2 ? dark : light;
    ctx.fillRect(x+col*size,y+row*size,size,size);
  }
}

function arch(scene, materials) {
  const m=materials;
  const p=atDistance(23);
  const gate=place(new T.Group(),p.x,0,p.z);
  gate.rotation.y=Math.atan2(p.tx,p.tz);
  scene.add(gate);
  for(const side of [-1,1]) {
    const x=side*8.9;
    mesh(gate,box,m.navy,x,.46,0,2.25,.95,2.8);
    mesh(gate,box,m.blue,x,3.57,0,1.1,6.4,1.4);
    for(let i=0;i<5;i++) {
      mesh(gate,box,i%2 ? m.navy : m.gold,x,.7+i*.54,-.71,1.13,.53,.04);
    }
    mesh(gate,sphere,m.gold,x,6.3,0,1.03,.56,.77);
  }
  mesh(gate,box,m.navy,0,6.4,0,19,2,1.55);
  mesh(gate,box,m.blue,0,7.43,0,19,.19,1.62);
  mesh(gate,box,m.gold,0,5.39,0,19,.22,1.62);
  const tex=signTexture(1024,112,(ctx,w,h)=>{
    ctx.fillStyle="#143754";
    ctx.fillRect(0,0,w,h);
    checker(ctx,26,24,5,3,20);
    checker(ctx,898,24,5,3,20);
    ctx.fillStyle="#ffda58";
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.font='italic 900 73px "Arial Black",Arial,sans-serif';
    ctx.fillText("SUNSHINE  KART",w/2,h/2+4);
  });
  panel(gate,18,1.85,tex,0,6.4,.786);
  panel(gate,18,1.85,tex,0,6.4,-.786).rotation.y=Math.PI;
}

function startLine(scene, m) {
  const p=atDistance(0);
  const stripe=place(new T.Group(),p.x,.042,p.z);
  stripe.rotation.y=Math.atan2(p.tx,p.tz);
  scene.add(stripe);
  const size=ROAD*2/18;
  for(let row=0;row<2;row++) for(let col=0;col<18;col++) {
    mesh(stripe,box,(row+col)%2?m.light:m.navy,(col-8.5)*size,0,(row-.5)*size,size,.018,size);
  }
}

function tree(scene,m,x,z,size,variant=0) {
  const group=place(new T.Group(),x,0,z);
  group.scale.setScalar(size);
  scene.add(group);
  mesh(group,cylinder,m.trunk,0,.92,0,.19,1.84,.19);
  if(variant===2) {
    for(let i=0;i<3;i++) mesh(group,cone,m.leaf[(i+variant)%m.leaf.length],0,1.55+i*.6,0,1.04-i*.18,1.66,.98-i*.15);
  } else {
    mesh(group,stone,m.leaf[variant],0,2.1,0,1.43,1.69,1.36).rotation.y=.42;
    mesh(group,stone,m.leaf[(variant+1)%m.leaf.length],-.74,1.8,.05,.77,.91,.75);
    mesh(group,stone,m.leaf[(variant+2)%m.leaf.length],.64,2.02,.33,.82,1.02,.88);
  }
}

function villa(scene,m,x,z,yaw,body,roof,scale=1) {
  const group=place(new T.Group(),x,0,z);
  group.rotation.y=yaw;
  group.scale.setScalar(scale);
  scene.add(group);
  mesh(group,box,m.sand,0,.23,0,7.6,.46,5.95);
  mesh(group,box,body,0,2.25,0,6.9,4.1,5.4);
  mesh(group,roofGeometry,roof,0,4.28,0);
  mesh(group,box,roof,0,4.29,0,7.6,.23,6.08);
  mesh(group,box,m.light,0,4.97,3.036,.91,1.0,.09);
  mesh(group,box,m.window,0,4.97,3.088,.65,.73,.055);
  mesh(group,box,m.light,2.15,4.9,-.95,.69,2.1,.65);
  mesh(group,box,m.navy,2.15,5.99,-.95,.88,.25,.87);
  mesh(group,box,m.blue,-.15,1.27,2.73,1.05,2.45,.15);
  for(const x of [-2.25,2.17]) {
    mesh(group,box,m.light,x,2.5,2.78,1.35,1.5,.13);
    mesh(group,box,m.window,x,2.52,2.86,1.05,1.2,.09);
    mesh(group,box,roof,x,1.7,2.99,1.48,.24,.52);
  }
}

function windmill(scene,m,x,z,scale=1) {
  const group=place(new T.Group(),x,0,z);
  group.rotation.y=-Math.PI/2;
  group.scale.setScalar(scale);
  scene.add(group);
  mesh(group,new T.CylinderGeometry(1.85,2.6,6.8,12),m.light,0,3.4,0);
  mesh(group,cone,m.pink,0,8.1,0,2.65,3.1,2.65);
  mesh(group,box,m.blue,0,1.06,2.43,1.13,2.08,.23);
  const sails=place(new T.Group(),0,6.65,2.45);
  group.add(sails);
  mesh(sails,sphere,m.navy,0,0,0,.5,.5,.34);
  for(let i=0;i<4;i++) {
    const arm=new T.Group();
    arm.rotation.z=i*Math.PI/2;
    sails.add(arm);
    mesh(arm,box,m.navy,0,2.03,0,.17,3.8,.16);
    mesh(arm,box,m.gold,.44,2.63,0,.85,2.43,.13);
    for(let j=0;j<4;j++) mesh(arm,box,m.light,.44,1.55+j*.65,.08,.85,.09,.08);
  }
  return sails;
}

function flag(scene,m,p,offset,fill) {
  const x=p.x+p.tz*offset,z=p.z-p.tx*offset;
  const group=place(new T.Group(),x,0,z);
  group.rotation.y=Math.atan2(p.tx,p.tz)+.35;
  scene.add(group);
  mesh(group,cylinder,m.navy,0,1.82,0,.055,3.64,.055);
  mesh(group,sphere,m.gold,0,3.72,0,.15,.15,.15);
  mesh(group,box,fill,.64,3.25,0,1.22,.65,.055);
  mesh(group,box,m.light,.5,3.25,.04,.34,.12,.03);
}

function arrowBoards(scene,m) {
  const turn=signTexture(420,100,(ctx,w,h)=>{
    ctx.fillStyle="#173b57";ctx.fillRect(0,0,w,h);
    ctx.fillStyle="#ffd44d";
    for(let x=29;x<380;x+=94){
      ctx.beginPath();ctx.moveTo(x,13);ctx.lineTo(x+45,50);ctx.lineTo(x,87);ctx.lineTo(x+24,87);ctx.lineTo(x+70,50);ctx.lineTo(x+24,13);ctx.fill();
    }
  });
  for(const [distance,side] of [[101,1],[194,-1],[235,-1],[333,1],[440,1],[536,1]]) {
    const p=atDistance(distance);
    const group=place(new T.Group(),p.x+p.tz*side*10.5,0,p.z-p.tx*side*10.5);
    group.rotation.y=Math.atan2(p.tx,p.tz)+Math.PI;
    scene.add(group);
    for(const x of [-2.35,2.35]) mesh(group,box,m.post,x,.92,0,.2,1.84,.26);
    mesh(group,box,m.navy,0,1.82,0,6.1,1.45,.19);
    const board=panel(group,6,1.39,turn,0,1.82,.105);
    if(side<0) board.scale.x=-1;
  }
}

function scatter(scene,m) {
  const rng=randomSource(7319);
  for(let i=0;i<38;i++) {
    const s=i*trackLength/38;
    const p=atDistance(s);
    const side=i%2 ? -1:1;
    const spread=11.8+rng()*9;
    const x=p.x+p.tz*side*spread,z=p.z-p.tx*side*spread;
    if(closest(x,z).offset**2<11**2 || (z < -51 && x>-60 && x<40)) continue;
    tree(scene,m,x,z,1.2+rng()*1.16,i%3);
  }
  for(let i=0;i<92;i++) {
    const x=(rng()-.5)*204,z=(rng()-.5)*194;
    if(closest(x,z).offset**2<12.2**2 || Math.hypot(x/115,(z-5)/104)>.97 || (x>-48 && x<43 && z>-60 && z<-36)) continue;
    if(i%3===0) tree(scene,m,x,z,1+rng()*1.7,i%3);
    else mesh(scene,stone,m.rock[i%3],x,.35,z,.4+rng()*1.4,.4+rng()*.9,.45+rng()*1.4).rotation.y=rng()*7;
  }
  const positions=[[-41,-43,2.4,0],[-29,-38,1.8,1],[20,-47,1.6,0],[53,-40,2.0,1],[62,-45,1.6,2],[-26,-94,1.8,1],[23,-91,2.1,0],[32,-92,1.4,1],[52,-81,1.8,0]];
  for(const [x,z,size,type] of positions) tree(scene,m,x,z,size,type);
  for(let i=0;i<17;i++) {
    const p=atDistance(8+i*trackLength/17);
    flag(scene,m,p,i%2?-11:11,[m.pink,m.gold,m.blue][i%3]);
  }
}

function clouds(scene,m) {
  const rng=randomSource(138);
  const groups=[];
  const origins=[[82,31,-118],[161,48,-53],[180,35,72],[71,44,140],[-65,41,163],[-161,33,34],[-117,39,-108],[12,31,-158],[220,50,-154]];
  for(const [x,y,z] of origins) {
    const group=place(new T.Group(),x,y,z);
    scene.add(group);
    for(let j=0;j<5;j++) {
      mesh(group,sphere,m.cloud,(j-2)*5.4,rng()*2.1,3*rng(),5.2+rng()*3,2.1+rng()*1.9,3+rng()*2);
    }
    groups.push({group,x});
  }
  return groups;
}

function waves(scene,m) {
  const rng=randomSource(231);
  const foam=new T.InstancedMesh(box,m.wave,120), matrix=new T.Matrix4(), pose=new T.Object3D();
  let count=0;
  for(let i=0;i<210 && count<120;i++) {
    const x=(rng()-.5)*480,z=(rng()-.5)*460;
    if(Math.hypot(x/128,(z-5)/119)<1.04) continue;
    pose.position.set(x,-1.43,z);
    pose.rotation.y=.26+rng()*.23;
    pose.scale.set(1.8+rng()*6,.025,.10+rng()*.13);
    pose.updateMatrix();
    matrix.copy(pose.matrix);
    foam.setMatrixAt(count++,matrix);
  }
  foam.count=count;
  scene.add(foam);
}

function makeScenery(scene) {
  const m=materialSet();
  const sky=new T.Mesh(new T.SphereGeometry(480,36,20),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,
    uniforms:{upper:{value:color(0x4da9e4)},horizon:{value:color(0xc8f5f2)}},
    vertexShader:"varying vec3 skyPosition; void main(){skyPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:"uniform vec3 upper; uniform vec3 horizon; varying vec3 skyPosition; void main(){float h=pow(clamp(normalize(skyPosition).y*2.55+.09,0.0,1.0),.6);gl_FragColor=vec4(mix(horizon,upper,h),1.0); #include <colorspace_fragment>\n}".replace("; #include",";\n#include")
  }));
  sky.frustumCulled=false;
  scene.add(sky);
  mesh(scene,box,m.ocean,0,-1.53,0,920,.12,920);
  ground(scene,m.shallow,128,119,-1.30);
  ground(scene,m.sand,121,113,-.28);
  ground(scene,m.turf,115,107,-.13,true);
  const mountains=[[147,-100,32,25,31],[169,-74,28,40,27],[172,61,30,25,40],[147,100,40,23,23],[-141,102,37,22,24],[-130,-97,28,19,33],[14,153,50,23,24],[-68,158,27,36,26],[120,-147,35,30,27],[183,-140,44,29,34]];
  for(let i=0;i<mountains.length;i++) {
    const [x,z,sx,sy,sz]=mountains[i];
    mesh(scene,stone,m.hill[i%m.hill.length],x,-1,z,sx,sy,sz).rotation.y=i*.74;
  }
  const hillSpots=[[-25,45,18,4,14],[-30,1,10,5,8],[45,65,15,5,8],[-38,-35,12,3,7],[62,-70,11,3,7]];
  for(const [x,z,sx,sy,sz] of hillSpots) mesh(scene,sphere,m.hill[0],x,-.9,z,sx,sy,sz);
  ribbon(scene,m.shoulder,0,WALL*2+.5,-.015);
  ribbon(scene,m.road,0,ROAD*2,.014,(i,side)=>color(0xffffff).multiplyScalar(.86+.07*Math.sin(i*.048+side)));
  for(const side of [-1,1]) {
    ribbon(scene,m.edge,side*(ROAD-.25),.11,.024);
    trackTiles(scene,m.curb,side*(ROAD+.34),.64,.039,1.42,1.42,[color(0xf47559),color(0xfff1cf)]);
  }
  for(const side of [-1,1]) for(const y of [.61,1.16]) {
    const rails=new T.InstancedMesh(box,m.fence,nodes.length);
    const pose=new T.Object3D();
    const d=side*(WALL+.16);
    for(let i=0;i<nodes.length;i++) {
      const a=atDistance(i*trackLength/nodes.length),b=atDistance((i+1)*trackLength/nodes.length);
      const x=a.x+a.tz*d,z=a.z-a.tx*d;
      const x2=b.x+b.tz*d,z2=b.z-b.tx*d;
      pose.position.set((x+x2)/2,y,(z+z2)/2);
      pose.rotation.y=Math.atan2(x2-x,z2-z);
      pose.scale.set(.24,.15,Math.hypot(x2-x,z2-z)+.06);
      pose.updateMatrix();
      rails.setMatrixAt(i,pose.matrix);
    }
    scene.add(rails);
  }
  const posts = new T.InstancedMesh(box,m.post,216);
  const pose=new T.Object3D();
  for(let i=0;i<216;i++) {
    const p=atDistance(Math.floor(i/2)*trackLength/108), d=(i%2 ? -1:1)*(WALL+.26);
    pose.position.set(p.x+p.tz*d,.64,p.z-p.tx*d);
    pose.rotation.y=Math.atan2(p.tx,p.tz);
    pose.scale.set(.30,1.36,.27);
    pose.updateMatrix();
    posts.setMatrixAt(i,pose.matrix);
  }
  scene.add(posts);
  trackTiles(scene,m.dash,0,.13,.022,6.7,2.4);
  startLine(scene,m);
  arch(scene,m);
  arrowBoards(scene,m);
  villa(scene,m,-9,-44,-1.6,m.light,m.pink,1.2);
  villa(scene,m,1,-39,-1.4,m.light,m.blue,.95);
  villa(scene,m,13,-44,-1.7,m.sand,m.pink,1.15);
  villa(scene,m,-25,-39,-1.5,m.light,m.pink,.89);
  villa(scene,m,51,55,1.18,m.sand,m.blue,1.2);
  villa(scene,m,36,57,1.28,m.light,m.pink,1.04);
  const mills=[windmill(scene,m,17,-37,1.36),windmill(scene,m,-28,54,1.6)];
  scatter(scene,m);
  waves(scene,m);
  return {clouds:clouds(scene,m),mills};
}

function kartModel(scene) {
  const root=new T.Group(), body=new T.Group();
  scene.add(root);
  root.add(body);
  const mat=(value,roughness=.53)=>flat(value,{roughness});
  const red=mat(0xee553d), orange=mat(0xffa33e), dark=mat(0x192c46), rubber=mat(0x192638,.97), silver=mat(0xc5e5eb);
  const cream=mat(0xfff4c5), blue=mat(0x298eec), glass=mat(0x152d56), yellow=mat(0xffcc3f), skin=mat(0xffbc76);
  const wheels=[];
  mesh(body,sphere,dark,0,.54,-.03,1.13,.34,1.65);
  mesh(body,sphere,red,0,.63,.26,1.07,.46,1.32);
  mesh(body,sphere,orange,0,.67,1.17,1.18,.30,.49);
  mesh(body,sphere,cream,0,.86,1.20,.49,.13,.37);
  mesh(body,sphere,red,0,.74,-1.19,1.23,.41,.57);
  mesh(body,sphere,orange,0,.62,-1.46,1.39,.24,.35);
  mesh(body,sphere,dark,0,.98,-.49,.63,.60,.64);
  mesh(body,sphere,blue,0,1.24,-.39,.48,.48,.44);
  for(const side of [-1,1]) {
    mesh(body,sphere,red,side*.93,.65,-.26,.41,.26,.73);
    mesh(body,sphere,cream,side*.99,.71,-1.56,.17,.13,.10);
    mesh(body,sphere,blue,side*.35,1.31,-.08,.22,.18,.40).rotation.y=side*.28;
    mesh(body,sphere,skin,side*.25,1.35,.27,.15,.13,.15);
    const exhaust=mesh(body,cylinder,silver,side*.73,.52,-1.64,.16,.43,.16);
    exhaust.rotation.x=Math.PI/2;
    const inside=mesh(body,cylinder,dark,side*.73,.52,-1.87,.10,.027,.10);
    inside.rotation.x=Math.PI/2;
    for(const z of [-1.03,1.08]) {
      const fork=place(new T.Group(),side*(z<0?1.12:1.02),.42,z);
      body.add(fork);
      const wheel=new T.Group();
      fork.add(wheel);
      mesh(wheel,cylinder,rubber,0,0,0,z<0?.48:.38,.46,z<0?.48:.38).rotation.z=Math.PI/2;
      mesh(wheel,cylinder,cream,side*.235,0,0,.24,.036,.24).rotation.z=Math.PI/2;
      mesh(wheel,cylinder,orange,side*.265,0,0,.13,.041,.13).rotation.z=Math.PI/2;
      for(let i=0;i<6;i++) {
        const a=i*Math.PI/3;
        mesh(wheel,box,silver,side*.261,Math.sin(a)*.179,Math.cos(a)*.179,.022,.055,.07).rotation.x=-a;
      }
      wheels.push({fork,wheel,front:z>0});
    }
  }
  const steering=mesh(body,new T.TorusGeometry(.26,.054,8,18),dark,0,1.38,.39);
  steering.rotation.x=-.69;
  const head=place(new T.Group(),0,1.89,-.33);
  body.add(head);
  mesh(head,sphere,blue,0,0,0,.65,.62,.62);
  mesh(head,sphere,yellow,0,.045,-.008,.17,.596,.627);
  mesh(head,sphere,glass,0,.004,.432,.57,.35,.27);
  mesh(head,sphere,cream,-.23,.11,.644,.18,.037,.031).rotation.z=-.24;
  for(const side of [-1,1]) mesh(head,sphere,yellow,side*.61,-.04,.038,.15,.26,.27);
  const plate=signTexture(128,72,(ctx,w,h)=>{
    ctx.fillStyle="#172b45";ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="#ffcf48";ctx.lineWidth=6;ctx.strokeRect(3,3,w-6,h-6);
    ctx.fillStyle="#fff5cf";ctx.font="900 italic 45px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("07",w/2,h/2+3);
  });
  panel(body,.68,.40,plate,0,.83,-1.765).rotation.y=Math.PI;
  const flames=[];
  for(const side of [-1,1]){
    const flame=mesh(body,cone,basic(0xffbf44,{transparent:true,opacity:.88}),side*.73,.52,-2.45,.22,1.55,.21);
    flame.rotation.x=-Math.PI/2;
    const core=mesh(body,cone,basic(0xc1f8ff),side*.73,.52,-2.22,.14,.86,.14);
    core.rotation.x=-Math.PI/2;
    flames.push(flame,core);
  }
  return {root,body,head,wheels,flames};
}

function smokeTexture() {
  return signTexture(64,64,(ctx)=>{
    const gradient=ctx.createRadialGradient(32,32,0,32,32,31);
    gradient.addColorStop(0,"#ffffffeb");gradient.addColorStop(.52,"#ffffffb8");gradient.addColorStop(1,"#ffffff00");
    ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  });
}

function shadowTexture() {
  return signTexture(64,64,(ctx)=>{
    const gradient=ctx.createRadialGradient(32,32,3,32,32,31);
    gradient.addColorStop(0,"#182343ad");gradient.addColorStop(.62,"#18234371");gradient.addColorStop(1,"#18234300");
    ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  });
}

export class World {
  constructor(container) {
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));
    this.renderer.outputColorSpace=T.SRGBColorSpace;
    container.append(this.renderer.domElement);
    this.scene=new T.Scene();
    this.scene.fog=new T.FogExp2(0xb9e7ed,.006);
    this.camera=new T.PerspectiveCamera(56,1,.08,550);
    this.scene.add(new T.HemisphereLight(0xfff4d7,0x8eb3ba,2.03));
    const sun=new T.DirectionalLight(0xffefd3,2.42);
    place(sun,-70,65,-39);
    this.scene.add(sun);
    this.scenery=makeScenery(this.scene);
    this.kart=kartModel(this.scene);
    const shadowMap=shadowTexture();
    this.shadow=mesh(this.scene,new T.PlaneGeometry(3.95,5.3),basic(0xffffff,{map:shadowMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),0,.054,0);
    this.shadow.rotation.x=-Math.PI/2;
    const texture=smokeTexture();
    this.smoke=Array.from({length:56},()=>{
      const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,color:0xffffff,transparent:true,depthWrite:false}));
      sprite.visible=false;
      this.scene.add(sprite);
      return {sprite,age:0,life:0,vx:0,vz:0};
    });
    this.smokeIndex=0;
    this.look=new T.Vector3();
    this.eye=new T.Vector3();
    this.cameraReady=false;
    this.resize(container);
  }

  resize(container) {
    this.width=container.clientWidth;
    this.height=container.clientHeight;
    this.camera.aspect=this.width/Math.max(1,this.height);
    this.renderer.setSize(this.width,this.height,false);
    this.camera.updateProjectionMatrix();
  }

  reset() {
    this.cameraReady=false;
    this.smokeCooldown=0;
    for(const p of this.smoke) p.sprite.visible=false;
  }

  position(model,kart,dt,time) {
    place(model.root,kart.x,.02,kart.z);
    model.root.rotation.y=kart.angle;
    model.body.rotation.z=(kart.steer??0)*(kart.drifting?.09:.044);
    model.head.rotation.y=(kart.steer??0)*.16;
    for(const {fork,wheel,front} of model.wheels) {
      wheel.rotation.x+=(kart.speed??0)*dt/.42;
      if(front) fork.rotation.y=-(kart.steer??0)*.32;
    }
    for(const flame of model.flames) {
      flame.visible=kart.boost>0;
      flame.scale.y=(flame.material.color.r>.9?1.44:.88)*(.84+.16*Math.sin(time*63+flame.position.x));
    }
  }

  particles(kart,dt) {
    this.smokeCooldown-=dt;
    if((kart.drifting || kart.collision) && this.smokeCooldown<=0 && kart.speed>5) {
      this.smokeCooldown=.034;
      for(const side of [-1,1]) {
        const p=this.smoke[this.smokeIndex++%this.smoke.length];
        const sx=Math.sin(kart.angle),cx=Math.cos(kart.angle);
        place(p.sprite,kart.x-1.05*sx+side*cx,.31,kart.z-1.05*cx-side*sx);
        p.vx=side*cx*.75;
        p.vz=-side*sx*.75;
        p.age=0;
        p.life=.55+Math.random()*.24;
        p.sprite.material.color.setHex(kart.collision?0xffdba0:0xf1fbff);
        p.sprite.visible=true;
      }
    }
    for(const p of this.smoke) {
      if(!p.sprite.visible) continue;
      p.age+=dt;
      if(p.age>=p.life) {p.sprite.visible=false; continue;}
      const t=p.age/p.life;
      p.sprite.position.x+=p.vx*dt;
      p.sprite.position.z+=p.vz*dt;
      p.sprite.position.y+=dt*.9;
      p.sprite.scale.setScalar(.50+t*1.55);
      p.sprite.material.opacity=(1-t)*.52;
    }
  }

  draw(kart,mode,time,dt) {
    const sx=Math.sin(kart.angle),cx=Math.cos(kart.angle);
    this.position(this.kart,kart,dt,time);
    place(this.shadow,kart.x,.056,kart.z);
    this.shadow.rotation.z=-kart.angle;
    this.particles(kart,dt);
    for(const mill of this.scenery.mills) mill.rotation.z=time*.36;
    for(const {group,x} of this.scenery.clouds) group.position.x=x+Math.sin(time*.055+x)*2.7;
    let targetFov=56;
    const portrait=this.width/Math.max(this.height,1)<.83;
    if(mode==="menu") {
      const sway=Math.sin(time*.47)*.38;
      const across=portrait ? -3.5 : -4.3;
      this.eye.set(kart.x-7.8*sx+across*cx,portrait?4.85:3.28,kart.z-7.8*cx-across*sx+sway);
      const lookSide=portrait ? .9 : 3.95;
      this.look.set(kart.x+6*sx+lookSide*cx,portrait?1.17:2.07,kart.z+6*cx-lookSide*sx);
      targetFov=portrait?67:52;
    } else {
      const rear=7.25+Math.max(0,kart.speed)*.044+(kart.boost>0?.94:0);
      const follow=kart.angle+Math.atan2(Math.sin(kart.travel-kart.angle),Math.cos(kart.travel-kart.angle))*.54;
      const fx=Math.sin(follow),fz=Math.cos(follow);
      this.eye.set(kart.x-fx*rear,4.35+(portrait?.5:0),kart.z-fz*rear);
      this.look.set(kart.x+fx*5.7,1.0,kart.z+fz*5.7);
      targetFov=(portrait?67:56)+(kart.boost>0?9:0);
    }
    if(!this.cameraReady) {
      this.camera.position.copy(this.eye);
      this.camera.fov=targetFov;
      this.cameraReady=true;
    }
    this.camera.position.lerp(this.eye,1-Math.exp(-10*dt));
    this.camera.fov+=(targetFov-this.camera.fov)*(1-Math.exp(-5*dt));
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.look);
    this.renderer.render(this.scene,this.camera);
  }
}

export function drawMap(canvas,kart) {
  const ctx=canvas.getContext("2d"), w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  const scale=Math.min((w-23)/181,(h-17)/166);
  const map=(x,z)=>[w/2+x*scale,h/2+(z-8)*scale];
  ctx.beginPath();
  nodes.forEach((p,i)=>ctx[i?"lineTo":"moveTo"](...map(p.x,p.z)));
  ctx.closePath();
  ctx.lineJoin="round";
  ctx.lineWidth=w*.058;
  ctx.strokeStyle="#8ab8d653";
  ctx.stroke();
  ctx.lineWidth=w*.024;
  ctx.strokeStyle="#d4e9fc";
  ctx.stroke();
  const dot=(x,z,r,fill)=>{
    ctx.beginPath();ctx.arc(...map(x,z),r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
  };
  dot(nodes[0].x,nodes[0].z,w*.023,"#ffffff");
  if(kart) dot(kart.x,kart.z,w*.032,"#ffcf3b");
}
