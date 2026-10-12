'use strict';
// The same source-cycle geometry and speed mapping as the iOS application.
const CYCLE_SECONDS = 11;
const SOUNDS = [
{
  id: 'wave', name: 'Wave', file: 'breath-cycle.m4a', icon: 'waveform', volume: 1
},
{
  id: 'forest', name: 'Forest', file: 'recording-3-cycle.m4a', icon: 'forest', volume: 1
},
{
  id: 'sea', name: 'Sea', file: 'ocean-cycle.m4a', icon: 'sea', volume: 1
},
{
  id: 'rain', name: 'Rain', file: 'rain-cycle.m4a', icon: 'rain', volume: 1
},
{
  id: 'storm', name: 'Thunderstorm', file: 'recording-10-cycle.m4a', icon: 'storm', volume: 1
},
{
  id: 'fire', name: 'Snow & Fire', file: 'recording-12-cycle.m4a', icon: 'fire', volume: 1
},];
const ICONS = {
  play: '<path fill="currentColor" stroke="none" d="M7 4.5a1 1 0 0 1 1.5-.86l13 7.5a1 1 0 0 1 0 1.72l-13 7.5A1 1 0 0 1 7 19.5z"/>',
  pause: '<path fill="currentColor" stroke="none" d="M6 4h4v16H6zm8 0h4v16h-4z"/>',
  waveform: '<path d="M3 10v4m4-8v12m5-16v20m5-16v12m4-8v4"/>',
  sea: '<path d="M2 16c3 0 3-3 6-3s3 3 6 3 3-3 6-3M2 20c3 0 3-2 6-2s3 2 6 2 3-2 6-2M3 12c3-6 7-9 12-7 4 2 3 7-1 7 2-2 0-5-2-4-2 1-2 4-2 5"/>',
  rain: '<path d="M5 13a4 4 0 0 1 0-8 6 6 0 0 1 11-1 5 5 0 1 1 2 9H5m2 3-1 2m6-2-1 2m6-2-1 2m-7 3-1 2m7-2-1 2"/>',
  storm: '<path d="M5 13a4 4 0 0 1 0-8 6 6 0 0 1 11-1 5 5 0 1 1 2 9h-2M12 11l-4 6h5l-3 6 8-9h-5l2-3"/>',
  forest: '<path d="m12 2-5 7h3l-6 8h6v5h4v-5h6l-6-8h3z"/><path d="M3 2a4 4 0 0 0 3 6A4 4 0 0 1 3 2" fill="currentColor"/><path d="m21 3 .5 1.5L23 5l-1.5.5L21 7l-.5-1.5L19 5l1.5-.5z"/>',
  fire: '<path d="M14 2c1 6 6 7 6 12a8 8 0 0 1-16 0c0-3 2-5 4-7-1 4 1 5 3 5 2-2 3-5 3-10z"/><path d="M12 14v6m-3-4 6 2m-6 0 6-2"/>',
  fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  turtle: '<path d="M6 14c0-6 12-6 12 0v3H6zm12-1h3a2 2 0 0 1 0 4h-3M7 17v3m9-3v3M6 15H3m7-5v7m4-7v7"/>',
  hare: '<path d="M8 15c-5-1-6 6-1 6h9c5-1 4-6 1-7l-1-3c5-2 5-6 1-6l-1-4c-2-1-2 3-2 6l-2-6c-3-1-2 5 0 9l-4 5zm4 2 4 4"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.waveform}</svg>`;
}
function phaseDuration(speed) {
  const value = Math.min(1, Math.max(0, speed));
  return value <= 0.5 ? 8 - 5 * value : 5.5 - 3 * (value - 0.5);
}
function breathingFrame(sourceSeconds) {
  const progress = ((sourceSeconds % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS / CYCLE_SECONDS;
  const expansion = (1 - Math.cos(progress * Math.PI * 2)) / 2;
  const fade = ((progress - 0.5) * 2) ** 2;
  return {
    progress, expansion, colorPhase: 1 - expansion,
    lightStrength: progress < 0.5 ? 0.8 * Math.sin(expansion * Math.PI / 2) : 0.8 * (1 - fade * fade * (3 - 2 * fade)),
    orientation: Math.floor(sourceSeconds / CYCLE_SECONDS) % 8 * Math.PI / 4,
  };
}
function loadSettings(storage) {
  try {
    const saved = JSON.parse(storage.getItem('hrv-asmr.settings') || '{}');
    return {
      speed: typeof saved.speed === 'number' && Number.isFinite(saved.speed) ? Math.max(0, Math.min(1, saved.speed)) : 0.5,
      sound: SOUNDS.findIndex(sound => sound.id === saved.sound) >= 0 ? SOUNDS.findIndex(sound => sound.id === saved.sound) : 0,
      hintSeen: saved.hintSeen === true
    };
  } catch {
    return {
      speed: 0.5, sound: 0, hintSeen: false
    };
  }
}
function saveSettings(storage, settings) {
  try {
    storage.setItem('hrv-asmr.settings', JSON.stringify({
      speed: settings.speed, sound: SOUNDS[settings.sound].id, hintSeen: settings.hintSeen
    }));
  } catch {
    /* Private browsing may disable storage. */
  }
}
// One native media element also supports background playback and system controls.
// Read its actual source position, rather than advancing visuals with a UI timer.
class AudioTransport {
  constructor(audio, onChange) {
    this.audio = audio;
    this.onChange = onChange;
    this.sourceSeconds = 0;
    this.lastPosition = 0;
    this.lastTime = performance.now();
    this.rate = 1;
    this.loading = false;
    this.request = 0;
    this.pendingSeek = null;
    audio.addEventListener('loadedmetadata', () => {
      if (this.pendingSeek !== null) {
        audio.currentTime = this.pendingSeek % audio.duration;
        this.lastPosition = audio.currentTime;
        this.lastTime = performance.now();
        this.pendingSeek = null;
      }
      audio.playbackRate = this.rate;
    });
    audio.addEventListener('timeupdate', () => this.position());
    for (const event of ['play', 'playing', 'pause', 'waiting', 'stalled', 'error', 'emptied']) {
      audio.addEventListener(event, () => {
        if (event === 'waiting' || event === 'stalled') this.loading = true;
        if (event === 'playing' || event === 'pause' || event === 'error') this.loading = false;
        this.lastTime = performance.now();
        onChange();
      });
    }
  }
  get playing() {
    return !this.audio.paused && !this.audio.ended && !this.audio.error;
  }
  position() {
    if (this.pendingSeek !== null) return this.sourceSeconds;
    const position = this.audio.currentTime;
    const now = performance.now();
    const duration = this.audio.duration;
    let delta = position - this.lastPosition;
    if (Number.isFinite(duration) && duration > 0) {
      // timeupdate can be throttled in a background tab. Resolve skipped loops
      // using elapsed time, while retaining the media element's precise phase.
      const estimate = this.playing && !this.loading ? (now - this.lastTime) / 1000 * this.rate : 0;
      const loops = Math.max(0, Math.round((estimate - delta) / duration));
      delta += loops * duration;
    }
    if (delta > 0) this.sourceSeconds += delta;
    this.lastPosition = position;
    this.lastTime = now;
    return this.sourceSeconds;
  }
  setRate(rate) {
    this.position();
    this.rate = rate;
    this.audio.playbackRate = rate;
    this.audio.defaultPlaybackRate = rate;
    // Varispeed, as in the native app; keep pitch and animation changes aligned.
    this.audio.preservesPitch = false;
    if ('webkitPreservesPitch' in this.audio) this.audio.webkitPreservesPitch = false;
  }
  select(sound) {
    this.position();
    const resume = this.playing;
    this.pause();
    this.audio.src = `assets/${sound.file}`;
    this.audio.volume = sound.volume;
    this.pendingSeek = this.sourceSeconds;
    this.lastPosition = 0;
    this.audio.load();
    this.setRate(this.rate);
    return resume;
  }
  async play() {
    const request = ++this.request;
    this.loading = true;
    this.onChange();
    try {
      await this.audio.play();
      if (request !== this.request) return;
      this.loading = false;
      this.lastTime = performance.now();
      this.onChange();
    } catch (error) {
      if (request !== this.request || error.name === 'AbortError') return;
      this.loading = false;
      this.onChange(error);
    }
  }
  pause() {
    this.position();
    ++this.request;
    this.audio.pause();
    this.loading = false;
    this.onChange();
  }
}
const CLOUDS = [
[0,0,.32,.78,-.45,.060],[-.09,-.06,.24,.60,.35,.030],[.09,.05,.25,.62,.35,.026],[-.04,.12,.21,.65,-.70,.018],[.08,-.12,.20,.68,-.70,.016],
[.22382,.09965,.175,.3,.41888,.105],[.09762,.21925,.17,.32,1.15192,.1],[-.10168,.22839,.165,.31,1.98968,.108],[-.22108,.09843,.18,.29,2.72271,.098],
[-.21925,-.09762,.17,.31,3.56047,.11],[-.10087,-.22656,.172,.3,4.29351,.102],[.08708,-.22686,.178,.29,5.07891,.097],[.22473,-.10006,.168,.32,5.86431,.106],];
function particleColor(ring, phase) {
  const segment = phase < .5 ? phase * 2 : (phase - .5) * 2;
  const blend = segment * segment * (3 - 2 * segment);
  const green = ring === 0 ? [.34,.90,.48] : [.25,.85,.42];
  const yellow = ring === 0 ? [1,.93,.22] : [1,.88,.16];
  const red = ring === 0 ? [1,.36,.10] : [1,.28 + ring * .04,.04];
  const from = phase < .5 ? green : yellow;
  const to = phase < .5 ? yellow : red;
  return from.map((value, index) => value + (to[index] - value) * blend);
}
function rgba(color, alpha = 1) {
  return `rgba(${color.map(value => Math.round(value * 255)).join(',')},${alpha})`;
}
function sizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return {
    width: rect.width, height: rect.height, ratio
  };
}
// The broad light field is a small WebGL shader; the exact quadratic curves of
// the SwiftUI diamonds are kept as Canvas paths, with no library dependencies.
class HaloRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.fallback = null;
    try {
      this.initialize();
    } catch {
      // A failed WebGL context cannot become a 2D context. Use a fresh canvas.
      const replacement = canvas.cloneNode();
      canvas.replaceWith(replacement);
      this.canvas = replacement;
      this.fallback = replacement.getContext('2d');
    }
    this.canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.gl = null;
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      try {
        this.initialize();
      } catch {
        /* Keep geometry visible. */
      }
    });
  }
  initialize() {
    const gl = this.canvas.getContext('webgl', {
      alpha: true, antialias: false, depth: false, powerPreference: 'low-power'
    });
    if (!gl) throw new Error('WebGL unavailable');
    const vertex = 'attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}';
    const lobes = CLOUDS.map(cloud => `light+=cloud(p,vec2(${cloud[0].toFixed(5)},${cloud[1].toFixed(5)}),${cloud[2].toFixed(5)},${cloud[3].toFixed(5)},${cloud[4].toFixed(5)})*${cloud[5].toFixed(5)};`).join('\n');
    const fragment = `precision mediump float; varying vec2 uv; uniform float expansion; uniform float strength; uniform float orientation; uniform vec3 color;
      mat2 rotation(float a){return mat2(cos(a),sin(a),-sin(a),cos(a));}
      float cloud(vec2 p,vec2 offset,float radius,float aspect,float angle){vec2 q=rotation(-angle)*(p-offset);q.y/=aspect;float d=length(q)/radius;return exp(-d*d*3.5);}
      void main(){vec2 p=vec2(uv.x-.5,.5-uv.y);float r=.28+.18*expansion;float light=.16*exp(-dot(p,p)/(r*r)*3.5);p=rotation(-orientation)*p/(.65+.35*expansion);${lobes}
      float alpha=min(.65,light*strength);gl_FragColor=vec4(color*alpha,alpha);}`;
    const shader = (type, source) => {
      const object = gl.createShader(type);
      gl.shaderSource(object, source);
      gl.compileShader(object);
      if (!gl.getShaderParameter(object, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(object));
      return object;
    };
    const program = gl.createProgram();
    const shaders = [shader(gl.VERTEX_SHADER, vertex), shader(gl.FRAGMENT_SHADER, fragment)];
    shaders.forEach(object => gl.attachShader(program, object));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    shaders.forEach(object => gl.deleteShader(object));
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    this.uniforms = Object.fromEntries(['expansion','strength','orientation','color'].map(name => [name, gl.getUniformLocation(program, name)]));
    this.gl = gl;
  }
  draw(frame) {
    const {
      width, height, ratio
    }
    = sizeCanvas(this.canvas);
    const color = particleColor(0, frame.colorPhase);
    if (this.gl) {
      const gl = this.gl;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.uniforms.expansion, frame.expansion);
      gl.uniform1f(this.uniforms.strength, frame.lightStrength);
      gl.uniform1f(this.uniforms.orientation, frame.orientation);
      gl.uniform3fv(this.uniforms.color, color);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else if (this.fallback) {
      const ctx = this.fallback;
      ctx.setTransform(ratio,0,0,ratio,0,0);
      ctx.clearRect(0,0,width,height);
      const unit = Math.min(width,height);
      const radius = unit * (.28 + .18 * frame.expansion);
      const gradient = ctx.createRadialGradient(width/2,height/2,0,width/2,height/2,radius);
      gradient.addColorStop(0,rgba(color,.2*frame.lightStrength));
      gradient.addColorStop(1,rgba(color,0));
      ctx.fillStyle = gradient;
      ctx.fillRect(0,0,width,height);
    }
  }
}
class PatternRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }
  draw(frame) {
    const {
      width, height, ratio
    }
    = sizeCanvas(this.canvas);
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,width,height);
    ctx.translate(width/2,height/2);
    const unit = Math.min(width,height);
    const {
      expansion, colorPhase
    }
    = frame;
    for (let index = 0;
    index < 100;
    index++) {
      const angle = index * 2.39996323;
      const distance = unit * (.12 + .37 * (index % 29) / 28);
      ctx.fillStyle = 'rgba(255,149,0,.12)';
      ctx.beginPath();
      ctx.arc(Math.cos(angle)*distance,Math.sin(angle)*distance,.7,0,Math.PI*2);
      ctx.fill();
    }
    for (let ring = 0;
    ring < 5;
    ring++) {
      const count = ring === 0 ? 1 : ring * 8;
      const distance = ring * unit * (.023 + expansion * .015);
      const dotSize = unit * (ring === 0 ? .025 : .016 - ring * .0023);
      ctx.fillStyle = rgba(particleColor(ring,colorPhase),1-ring*.15);
      for (let index = 0;
      index < count;
      index++) {
        const angle = index/count*Math.PI*2+ring*.28;
        ctx.beginPath();
        ctx.arc(Math.cos(angle)*distance,Math.sin(angle)*distance,dotSize/2,0,Math.PI*2);
        ctx.fill();
      }
    }
    const radius = unit * (.2075 + .17 * expansion);
    for (let index = 0;
    index < 8;
    index++) {
      const angle = index*Math.PI/4-Math.PI/2;
      const large = index % 2 === 0;
      const distance = Math.max(0,radius*(large?1:.92)-(large?6:15));
      const x = Math.cos(angle)*distance, y = Math.sin(angle)*distance;
      const half = unit*(large?.076:.058)*(1-expansion*.38);
      const w = half*.94, h = half*1.02, tip = half*.07, wx = half*.45, wy = half*.49;
      ctx.save();
      ctx.translate(x,y);
      const path = new Path2D();
      path.moveTo(tip,-h+tip);
      path.quadraticCurveTo(wx,-wy,w-tip,-tip);
      path.quadraticCurveTo(w,0,w-tip,tip);
      path.quadraticCurveTo(wx,wy,tip,h-tip);
      path.quadraticCurveTo(0,h,-tip,h-tip);
      path.quadraticCurveTo(-wx,wy,-w+tip,tip);
      path.quadraticCurveTo(-w,0,-w+tip,-tip);
      path.quadraticCurveTo(-wx,-wy,-tip,-h+tip);
      path.quadraticCurveTo(0,-h,tip,-h+tip);
      path.closePath();
      const warmGreen = large?.035:.19, warmBlue = large?.035:.025;
      const highlight = [.28*(1-colorPhase)+colorPhase,.58*(1-colorPhase)+(large?.22:.38)*colorPhase,.5*(1-colorPhase)+.12*colorPhase];
      const color = [(large?.12:.1)*(1-colorPhase)+(large?.9:1)*colorPhase,(large?.43:.46)*(1-colorPhase)+warmGreen*colorPhase,(large?.38:.34)*(1-colorPhase)+warmBlue*colorPhase];
      ctx.globalAlpha = .7+.3*expansion;
      const material = ctx.createLinearGradient(-half,-half,half,half);
      material.addColorStop(0,rgba(highlight,.95));
      material.addColorStop(1,rgba(color,.8));
      ctx.fillStyle=material;
      ctx.fill(path);
      ctx.clip(path);
      const reflection=ctx.createLinearGradient(-w,-h,w,h);
      for (const [stop,alpha] of [[0,.02],[.16,.07],[.27,.13],[.34,.15],[.43,.11],[.53,.05],[.62,0],[.73,-.05],[.88,.05],[1,0]]) {
        reflection.addColorStop(stop,alpha<0?`rgba(0,0,0,${-alpha})`:`rgba(255,255,255,${alpha})`);
      }
      ctx.fillStyle=reflection;
      ctx.fill(path);
      ctx.strokeStyle=rgba(highlight,.12);
      ctx.lineWidth=Math.max(.7,half*.03);
      ctx.stroke(path);
      ctx.restore();
    }
  }
}
class StarRenderer {
  constructor(canvas) {
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d');
    let seed=7281;
    const random=()=>{
      seed=(seed*1664525+1013904223)>>>0;
      return seed/4294967296;
    };
    this.stars=Array.from({
      length:40
    },(_,index)=>({
      x:(random()+random())/2,y:(random()+random())/2,size:.85+(index%4)*.25,phase:random()*Math.PI*2,duration:3.5+(index%7)*.6
    }));
  }
  draw(time) {
    const {
      width,height,ratio
    }
    =sizeCanvas(this.canvas),ctx=this.ctx;
    if(!ctx)return;
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,width,height);
    for(const star of this.stars){
      const alpha=.08+.25*(1+Math.sin(time/star.duration+star.phase))/2;
      ctx.fillStyle=`rgba(255,234,192,${alpha})`;
      ctx.beginPath();
      ctx.arc(star.x*width,star.y*height,star.size/2,0,Math.PI*2);
      ctx.fill();
    }
  }
}
function initializeApp() {
  const $=id=>document.getElementById(id);
  let storage;
  try {
    storage=window.localStorage;
  } catch {
    storage={
      getItem:()=>null,setItem:()=>{
      }
    };
  }
  const settings=loadSettings(storage);
  const app=$('app'),play=$('play'),soundButton=$('sound'),pace=$('pace'),overlay=$('picker-overlay'),hint=$('hint');
  const halo=new HaloRenderer($('halo')),pattern=new PatternRenderer($('pattern')),stars=new StarRenderer($('stars'));
  let transport,animation=0,lastStarTime=0,idleTimer=0,captionTimer=0,hintTimer=0,wakeLock=null,wakeRequest=null,wasHidden=false;
  let holding=false,holdTimer=0,suppressClick=false,started=false,lastPhase=null;
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const persist=()=>saveSettings(storage,settings);
  function updateMediaSession() {
    if(!('mediaSession' in navigator)||typeof MediaMetadata==='undefined')return;
    navigator.mediaSession.metadata=new MediaMetadata({
      title:'HRV ASMR',artist:SOUNDS[settings.sound].name,album:'Find your rhythm',artwork:[{
        src:new URL('assets/icon.svg',location.href).href,type:'image/svg+xml',sizes:'any'
      }]
    });
    navigator.mediaSession.playbackState=transport.playing?'playing':'paused';
  }
  async function updateWakeLock() {
    if(!('wakeLock' in navigator))return;
    if(!transport.playing||document.hidden){
      if(wakeLock){
        await wakeLock.release().catch(()=>{
        });
        wakeLock=null;
      }
      return;
    }
    if(!wakeLock&&!wakeRequest){
      wakeRequest=navigator.wakeLock.request('screen');
      try{
        const lock=await wakeRequest;
        if(!transport.playing||document.hidden){
          await lock.release();
        } else {
          wakeLock=lock;
          lock.addEventListener('release',()=>{
            if(wakeLock===lock)wakeLock=null;
          });
        }
      } catch {
        /* Browser may deny a screen lock. */
      } finally {
        wakeRequest=null;
      }
    }
  }
  function updatePlayback(error) {
    if(!transport)return;
    const playing=transport.playing;
    play.innerHTML=icon(playing?'pause':'play');
    play.setAttribute('aria-label',playing?'Pause breathing':'Resume breathing');
    $('play-label').textContent=playing?'Pause':'Play';
    $('message').textContent=error?'Couldn’t play this sound. Tap Play to try again.':transport.audio.error?'Couldn’t load this sound. Choose another sound or try Play again.':transport.loading?'Loading sound…':'';
    updateMediaSession();
    updateWakeLock();
    render();
    if(playing){
      started=true;
      scheduleIdle();
      startAnimation();
    } else {
      clearTimeout(idleTimer);
      clearTimeout(captionTimer);
      showControls(false);
    }
  }
  transport=new AudioTransport($('audio'),updatePlayback);
  function render() {
    const frame=breathingFrame(transport.position());
    // Reduced Motion retains the breathing colors and label, with fixed geometry.
    const visual=reduceMotion.matches?{
      ...frame,expansion:.45,orientation:0
    }
    :frame;
    halo.draw(visual);
    pattern.draw(visual);
    const phase=frame.progress<.5?'IN':'OUT';
    if(lastPhase!==phase){
      $('phase').innerHTML=`breathe <strong>${phase}</strong>`;
      $('guidance').textContent=phase==='IN'?'Fill your lungs slowly':'Release and soften';
      lastPhase=phase;
    }
  }
  function tick(time) {
    animation=0;
    if(document.hidden||!transport.playing)return;
    render();
    if(time-lastStarTime>50){
      stars.draw(transport.sourceSeconds/transport.rate);
      lastStarTime=time;
    }
    animation=requestAnimationFrame(tick);
  }
  function startAnimation(){
    if(!animation&&!document.hidden)animation=requestAnimationFrame(tick);
  }
  function scheduleIdle() {
    clearTimeout(idleTimer);
    clearTimeout(captionTimer);
    if(!transport.playing||document.hidden||!overlay.hidden||holding||hint.hidden===false||app.classList.contains('controls-hidden'))return;
    idleTimer=setTimeout(hideControls,15000);
  }
  function dismissHint(){
    hint.hidden=true;
    clearTimeout(hintTimer);
    if(started){
      settings.hintSeen=true;
      persist();
    }
    scheduleIdle();
  }
  function showControls(reset=true) {
    app.classList.remove('controls-hidden','caption-hidden');
    $('show-controls').hidden=true;
    for(const element of [document.querySelector('header'),$('controls')]){
      element.removeAttribute('inert');
      element.removeAttribute('aria-hidden');
    }
    if(reset)scheduleIdle();
  }
  function hideControls(){
    if(!transport.playing||!overlay.hidden)return;
    dismissHint();
    clearTimeout(idleTimer);
    app.classList.add('controls-hidden');
    $('show-controls').hidden=false;
    for(const element of [document.querySelector('header'),$('controls')]){
      element.setAttribute('inert','');
      element.setAttribute('aria-hidden','true');
    }
    captionTimer=setTimeout(()=>app.classList.add('caption-hidden'),15000);
  }
  function updatePace() {
    const seconds=phaseDuration(settings.speed);
    pace.value=settings.speed;
    pace.style.setProperty('--position',`${settings.speed*100}%`);
    $('duration').value=`${Number(seconds.toFixed(1))} s`;
    $('pace-name').textContent=settings.speed<.4?'Slow':settings.speed>.6?'Fast':'Balanced';
    pace.setAttribute('aria-valuetext',`${seconds.toFixed(1)} seconds per inhale or exhale`);
    transport.setRate(5.5/seconds);
    persist();
    render();
  }
  function updateSound() {
    const selected=SOUNDS[settings.sound];
    soundButton.innerHTML=icon(selected.icon);
    $('sound-name').textContent=selected.name;
    soundButton.setAttribute('aria-label',`Change sound, current sound: ${selected.name}`);
    for(const button of $('sound-options').querySelectorAll('button'))button.setAttribute('aria-pressed',String(Number(button.dataset.index)===settings.sound));
    persist();
    updateMediaSession();
  }
  function selectSound(index) {
    dismissHint();
    const resume=transport.select(SOUNDS[index]);
    settings.sound=index;
    updateSound();
    if(resume)transport.play();
    render();
    scheduleIdle();
  }
  function cycleSound(direction=1){
    selectSound((settings.sound+direction+SOUNDS.length)%SOUNDS.length);
  }
  function positionPicker() {
    const trigger=soundButton.getBoundingClientRect(),parent=app.getBoundingClientRect(),picker=$('picker');
    picker.style.left=`${Math.max(8,Math.min(parent.width-118,trigger.left-parent.left+trigger.width/2-55))}px`;
    picker.style.bottom=`${parent.bottom-trigger.top+8}px`;
    picker.style.maxHeight=`${Math.max(70,trigger.top-parent.top-20)}px`;
  }
  function openPicker(){
    dismissHint();
    clearTimeout(idleTimer);
    clearTimeout(captionTimer);
    overlay.hidden=false;
    $('choose').setAttribute('aria-expanded','true');
    positionPicker();
    $('picker').scrollTop=$('picker').scrollHeight;
    const selected=$('sound-options').querySelector('[aria-pressed=true]');
    selected?.focus({
      preventScroll:true
    });
    selected?.scrollIntoView({
      block:'nearest'
    });
  }
  function closePicker(focus=true){
    overlay.hidden=true;
    $('choose').setAttribute('aria-expanded','false');
    if(focus)$('choose').focus({
      preventScroll:true
    });
    scheduleIdle();
  }
  $('sound-options').innerHTML=[...SOUNDS].reverse().map(sound=>{
    const index=SOUNDS.indexOf(sound);
    return `<button data-index="${index}" aria-pressed="${index===settings.sound}"><span class="glass">${icon(sound.icon)}</span><span>${sound.name}</span></button>`;
  }).join('');
  $('sound-options').addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button)return;
    selectSound(Number(button.dataset.index));
    closePicker();
  });
  soundButton.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    holding=true;
    suppressClick=false;
    soundButton.classList.add('pressed');
    clearTimeout(idleTimer);
    holdTimer=setTimeout(()=>{
      suppressClick=true;
      holding=false;
      soundButton.classList.remove('pressed');
      openPicker();
    },500);
  });
  function endHold(){
    clearTimeout(holdTimer);
    holding=false;
    soundButton.classList.remove('pressed');
    scheduleIdle();
  }
  window.addEventListener('pointerup',endHold);
  window.addEventListener('pointercancel',()=>{
    suppressClick=true;
    endHold();
  });
  soundButton.addEventListener('contextmenu',event=>event.preventDefault());
  soundButton.addEventListener('click',()=>{
    if(suppressClick){
      suppressClick=false;
      return;
    }
    cycleSound();
  });
  $('choose').addEventListener('click',openPicker);
  $('dismiss-picker').addEventListener('click',()=>closePicker());
  overlay.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      event.preventDefault();
      closePicker();
    }
    if(event.key==='Tab'){
      const buttons=[...$('sound-options').querySelectorAll('button')];
      const index=buttons.indexOf(document.activeElement);
      event.preventDefault();
      buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length].focus();
    }
  });
  play.addEventListener('click',()=>{
    dismissHint();
    if(transport.playing)transport.pause();
    else{
      if(transport.audio.error){
        transport.select(SOUNDS[settings.sound]);
      }
      transport.play();
      if(!settings.hintSeen&&!started){
        hintTimer=setTimeout(()=>{
          if(transport.playing){
            hint.hidden=false;
            clearTimeout(idleTimer);
            hintTimer=setTimeout(dismissHint,6500);
          }
        },2000);
      }
    }
  });
  $('dismiss-hint').addEventListener('click',dismissHint);
  pace.addEventListener('input',()=>{
    settings.speed=Number(pace.value);
    dismissHint();
    updatePace();
    scheduleIdle();
  });
  pace.addEventListener('pointerdown',()=>{
    holding=true;
    clearTimeout(idleTimer);
  });
  $('show-controls').addEventListener('click',()=>showControls());
  app.addEventListener('click',event=>{
    if(!overlay.hidden||event.target.closest('button,input,a,#controls,#hint')||app.classList.contains('controls-hidden'))return;
    if(transport.playing)hideControls();
  });
  document.addEventListener('keydown',event=>{
    if(!overlay.hidden||event.target.closest('input,button,a'))return;
    if(event.code==='Space'){
      event.preventDefault();
      showControls();
      play.click();
    } else if(event.key==='Escape')showControls();
  });
  $('turtle').innerHTML=icon('turtle');
  $('hare').innerHTML=icon('hare');
  $('fullscreen').innerHTML=icon('fullscreen');
  if(!document.documentElement.requestFullscreen){
    $('fullscreen').hidden=true;
  } else {
    $('fullscreen').addEventListener('click',async()=>{
      try{
        if(document.fullscreenElement)await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch {
        /* Fullscreen is optional. */
      }
    });
  }
  document.addEventListener('fullscreenchange',()=>{
    $('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen');
  });
  if('mediaSession' in navigator){
    for(const [action,handler] of Object.entries({
      play:()=>transport.play(),pause:()=>transport.pause(),nexttrack:()=>cycleSound(),previoustrack:()=>cycleSound(-1)
    })){
      try{
        navigator.mediaSession.setActionHandler(action,handler);
      } catch {
        /* Some browsers expose fewer actions. */
      }
    }
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      transport.position();
      cancelAnimationFrame(animation);
      animation=0;
      clearTimeout(idleTimer);
      clearTimeout(captionTimer);
      clearTimeout(hintTimer);
      hint.hidden=true;
      closePicker(false);
      wasHidden=true;
      updateWakeLock();
    } else {
      if(wasHidden){
        showControls();
        wasHidden=false;
      }
      transport.position();
      render();
      stars.draw(transport.sourceSeconds/transport.rate);
      startAnimation();
      updateWakeLock();
    }
  });
  window.addEventListener('pageshow',()=>{
    render();
    updatePlayback();
  });
  window.addEventListener('resize',()=>{
    render();
    stars.draw(transport.sourceSeconds/transport.rate);
    if(!overlay.hidden)positionPicker();
  });
  reduceMotion.addEventListener?.('change',render);
  transport.select(SOUNDS[settings.sound]);
  updateSound();
  updatePace();
  updatePlayback();
  stars.draw(0);
}
// CommonJS exports keep the timing tests buildless; the browser uses this file directly.
if(typeof module!=='undefined'&&module.exports)module.exports={
  phaseDuration,breathingFrame,loadSettings,saveSettings,AudioTransport,SOUNDS
};
if(typeof document!=='undefined')initializeApp();
