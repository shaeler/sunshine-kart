const TEMPO = 104;
const STEP = 60 / TEMPO / 4;
const progression = [
  [38,[57,61,64,66]],[37,[55,57,64,67]],[35,[57,62,66]],[33,[55,59,61,64]],
  [43,[55,59,62,66]],[42,[54,57,61,64]],[40,[55,59,62,66]],[33,[55,59,61,64]],
  [35,[57,62,66]],[42,[54,57,61,64]],[43,[55,59,62,66]],[38,[54,57,62,64]],
  [40,[55,59,62,66]],[33,[55,59,61,64]],[38,[54,57,61,64]],[33,[55,59,61,64]]
];
// Each entry gives the sixteenth-note onset, MIDI pitch, and length in sixteenths.
const melody = [
  [[0,69,1],[2,66,1],[3,69,1],[6,74,3],[10,73,1],[12,69,2],[15,67,1]],
  [[1,69,3],[6,64,2],[9,67,1],[11,64,1],[14,61,1]],
  [[0,66,1],[2,62,1],[3,66,1],[6,71,3],[10,74,1],[12,73,2]],
  [[0,71,2],[3,69,3],[8,64,1],[10,67,1],[12,69,2],[15,73,1]],
  [[0,74,2],[3,71,2],[6,67,3],[11,71,1],[13,74,1],[15,76,1]],
  [[0,73,3],[5,69,1],[7,66,2],[10,69,1],[12,73,2]],
  [[0,71,1],[2,67,1],[4,64,2],[7,66,1],[9,67,1],[11,71,2],[14,74,1]],
  [[0,73,1],[2,71,1],[4,69,3],[10,64,2],[14,67,1]],
  [[0,78,3],[4,74,1],[6,71,2],[9,74,1],[11,78,1],[14,81,1]],
  [[0,76,3],[5,73,1],[7,69,2],[11,73,2],[15,74,1]],
  [[0,79,3],[4,76,1],[6,74,2],[10,71,1],[12,74,2],[15,76,1]],
  [[0,78,3],[5,76,1],[7,74,2],[10,73,1],[12,69,2]],
  [[0,67,2],[3,71,1],[5,74,2],[8,76,1],[10,74,1],[12,71,1],[15,67,1]],
  [[0,69,1],[2,73,1],[4,76,2],[7,79,1],[9,76,1],[12,73,3]],
  [[0,74,3],[4,69,2],[8,66,1],[10,69,1],[12,74,3]],
  [[0,73,2],[4,71,1],[6,67,2],[10,64,2],[14,67,1],[15,68,1]]
];
const bassPattern = [[0,0,2.6],[3,12,1.7],[6,7,1.35],[8,0,2.4],[11,12,1.4],[13,7,1.3],[15,0,.8]];
const guitarHits = [2,5,8,10,13];
const horns = [0,6,11];
const hornHarmonics = [0,1,.6,.32,.19,.12,.08,.045,.018];
const bassHarmonics = [0,1,.38,.22,.09,.052,.022];
const pluckHarmonics = [0,1,.36,.14,.25,.17,.045,.055,.02];
const hz = note => 440 * 2**((note - 69) / 12);

export class Sound {
  constructor() {
    this.muted = false;
    this.playing = false;
    this.nextTime = 0;
    this.index = 0;
  }

