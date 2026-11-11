import {BOOST_TIME, STEP, drive, newKart, newLap, trackLength, updateLap} from "./physics.js";
import {Sound} from "./music.js?v=2";
import {World, drawMap} from "./world.js";

const el = id => document.getElementById(id);
const stage=el("stage");
const sound=new Sound(el("race-music"));
const recordKey="sunshine-kart/bay-v1/best";
const muteKey="sunshine-kart/mute";
const controls=new Set(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight","Space"]);
const keys=new Set();
const touchKeys=new Map();
const held=(...codes)=>codes.some(code=>keys.has(code)||[...touchKeys.values()].includes(code));
const reducedMotion=matchMedia("(prefers-reduced-motion: reduce)").matches;
const timeText=seconds=>{
  const ms=Math.floor(seconds*1000+.00001);
  return String(Math.floor(ms/60000)).padStart(2,"0")+":"+String(Math.floor(ms/1000)%60).padStart(2,"0")+"."+String(ms%1000).padStart(3,"0");
};

function readRecord() {
  try {
    const record=JSON.parse(localStorage.getItem(recordKey));
    if (Number.isFinite(record?.time) && record.time>0 && record.time<360) return {time:record.time};
  } catch {}
  return null;
}

function writeLocal(key,value) {
  try {localStorage.setItem(key,value);} catch {}
}

let record=readRecord();
try {sound.setMuted(localStorage.getItem(muteKey)==="1");} catch {}

let world;
try {world=new World(stage);}
catch (error) {
  console.error(error);
  el("error").hidden=false;
  el("start").disabled=true;
}
if(world) launch();

function launch() {
  const ui={
    start:el("start"),sound:el("sound"),pause:el("pause"),pauseMenu:el("pause-menu"),resume:el("resume"),
    restart:el("restart"),back:el("back"),time:el("time"),best:el("best"),lap:el("lap"),count:el("count"),
    message:el("message"),speed:el("speed"),boost:el("boost-track"),fill:el("boost-fill"),label:el("boost-label"),map:el("map")
  };
  let mode="menu", pausedFrom, kart=newKart(), lap=newLap(), lapNumber=1;
  let previous=performance.now(), accumulator=0, ambient=0, countdown=3, countShown=0, bannerTime=0, raceAge=0, bumpTime=0, boostWasOn=false;

  function setMode(value) {
    mode=value;
    document.body.dataset.mode=value;
    ui.pause.hidden=value==="menu" || value==="paused";
    ui.pauseMenu.hidden=value!=="paused";
  }

  function setSoundButton() {
    ui.sound.setAttribute("aria-pressed",String(sound.muted));
    ui.sound.setAttribute("aria-label",sound.muted?"打开声音":"关闭声音");
  }

  function toggleSound() {
    sound.unlock();
    sound.setMuted(!sound.muted);
    writeLocal(muteKey,sound.muted?"1":"0");
    setSoundButton();
  }

  function clearControls() {
    keys.clear();
    touchKeys.clear();
  }

  function begin() {
    sound.unlock();
    sound.prepareRace();
    clearControls();
    kart=newKart();
    lap=newLap();
    lapNumber=1;
    raceAge=0;
    countdown=3;
    countShown=0;
    bannerTime=0;
    bumpTime=0;
    boostWasOn=false;
    accumulator=0;
    ui.message.hidden=true;
    world.reset();
    setMode("countdown");
    if(document.activeElement instanceof HTMLElement) document.activeElement.blur();
    tickCountdown(0);
    renderHUD();
  }

  function toMenu() {
    clearControls();
    kart=newKart();
    sound.race(false,true);
    world.reset();
    setMode("menu");
    ui.count.hidden=true;
    ui.start.focus({preventScroll:true});
  }

  function pause() {
    if(mode!=="race" && mode!=="countdown") return;
    pausedFrom=mode;
    sound.race(false);
    clearControls();
    setMode("paused");
    ui.resume.focus({preventScroll:true});
  }

  function resume() {
    if(mode!=="paused") return;
    sound.unlock();
    if(pausedFrom==="race") sound.race(true);
    else sound.prepareRace();
    accumulator=0;
    setMode(pausedFrom);
    ui.resume.blur();
  }

  function tickCountdown(dt) {
    countdown=Math.max(0,countdown-dt);
    const count=Math.ceil(countdown);
    if(count>0 && count!==countShown) {
      countShown=count;
      ui.count.textContent=String(count);
      ui.count.hidden=false;
      sound.effect("count");
    }
    if(count===0) {
      setMode("race");
      ui.count.textContent="GO!";
      sound.effect("go");
      sound.race(true,true);
    }
  }

  function finishLap() {
    const personalBest=!record||lap.time<record.time;
    if(personalBest && lap.time<360) {
      record={time:lap.time};
      writeLocal(recordKey,JSON.stringify(record));
    }
    ui.message.textContent=(personalBest?"新纪录":"完成一圈")+" · "+timeText(lap.time);
    ui.message.hidden=false;
    bannerTime=3;
    lapNumber++;
    lap=newLap();
    lap.previous=kart.progress.s;
    sound.effect("lap");
  }

  function step(dt) {
    if(mode==="countdown") tickCountdown(dt);
    else if(mode==="race") {
      raceAge+=dt;
      const input={
        throttle:held("ArrowUp","KeyW"),
        brake:held("ArrowDown","KeyS"),
        steer:Number(held("ArrowRight","KeyD"))-Number(held("ArrowLeft","KeyA")),
        drift:held("ShiftLeft","ShiftRight"),
        boost:held("Space")
      };
      drive(kart,input,dt);
      const boostActive=kart.boost>0;
      if(boostActive&&!boostWasOn) sound.effect("boost");
      boostWasOn=boostActive;
      if(kart.collision && raceAge>bumpTime && Math.abs(kart.speed)>7) {
        sound.effect("bump");
        bumpTime=raceAge+.38;
      }
      if(bannerTime>0) bannerTime-=dt;
      if(updateLap(lap,kart,dt)) finishLap();
    }
  }

  function renderHUD() {
    const boostActive=kart.boost>0;
    const fill=boostActive?kart.boost/BOOST_TIME:kart.charge;
    ui.time.textContent=timeText(lap.time);
    ui.best.textContent=record?timeText(record.time):"--:--.---";
    ui.lap.textContent="第 "+lapNumber+" 圈";
    ui.speed.textContent=String(Math.round(Math.abs(kart.speed)*5.1)).padStart(3,"0");
    ui.fill.style.transform="scaleX("+fill+")";
    ui.boost.classList.toggle("ready",kart.charge>=1);
    ui.boost.classList.toggle("active",boostActive);
    ui.boost.setAttribute("aria-valuenow",Math.round(fill*100));
    ui.label.textContent=boostActive?"氮气加速":kart.charge>=1?"已就绪 · 空格":kart.drifting?"正在漂移":"漂移蓄力";
    ui.count.hidden=!(mode==="countdown"||(mode==="race"&&raceAge<.72));
    ui.message.hidden=bannerTime<=0 || mode==="paused";
  }

  function frame(now) {
    const dt=Math.min(.1,(now-previous)/1000);
    previous=now;
    if(mode!=="paused") {
      ambient+=dt;
      if(mode==="race" || mode==="countdown") {
        accumulator+=dt;
        while(accumulator>=STEP) {
          step(STEP);
          accumulator-=STEP;
        }
        renderHUD();
      }
      world.draw(kart,mode,reducedMotion&&mode==="menu"?0:ambient,dt);
      if(mode==="race"||mode==="countdown") drawMap(ui.map,kart);
    }
    sound.tick(kart,mode==="race"||mode==="countdown");
    requestAnimationFrame(frame);
  }

  el("distance").textContent=Math.round(trackLength)+" 米";
  drawMap(el("menu-map"));
  setSoundButton();
  world.reset();
  world.draw(kart,mode,0,0);
  requestAnimationFrame(frame);
  window.addEventListener("resize",()=>{
    world.resize(stage);
    if(mode==="paused") world.draw(kart,pausedFrom,ambient,0);
  });
  window.addEventListener("blur",pause);
  document.addEventListener("visibilitychange",()=>{if(document.hidden) pause();});
  ui.start.addEventListener("click",begin);
  ui.sound.addEventListener("click",toggleSound);
  ui.pause.addEventListener("click",pause);
  ui.resume.addEventListener("click",resume);
  ui.restart.addEventListener("click",begin);
  ui.back.addEventListener("click",toMenu);

  window.addEventListener("keydown",event=>{
    if(event.metaKey||event.ctrlKey||event.altKey) return;
    if(controls.has(event.code) && (mode==="race"||mode==="countdown")) {
      event.preventDefault();
      keys.add(event.code);
    }
    if(event.repeat) return;
    if(event.code==="KeyM") toggleSound();
    if(event.code==="Escape") {
      if(mode==="paused") resume();
      else pause();
    }
    if(event.code==="Enter" && mode==="menu" && !(document.activeElement instanceof HTMLButtonElement)) {
      event.preventDefault();
      begin();
    }
  });
  window.addEventListener("keyup",event=>keys.delete(event.code));

  document.querySelectorAll("[data-key]").forEach(button=>{
    button.addEventListener("pointerdown",event=>{
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      touchKeys.set(event.pointerId,button.dataset.key);
    });
    for(const eventName of ["pointerup","pointercancel","lostpointercapture"]) {
      button.addEventListener(eventName,event=>touchKeys.delete(event.pointerId));
    }
  });
}
