# FretMemo Comprehensive Implementation Plan v2.0

## Executive Summary

This document consolidates all research and planning into a single implementation roadmap for FretMemo. The plan is organized into **4 phases** spanning approximately 16-20 weeks, with each feature designed to be **100% client-side** using localStorage/IndexedDB for persistence—no databases, servers, or paid APIs.

**Current State (Based on Screenshots):**
- ✅ Three main modes: Guess Note, Play Practice, Technique
- ✅ Technique tab expanded with 6 exercises (Spider Walk, Permutation Trainer, Diagonal Patterns, String Skipping, Legato Builder, Linear Shifter)
- ✅ Daily Challenge system with permutation progress (0/24)
- ✅ Burst Mode settings implemented
- ✅ Metronome with tempo, duration, auto-acceleration
- ✅ Note filtering (naturals only, specific notes)
- ✅ Microphone input support
- ✅ Dark mode, left-handed mode

---

## Table of Contents

1. [Phase 1: Retention & Engagement Core](#phase-1-retention--engagement-core-weeks-1-4)
2. [Phase 2: Learning Intelligence](#phase-2-learning-intelligence-weeks-5-8)
3. [Phase 3: Expanded Training Modes](#phase-3-expanded-training-modes-weeks-9-12)
4. [Phase 4: Advanced Features](#phase-4-advanced-features-weeks-13-16)
5. [Technical Architecture](#technical-architecture)
6. [UI/UX Specifications](#uiux-specifications)
7. [Data Schemas](#data-schemas)
8. [Recommended Libraries](#recommended-libraries)

---

## Phase 1: Retention & Engagement Core (Weeks 1-4)

**Goal:** Implement features that dramatically increase daily return rates and practice consistency.

### 1.1 Streak System with Freeze Mechanic

**Priority:** 🔴 Critical | **Effort:** Medium | **Impact:** Very High

**Description:**
Track consecutive days of practice with visual rewards. Research shows streak mechanics boost engagement by 40-60%.

**Data Structure (localStorage):**
```javascript
{
  "streak": {
    "current": 7,
    "longest": 14,
    "lastPracticeDate": "2026-01-29",
    "freezesAvailable": 1,
    "freezesUsed": 0,
    "totalPracticeDays": 45
  }
}
```

**Implementation Details:**
- On app load, compare `lastPracticeDate` with current date
- If same day: no change
- If yesterday: increment streak
- If >1 day gap: reset streak (unless freeze used)
- Award 1 freeze per 7-day streak achieved

**UI Changes (Reference: Current Settings Panel):**
- Add streak display to main header area (near "FretMemo — Guitar Fretboard Trainer")
- Show 🔥 icon with streak count
- Streak freeze button in settings

**Visual Mockup:**
```
┌─────────────────────────────────────────────────┐
│  FretMemo — Guitar Fretboard Trainer    🔥 7    │
│  Choose a mode and start practicing             │
└─────────────────────────────────────────────────┘
```

---

### 1.2 Fretboard Heat Map Visualization

**Priority:** 🔴 Critical | **Effort:** Medium | **Impact:** Very High

**Description:**
Color-code fretboard positions based on user accuracy. Green = mastered (>85%), Yellow = learning (60-85%), Red = needs work (<60%).

**Data Structure (IndexedDB via Dexie.js):**
```javascript
// Store: position_stats
{
  "id": "E-5",  // String-Fret
  "note": "A",
  "attempts": 47,
  "correct": 38,
  "accuracy": 0.808,
  "avgResponseTimeMs": 1250,
  "lastPracticed": "2026-01-30T14:30:00Z"
}
```

**UI Changes (Reference: Fretboard → Note mode screenshot):**
- Add "Show Heat Map" toggle in Settings under APPEARANCE section
- When enabled, fretboard dots are colored by accuracy
- Add small legend: 🟢 Mastered | 🟡 Learning | 🔴 Focus

**Integration with Existing Modes:**
- Update position stats after each answer in "Guess Note" mode
- Update after each played note in "Play Practice" mode (when microphone detects correct pitch)

---

### 1.3 Achievement Badge System

**Priority:** 🟡 High | **Effort:** Medium | **Impact:** High

**Description:**
Award badges for milestones to provide dopamine hits and goals beyond personal improvement.

**Initial Badge Set (15 badges):**

| Badge | Name | Criteria |
|-------|------|----------|
| 🎯 | First Blood | Answer 1 note correctly |
| 🔟 | Getting Started | Answer 10 notes correctly |
| 💯 | Century | Answer 100 notes correctly |
| 🏆 | Note Ninja | Answer 1,000 notes correctly |
| 🔥 | Streak Starter | Achieve 3-day streak |
| 🔥🔥 | Week Warrior | Achieve 7-day streak |
| 🔥🔥🔥 | Monthly Master | Achieve 30-day streak |
| 🎸 | String Theory | Master all notes on one string |
| 🌈 | Natural Born | Master all natural notes |
| ⚡ | Speed Demon | 30 correct in 60 seconds |
| 🕷️ | Spider Master | Complete Spider Walk at 120 BPM |
| 🔀 | Permutation Pro | Complete 12/24 permutations |
| 🎓 | Completionist | Complete all 24 permutations |
| 👂 | Ear Opener | Complete 10 ear training exercises |
| 🎹 | Theory Buff | Complete 10 interval exercises |

**Data Structure:**
```javascript
{
  "achievements": {
    "first_blood": { "unlocked": true, "date": "2026-01-15T10:00:00Z" },
    "century": { "unlocked": false, "progress": 67 },
    // ...
  }
}
```

**UI:**
- Add "Achievements" button/section accessible from main screen
- Modal/page showing all badges (earned = colored, unearned = greyed)
- Toast notification when badge earned

---

### 1.4 Practice Focus Mode (Fret/String Range Selection)

**Priority:** 🟡 High | **Effort:** Low | **Impact:** High

**Description:**
Allow users to restrict practice to specific fret ranges and strings. This is a highly requested feature from community research.

**UI Changes (Reference: Current Settings Panel - add new section):**

```
┌─────────────────────────────────────────────────┐
│  FOCUS AREA                                     │
│                                                 │
│  Fret Range                                     │
│  ┌─────────────────────────────────────────┐   │
│  │  Min: [1] ▲▼    Max: [12] ▲▼            │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Strings to Practice                           │
│  [✓] E  [✓] A  [✓] D  [✓] G  [✓] B  [✓] e   │
│                                                 │
│  [ ] Hide Fret Numbers (advanced mode)          │
└─────────────────────────────────────────────────┘
```

**Implementation:**
- Add `focusArea` object to settings in localStorage
- Filter random note generation to only selected range
- Visual indicator on fretboard showing active zone

---

### 1.5 PWA (Progressive Web App) Implementation

**Priority:** 🟡 High | **Effort:** Medium | **Impact:** High

**Description:**
Enable offline functionality and "Add to Home Screen" for mobile users.

**Files to Create:**

**manifest.json:**
```json
{
  "name": "FretMemo - Guitar Fretboard Trainer",
  "short_name": "FretMemo",
  "description": "Master the guitar fretboard with interactive training",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#f5a623",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**service-worker.js:**
```javascript
const CACHE_NAME = 'fretmemo-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  // ... all static assets
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
```

---

## Phase 2: Learning Intelligence (Weeks 5-8)

**Goal:** Implement smart learning algorithms that optimize practice effectiveness.

### 2.1 Spaced Repetition Algorithm (SM-2)

**Priority:** 🔴 Critical | **Effort:** High | **Impact:** Very High

**Description:**
Implement the SM-2 algorithm (used in Anki) to prioritize notes the user struggles with.

**Algorithm Overview:**
```javascript
function calculateNextReview(quality, repetitions, easeFactor, interval) {
  // quality: 0-5 (0-2 = incorrect, 3-5 = correct with varying ease)
  
  if (quality < 3) {
    // Reset on failure
    return { repetitions: 0, interval: 1, easeFactor };
  }
  
  let newInterval;
  if (repetitions === 0) {
    newInterval = 1;
  } else if (repetitions === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(interval * easeFactor);
  }
  
  const newEaseFactor = Math.max(1.3, 
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );
  
  return {
    repetitions: repetitions + 1,
    interval: newInterval,
    easeFactor: newEaseFactor,
    nextReviewDate: addDays(new Date(), newInterval)
  };
}
```

**Data Structure (IndexedDB):**
```javascript
// Store: spaced_repetition
{
  "id": "E-5",
  "easeFactor": 2.5,
  "interval": 6,
  "repetitions": 3,
  "nextReviewDate": "2026-02-05",
  "lastQuality": 4
}
```

**Integration:**
- On session start, query positions where `nextReviewDate <= today`
- Prioritize these in random note selection
- Update after each answer based on correctness and response time

---

### 2.2 Daily Challenge System Enhancement

**Priority:** 🟡 High | **Effort:** Medium | **Impact:** High

**Description:**
Expand beyond permutation daily challenges to include various challenge types.

**Challenge Types:**
```javascript
const challengeTypes = [
  {
    type: 'speed_round',
    title: 'Speed Blitz',
    description: 'Identify 30 notes in 60 seconds',
    params: { targetCount: 30, timeLimit: 60 }
  },
  {
    type: 'accuracy_run',
    title: 'Precision Practice',
    description: 'Get 20 correct with max 2 mistakes',
    params: { targetCorrect: 20, maxMistakes: 2 }
  },
  {
    type: 'string_focus',
    title: 'String Master',
    description: 'Master all notes on the {string} string',
    params: { string: 'A' }  // Rotates daily
  },
  {
    type: 'position_challenge',
    title: 'Position Pro',
    description: 'Focus on frets {start}-{end}',
    params: { startFret: 5, endFret: 9 }
  },
  {
    type: 'permutation',
    title: 'Finger Twister',
    description: 'Complete permutation {pattern}',
    params: { pattern: [3, 2, 1, 4] }
  }
];
```

**Daily Selection Algorithm:**
```javascript
function getDailyChallenge(date) {
  const seed = dateToSeed(date);  // Deterministic from date
  const challengeIndex = seed % challengeTypes.length;
  const challenge = { ...challengeTypes[challengeIndex] };
  
  // Customize params based on date seed
  if (challenge.type === 'string_focus') {
    const strings = ['E', 'A', 'D', 'G', 'B', 'e'];
    challenge.params.string = strings[seed % 6];
  }
  // ...
  
  return challenge;
}
```

**UI (Reference: Current Daily Challenge bar):**
- Keep existing golden banner style
- Add challenge type icon
- Show progress during challenge
- Award 150-250 XP on completion

---

### 2.3 XP & Leveling System

**Priority:** 🟡 High | **Effort:** Low | **Impact:** Medium

**Description:**
Gamification layer that provides ongoing progression feedback.

**XP Awards:**
| Action | Base XP | With Streak Multiplier |
|--------|---------|------------------------|
| Correct answer | 10 | +10% per streak day (max +50%) |
| Perfect round (no mistakes) | 50 | +10% per streak day |
| Daily challenge complete | 200 | +10% per streak day |
| Achievement unlocked | 100 | Fixed |
| New permutation mastered | 75 | Fixed |

**Level Curve:**
```javascript
function xpForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}
// Level 1: 100 XP
// Level 5: 559 XP
// Level 10: 3,162 XP
// Level 20: 17,889 XP
```

**UI:**
- Add XP bar below streak counter in header
- Level badge next to username/streak
- Level-up animation/celebration

---

### 2.4 Alternate Tuning Support

**Priority:** 🟡 High | **Effort:** Medium | **Impact:** High

**Description:**
Most competitors paywall this feature. FretMemo can differentiate by offering it free.

**Supported Tunings:**
```javascript
const tunings = {
  standard: ['E', 'A', 'D', 'G', 'B', 'E'],
  dropD: ['D', 'A', 'D', 'G', 'B', 'E'],
  halfStepDown: ['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'Eb'],
  fullStepDown: ['D', 'G', 'C', 'F', 'A', 'D'],
  dadgad: ['D', 'A', 'D', 'G', 'A', 'D'],
  openG: ['D', 'G', 'D', 'G', 'B', 'D'],
  openD: ['D', 'A', 'D', 'F#', 'A', 'D'],
  dropC: ['C', 'G', 'C', 'F', 'A', 'D'],
  openE: ['E', 'B', 'E', 'G#', 'B', 'E'],
  custom: null  // User-defined
};
```

**UI Changes (Reference: Settings Panel - add to APPEARANCE or new section):**
```
┌─────────────────────────────────────────────────┐
│  TUNING                                         │
│                                                 │
│  Preset Tuning                                  │
│  ┌─────────────────────────────────────────┐   │
│  │  Standard (E-A-D-G-B-E)             ▼   │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [ ] Custom Tuning                              │
│  6: [E▼] 5: [A▼] 4: [D▼] 3: [G▼] 2: [B▼] 1: [E▼]│
└─────────────────────────────────────────────────┘
```

**Implementation:**
- Recalculate all note positions when tuning changes
- Function: `getNoteAtPosition(string, fret, tuning)`
- Store selected tuning in localStorage

---

### 2.5 Data Export/Import

**Priority:** 🟢 Medium | **Effort:** Low | **Impact:** Medium

**Description:**
Allow users to backup progress and transfer between devices.

**Export Format (JSON):**
```javascript
{
  "version": "2.0",
  "exportDate": "2026-01-30T15:00:00Z",
  "settings": { /* all localStorage settings */ },
  "streak": { /* streak data */ },
  "achievements": { /* achievement data */ },
  "positionStats": [ /* all position stats */ ],
  "spacedRepetition": [ /* SR data */ ],
  "practiceHistory": [ /* last 100 sessions */ ]
}
```

**UI:**
- Add "Export Data" and "Import Data" buttons in Settings
- Export: Generate JSON, trigger download
- Import: File picker, validate JSON, merge/replace data

---

## Phase 3: Expanded Training Modes (Weeks 9-12)

**Goal:** Add new training modalities that complement fretboard memorization.

### 3.1 Ear Training Mode

**Priority:** 🔴 Critical | **Effort:** High | **Impact:** Very High

**Description:**
Connect auditory recognition with fretboard knowledge using Web Audio API.

**Sub-modes:**

#### 3.1.1 Sound → Fretboard
- App plays a tone
- User clicks the position on fretboard
- Multiple correct positions accepted (same note, different octaves)

#### 3.1.2 Interval Recognition
- App plays two notes
- User identifies the interval (minor 2nd, major 3rd, etc.)
- Progressive difficulty: start with P5, P8, then add more

#### 3.1.3 Chord Quality Recognition
- App plays a chord (major, minor, dim, aug)
- User identifies the quality
- Later: 7th chords, extended chords

**Implementation with Tone.js:**
```javascript
import * as Tone from 'tone';

// Guitar-like synth
const synth = new Tone.Synth({
  oscillator: { type: 'triangle' },
  envelope: {
    attack: 0.01,
    decay: 0.3,
    sustain: 0.2,
    release: 0.8
  }
}).toDestination();

// Play note
function playNote(note) {
  synth.triggerAttackRelease(note, '4n');
}

// Play interval
function playInterval(root, interval) {
  const secondNote = Tonal.transpose(root, interval);
  synth.triggerAttackRelease(root, '4n');
  setTimeout(() => {
    synth.triggerAttackRelease(secondNote, '4n');
  }, 600);
}

// Play chord
const polySynth = new Tone.PolySynth(Tone.Synth).toDestination();
function playChord(notes) {
  polySynth.triggerAttackRelease(notes, '2n');
}
```

**UI:**
- New tab/mode: "Ear Training" (or sub-mode under "Guess Note")
- Play button with speaker icon
- "Repeat" button to hear again
- Progressive difficulty selector

---

### 3.2 Interval Training on Fretboard

**Priority:** 🟡 High | **Effort:** Medium | **Impact:** High

**Description:**
Visual interval training - find notes relative to a given root.

**Exercise Flow:**
1. App highlights root note (e.g., A on 5th fret E string)
2. App prompts: "Find the Major 3rd"
3. User clicks fretboard position
4. Feedback: correct/incorrect, show all valid positions

**Implementation with Tonal.js:**
```javascript
import { Interval, Note } from 'tonal';

function getIntervalTarget(root, intervalName) {
  return Interval.transposeFrom(root, intervalName);
}
// getIntervalTarget('A3', '3M') → 'C#4'
```

**Interval Progression:**
1. Perfect intervals (P5, P8)
2. Major intervals (M2, M3, M6, M7)
3. Minor intervals (m2, m3, m6, m7)
4. Tritone, compound intervals

---

### 3.3 Chord Diagram Display & Training

**Priority:** 🟡 High | **Effort:** Medium | **Impact:** High

**Description:**
Show chord diagrams and quiz users on chord shapes/notes.

**Using SVGuitar library:**
```javascript
import { SVGuitarChord } from 'svguitar';

const chart = new SVGuitarChord('#chord-container')
  .chord({
    fingers: [
      [1, 0],  // String 1, fret 0 (open)
      [2, 1],  // String 2, fret 1
      [3, 0],
      [4, 2],
      [5, 3],
      [6, 'x'] // Muted
    ],
    barres: [],
    title: 'C Major'
  })
  .draw();
```

**Training Modes:**
1. **Chord → Name**: Show diagram, user names the chord
2. **Name → Diagram**: Show name, user identifies correct diagram from options
3. **Chord → Notes**: Show chord, user lists the notes it contains
4. **Notes → Fretboard**: Show chord notes, user finds them all on fretboard

**Chord Database:**
- Use `chords-db` npm package (JSON, client-side)
- Covers 95 chord suffixes across 12 keys

---

### 3.4 Scale Visualization & Practice

**Priority:** 🟡 High | **Effort:** Medium | **Impact:** High

**Description:**
Display scales across the fretboard with color-coded degrees.

**Implementation with Tonal.js:**
```javascript
import { Scale } from 'tonal';

const cMajor = Scale.get('C major');
// {
//   name: 'C major',
//   notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
//   intervals: ['1P', '2M', '3M', '4P', '5P', '6M', '7M']
// }
```

**Visualization Options:**
- Color by scale degree (root=red, 3rd=blue, 5th=green, etc.)
- Show note names or interval numbers
- Filter by position (CAGED shapes)
- 3-notes-per-string patterns

**Practice Mode:**
- Guided scale playthrough with metronome
- Random note within scale
- Ascending/descending challenges

---

### 3.5 Sight Reading Trainer

**Priority:** 🟢 Medium | **Effort:** High | **Impact:** Medium

**Description:**
Display standard notation, user finds the note on fretboard.

**Using abcjs (lighter) or VexFlow (full-featured):**
```javascript
// abcjs example
import abcjs from 'abcjs';

const notation = "X:1\nK:C\nC D E F|";
abcjs.renderAbc("notation-container", notation);
```

**Exercise Flow:**
1. Display single note on staff
2. User clicks fretboard position
3. Accept any octave-correct position
4. Progress through positions (open → 5th fret → 12th fret)

**UI:**
- Staff display area above fretboard
- Clef selector (treble/bass for theory)
- Position range limiter

---

## Phase 4: Advanced Features (Weeks 13-16)

**Goal:** Polish and add power-user features.

### 4.1 "Find All Notes" Challenge Mode

**Priority:** 🟡 High | **Effort:** Low | **Impact:** High

**Description:**
"Find all the A notes!" - user clicks every occurrence of a note.

**Implementation:**
```javascript
function getAllPositionsForNote(note, maxFret = 12) {
  const positions = [];
  const tuning = getCurrentTuning();
  
  tuning.forEach((openNote, stringIndex) => {
    for (let fret = 0; fret <= maxFret; fret++) {
      const noteAtPosition = getNoteAtFret(openNote, fret);
      if (Note.pitchClass(noteAtPosition) === Note.pitchClass(note)) {
        positions.push({ string: stringIndex, fret });
      }
    }
  });
  
  return positions;
}
```

**UI:**
- Timer (optional)
- Counter: "Found 3/6 A notes"
- Highlight found positions
- Show remaining on completion

---

### 4.2 Timed Challenge Modes

**Priority:** 🟡 High | **Effort:** Low | **Impact:** High

**Description:**
Gamified speed challenges.

**Modes:**
1. **60-Second Blitz**: Max correct answers in 60 seconds
2. **Survival**: Keep going until you miss
3. **Speed Ladder**: BPM increases every 10 correct

**Implementation:**
```javascript
class TimedChallenge {
  constructor(type, params) {
    this.type = type;
    this.timeLimit = params.timeLimit || 60;
    this.score = 0;
    this.mistakes = 0;
  }
  
  start() {
    this.startTime = Date.now();
    this.timer = setInterval(() => this.tick(), 100);
  }
  
  tick() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    if (elapsed >= this.timeLimit) {
      this.end();
    }
    this.updateUI(this.timeLimit - elapsed);
  }
  
  recordAnswer(correct) {
    if (correct) this.score++;
    else this.mistakes++;
    
    if (this.type === 'survival' && !correct) {
      this.end();
    }
  }
}
```

**UI:**
- Prominent countdown timer
- Score counter
- High score display
- Celebration animation on new record

---

### 4.3 Circle of Fifths Interactive Tool

**Priority:** 🟢 Medium | **Effort:** Medium | **Impact:** Medium

**Description:**
Interactive Circle of Fifths for theory exploration.

**Features:**
- Click key to see relative major/minor
- Display key signature (sharps/flats)
- Show diatonic chords
- Link to scale visualization on fretboard

**Implementation:**
- SVG-based circle
- Click handlers for each key segment
- Tonal.js for chord/scale calculations

---

### 4.4 CAGED System Visualization

**Priority:** 🟢 Medium | **Effort:** Medium | **Impact:** Medium

**Description:**
Show how chord shapes connect across the fretboard.

**Implementation:**
```javascript
const cagedShapes = {
  C: { positions: [...], rootString: 5 },
  A: { positions: [...], rootString: 5 },
  G: { positions: [...], rootString: 6 },
  E: { positions: [...], rootString: 6 },
  D: { positions: [...], rootString: 4 }
};

function getCAGEDPositions(root, shape) {
  // Calculate where this shape falls for given root
}
```

**UI:**
- Select root note
- Toggle individual CAGED shapes
- Animation showing connection between shapes

---

### 4.5 Practice Session Planner & Timer

**Priority:** 🟢 Medium | **Effort:** Medium | **Impact:** Medium

**Description:**
Structured practice routines with Pomodoro-style timing.

**Pre-built Routines:**
```javascript
const routines = [
  {
    name: "5-Minute Warm-Up",
    segments: [
      { mode: 'technique', exercise: 'spider-walk', duration: 60 },
      { mode: 'guess-note', submode: 'fretboard', duration: 120 },
      { mode: 'technique', exercise: 'permutation', duration: 120 }
    ]
  },
  {
    name: "Full Practice Session",
    segments: [
      { mode: 'technique', exercise: 'spider-walk', duration: 120 },
      { mode: 'guess-note', submode: 'all', duration: 300 },
      { mode: 'ear-training', submode: 'intervals', duration: 180 },
      { mode: 'technique', exercise: 'string-skipping', duration: 120 },
      { mode: 'scales', scale: 'random', duration: 180 }
    ]
  }
];
```

**UI:**
- Routine selector
- Current segment indicator
- Time remaining
- Auto-transition between segments
- Session summary at end

---

### 4.6 Extended Instrument Support

**Priority:** 🟢 Low | **Effort:** Medium | **Impact:** Medium

**Description:**
Support bass, 7-string, 8-string guitars.

**Implementation:**
```javascript
const instruments = {
  guitar6: { strings: 6, tuning: ['E', 'A', 'D', 'G', 'B', 'E'] },
  guitar7: { strings: 7, tuning: ['B', 'E', 'A', 'D', 'G', 'B', 'E'] },
  guitar8: { strings: 8, tuning: ['F#', 'B', 'E', 'A', 'D', 'G', 'B', 'E'] },
  bass4: { strings: 4, tuning: ['E', 'A', 'D', 'G'] },
  bass5: { strings: 5, tuning: ['B', 'E', 'A', 'D', 'G'] },
  ukulele: { strings: 4, tuning: ['G', 'C', 'E', 'A'] }
};
```

**UI Changes:**
- Add instrument selector in Settings
- Fretboard dynamically adjusts string count
- Note ranges adjust accordingly

---

## Technical Architecture

### Storage Strategy

```
┌─────────────────────────────────────────────────────────┐
│                     STORAGE LAYER                        │
├─────────────────────────────────────────────────────────┤
│  localStorage (Synchronous, ~5MB)                        │
│  ├── settings (tuning, appearance, focus area)           │
│  ├── streak (current, longest, lastDate)                │
│  ├── achievements (badge status)                         │
│  └── xp (total, level)                                   │
├─────────────────────────────────────────────────────────┤
│  IndexedDB via Dexie.js (Async, unlimited)              │
│  ├── position_stats (72+ records - each fret position)  │
│  ├── spaced_repetition (SR algorithm data)              │
│  ├── practice_sessions (history log)                     │
│  └── audio_recordings (optional self-review clips)       │
└─────────────────────────────────────────────────────────┘
```

### Audio Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     AUDIO LAYER                          │
├─────────────────────────────────────────────────────────┤
│  INPUT (Microphone)                                      │
│  ├── Web Audio API → AnalyserNode                       │
│  ├── Pitch Detection: ml5.js CREPE model OR Pitchy      │
│  └── Onset Detection: Meyda.js (spectral flux)          │
├─────────────────────────────────────────────────────────┤
│  OUTPUT (Synthesis)                                      │
│  ├── Tone.js Synth (guitar-like tones)                  │
│  ├── Tone.PolySynth (chords)                            │
│  └── Metronome: Tone.Transport + Tone.Loop              │
└─────────────────────────────────────────────────────────┘
```

### State Management

```javascript
// Recommended: Simple pub/sub or lightweight state manager
const state = {
  // Session state (in memory)
  currentMode: 'guess-note',
  currentSubMode: 'fretboard',
  isPlaying: false,
  currentNote: null,
  sessionScore: { correct: 0, incorrect: 0 },
  
  // Persistent state (localStorage/IndexedDB)
  settings: { /* from localStorage */ },
  streak: { /* from localStorage */ },
  achievements: { /* from localStorage */ },
  positionStats: { /* from IndexedDB */ }
};

// Event emitter for UI updates
const events = new EventEmitter();
events.on('answer', handleAnswer);
events.on('modeChange', handleModeChange);
```

---

## UI/UX Specifications

### Navigation Structure (Updated)

```
FretMemo
├── Guess Note (existing)
│   ├── Fretboard → Note
│   ├── Tab → Note
│   └── Note → Tab
├── Play Practice (existing)
│   ├── Note Names
│   └── Tab Sequence
├── Technique (existing, expanded)
│   ├── Spider Walk
│   ├── Permutation Trainer
│   ├── Diagonal Patterns
│   ├── String Skipping
│   ├── Legato Builder
│   └── Linear Shifter
├── Ear Training (NEW)
│   ├── Sound → Fretboard
│   ├── Interval Recognition
│   └── Chord Quality
├── Theory Tools (NEW)
│   ├── Scale Explorer
│   ├── Chord Library
│   ├── Circle of Fifths
│   └── CAGED Visualizer
└── Challenges (NEW)
    ├── Daily Challenge
    ├── Timed Blitz
    ├── Survival Mode
    └── Find All Notes
```

### Settings Panel Additions

**Reference:** Current settings panel screenshot

**New Sections to Add:**

```
┌─────────────────────────────────────────────────────────┐
│  GAMIFICATION                                            │
│                                                          │
│  Show XP & Level         [✓]                            │
│  Show Streak             [✓]                            │
│  Achievement Notifications [✓]                          │
├─────────────────────────────────────────────────────────┤
│  FOCUS AREA                                              │
│                                                          │
│  Fret Range: Min [0] Max [12]                           │
│  Strings: [✓]E [✓]A [✓]D [✓]G [✓]B [✓]e               │
│  [ ] Hide Fret Numbers                                   │
├─────────────────────────────────────────────────────────┤
│  TUNING                                                  │
│                                                          │
│  [Standard (E-A-D-G-B-E)                    ▼]          │
│  [ ] Custom tuning...                                    │
├─────────────────────────────────────────────────────────┤
│  LEARNING                                                │
│                                                          │
│  [ ] Enable Spaced Repetition                           │
│  [ ] Show Heat Map                                       │
│  Notation: (○) Sharps (○) Flats (●) Both               │
├─────────────────────────────────────────────────────────┤
│  DATA                                                    │
│                                                          │
│  [Export Progress]  [Import Progress]                   │
│  [Reset All Data]                                        │
└─────────────────────────────────────────────────────────┘
```

### Header Bar Enhancement

**Current:** `FretMemo — Guitar Fretboard Trainer`

**Enhanced:**
```
┌─────────────────────────────────────────────────────────┐
│ [Settings]  FretMemo — Guitar Fretboard Trainer         │
│                                                          │
│             🔥 7 day streak    ⭐ Level 12 (2,450 XP)   │
│             ████████░░ 450 XP to next level             │
└─────────────────────────────────────────────────────────┘
```

---

## Data Schemas

### Complete localStorage Schema

```javascript
{
  // Settings
  "settings": {
    "tempo": 60,
    "noteDuration": 1,
    "accelerateAuto": false,
    "accelerateBy": 5,
    "accelerateEvery": 8,
    "noteSequence": "random",
    "rootNote": "C",
    "microphoneEnabled": false,
    "naturalsOnly": false,
    "selectedNotes": ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"],
    "darkMode": true,
    "leftHanded": false,
    "tuning": "standard",
    "customTuning": null,
    "focusArea": {
      "minFret": 0,
      "maxFret": 12,
      "strings": [true, true, true, true, true, true]
    },
    "hideFretNumbers": false,
    "showHeatMap": false,
    "spacedRepetitionEnabled": true,
    "notationPreference": "sharps"
  },
  
  // Gamification
  "streak": {
    "current": 7,
    "longest": 14,
    "lastPracticeDate": "2026-01-29",
    "freezesAvailable": 1,
    "freezesUsed": 0
  },
  
  "xp": {
    "total": 2450,
    "level": 12,
    "todayEarned": 150
  },
  
  "achievements": {
    "first_blood": { "unlocked": true, "date": "2026-01-15" },
    "century": { "unlocked": true, "date": "2026-01-20" },
    "note_ninja": { "unlocked": false, "progress": 673 }
    // ... more achievements
  },
  
  // Technique Progress
  "technique": {
    "permutationsCompleted": [0, 1, 5, 23],  // Indices of completed
    "maxBPM": {
      "spider-walk": 100,
      "permutation": 80,
      "diagonal": 70
    }
  },
  
  // Daily Challenge
  "dailyChallenge": {
    "lastCompletedDate": "2026-01-29",
    "completedToday": false
  }
}
```

### IndexedDB Schema (Dexie.js)

```javascript
import Dexie from 'dexie';

const db = new Dexie('FretMemoDB');

db.version(1).stores({
  positionStats: 'id, note, accuracy, lastPracticed',
  spacedRepetition: 'id, nextReviewDate',
  practiceSessions: '++id, date, mode, duration',
  audioClips: '++id, date, duration'
});

// Example records:

// positionStats
{
  id: 'E-5',           // String-Fret unique ID
  note: 'A',
  attempts: 47,
  correct: 38,
  accuracy: 0.808,
  avgResponseTimeMs: 1250,
  lastPracticed: new Date()
}

// spacedRepetition
{
  id: 'E-5',
  easeFactor: 2.5,
  interval: 6,
  repetitions: 3,
  nextReviewDate: new Date('2026-02-05'),
  lastQuality: 4
}

// practiceSessions
{
  id: 1,  // Auto-increment
  date: new Date(),
  mode: 'guess-note',
  subMode: 'fretboard',
  duration: 300,  // seconds
  totalQuestions: 45,
  correct: 38,
  accuracy: 0.844,
  xpEarned: 380
}
```

---

## Recommended Libraries

### Core (Already likely in use)
| Library | Purpose | Size | CDN |
|---------|---------|------|-----|
| Tone.js | Audio synthesis & metronome | ~150KB | cdnjs ✓ |

### New Additions
| Library | Purpose | Size | CDN |
|---------|---------|------|-----|
| Tonal.js | Music theory calculations | ~6KB gzip | cdnjs ✓ |
| Dexie.js | IndexedDB wrapper | ~20KB | cdnjs ✓ |
| SVGuitar | Chord diagrams | ~15KB | npm only |
| ml5.js | Pitch detection (CREPE) | ~10MB (model) | cdnjs ✓ |
| Meyda.js | Audio feature extraction | ~30KB | cdnjs ✓ |
| abcjs | Music notation | ~200KB | cdnjs ✓ |
| lz-string | URL state compression | ~5KB | cdnjs ✓ |

### Optional/Alternative
| Library | Purpose | Notes |
|---------|---------|-------|
| Pitchy | Lightweight pitch detection | Alternative to ml5 if size is concern |
| VexFlow | Full music notation | Heavier than abcjs but more powerful |
| @moonwave99/fretboard.js | SVG fretboard rendering | If rebuilding fretboard component |

---

## Implementation Checklist

### Phase 1 (Weeks 1-4)
- [ ] 1.1 Streak system with localStorage
- [ ] 1.2 Heat map visualization on fretboard
- [ ] 1.3 Achievement badge system (15 initial badges)
- [ ] 1.4 Focus mode (fret/string range selection)
- [ ] 1.5 PWA manifest and service worker

### Phase 2 (Weeks 5-8)
- [ ] 2.1 Spaced repetition algorithm (SM-2)
- [ ] 2.2 Enhanced daily challenge system
- [ ] 2.3 XP and leveling system
- [ ] 2.4 Alternate tuning support
- [ ] 2.5 Data export/import

### Phase 3 (Weeks 9-12)
- [ ] 3.1 Ear training mode (Sound → Fretboard)
- [ ] 3.2 Interval training on fretboard
- [ ] 3.3 Chord diagram display
- [ ] 3.4 Scale visualization
- [ ] 3.5 Basic sight reading trainer

### Phase 4 (Weeks 13-16)
- [ ] 4.1 "Find All Notes" challenge
- [ ] 4.2 Timed challenge modes
- [ ] 4.3 Circle of Fifths tool
- [ ] 4.4 CAGED system visualization
- [ ] 4.5 Practice session planner
- [ ] 4.6 Extended instrument support

---

## Success Metrics

Track these metrics to measure feature impact:

| Metric | Current | Phase 1 Target | Phase 4 Target |
|--------|---------|----------------|----------------|
| Daily Active Users | Baseline | +30% | +100% |
| Avg Session Duration | Baseline | +20% | +50% |
| 7-Day Retention | Baseline | +40% | +80% |
| PWA Installs | 0 | 100 | 500 |
| Avg Streak Length | N/A | 3 days | 7 days |

---

*Document Version: 2.0*
*Last Updated: January 30, 2026*
*For: FretMemo.net Development Team