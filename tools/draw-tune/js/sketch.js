/* ============================================================
   sketch.js - the drawing model and its renderer

   Strokes are stored in normalised coordinates (0..1 on both axes) so the
   drawing survives window resizing. Alongside its point list every stroke
   keeps a column index: COLUMNS buckets across the width, each holding the
   y the stroke sits at there. That gives the playhead an O(1) lookup per
   stroke per frame instead of walking every segment.
   ============================================================ */

(function (global) {
  'use strict';

  var COLUMNS = 2048;

  var TOOL_COLORS = {
    sine:     '#d01818',
    square:   '#0f9b0f',
    triangle: '#2444d8'
  };

  var LINE_WIDTH = 3;

  /* ---------------- Stroke ---------------- */

  function Stroke(tool) {
    this.tool = tool;
    this.pts = [];
    this.cols = new Float32Array(COLUMNS);
    this.cols.fill(NaN);
    this.minX = 1; this.maxX = 0;
    this.minY = 1; this.maxY = 0;
  }

  Stroke.prototype.addPoint = function (x, y) {
    x = clamp01(x); y = clamp01(y);
    var last = this.pts[this.pts.length - 1];
    if (last && Math.abs(last.x - x) < 1e-5 && Math.abs(last.y - y) < 1e-5) return false;

    this.pts.push({ x: x, y: y });
    if (x < this.minX) this.minX = x;
    if (x > this.maxX) this.maxX = x;
    if (y < this.minY) this.minY = y;
    if (y > this.maxY) this.maxY = y;

    if (last) this._rasterize(last, { x: x, y: y });
    else this.cols[colOf(x)] = y;
    return true;
  };

  Stroke.prototype._rasterize = function (a, b) {
    var c0 = colOf(a.x), c1 = colOf(b.x);
    if (c0 === c1) {
      this.cols[c0] = b.y;
      return;
    }
    var step = c1 > c0 ? 1 : -1;
    var dx = b.x - a.x;
    for (var c = c0; c !== c1 + step; c += step) {
      var x = c / (COLUMNS - 1);
      var t = dx === 0 ? 1 : (x - a.x) / dx;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      this.cols[c] = a.y + (b.y - a.y) * t;
    }
  };

  /** y of this stroke at normalised x, or NaN when the stroke is not there. */
  Stroke.prototype.yAt = function (x) {
    if (x < this.minX - 0.002 || x > this.maxX + 0.002) return NaN;
    return this.cols[colOf(x)];
  };

  /**
   * True when (x, y) lands inside the brush. The radius arrives split per
   * axis (rx, ry) because the stored coordinates are normalised on a canvas
   * that is not square - that keeps the brush round on screen.
   */
  Stroke.prototype.hitTest = function (x, y, rx, ry) {
    if (x < this.minX - rx || x > this.maxX + rx) return false;
    if (y < this.minY - ry || y > this.maxY + ry) return false;

    function inside(px, py) {
      var dx = (px - x) / rx;
      var dy = (py - y) / ry;
      return dx * dx + dy * dy <= 1;
    }

    // Sample the column index across the width of the brush. This catches
    // long straight segments, whose recorded points can be far apart.
    var SAMPLES = 9;
    for (var i = 0; i < SAMPLES; i++) {
      var sx = x + rx * ((2 * i) / (SAMPLES - 1) - 1);
      var sy = this.yAt(sx);
      if (!isNaN(sy) && inside(sx, sy)) return true;
    }
    // Recorded points as well, for near-vertical strokes that only ever
    // occupy a single column.
    for (i = 0; i < this.pts.length; i++) {
      if (inside(this.pts[i].x, this.pts[i].y)) return true;
    }
    return false;
  };

  function colOf(x) {
    var c = Math.round(clamp01(x) * (COLUMNS - 1));
    return c < 0 ? 0 : (c > COLUMNS - 1 ? COLUMNS - 1 : c);
  }

  function clamp01(v) {
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  /* ---------------- Sketch ---------------- */

  function Sketch(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Off-screen layer holding grid + finished strokes; the visible canvas
    // just blits it and paints the playhead on top each frame.
    this.layer = document.createElement('canvas');
    this.lctx = this.layer.getContext('2d');

    this.strokes = [];
    this.current = null;

    this.w = 1; this.h = 1;       // css pixels
    this.dpr = 1;

    this.noteMap = null;
    this.bars = 4;
    this.showGrid = true;
    this.showBars = true;
    this.layerDirty = true;
  }

  Sketch.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    if (w === this.w && h === this.h && dpr === this.dpr) return;

    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.layer.width = this.canvas.width;
    this.layer.height = this.canvas.height;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layerDirty = true;
  };

  Sketch.prototype.setNoteMap = function (nm) { this.noteMap = nm; this.layerDirty = true; };
  Sketch.prototype.setBars = function (n) { this.bars = n; this.layerDirty = true; };

  /* ---- editing ---- */

  Sketch.prototype.beginStroke = function (tool, x, y) {
    this.current = new Stroke(tool);
    this.current.addPoint(x, y);
    return this.current;
  };

  Sketch.prototype.extendStroke = function (x, y) {
    if (this.current) this.current.addPoint(x, y);
  };

  Sketch.prototype.endStroke = function () {
    var s = this.current;
    this.current = null;
    if (!s) return null;
    if (s.pts.length < 2) {
      // A single click still counts: give it a short audible tail.
      s.addPoint(Math.min(1, s.pts[0].x + 0.012), s.pts[0].y);
    }
    this.strokes.push(s);
    this.layerDirty = true;
    return s;
  };

  /** Erases every stroke touched by the brush. Returns the removed strokes. */
  Sketch.prototype.eraseAt = function (x, y, radiusPx) {
    var rx = radiusPx / Math.max(this.w, 1);
    var ry = radiusPx / Math.max(this.h, 1);
    var removed = [];
    var kept = [];
    for (var i = 0; i < this.strokes.length; i++) {
      var s = this.strokes[i];
      if (s.hitTest(x, y, rx, ry)) removed.push(s);
      else kept.push(s);
    }
    if (removed.length) {
      this.strokes = kept;
      this.layerDirty = true;
    }
    return removed;
  };

  Sketch.prototype.undo = function () {
    var s = this.strokes.pop() || null;
    if (s) this.layerDirty = true;
    return s;
  };

  Sketch.prototype.clear = function () {
    var removed = this.strokes;
    this.strokes = [];
    this.current = null;
    this.layerDirty = true;
    return removed;
  };

  /* ---- rendering ---- */

  Sketch.prototype._drawGrid = function (c) {
    var w = this.w, h = this.h, i;

    if (this.showGrid && this.noteMap && this.noteMap.rows <= 72) {
      var nm = this.noteMap;
      for (i = 0; i <= nm.rows; i++) {
        var y = Math.round(nm.rowEdgeY(i) * h) + 0.5;
        var isRoot = i < nm.rows && nm.isRoot(i);
        c.strokeStyle = isRoot ? '#c9d6e8' : '#eeeeee';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
      }
    }

    if (this.showBars) {
      var beats = this.bars * 4;
      if (beats <= 96) {
        c.strokeStyle = '#e6e6e6';
        c.lineWidth = 1;
        for (i = 1; i < beats; i++) {
          if (i % 4 === 0) continue;
          var bx = Math.round((i / beats) * w) + 0.5;
          c.beginPath(); c.moveTo(bx, 0); c.lineTo(bx, h); c.stroke();
        }
      }
      c.strokeStyle = '#b9b9c8';
      c.lineWidth = 1;
      for (i = 1; i < this.bars; i++) {
        var x = Math.round((i / this.bars) * w) + 0.5;
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke();
      }
    }
  };

  Sketch.prototype._drawStroke = function (c, s) {
    if (s.pts.length === 0) return;
    c.strokeStyle = TOOL_COLORS[s.tool] || '#000';
    c.lineWidth = LINE_WIDTH;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(s.pts[0].x * this.w, s.pts[0].y * this.h);
    for (var i = 1; i < s.pts.length; i++) {
      c.lineTo(s.pts[i].x * this.w, s.pts[i].y * this.h);
    }
    if (s.pts.length === 1) c.lineTo(s.pts[0].x * this.w + 0.01, s.pts[0].y * this.h);
    c.stroke();
  };

  Sketch.prototype._rebuildLayer = function () {
    var c = this.lctx;
    c.clearRect(0, 0, this.w, this.h);
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, this.w, this.h);
    this._drawGrid(c);
    for (var i = 0; i < this.strokes.length; i++) this._drawStroke(c, this.strokes[i]);
    this.layerDirty = false;
  };

  /**
   * Paints one frame.
   * @param {number} phase     playhead position, 0..1
   * @param {Array}  sounding  [{ stroke, y }] currently under the playhead
   * @param {boolean} playing
   */
  Sketch.prototype.render = function (phase, sounding, playing) {
    if (this.layerDirty) this._rebuildLayer();

    var c = this.ctx;
    c.drawImage(this.layer, 0, 0, this.w, this.h);

    if (this.current) this._drawStroke(c, this.current);

    var px = phase * this.w;

    // The tempo line.
    c.strokeStyle = playing ? '#000000' : '#9a9a9a';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(Math.round(px) + 0.5, 0);
    c.lineTo(Math.round(px) + 0.5, this.h);
    c.stroke();

    // Contact points where it crosses a line.
    if (playing && sounding) {
      for (var i = 0; i < sounding.length; i++) {
        var s = sounding[i];
        var y = s.y * this.h;
        c.fillStyle = TOOL_COLORS[s.stroke.tool] || '#000';
        c.beginPath();
        c.arc(px, y, 5, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.9)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(px, y, 8, 0, Math.PI * 2);
        c.stroke();
      }
    }
  };

  global.Sketch = Sketch;
  global.Sketch.TOOL_COLORS = TOOL_COLORS;
})(window);
