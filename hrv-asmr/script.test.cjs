const { test } = require('node:test');
const assert = require('node:assert/strict');
const { phaseDuration, breathingFrame, loadSettings, saveSettings, AudioTransport, SOUNDS } = require('./script.js');

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
class Media extends EventTarget {
  constructor() { super(); this.paused = true; this.ended = false; this.error = null; this.currentTime = 0; this.duration = 11; this.playbackRate = 1; }
  play() { this.paused = false; this.dispatchEvent(new Event('play')); this.dispatchEvent(new Event('playing')); return Promise.resolve(); }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  load() { this.currentTime = 0; }
  metadata(duration = 11) { this.duration = duration; this.dispatchEvent(new Event('loadedmetadata')); }
}
function setup(t) {
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  const media = new Media(), errors = [];
  const transport = new AudioTransport(media, error => { if (error) errors.push(error); });
  return { transport, media, errors, advance(seconds, position) { now += seconds * 1000; media.currentTime = position; return transport.position(); } };
}

test('native pace endpoints and balanced midpoint are exact and continuous', () => {
  close(phaseDuration(0), 8); close(phaseDuration(.5), 5.5); close(phaseDuration(1), 4);
  close(phaseDuration(-1), 8); close(phaseDuration(2), 4);
  assert.ok(Math.abs(phaseDuration(.5 - 1e-7) - phaseDuration(.5 + 1e-7)) < 1e-6);
});
test('geometry reaches full expansion at inhale end and stays continuous at the loop seam', () => {
  close(breathingFrame(0).expansion, 0); close(breathingFrame(5.5).expansion, 1);
  close(breathingFrame(11).expansion, 0); close(breathingFrame(0).lightStrength, 0);
  close(breathingFrame(5.5).lightStrength, .8);
  assert.ok(breathingFrame(11-1e-5).lightStrength < 1e-8);
  close(breathingFrame(22).orientation, Math.PI / 2);
  for(let source=0;source<100;source+=.1){const frame=breathingFrame(source);assert.ok(frame.lightStrength>=0 && frame.lightStrength<=.800000001);assert.ok(frame.progress>=0&&frame.progress<1);}
});
test('settings survive reload, corrupted JSON and denied storage', () => {
  let value;const storage={getItem:()=>value,setItem:(key,next)=>{value=next;}};
  saveSettings(storage,{speed:.7,sound:3,hintSeen:true});assert.deepEqual(loadSettings(storage),{speed:.7,sound:3,hintSeen:true});
  value='{broken';assert.deepEqual(loadSettings(storage),{speed:.5,sound:0,hintSeen:false});
  value='{"speed":12,"sound":"removed"}';assert.deepEqual(loadSettings(storage),{speed:1,sound:0,hintSeen:false});
  const denied={getItem:()=>{throw Error();},setItem:()=>{throw Error();}};
  assert.equal(loadSettings(denied).speed,.5);assert.doesNotThrow(()=>saveSettings(denied,{speed:.5,sound:0}));
});
test('audio position remains authoritative across normal and background loop boundaries', async t => {
  const {transport,media,advance}=setup(t);await transport.play();
  close(advance(10,10),10);close(advance(2,1),12);close(advance(35,3),47);
  close(breathingFrame(transport.position()).progress,3/11);
  transport.pause();close(advance(600,3),47);
  await transport.play();close(advance(1,4),48);
  assert.equal(media.paused,false);
});
test('speed changes preserve phase and sample position through the next loop', async t => {
  const {transport,media,advance}=setup(t);await transport.play();close(advance(4,4),4);
  transport.setRate(5.5/8);close(transport.position(),4);
  assert.equal(media.preservesPitch,false);close(media.playbackRate,5.5/8);
  close(advance(16,(4+11)%11),15);
});
test('selection preserves the phase and second cycle of a 22-second recording', async t => {
  const {transport,media,advance}=setup(t);await transport.play();advance(17,6);
  assert.equal(transport.select(SOUNDS[5]),true);media.metadata(22);
  close(media.currentTime,17);close(transport.position(),17);
  await transport.play();close(advance(6,1),23);
  transport.pause();assert.equal(transport.select(SOUNDS[0]),false);media.metadata(11);
  close(media.currentTime,1);close(transport.position(),23);assert.equal(media.paused,true);
});
test('a rejected play is recoverable and a stale request cannot overwrite a newer pause', async t => {
  const {transport,media,errors}=setup(t);
  const failure=new Error('Device interrupted');media.play=()=>Promise.reject(failure);
  await transport.play();assert.equal(errors[0],failure);assert.equal(transport.loading,false);
  media.play=Media.prototype.play;await transport.play();assert.equal(transport.playing,true);
  let reject;media.play=()=>new Promise((_,r)=>{reject=r;});const pending=transport.play();transport.pause();reject(new Error('Old request'));await pending;
  assert.equal(errors.length,1);assert.equal(transport.playing,false);assert.equal(transport.loading,false);
});
