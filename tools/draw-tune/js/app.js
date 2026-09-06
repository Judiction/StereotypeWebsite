/* ============================================================
   app.js - UI wiring and the transport loop

   The playhead advances by its own phase accumulator rather than being
   derived from an absolute start time, so changing tempo or bar count
   mid-flight speeds the sweep up or slows it down without jumping.
   ============================================================ */

(function () {
  'use strict';

  var BEATS_PER_BAR = 4;

  // The eraser is deliberately tight: it takes the stroke you are pointing at
  // and nothing near it. A finger reports the centre of a contact patch rather
  // than a pixel, so touch gets a little more reach - a mouse or a stylus does
  // not need it.
  var ERASER_RADIUS = 5;
  var ERASER_RADIUS_TOUCH = 11;

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- State ---------------- */

  var engine = new AudioEngine();
  var sketch = null;

  var state = {
    tool: 'sine',
    bpm: 110,
    bars: 4,
    playing: false,
    phase: 0,
    drawing: false,
    erasing: false,
    pointerId: null
  };

  var noteMap = new Theory.NoteMap(0, 'pentatonic');
  var lastTime = 0;
  var sounding = [];      // rebuilt each frame: [{ stroke, y }]

  /* ---------------- Dialogs ---------------- */

  function showAbout() { $('aboutVeil').hidden = false; }
  function hideAbout() { $('aboutVeil').hidden = true; }

  function notify(msg) {
    $('errText').textContent = msg;
    $('errVeil').hidden = false;
  }

  $('aboutOk').addEventListener('click', hideAbout);
  $('aboutX').addEventListener('click', hideAbout);
  $('errOk').addEventListener('click', function () { $('errVeil').hidden = true; });

  /* ---------------- Menus ---------------- */

  var menubar = $('menubar');
  menubar.addEventListener('click', function (e) {
    var label = e.target.closest('.menu-label');
    if (label) {
      var menu = label.parentElement;
      var wasOpen = menu.classList.contains('open');
      closeMenus();
      if (!wasOpen) menu.classList.add('open');
      return;
    }
    var item = e.target.closest('.menu-pop button');
    if (!item) return;
    closeMenus();
    switch (item.dataset.action) {
      case 'clear': doClear(); break;
      case 'undo': doUndo(); break;
      case 'about': showAbout(); break;
      case 'toggle-grid':
        sketch.showGrid = !sketch.showGrid;
        sketch.layerDirty = true;
        break;
      case 'toggle-bars':
        sketch.showBars = !sketch.showBars;
        sketch.layerDirty = true;
        break;
    }
  });

  document.addEventListener('mousedown', function (e) {
    if (!e.target.closest('.menu')) closeMenus();
  });

  function closeMenus() {
    var open = menubar.querySelectorAll('.menu.open');
    for (var i = 0; i < open.length; i++) open[i].classList.remove('open');
  }

  /* ---------------- Tools ---------------- */

  var toolButtons = document.querySelectorAll('.tool');

  function selectTool(tool) {
    state.tool = tool;
    for (var i = 0; i < toolButtons.length; i++) {
      toolButtons[i].classList.toggle('active', toolButtons[i].dataset.tool === tool);
    }
    $('paint').classList.toggle('erasing', tool === 'eraser');
    $('statusHint').textContent = tool === 'eraser'
      ? 'Drag over a line to erase it.'
      : 'Drawing with the ' + tool + ' voice. Higher on the canvas is a higher note.';
  }

  for (var t = 0; t < toolButtons.length; t++) {
    (function (btn) {
      btn.addEventListener('click', function () { selectTool(btn.dataset.tool); });
    })(toolButtons[t]);
  }

  /* ---------------- Voice colours ---------------- */

  // A Paint-style fixed palette, plus "Other..." for the system picker.
  var PALETTE = [
    '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c',
    '#00a2e8', '#3f48cc', '#a349a4', '#b97a57', '#ffaec9', '#c8bfe7', '#efe4b0',
    '#d01818', '#ff6a00', '#0f9b0f', '#008080', '#2444d8', '#7030a0', '#404040',
    '#ff0080', '#00ff40', '#00ffff', '#8000ff', '#804000', '#c0c0c0', '#ffffff'
  ];

  var colorPop = $('colorPop');
  var colorGrid = $('colorGrid');
  var colorNative = $('colorNative');
  var colorTarget = null;      // which voice the popup is editing

  PALETTE.forEach(function (hex) {
    var b = document.createElement('button');
    b.type = 'button';
    b.style.background = hex;
    b.title = hex;
    b.dataset.color = hex;
    colorGrid.appendChild(b);
  });

  /** Repaints everything that shows a voice colour. */
  function applyVoiceColor(tool, color) {
    Sketch.TOOL_COLORS[tool] = color;
    sketch.layerDirty = true;                        // redraw existing strokes

    var sw = document.querySelector('.swatch[data-tool="' + tool + '"] i');
    if (sw) sw.style.background = color;

    var dot = document.querySelector('.mix-dot[data-tool="' + tool + '"]');
    if (dot) dot.style.background = color;

    var icon = document.querySelector('.tool[data-tool="' + tool + '"] .wave');
    if (icon) icon.setAttribute('stroke', color);
  }

  function openColorPop(tool, anchor) {
    colorTarget = tool;
    $('colorPopTitle').textContent = tool.charAt(0).toUpperCase() + tool.slice(1) + ' colour';

    var current = Sketch.TOOL_COLORS[tool].toLowerCase();
    var cells = colorGrid.children;
    for (var i = 0; i < cells.length; i++) {
      cells[i].classList.toggle('current', cells[i].dataset.color === current);
    }
    colorNative.value = /^#[0-9a-f]{6}$/.test(current) ? current : '#ff0000';

    colorPop.hidden = false;
    // Anchor to the swatch, then nudge back inside the viewport.
    var r = anchor.getBoundingClientRect();
    var pr = colorPop.getBoundingClientRect();
    var left = Math.min(r.right + 6, window.innerWidth - pr.width - 6);
    var top = Math.min(r.top, window.innerHeight - pr.height - 6);
    colorPop.style.left = Math.max(6, left) + 'px';
    colorPop.style.top = Math.max(6, top) + 'px';

    document.querySelectorAll('.swatch').forEach(function (s) {
      s.classList.toggle('open', s.dataset.tool === tool);
    });
  }

  function closeColorPop() {
    colorPop.hidden = true;
    colorTarget = null;
    document.querySelectorAll('.swatch').forEach(function (s) {
      s.classList.remove('open');
    });
  }

  document.querySelectorAll('.swatch').forEach(function (sw) {
    sw.addEventListener('click', function (e) {
      e.stopPropagation();
      var tool = sw.dataset.tool;
      if (!colorPop.hidden && colorTarget === tool) closeColorPop();
      else openColorPop(tool, sw);
    });
  });

  colorGrid.addEventListener('click', function (e) {
    var cell = e.target.closest('button');
    if (!cell || !colorTarget) return;
    applyVoiceColor(colorTarget, cell.dataset.color);
    closeColorPop();
  });

  $('colorOther').addEventListener('click', function () {
    colorNative.click();
  });

  colorNative.addEventListener('input', function () {
    if (colorTarget) applyVoiceColor(colorTarget, this.value);
  });
  colorNative.addEventListener('change', closeColorPop);

  $('colorClose').addEventListener('click', closeColorPop);

  document.addEventListener('mousedown', function (e) {
    if (colorPop.hidden) return;
    if (e.target.closest('#colorPop') || e.target.closest('.swatch')) return;
    closeColorPop();
  });

  /* ---------------- Canvas input ---------------- */

  var canvas = $('paint');

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / Math.max(rect.width, 1),
      y: (e.clientY - rect.top) / Math.max(rect.height, 1)
    };
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    if (state.pointerId !== null) return;   // one finger draws; ignore the rest
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    state.pointerId = e.pointerId;

    var p = pointerPos(e);
    ensureAudio();

    if (state.tool === 'eraser') {
      state.erasing = true;
      eraseAndSilence(p, e.pointerType);
    } else {
      state.drawing = true;
      sketch.beginStroke(state.tool, p.x, p.y);
    }
  });

  canvas.addEventListener('pointermove', function (e) {
    var p = pointerPos(e);
    updateCursorReadout(p);

    if (e.pointerId !== state.pointerId) return;
    if (state.drawing) sketch.extendStroke(p.x, p.y);
    else if (state.erasing) eraseAndSilence(p, e.pointerType);
  });

  function endPointer(e) {
    if (e.pointerId !== state.pointerId) return;
    if (state.drawing) sketch.endStroke();
    state.drawing = false;
    state.erasing = false;
    state.pointerId = null;
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', function (e) {
    if (e.pointerId !== state.pointerId) $('statusNote').textContent = '--';
  });

  // A long press on a phone would otherwise pop the browser's own menu.
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function eraseAndSilence(p, pointerType) {
    var r = pointerType === 'touch' ? ERASER_RADIUS_TOUCH : ERASER_RADIUS;
    var removed = sketch.eraseAt(p.x, p.y, r);
    for (var i = 0; i < removed.length; i++) engine.noteOff(removed[i]);
  }

  function updateCursorReadout(p) {
    if (p.y < 0 || p.y > 1) { $('statusNote').textContent = '--'; return; }
    $('statusNote').textContent = noteMap.nameAt(p.y);
  }

  /* ---------------- Editing actions ---------------- */

  function doUndo() {
    var s = sketch.undo();
    if (s) engine.noteOff(s);
  }

  function doClear() {
    var removed = sketch.clear();
    for (var i = 0; i < removed.length; i++) engine.noteOff(removed[i]);
    engine.allOff();
  }

  $('btnUndo').addEventListener('click', doUndo);
  $('btnClear').addEventListener('click', doClear);

  /* ---------------- Transport ---------------- */

  function setPlaying(on) {
    state.playing = on;
    $('btnPlay').innerHTML = on ? '&#10074;&#10074; Pause' : '&#9658; Play';
    $('btnPlay').classList.toggle('down', on);
    if (!on) engine.allOff();
  }

  $('btnPlay').addEventListener('click', function () {
    ensureAudio();
    setPlaying(!state.playing);
  });

  $('btnStop').addEventListener('click', function () {
    setPlaying(false);
    state.phase = 0;
  });

  /**
   * Pushes every control's current position into the engine. The markup is the
   * single source of truth for the start-up settings, and a browser that
   * restores slider positions across a reload lands here too.
   */
  function syncEngineFromControls() {
    engine.setBpm(state.bpm);
    engine.setReverbType($('revType').value);
    engine.setDelayType($('dlyType').value);
    engine.setReverbAmount(parseInt($('revAmt').value, 10) / 100);
    engine.setDelayAmount(parseInt($('dlyAmt').value, 10) / 100);
    engine.setVolume(parseInt($('vol').value, 10) / 100);
    engine.setVoiceVolume('sine', parseInt($('volSine').value, 10) / 100);
    engine.setVoiceVolume('square', parseInt($('volSquare').value, 10) / 100);
    engine.setVoiceVolume('triangle', parseInt($('volTriangle').value, 10) / 100);
  }

  function ensureAudio() {
    // Tone.start() has to happen inside a user gesture, so every interaction
    // that could make sound calls this; it is a no-op once running.
    if (engine.ready || engine._starting || !window.Tone) return;
    engine.init().then(syncEngineFromControls).catch(function (err) {
      notify('Could not start audio: ' + err.message);
    });
  }

  /* ---------------- Tempo ---------------- */

  var bpmInput = $('bpm');

  function setBpm(v, writeBack) {
    v = Math.round(v);
    if (!isFinite(v)) return;
    v = Math.max(20, Math.min(300, v));
    state.bpm = v;
    if (writeBack) bpmInput.value = v;
    engine.setBpm(v);
  }

  bpmInput.addEventListener('change', function () { setBpm(parseFloat(this.value), true); });
  bpmInput.addEventListener('input', function () {
    var v = parseFloat(this.value);
    if (isFinite(v) && v >= 20 && v <= 300) setBpm(v, false);
  });

  // Tap tempo: average the gaps between recent taps, dropping stale ones.
  var taps = [];
  $('btnTap').addEventListener('click', function () {
    var now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
    taps.push(now);
    if (taps.length > 5) taps.shift();
    if (taps.length < 2) {
      $('statusHint').textContent = 'Keep tapping...';
      return;
    }
    var span = taps[taps.length - 1] - taps[0];
    var bpm = 60000 / (span / (taps.length - 1));
    setBpm(bpm, true);
    $('statusHint').textContent = 'Tap tempo: ' + state.bpm + ' BPM';
  });

  /* ---------------- Bars ---------------- */

  var barsInput = $('bars');
  barsInput.addEventListener('input', function () {
    state.bars = parseInt(this.value, 10);
    $('barsOut').textContent = state.bars;
    sketch.setBars(state.bars);
  });

  /* ---------------- Key & scale ---------------- */

  function rebuildNoteMap() {
    noteMap = new Theory.NoteMap(parseInt($('root').value, 10), $('scale').value);
    sketch.setNoteMap(noteMap);
  }

  $('root').addEventListener('change', rebuildNoteMap);
  $('scale').addEventListener('change', rebuildNoteMap);

  /* ---------------- FX rack ---------------- */

  function bindAmount(sliderId, outId, apply) {
    var el = $(sliderId);
    el.addEventListener('input', function () {
      var v = parseInt(this.value, 10);
      $(outId).textContent = v;
      apply(v / 100);
    });
  }

  bindAmount('revAmt', 'revOut', function (v) { engine.setReverbAmount(v); });
  bindAmount('dlyAmt', 'dlyOut', function (v) { engine.setDelayAmount(v); });
  bindAmount('vol', 'volOut', function (v) { engine.setVolume(v); });

  // Voice faders share one readout, which shows whichever was moved last.
  [['volSine', 'sine'], ['volSquare', 'square'], ['volTriangle', 'triangle']]
    .forEach(function (pair) {
      $(pair[0]).addEventListener('input', function () {
        var v = parseInt(this.value, 10);
        $('mixOut').textContent = v;
        engine.setVoiceVolume(pair[1], v / 100);
      });
    });

  $('revType').addEventListener('change', function () {
    ensureAudio();
    engine.setReverbType(this.value);
  });
  $('dlyType').addEventListener('change', function () {
    ensureAudio();
    engine.setDelayType(this.value);
  });

  /* ---------------- Keyboard ---------------- */

  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    // A focused button already responds to Space itself; do not act twice.
    if (tag === 'button' && (e.key === ' ' || e.key === 'Enter')) return;

    if (e.key === ' ') {
      e.preventDefault();
      ensureAudio();
      setPlaying(!state.playing);
    } else if (e.key === '1') { selectTool('sine'); }
    else if (e.key === '2') { selectTool('square'); }
    else if (e.key === '3') { selectTool('triangle'); }
    else if (e.key === 'e' || e.key === 'E') { selectTool('eraser'); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault(); doUndo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault(); doClear();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Delete') {
      e.preventDefault(); doClear();
    } else if (e.key === 'Escape') {
      closeMenus(); hideAbout(); closeColorPop();
    }
  });

  /* ---------------- Main loop ---------------- */

  function loopSeconds() {
    return (state.bars * BEATS_PER_BAR * 60) / state.bpm;
  }

  function tick(now) {
    requestAnimationFrame(tick);

    var dt = lastTime ? (now - lastTime) / 1000 : 0;
    lastTime = now;
    if (dt > 0.25) dt = 0.25;          // tab was hidden; do not fast-forward

    if (state.playing) {
      state.phase += dt / loopSeconds();
      if (state.phase >= 1) state.phase -= Math.floor(state.phase);
    }

    updateVoices();
    sketch.render(state.phase, sounding, state.playing);
    updateStatus();
  }

  function updateVoices() {
    sounding.length = 0;

    var i, s, y;

    if (!state.playing) {
      if (engine.voiceCount()) engine.allOff();
      return;
    }

    // The stroke under the cursor counts too, so a line sings as it is drawn.
    var strokes = sketch.current
      ? sketch.strokes.concat([sketch.current])
      : sketch.strokes;

    var seen = new Set();
    for (i = 0; i < strokes.length; i++) {
      s = strokes[i];
      y = s.yAt(state.phase);
      if (isNaN(y)) continue;
      seen.add(s);
      sounding.push({ stroke: s, y: y });
      var midi = noteMap.midiAt(y);
      engine.noteUpdate(s, s.tool, midi, Theory.midiToFreq(midi));
    }

    // Release anything the playhead has moved past.
    engine.active.forEach(function (rec, id) {
      if (!seen.has(id)) engine.noteOff(id);
    });
  }

  var statusTick = 0;
  function updateStatus() {
    if (++statusTick % 6) return;      // ten updates a second is plenty
    var beats = state.bars * BEATS_PER_BAR;
    var pos = state.phase * beats;
    var bar = Math.floor(pos / BEATS_PER_BAR) + 1;
    var beat = Math.floor(pos % BEATS_PER_BAR) + 1;
    $('statusPos').textContent = 'Bar ' + bar + ' : ' + beat;
    var n = engine.voiceCount();
    $('statusVoices').textContent = n + (n === 1 ? ' voice' : ' voices');
  }

  /* ---------------- Boot ---------------- */

  function boot() {
    sketch = new Sketch(canvas);
    sketch.setNoteMap(noteMap);
    sketch.setBars(state.bars);
    sketch.resize();

    if (window.ResizeObserver) {
      new ResizeObserver(function () { sketch.resize(); }).observe($('canvasFrame'));
    }
    window.addEventListener('resize', function () { sketch.resize(); });

    // Phones report the new size a beat after the rotation animation, and the
    // visual viewport moves on its own as the URL bar shows and hides.
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { sketch.resize(); }, 250);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () { sketch.resize(); });
    }

    // Leaving the tab or switching apps must not leave a note droning.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        engine.allOff();
      } else if (engine.ready && Tone.context.state === 'suspended') {
        Tone.context.resume();
      }
    });

    selectTool('sine');
    $('barsOut').textContent = state.bars;
    setBpm(parseFloat(bpmInput.value), true);

    // Make sure the swatches, mixer dots and tool icons all start in step
    // with the colours the renderer actually uses.
    ['sine', 'square', 'triangle'].forEach(function (tool) {
      applyVoiceColor(tool, Sketch.TOOL_COLORS[tool]);
    });

    // Stores the start-up settings now; init() builds the FX chain from them,
    // and ensureAudio applies them again once the engine is actually running.
    syncEngineFromControls();

    if (!window.Tone) {
      notify('Tone.js could not be loaded from the CDN. Check your internet ' +
             'connection and reload - drawing works, but there will be no sound.');
    }

    requestAnimationFrame(tick);
  }

  boot();
})();
