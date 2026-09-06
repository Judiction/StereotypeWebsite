/* ============================================================
   audio.js - Tone.js voice pool + master reverb / delay rack

   Signal path:
     voices -> voiceBus -> delay -> reverb -> limiter -> master out
   Each effect stays in the chain permanently; the vertical sliders
   drive its wet amount, the dropdowns swap the algorithm.
   ============================================================ */

(function (global) {
  'use strict';

  var MAX_VOICES = 20;

  // Per-waveform gain trim and tone shaping. Square is by far the loudest
  // and harshest of the three, so it gets pulled down and filtered.
  var TIMBRE = {
    sine:     { level: 0.34, cutoff: 12000 },
    triangle: { level: 0.30, cutoff: 9000 },
    square:   { level: 0.15, cutoff: 3200 }
  };

  /* ---------------- Voice ---------------- */

  function Voice(engine) {
    this.engine = engine;
    this.osc = new Tone.Oscillator({ type: 'sine', frequency: 440 });
    this.filter = new Tone.Filter({ type: 'lowpass', frequency: 12000, Q: 0.6 });
    this.amp = new Tone.Gain(0);

    this.osc.connect(this.filter);
    this.filter.connect(this.amp);
    this.osc.start();

    this.dest = null;             // set on the first attack, per waveform
    this.busy = false;
    this.startedAt = 0;
    this.level = 0.3;
  }

  var FLOOR = 0.0006;   // exponential ramps cannot reach exactly zero

  /* Each waveform has its own fader on the mixer, so a voice re-plugs itself
     whenever it is reused for a different waveform. */
  Voice.prototype._route = function (type) {
    var bus = this.engine.channels[type] || this.engine.voiceBus;
    if (this.dest === bus) return;
    if (this.dest) this.amp.disconnect(this.dest);
    this.amp.connect(bus);
    this.dest = bus;
  };

  Voice.prototype.attack = function (type, freq, t) {
    var timbre = TIMBRE[type] || TIMBRE.sine;
    this.level = timbre.level;

    this._route(type);
    this.osc.type = type;
    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.setValueAtTime(timbre.cutoff, t);

    this.osc.frequency.cancelScheduledValues(t);
    this.osc.frequency.setValueAtTime(freq, t);

    var g = this.amp.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(FLOOR, t);
    g.exponentialRampToValueAtTime(this.level, t + 0.014);

    this.busy = true;
    this.startedAt = t;
  };

  /* A short dip-and-rise so a sloping line articulates each new note
     instead of sliding through them. */
  Voice.prototype.retrigger = function (freq, t) {
    var g = this.amp.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(g.value, FLOOR), t);
    g.exponentialRampToValueAtTime(FLOOR, t + 0.011);
    this.osc.frequency.setValueAtTime(freq, t + 0.012);
    g.exponentialRampToValueAtTime(this.level, t + 0.028);
  };

  Voice.prototype.release = function (t) {
    var g = this.amp.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(g.value, FLOOR), t);
    g.exponentialRampToValueAtTime(FLOOR, t + 0.05);
    g.setValueAtTime(0, t + 0.055);
    this.busy = false;
  };

  Voice.prototype.dispose = function () {
    this.osc.dispose();
    this.filter.dispose();
    this.amp.dispose();
  };

  /* ---------------- Engine ---------------- */

  function AudioEngine() {
    this.ready = false;
    this.voices = [];
    this.active = new Map();   // note id (a Stroke) -> { voice, midi }
    // These match the controls' start positions in the markup; the UI pushes
    // its own values in at startup, so the two cannot drift apart.
    this.bpm = 110;
    this.revType = 'hall';
    this.dlyType = 'tape';
    this.revAmount = 0.8;
    this.dlyAmount = 0.4;
    this.channels = {};                                         // waveform -> Gain
    this.voiceGain = { sine: 0.8, square: 0.8, triangle: 0.8 };  // fader positions
  }

  AudioEngine.prototype.init = function () {
    var self = this;
    if (this.ready) return Promise.resolve();
    if (this._starting) return this._starting;

    this._starting = Tone.start().then(function () {
      self.out = new Tone.Gain(0.8).toDestination();
      self.limiter = new Tone.Limiter(-2).connect(self.out);
      self.voiceBus = new Tone.Gain(1);

      ['sine', 'square', 'triangle'].forEach(function (type) {
        self.channels[type] = new Tone.Gain(self.voiceGain[type]).connect(self.voiceBus);
      });

      self.reverb = null;
      self.delay = null;
      self.lfo = null;

      self._buildReverb(self.revType);
      self._buildDelay(self.dlyType);
      self._reconnect();

      self.ready = true;
    });

    return this._starting;
  };

  /* ---- routing ---- */

  AudioEngine.prototype._reconnect = function () {
    this.voiceBus.disconnect();
    this.delay.disconnect();
    this.reverb.disconnect();
    this.voiceBus.connect(this.delay);
    this.delay.connect(this.reverb);
    this.reverb.connect(this.limiter);
  };

  /* ---- reverb ---- */

  AudioEngine.prototype._buildReverb = function (type) {
    var node;
    switch (type) {
      case 'room':
        node = new Tone.Freeverb({ roomSize: 0.55, dampening: 2600 });
        break;
      case 'plate':
        node = new Tone.JCReverb({ roomSize: 0.85 });
        break;
      case 'cathedral':
        node = new Tone.Reverb({ decay: 11, preDelay: 0.06 });
        if (node.generate) node.generate();
        break;
      case 'hall':
      default:
        node = new Tone.Reverb({ decay: 4.5, preDelay: 0.025 });
        if (node.generate) node.generate();
        break;
    }
    node.wet.value = this.revAmount;
    this.reverb = node;
  };

  AudioEngine.prototype.setReverbType = function (type) {
    if (!this.ready || type === this.revType) { this.revType = type; return; }
    this.revType = type;
    var old = this.reverb;
    this._buildReverb(type);
    this._reconnect();
    old.disconnect();
    old.dispose();
  };

  AudioEngine.prototype.setReverbAmount = function (v) {
    this.revAmount = v;
    if (this.ready) this.reverb.wet.rampTo(v, 0.05);
  };

  /* ---- delay ---- */

  AudioEngine.prototype._buildDelay = function (type) {
    var beat = 60 / this.bpm;
    var node;

    if (this.lfo) { this.lfo.dispose(); this.lfo = null; }

    switch (type) {
      case 'pingpong':
        node = new Tone.PingPongDelay({ delayTime: beat / 2, feedback: 0.34, maxDelay: 4 });
        break;
      case 'tape':
        // Warm, wobbling repeats: an LFO nudges the delay time by a few ms.
        node = new Tone.FeedbackDelay({ delayTime: beat * 0.75, feedback: 0.46, maxDelay: 4 });
        try {
          this.lfo = new Tone.LFO({ frequency: 0.4, min: -0.004, max: 0.004 }).start();
          this.lfo.connect(node.delayTime);
        } catch (err) {
          // No wobble on browsers that refuse the param connection - the
          // delay itself still works.
          if (this.lfo) { this.lfo.dispose(); this.lfo = null; }
        }
        break;
      case 'slapback':
        node = new Tone.FeedbackDelay({ delayTime: 0.095, feedback: 0.16, maxDelay: 4 });
        break;
      case 'digital':
      default:
        node = new Tone.FeedbackDelay({ delayTime: beat / 2, feedback: 0.34, maxDelay: 4 });
        break;
    }
    node.wet.value = this.dlyAmount;
    this.delay = node;
  };

  AudioEngine.prototype.setDelayType = function (type) {
    if (!this.ready || type === this.dlyType) { this.dlyType = type; return; }
    this.dlyType = type;
    var old = this.delay;
    this._buildDelay(type);
    this._reconnect();
    old.disconnect();
    old.dispose();
  };

  AudioEngine.prototype.setDelayAmount = function (v) {
    this.dlyAmount = v;
    if (this.ready) this.delay.wet.rampTo(v, 0.05);
  };

  /** Keeps tempo-synced delay times in step with the transport tempo. */
  AudioEngine.prototype.setBpm = function (bpm) {
    this.bpm = bpm;
    if (!this.ready) return;
    var beat = 60 / bpm;
    if (this.dlyType === 'digital' || this.dlyType === 'pingpong') {
      this.delay.delayTime.rampTo(beat / 2, 0.1);
    } else if (this.dlyType === 'tape') {
      this.delay.delayTime.rampTo(beat * 0.75, 0.1);
    }
  };

  AudioEngine.prototype.setVolume = function (v) {
    if (this.ready) this.out.gain.rampTo(v, 0.05);
  };

  /** Per-waveform fader, 0..1. Safe to call before the engine is running. */
  AudioEngine.prototype.setVoiceVolume = function (type, v) {
    if (!(type in this.voiceGain)) return;
    this.voiceGain[type] = v;
    if (this.ready && this.channels[type]) this.channels[type].gain.rampTo(v, 0.04);
  };

  /* ---- voice pool ---- */

  AudioEngine.prototype._take = function () {
    var i, v;
    for (i = 0; i < this.voices.length; i++) {
      if (!this.voices[i].busy) return this.voices[i];
    }
    if (this.voices.length < MAX_VOICES) {
      v = new Voice(this);
      this.voices.push(v);
      return v;
    }
    // Steal the oldest sounding voice.
    var oldest = this.voices[0];
    for (i = 1; i < this.voices.length; i++) {
      if (this.voices[i].startedAt < oldest.startedAt) oldest = this.voices[i];
    }
    this.active.forEach(function (rec, id, map) {
      if (rec.voice === oldest) map.delete(id);
    });
    return oldest;
  };

  /**
   * Drives one sounding note per id. Call every frame with the pitch the id
   * should currently produce; call noteOff when it should stop.
   */
  AudioEngine.prototype.noteUpdate = function (id, type, midi, freq) {
    if (!this.ready) return;
    var t = Tone.now();
    var rec = this.active.get(id);

    if (!rec) {
      var voice = this._take();
      voice.attack(type, freq, t);
      this.active.set(id, { voice: voice, midi: midi, type: type });
      return;
    }
    if (rec.midi !== midi || rec.type !== type) {
      if (rec.type !== type) {
        rec.voice.attack(type, freq, t);
      } else {
        rec.voice.retrigger(freq, t);
      }
      rec.midi = midi;
      rec.type = type;
    }
  };

  AudioEngine.prototype.noteOff = function (id) {
    var rec = this.active.get(id);
    if (!rec) return;
    if (this.ready) rec.voice.release(Tone.now());
    this.active.delete(id);
  };

  AudioEngine.prototype.allOff = function () {
    var self = this;
    this.active.forEach(function (rec) {
      if (self.ready) rec.voice.release(Tone.now());
    });
    this.active.clear();
  };

  AudioEngine.prototype.voiceCount = function () {
    return this.active.size;
  };

  global.AudioEngine = AudioEngine;
})(window);
