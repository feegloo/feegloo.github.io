# HRV ASMR web companion

Static JavaScript port of HRV Breathing ASMR Meditation at
<https://aleksanderfigiel.pl/hrv-asmr/>. Native source:
[`feegloo/vibe-ios-app-breathing`, `b620344`](https://github.com/feegloo/vibe-ios-app-breathing/commit/b620344e6e2de54043ec6664ed6b2e6e2abeb97e).
The iOS application remains in its own repository.

## Run and check

No installation, bundler, CDN or server API is required. From the website root:

```bash
python3 -m http.server 8000
# Open http://localhost:8000/hrv-asmr/
node --check hrv-asmr/script.js
node --test hrv-asmr/script.test.cjs
```

GitHub Pages publishes the folder through the existing Pages workflow.

## Files and behavior

| File | Responsibility |
| --- | --- |
| `hrv-asmr/index.html` | Accessible controls, canvases and one native audio element |
| `hrv-asmr/style.css` | Black full-screen layout, compact height breakpoint, portrait and landscape |
| `hrv-asmr/script.js` | Audio transport, native breathing geometry, WebGL halo, Canvas diamonds/particles/stars, UI and preferences |
| `hrv-asmr/assets/` | Six AAC recordings and a vector icon |
| `hrv-asmr/script.test.cjs` | Buildless Node tests for timing, settings and transport transitions |

- Press Play to start. Space toggles playback when focus is outside a control.
- The slider preserves the native mapping: 8 s at Slow, 5.5 s at Balanced,
  4 s at Fast for each inhale/exhale. `playbackRate` changes the recording
  speed and pitch together, as native varispeed does.
- Tap the sound button to cycle Wave, Forest, Sea, Rain, Thunderstorm,
  Snow & Fire. Hold for 0.5 s, or use Choose sound, to open the picker.
  Escape or a backdrop tap closes it without activating a control underneath.
- Audio time drives expansion, colors and breath labels. Pause, rate changes
  and sound changes retain the source phase. Thunderstorm and Snow & Fire use
  22-second recordings; the breathing cycle remains 11 source seconds.
- Tap empty space to hide controls; tap again to restore. Playback hides
  controls after 15 seconds of inactivity, then the caption after another 15.
  Controls stay visible while paused or choosing a sound.
- Tempo, sound and tutorial dismissal are stored locally. No account,
  analytics, cookies or backend calls are added.
- The halo uses WebGL with a simplified radial Canvas fallback when WebGL
  is unavailable. Canvas reproduces the native quadratic diamond paths.
  Reduced Motion fixes geometry and keeps breathing colors/labels.
- System Play/Pause and Next/Previous use Media Session where supported.
  A screen wake lock and fullscreen are optional browser capabilities.
  Rendering stops while the page is hidden, without deliberately stopping audio.

## Audio assets

The current six ALAC assets were retrieved from the native repository. The
large Snow & Fire asset was extracted from the archive built for the same SHA,
with its Git blob SHA verified against the current source tree before conversion.
All output assets are AAC at 192 kbps, stereo, 44.1 kHz with fast-start metadata.
The Wave asset bakes in native player gain `0.544`; the browser element stays at
volume 1 so Safari's system-volume handling does not lose that attenuation.
Other recordings retain their existing gain and preprocessing.

To reproduce, supply the native ALAC files in a separate input directory:

```bash
ffmpeg -i breath-cycle.m4a -af volume=0.544 -c:a aac -b:a 192k \
  -movflags +faststart hrv-asmr/assets/breath-cycle.m4a
# For each other native asset, omit -af volume=0.544.
```

## Verification and browser limits

Node tests cover pace endpoints, phase boundaries, long background gaps,
loop counting, pause/resume, tempo changes, switching between one/two-cycle
recordings, invalid/blocked storage and recovery from rejected Play requests.
All six converted assets have been decoded with FFmpeg and checked for their
11/22-second durations. HTML IDs and static local references have been checked.

Visual browser QA and physical-device audio checks have not been performed.
Check Safari on an iPhone and Chrome/Firefox on a desktop:

1. Play all six sounds at the slow, middle and fast slider positions. Listen
   across several loop boundaries and check the IN/OUT labels.
2. Pause midway, resume, change sound and change pace without a phase jump.
3. Lock the phone for several minutes, use system media controls and reopen
   the page. Check ongoing playback and the recovered breathing phase.
4. Disconnect Bluetooth, then press Play using the phone speaker.
5. Rotate, test a short screen and fullscreen, hide/show controls, hold and
   scroll the sound picker, keyboard focus and Reduced Motion.

The browser controls autoplay, background suspension, Bluetooth routing and
media controls. A web page cannot provide the same AVAudioSession route-change
handling as the native app. HTML audio loops can also have browser-dependent
seams; sample-accurate PCM looping from the native engine is not guaranteed.