  unlock() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!this.context) {
      this.context = new Audio();
      const context = this.context;
      this.master = context.createGain();
      this.master.gain.value = this.muted ? 0 : .65;
      const compressor = context.createDynamicsCompressor();
      this.master.connect(compressor).connect(context.destination);
      this.music = context.createGain();
      this.music.gain.value = 0;
      this.music.connect(this.master);
      this.horn = this.wave(hornHarmonics);
      this.bass = this.wave(bassHarmonics);
      this.pluck = this.wave(pluckHarmonics);
      this.engineGain = context.createGain();
      this.engineGain.gain.value = 0;
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 295;
      this.engine = context.createOscillator();
      this.engine.type = "sawtooth";
      this.engine.frequency.value = 37;
      this.engine.connect(filter).connect(this.engineGain).connect(this.master);
      this.engine.start();
      this.noise = context.createBuffer(1,context.sampleRate,context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random()*2-1;
    }
    this.context.resume().catch(() => {});
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.context) this.master.gain.setTargetAtTime(muted ? 0 : .65,this.context.currentTime,.025);
  }

  race(playing, reset = false) {
    if (!this.context) return;
    this.playing = playing;
    this.music.gain.setTargetAtTime(playing ? .84 : 0,this.context.currentTime,.045);
    if (reset) this.index = 0;
    if (playing) this.nextTime = this.context.currentTime+.055;
  }

  tone(note, time, length, amp, type, target, cutoff) {
    const ctx = this.context, wave = ctx.createOscillator(), gain = ctx.createGain();
    wave.type = type;
    wave.frequency.value = hz(note);
    gain.gain.setValueAtTime(.0001,time);
    gain.gain.exponentialRampToValueAtTime(amp,time+.008);
    gain.gain.exponentialRampToValueAtTime(Math.max(.001,amp*.45),time+length*.54);
    gain.gain.exponentialRampToValueAtTime(.0001,time+length);
    if (cutoff) {
      const filter = ctx.createBiquadFilter();
      filter.frequency.value = cutoff;
      wave.connect(filter).connect(gain);
    } else wave.connect(gain);
    gain.connect(target);
    wave.start(time);
    wave.stop(time+length+.02);
  }

  wave(harmonics) {
    return this.context.createPeriodicWave(new Float32Array(harmonics.length),new Float32Array(harmonics));
  }

  instrument(waveform, note, time, length, volume, color, pan) {
    const ctx = this.context;
    const wave = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    wave.setPeriodicWave(waveform);
    const frequency = hz(note);
    const isHorn = waveform === this.horn;
    wave.frequency.setValueAtTime(isHorn ? frequency*.989 : frequency,time);
    if (isHorn) wave.frequency.linearRampToValueAtTime(frequency,time+.034);
    filter.frequency.setValueAtTime(color*.62,time);
    filter.frequency.exponentialRampToValueAtTime(color,time+.018);
    filter.frequency.exponentialRampToValueAtTime(color*.46,time+length);
    gain.gain.setValueAtTime(.0001,time);
    gain.gain.exponentialRampToValueAtTime(volume,time+(isHorn?.019:.006));
    gain.gain.exponentialRampToValueAtTime(volume*(isHorn?.65:.19),time+length*.72);
    gain.gain.exponentialRampToValueAtTime(.0001,time+length+.028);
    wave.connect(filter).connect(gain);
    if (pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner).connect(this.music);
    } else gain.connect(this.music);
    wave.start(time);
    wave.stop(time+length+.038);
  }

  kick(time, volume) {
    const ctx = this.context, wave = ctx.createOscillator(), gain = ctx.createGain();
    wave.frequency.setValueAtTime(116,time);
    wave.frequency.exponentialRampToValueAtTime(55,time+.076);
    gain.gain.setValueAtTime(volume,time);
    gain.gain.exponentialRampToValueAtTime(.001,time+.13);
    wave.connect(gain).connect(this.music);
    wave.start(time);
    wave.stop(time+.145);
  }

  percussion(time, length, amp, frequency, type, target) {
    const ctx = this.context, noise = ctx.createBufferSource(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    noise.buffer = this.noise;
    filter.type = type;
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(amp,time);
    gain.gain.exponentialRampToValueAtTime(.0001,time+length);
    noise.connect(filter).connect(gain).connect(target);
    noise.start(time);
    noise.stop(time+length+.01);
  }

  beat(index, time) {
    const bar = Math.floor(index/16) % progression.length, tick = index % 16;
    const [root,chord] = progression[bar];
    const t = time + (tick % 2 === 0 ? 0 : STEP*.13);
    const turnaround = bar % 4 === 3;

    if (tick === 0 || tick === 8) this.kick(t,.18);
    if (tick === 6 || tick === 11) this.kick(t,.10);
    if (tick === 4 || tick === 12 || (turnaround && tick === 15)) {
      const accent = tick === 15 ? .52 : 1;
      this.percussion(t,.115,.093*accent,2100,"bandpass",this.music);
      this.tone(54,t,.077,.028*accent,"triangle",this.music);
    }
    if (tick % 2 === 0 || tick === 7 || tick === 15) {
      const open = tick === 2 || tick === 10;
      this.percussion(t,open?.078:.030,open?.048:.031,7000,"highpass",this.music);
    }

    for (const [onset,interval,length] of bassPattern) {
      if (tick !== onset) continue;
      const nextRoot = progression[(bar+1)%progression.length][0];
      const note = onset === 15 ? nextRoot+(nextRoot > root ? -1 : 1) : root+interval;
      this.instrument(this.bass,note,t,STEP*length,onset===0?.177:.131,960,0);
    }
    if (guitarHits.includes(tick)) {
      chord.forEach((note,i)=>this.instrument(this.pluck,note,t+i*.006,STEP*(tick===8?1.3:.91),.037,2650,-.38));
    }
    if ((bar % 4 === 1 || bar % 4 === 3) && horns.includes(tick)) {
      chord.slice(1).forEach(note=>this.instrument(this.horn,note,t+.014,STEP*.92,.021,1900,.32));
    }
    for (const [onset,note,length] of melody[bar]) {
      if (tick !== onset) continue;
      this.instrument(this.horn,note,t,STEP*length*.93,.125,2630,.08);
      this.instrument(this.pluck,note+12,t+.011,STEP*length*.58,.029,4100,.30);
      if (bar >= 8 && bar < 12 && length >= 2) {
        this.instrument(this.horn,note-12,t+.008,STEP*length*.83,.038,2210,-.24);
      }
    }
  }

  effect(kind) {
    if (!this.context) return;
    const t = this.context.currentTime;
    if (kind === "boost") {
      this.percussion(t,.32,.19,1250,"bandpass",this.master);
      this.tone(69,t,.16,.12,"triangle",this.master);
      this.tone(81,t+.075,.23,.09,"triangle",this.master);
    } else if (kind === "bump") {
      this.percussion(t,.16,.13,400,"lowpass",this.master);
    } else if (kind === "lap") {
      [72,76,79].forEach((note,index) => this.tone(note,t+index*.085,.17,.10,"triangle",this.master));
    } else {
      this.tone(kind === "go" ? 79 : 67,t,.18,.16,"triangle",this.master);
    }
  }

  tick(kart, active) {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.engine.frequency.setTargetAtTime(37+Math.abs(kart.speed)*2.6,now,.07);
    this.engineGain.gain.setTargetAtTime(active ? .018+Math.abs(kart.speed)*.001 : 0,now,.07);
    if (!this.playing) return;
    if (this.nextTime < now-.2) this.nextTime = now+.03;
    while (this.nextTime < now+.15) {
      this.beat(this.index++,this.nextTime);
      this.nextTime += STEP;
    }
  }
}
