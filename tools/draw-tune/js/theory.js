/* ============================================================
   theory.js - scales, note names, canvas-height -> pitch mapping
   ============================================================ */

(function (global) {
  'use strict';

  var SCALES = {
    chromatic:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    major:      [0, 2, 4, 5, 7, 9, 11],
    minor:      [0, 2, 3, 5, 7, 8, 10],
    dorian:     [0, 2, 3, 5, 7, 9, 10],
    pentatonic: [0, 2, 4, 7, 9],
    blues:      [0, 3, 5, 6, 7, 10]
  };

  var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // Playable window: C2 (36) up to C7 (96). Five octaves reads well on a canvas.
  var MIN_MIDI = 36;
  var MAX_MIDI = 96;

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  function midiToName(m) {
    return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  }

  /**
   * A NoteMap turns a normalised y (0 = top of canvas, 1 = bottom) into a
   * pitch. The list of allowed notes is built once per key/scale change, then
   * the canvas height is divided into that many equal rows.
   */
  function NoteMap(rootPc, scaleKey) {
    this.root = ((rootPc % 12) + 12) % 12;
    this.scaleKey = SCALES[scaleKey] ? scaleKey : 'chromatic';
    this.notes = [];

    var intervals = SCALES[this.scaleKey];
    for (var m = MIN_MIDI; m <= MAX_MIDI; m++) {
      var degree = (((m - this.root) % 12) + 12) % 12;
      if (intervals.indexOf(degree) !== -1) this.notes.push(m);
    }
    this.rows = this.notes.length;
  }

  /** y (0..1, top-down) -> row index, 0 = lowest note at the bottom. */
  NoteMap.prototype.rowAt = function (y) {
    var r = Math.floor((1 - y) * this.rows);
    if (r < 0) r = 0;
    if (r > this.rows - 1) r = this.rows - 1;
    return r;
  };

  NoteMap.prototype.midiAt = function (y) {
    return this.notes[this.rowAt(y)];
  };

  NoteMap.prototype.freqAt = function (y) {
    return midiToFreq(this.midiAt(y));
  };

  NoteMap.prototype.nameAt = function (y) {
    return midiToName(this.midiAt(y));
  };

  /** Normalised y of the centre of a row - used to draw the note grid. */
  NoteMap.prototype.rowCenterY = function (row) {
    return 1 - (row + 0.5) / this.rows;
  };

  /** Normalised y of the boundary above a row. */
  NoteMap.prototype.rowEdgeY = function (row) {
    return 1 - row / this.rows;
  };

  /** True when the note in this row is the tonic of the current key. */
  NoteMap.prototype.isRoot = function (row) {
    return (((this.notes[row] - this.root) % 12) + 12) % 12 === 0;
  };

  global.Theory = {
    SCALES: SCALES,
    NOTE_NAMES: NOTE_NAMES,
    MIN_MIDI: MIN_MIDI,
    MAX_MIDI: MAX_MIDI,
    midiToFreq: midiToFreq,
    midiToName: midiToName,
    NoteMap: NoteMap
  };
})(window);
