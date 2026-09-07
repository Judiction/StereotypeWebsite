# Paint Tune

A browser drawing tool that turns the lines you draw into music, wearing a
Windows 95 / MS Paint face.

A vertical **TempoLine** sweeps across the canvas from left to right. Wherever it
crosses a line you drew, that line sounds: the colour picks the waveform, the
height picks the pitch.

## Running it

Open `index.html` in a browser. That is the whole install — no build step.

Tone.js is pulled from a CDN, so the **first** load needs an internet
connection. If it cannot be reached the page still draws, but stays silent and
says so.

Browsers block audio until you interact with the page, so the first click or
Play press is what starts the audio engine.

The transport starts stopped and nothing sounds while it is, so the **first
finished stroke starts the sweep** on its own. Only the first one: after that,
Stop means stop and drawing will not restart it.

## Controls

**Top bar**

| Control | What it does |
| --- | --- |
| Play / Pause | Starts and pauses the TempoLine (also `Space`) |
| Stop | Stops and rewinds to the left edge |
| BPM | Tempo, 20–300 |
| TAP | Tap it in time, twice or more, to set the tempo |
| Bars | Loop length, 1–16 bars of 4 beats |
| Key & Scale | Which notes the canvas height snaps to |

**Left toolbox**

| Tool | Sound | Colour |
| --- | --- | --- |
| Sine | pure tone | red |
| Square | buzzy, hollow | green |
| Triangle | soft, reedy | blue |
| Eraser | removes the stroke you point at | — |

Plus **Undo** and **Clear**.

The eraser has no size control: it is fixed small so it takes the line you are
actually on and nothing beside it. Touch pointers get a slightly wider reach
than a mouse or stylus, because a finger reports the centre of a contact patch
rather than an exact pixel.

**Voice colours** — the swatches in the lower left corner are buttons. Click one
to open a Paint-style palette and pick a new colour for that voice; **Other...**
opens the system colour picker for anything else. Every line already drawn with
that voice repaints immediately, along with its tool icon and mixer dot.

**Right rack**

**Voice Mix** at the top: one vertical fader per voice — sine, square,
triangle — each marked with that voice's colour. 100 is unity; the readout
below shows whichever fader you moved last.

Below it, vertical sliders for **Reverb**, **Delay** and master **Volume**,
each with a dropdown of algorithms:

- Reverb — Hall, Room, Plate, Cathedral
- Delay — Digital, Ping-Pong, Tape, Slapback

Digital, Ping-Pong and Tape lock their delay time to the tempo, so they stay in
step when you change the BPM.

It opens on Hall reverb at 80 and Tape delay at 40, with all three voices and
the master fader at 80. The control positions in `index.html` are the single
source of truth for those defaults — the engine reads them at startup, so
changing a slider's `value` there is all it takes to change what you land on.

## On phones and tablets

The layout adapts on its own — there is no separate mobile page and no user-agent
sniffing, just breakpoints.

**Narrow screens (≤760px)** hand as much width as possible to the canvas. The
four tools stack into a single column in a 48px strip, the mixer and FX faders
stack into a 54px strip on the right, the numeric readouts hide, and the voice
swatches drop their text labels — the colour chip is the label, and it is still
what you tap to change the colour. On a 390px-wide phone that leaves roughly
275px of canvas instead of about 180px before.

**Landscape (≤540px tall)** flips the priority to vertical space: the menu bar
goes away, the header flattens to one row, every fader shortens, and the tools
go back to two columns since width is no longer the scarce axis.

**Touch** gets bigger targets throughout — 40px tool buttons, fatter slider
thumbs, roomier menu rows — and a little more eraser reach. The page is pinned so
it cannot rubber-band or scroll behind the app, long-press on the canvas does
not raise the browser's own menu, extra fingers are ignored while one is
drawing, and text fields are sized so iOS does not zoom in when you focus them.
Both side rails scroll on their own if a screen is too short to show everything.

Rotating the device, or the URL bar sliding away, re-fits the canvas without
losing the drawing — strokes are stored in normalised coordinates.

**The iPhone silent switch.** On iOS every browser is WebKit, and Web Audio
lands in the *ambient* audio session — the one the ring/silent switch mutes.
Since most iPhones live in silent mode, the tool used to be silent for most
people who opened it on a phone. `_claimAudioSession` in `js/audio.js` moves the
page to the *playback* session instead, two ways: `navigator.audioSession.type`
where WebKit supports it, and, for older iOS, a looping silent `<audio>` element
started inside the same user gesture as the AudioContext. That element has to
stay unmuted — a muted one counts as silent media and does not promote the
session — and neither route runs anywhere but iOS.

A volume slider that is simply down still produces silence, so the first time
audio starts on a phone a strip explains where to look: the silent switch on
iOS, media volume on Android. It never appears on desktop.

iOS also parks the context in `interrupted` after a call, Siri, or an app
switch — not `suspended` — so `engine.resume()` handles both, and runs on the
next tap as well as on `visibilitychange`.

## Keyboard

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `1` `2` `3` | Sine / Square / Triangle |
| `E` | Eraser |
| `Ctrl+Z` | Undo the last stroke |
| `Ctrl+N` | Clear the canvas |
| `Esc` | Close a menu or dialog |

## How the pitch mapping works

The canvas covers C2 to C7. Only the notes of the chosen key and scale are kept,
and the canvas height is split into that many equal rows — so a pentatonic canvas
has 26 rows and a chromatic one has 61. The faint horizontal lines show the rows,
with the tonic of the key drawn slightly darker. A line drawn on a slope
re-articulates each time it crosses into a new row, so it plays a run of notes
rather than sliding.

## Files

```
index.html        markup and the Win95 window chrome
css/style.css     the retro styling: bevels, title bar, chunky sliders
js/theory.js      scales, note names, canvas height -> pitch
js/audio.js       Tone.js voice pool and the master reverb/delay rack
js/sketch.js      stroke storage, the playhead lookup index, rendering
js/app.js         UI wiring and the transport loop
```

### Notes on the implementation

Strokes are stored in normalised 0–1 coordinates, so resizing the window keeps
the drawing intact. Each stroke also keeps a 2048-bucket column index of its own
height, which is what lets the playhead ask every stroke "where are you at this
x?" once per frame without walking its whole point list.

The playhead advances by accumulating phase per frame rather than reading an
absolute clock, so changing tempo or bar count while it is running speeds it up
or slows it down smoothly instead of making it jump.

Voices come from a pool capped at 20; a stroke holds one voice for as long as
the playhead is on it, and the oldest voice is stolen if you draw more
overlapping lines than that. Each waveform has its own gain stage between the
pool and the master chain, which is what the Voice Mix faders drive — a voice
re-plugs itself into the right channel when it is reused for another waveform.

Voice colours live in one shared table that the renderer reads at draw time, so
changing a colour only needs to mark the stroke layer dirty; the next frame
repaints every existing line in the new colour.
