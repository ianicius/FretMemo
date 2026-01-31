# FretMemo Music Theory & Ear Training Implementation Plan v3.0

## Executive Summary

This document provides the comprehensive implementation roadmap for adding **Music Theory** and **Ear Training** capabilities to FretMemo. Building upon the existing technique exercises (Spider Walk, Permutation Trainer, etc.), this phase creates an integrated learning environment that connects auditory perception with fretboard topography—a unique differentiator from competitors.

**Core Principle:** All features remain **100% client-side** using Web Audio API, Tone.js, Tonal.js, localStorage/IndexedDB, and zero backend dependencies.

**Estimated Timeline:** 16-20 weeks across 4 phases

---

## 6. Technical Specifications

### 6.1 Fretboard Mapper Core

```javascript
class FretboardMapper {
  // Standard tuning MIDI note numbers (E2=40 to E4=64)
  static STANDARD_TUNING_MIDI = [40, 45, 50, 55, 59, 64];
  
  // The G-B interval is a Major 3rd (4 semitones), not P4 (5 semitones)
  static STRING_INTERVALS = [5, 5, 5, 4, 5]; // Intervals between adjacent strings
  
  constructor(tuning = 'standard') {
    this.tuning = this.getTuningMidi(tuning);
    this.noteCache = this.buildNoteCache();
  }

  getTuningMidi(tuningName) {
    const tunings = {
      standard: [40, 45, 50, 55, 59, 64],
      dropD: [38, 45, 50, 55, 59, 64],
      halfStepDown: [39, 44, 49, 54, 58, 63],
      openG: [38, 43, 50, 55, 59, 62],
      dadgad: [38, 45, 50, 55, 57, 62]
    };
    return tunings[tuningName] || tunings.standard;
  }

  buildNoteCache() {
    const cache = {};
    for (let string = 0; string < 6; string++) {
      for (let fret = 0; fret <= 24; fret++) {
        const midi = this.tuning[string] + fret;
        const note = Note.fromMidi(midi);
        const key = `${string}-${fret}`;
        cache[key] = {
          midi, note,
          pitchClass: Note.pitchClass(note),
          octave: Note.octave(note)
        };
      }
    }
    return cache;
  }

  getNoteAtPosition(string, fret) {
    return this.noteCache[`${string}-${fret}`]?.note;
  }

  getMidiAtPosition(string, fret) {
    return this.noteCache[`${string}-${fret}`]?.midi;
  }

  getAllPositionsForPitchClass(pitchClass, minFret = 0, maxFret = 12) {
    const positions = [];
    for (let string = 0; string < 6; string++) {
      for (let fret = minFret; fret <= maxFret; fret++) {
        const data = this.noteCache[`${string}-${fret}`];
        if (data && data.pitchClass === pitchClass) {
          positions.push({ string, fret, note: data.note, midi: data.midi });
        }
      }
    }
    return positions;
  }

  findChordVoicing(notes, preferredPosition = 'open') {
    // Find a playable voicing for given chord notes
    const voicings = this.generateVoicings(notes);
    
    // Sort by playability score
    voicings.sort((a, b) => this.voicingScore(b) - this.voicingScore(a));
    
    return voicings[0];
  }

  voicingScore(voicing) {
    let score = 100;
    
    // Penalize wide fret spans
    const frets = voicing.positions.map(p => p.fret).filter(f => f > 0);
    const span = Math.max(...frets) - Math.min(...frets);
    score -= span * 10;
    
    // Prefer open strings
    score += voicing.positions.filter(p => p.fret === 0).length * 5;
    
    // Penalize positions requiring big stretches
    if (span > 4) score -= 30;
    
    return score;
  }
}
```

### 6.2 Audio Synthesis Details

```javascript
// Karplus-Strong Synthesis for Guitar-Like Tones
class GuitarSynthesizer {
  constructor(audioContext) {
    this.ctx = audioContext;
  }

  createGuitarTone(frequency, duration = 2) {
    const sampleRate = this.ctx.sampleRate;
    const samples = Math.round(sampleRate / frequency);
    const bufferSize = Math.round(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    
    // Initialize with noise burst (simulates pluck)
    for (let i = 0; i < samples; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    // Karplus-Strong: averaging filter with decay
    const decay = 0.996;
    for (let i = samples; i < bufferSize; i++) {
      data[i] = decay * (data[i - samples] + data[i - samples + 1]) / 2;
    }
    
    return buffer;
  }

  playNote(frequency, startTime = 0, duration = 2) {
    const buffer = this.createGuitarTone(frequency, duration);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    source.start(this.ctx.currentTime + startTime);
    return source;
  }
}
```

### 6.3 Theory Engine Integration (Tonal.js)

```javascript
// Utility functions wrapping Tonal.js
const TheoryEngine = {
  // Get all notes in a scale
  getScaleNotes: (root, scaleName) => Scale.get(`${root} ${scaleName}`).notes,
  
  // Get chord notes
  getChordNotes: (root, quality) => Chord.get(`${root}${quality}`).notes,
  
  // Transpose a note by interval
  transpose: (note, interval) => Note.transpose(note, interval),
  
  // Get interval between two notes
  getInterval: (note1, note2) => Interval.distance(note1, note2),
  
  // Get semitones for interval
  getSemitones: (interval) => Interval.semitones(interval),
  
  // Check if note is in scale
  isInScale: (note, root, scaleName) => {
    const scale = Scale.get(`${root} ${scaleName}`);
    return scale.notes.includes(Note.pitchClass(note));
  },
  
  // Get scale degree of a note
  getScaleDegree: (note, root, scaleName) => {
    const scale = Scale.get(`${root} ${scaleName}`);
    return scale.notes.indexOf(Note.pitchClass(note)) + 1;
  },
  
  // Get diatonic chords for a key
  getDiatonicChords: (key, includeSevenths = false) => {
    const scale = Scale.get(`${key} major`);
    const qualities = ['', 'm', 'm', '', '', 'm', 'dim'];
    const seventhQualities = ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'];
    
    return scale.notes.map((note, i) => ({
      root: note,
      triad: `${note}${qualities[i]}`,
      seventh: `${note}${seventhQualities[i]}`,
      degree: i + 1,
      roman: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'][i]
    }));
  }
};
```

---

## 7. Data Models & Storage

### 7.1 IndexedDB Schema (Dexie.js)

```javascript
import Dexie from 'dexie';

const db = new Dexie('FretMemoDB');

db.version(2).stores({
  // Existing stores
  positionStats: 'id, note, accuracy, lastPracticed',
  practiceSessions: '++id, date, mode, duration',
  
  // New stores for Theory & Ear Training
  srsCards: 'id, exerciseType, nextReviewDate, easeFactor',
  exerciseResults: '++id, exerciseType, itemId, timestamp, correct',
  earTrainingProgress: 'exerciseType, totalAttempts, totalCorrect',
  achievements: 'id, unlockedAt',
  dailyChallenges: 'date, exerciseType, completed'
});

// SRS Card example
const srsCardExample = {
  id: 'interval_m3',          // Unique identifier
  exerciseType: 'intervals',   // Category
  easeFactor: 2.5,            // SM-2 ease factor
  interval: 6,                // Days until next review
  repetitions: 3,             // Successful repetitions
  nextReviewDate: '2026-02-06',
  lastReviewDate: '2026-01-31',
  createdAt: '2026-01-15'
};

// Exercise result example
const resultExample = {
  id: 1,                      // Auto-increment
  exerciseType: 'intervals',
  itemId: 'm3',               // Minor 3rd
  timestamp: '2026-01-31T14:30:00Z',
  correct: true,
  responseTimeMs: 1850,
  difficulty: 'intermediate',
  context: {
    rootNote: 'C4',
    targetNote: 'Eb4',
    mode: 'melodic'
  }
};
```

### 7.2 localStorage Schema Additions

```javascript
const settingsAdditions = {
  // Ear Training Settings
  earTraining: {
    defaultInstrument: 'pluck',      // pluck, sine, piano
    playbackVolume: 0.8,
    droneVolume: 0.3,
    autoplayNext: true,
    showHints: true,
    difficulty: 'intermediate',
    intervals: {
      enabled: ['P5', 'P4', 'M3', 'm3', 'P8'],
      mode: 'melodic'                // melodic, harmonic, both
    },
    chords: {
      enabled: ['major', 'minor'],
      style: 'block'                 // block, arpeggio, strum
    }
  },
  
  // Theory Settings
  theory: {
    preferredNotation: 'sharps',     // sharps, flats, both
    showDegreeNumbers: true,
    showSolfege: false,
    highlightRoots: true
  },
  
  // Progress
  earTrainingStreak: {
    current: 5,
    longest: 12,
    lastPracticeDate: '2026-01-31'
  }
};
```

---

## 8. UI/UX Design Specifications

### 8.1 Navigation Structure

```
FretMemo
├── Guess Note (existing)
├── Play Practice (existing)
├── Technique (existing)
└── Theory & Ear (NEW)
    ├── Ear Training
    │   ├── Note Recognition
    │   ├── Intervals
    │   ├── Chord Quality
    │   ├── Scale Degrees (Functional)
    │   └── Mini Dictation
    ├── Music Theory
    │   ├── Circle of Fifths
    │   ├── Diatonic Chords
    │   ├── Interval Navigator
    │   └── Scale Explorer
    └── Progress
        ├── Statistics
        ├── Achievements
        └── Weak Areas
```

### 8.2 Ear Training Exercise UI Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    Interval Recognition           ⚙ Settings    Level: 3/10   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        🎵 AUDIO CONTROLS                        │   │
│  │                                                                 │   │
│  │      [▶ Play]     [↻ Repeat]     [💡 Hint]     [Skip →]        │   │
│  │                                                                 │   │
│  │      Mode: (● Melodic) (○ Harmonic)                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      ANSWER OPTIONS                             │   │
│  │                                                                 │   │
│  │   [m2]  [M2]  [m3]  [M3]  [P4]  [TT]  [P5]  [m6]  [M6]  [P8]  │   │
│  │                                                                 │   │
│  │   (Options highlight on hover, selected = filled)              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      FRETBOARD DISPLAY                          │   │
│  │                                                                 │   │
│  │   (Shows root note highlighted, optional second note after     │   │
│  │    answer or in "show on fretboard" mode)                      │   │
│  │                                                                 │   │
│  │   E ──●──────────────────────────────────────────              │   │
│  │   B ──────────────────────────────────────────────              │   │
│  │   G ──────────────────────────────────────────────              │   │
│  │   D ──────────────────────────────────────────────              │   │
│  │   A ──────────────────────────────────────────────              │   │
│  │   E ──────────────────────────────────────────────              │   │
│  │      0    3    5    7    9    12                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Session: 12/20  │  Streak: 🔥 8  │  Accuracy: 83%  │  ⏱ 1.2s  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Circle of Fifths Interactive UI

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    Circle of Fifths                            ⚙ Settings      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│         Exercise: Find the key with 3 sharps                            │
│                                                                         │
│                           ┌───────┐                                     │
│                      F    │   C   │    G                                │
│                    ┌──────┴───────┴──────┐                              │
│               Bb   │                      │   D                         │
│              ┌─────┤       (Inner        ├─────┐                        │
│         Eb   │     │       Ring:         │     │   A                    │
│        ┌─────┤     │       Minor         │     ├─────┐                  │
│   Ab   │     │     │       Keys)         │     │     │   E              │
│        └─────┤     │                     │     ├─────┘                  │
│         Db   │     │                     │     │   B                    │
│              └─────┤                     ├─────┘                        │
│               Gb   │                     │   F#                         │
│                    └─────────────────────┘                              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Selected: A major    Sharps: 3 (F#, C#, G#)                    │   │
│  │                                                                 │   │
│  │  Relative Minor: F# minor                                       │   │
│  │  Parallel Minor: A minor                                        │   │
│  │                                                                 │   │
│  │  Diatonic Chords: A  Bm  C#m  D  E  F#m  G#dim                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  [▶ Play Scale]   [▶ Play Chords]   [Show on Fretboard]                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.4 Feedback Patterns

```javascript
const FEEDBACK_PATTERNS = {
  correct: {
    visual: {
      color: '#22C55E',           // Green
      animation: 'pulse',
      duration: 300
    },
    audio: {
      type: 'chime',
      frequency: 880,             // A5
      duration: 150
    }
  },
  incorrect: {
    visual: {
      color: '#EF4444',           // Red
      animation: 'shake',
      duration: 400
    },
    audio: {
      type: 'buzz',
      frequency: 220,             // A3
      duration: 200
    },
    showCorrectAnswer: true,
    showExplanation: true
  },
  streak: {
    thresholds: [5, 10, 20, 50],
    messages: [
      "🔥 5 in a row!",
      "🔥🔥 10 streak! You're on fire!",
      "🔥🔥🔥 20 streak! Incredible!",
      "👑 50 streak! Legendary!"
    ]
  }
};
```

---

## 9. Exercise Catalog

### 9.1 Complete Exercise List

| Category | Exercise | Difficulty | Audio | Fretboard | SRS |
|----------|----------|------------|-------|-----------|-----|
| **Ear Training** | | | | | |
| | Note Recognition | Beginner | ✅ Play | ✅ Click | ✅ |
| | Interval (Melodic) | Beginner | ✅ Play | ○ Optional | ✅ |
| | Interval (Harmonic) | Intermediate | ✅ Play | ○ Optional | ✅ |
| | Chord Quality (Triads) | Beginner | ✅ Play | ○ Optional | ✅ |
| | Chord Quality (7ths) | Intermediate | ✅ Play | ○ Optional | ✅ |
| | Scale Degrees (Functional) | Intermediate | ✅ Drone | ✅ Click | ✅ |
| | Chord Progressions | Advanced | ✅ Play | ○ Display | ✅ |
| | Mini Dictation (5 notes) | Advanced | ✅ Play | ✅ Input | ✅ |
| **Music Theory** | | | | | |
| | Circle of Fifths - Keys | Beginner | ○ Optional | ✅ Display | ✅ |
| | Circle of Fifths - Relatives | Intermediate | ○ Optional | ✅ Display | ✅ |
| | Diatonic Chords - Identify | Intermediate | ✅ Play | ✅ Build | ✅ |
| | Diatonic Chords - Build | Intermediate | ✅ Play | ✅ Click | ✅ |
| | Interval Navigator | Beginner | ✅ Play | ✅ Click | ✅ |
| | Warp Hunter (G-B) | Intermediate | ✅ Play | ✅ Click | ✅ |
| | Scale Visualization | Beginner | ✅ Play | ✅ Display | ○ |
| | CAGED Shapes | Intermediate | ✅ Play | ✅ Display | ✅ |

### 9.2 Difficulty Progression

**Beginner Tier:**
- P8, P5, P4 intervals only
- Major vs Minor chords only
- Notes within 0-5 frets
- 3-note dictations
- Circle of Fifths: key signatures only

**Intermediate Tier:**
- All simple intervals
- Add dim, aug, sus chords
- Add 7th chords
- Full fretboard (0-12)
- 5-note dictations
- Functional: all 7 degrees
- G-B string "warp" exercises

**Advanced Tier:**
- Compound intervals
- Extended chords (9, 11, 13)
- Chord progressions
- Full fretboard + positions
- 7+ note dictations
- Mode identification
- Chromatic alterations

---

## 10. Implementation Checklist

### Phase 1: Audio Foundation & Core Ear Training (Weeks 1-4)

- [ ] **Week 1: Audio Engine**
  - [ ] Implement GuitarAudioEngine with Tone.js
  - [ ] Create acoustic profile presets
  - [ ] Implement per-string monophony
  - [ ] Add audio unlock button for autoplay policy

- [ ] **Week 2: Pitch Detection**
  - [ ] Implement PitchDetector with autocorrelation
  - [ ] Add microphone permission handling
  - [ ] Create tolerance settings UI
  - [ ] Test with real guitar input

- [ ] **Week 3: Note Ear Training**
  - [ ] Build NoteEarTraining exercise class
  - [ ] Create exercise UI component
  - [ ] Integrate with fretboard for answer input
  - [ ] Add feedback system (visual + audio)

- [ ] **Week 4: Interval Recognition**
  - [ ] Build IntervalEarTraining exercise class
  - [ ] Implement melodic and harmonic modes
  - [ ] Create answer selection UI
  - [ ] Add song reference hints

### Phase 2: Music Theory Modules (Weeks 5-8)

- [ ] **Week 5: Fretboard Mapper**
  - [ ] Complete FretboardMapper class
  - [ ] Implement interval shape calculations
  - [ ] Add G-B warp compensation
  - [ ] Test with all tunings

- [ ] **Week 6: Circle of Fifths**
  - [ ] Build interactive SVG circle component
  - [ ] Implement key selection handlers
  - [ ] Add exercise modes (identify, relatives)
  - [ ] Connect to scale/chord display

- [ ] **Week 7: Diatonic Chords**
  - [ ] Create DiatonicChordExercise class
  - [ ] Build chord on fretboard UI
  - [ ] Implement degree identification exercises
  - [ ] Add audio playback for chords

- [ ] **Week 8: Interval Navigator**
  - [ ] Build WarpHunterExercise
  - [ ] Create interval shape visualization
  - [ ] Implement cross-string exercises
  - [ ] Add "Mind the Warp" feedback

### Phase 3: Advanced Ear Training (Weeks 9-12)

- [ ] **Week 9: Chord Quality Recognition**
  - [ ] Build ChordEarTraining class
  - [ ] Implement all chord quality data
  - [ ] Create block/arpeggio/strum playback
  - [ ] Add difficulty tiers

- [ ] **Week 10: Functional Ear Training**
  - [ ] Implement FunctionalEarTraining with drone
  - [ ] Create scale degree UI
  - [ ] Add solfege option
  - [ ] Test in multiple keys

- [ ] **Week 11: Chord Progressions**
  - [ ] Build ProgressionEarTraining class
  - [ ] Implement common progression database
  - [ ] Create drag-and-drop UI for ordering
  - [ ] Add genre categories

- [ ] **Week 12: Mini Dictation**
  - [ ] Build MiniDictation class
  - [ ] Create sequential input UI
  - [ ] Implement melody generation algorithm
  - [ ] Add replay and playback controls

### Phase 4: Integration & Gamification (Weeks 13-16)

- [ ] **Week 13: Spaced Repetition**
  - [ ] Implement SpacedRepetitionEngine
  - [ ] Integrate with all exercises
  - [ ] Create due card selection logic
  - [ ] Add review scheduling UI

- [ ] **Week 14: Achievements & XP**
  - [ ] Define all achievements
  - [ ] Implement achievement checking
  - [ ] Create notification system
  - [ ] Build achievements display page

- [ ] **Week 15: Adaptive Difficulty**
  - [ ] Implement AdaptiveDifficulty class
  - [ ] Create weak area identification
  - [ ] Add automatic difficulty adjustment
  - [ ] Test with simulated user data

- [ ] **Week 16: Progress Dashboard**
  - [ ] Build ProgressDashboard class
  - [ ] Create statistics visualization
  - [ ] Implement heatmaps
  - [ ] Add export functionality

---

## Appendix A: Library CDN Links

```html
<!-- Tone.js -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/tone/15.0.4/Tone.min.js"></script>

<!-- Tonal.js -->
<script src="https://cdn.jsdelivr.net/npm/tonal/browser/tonal.min.js"></script>

<!-- Dexie.js -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/dexie/4.0.1/dexie.min.js"></script>
```

---

## Appendix B: Song References for Intervals

| Interval | Ascending | Descending |
|----------|-----------|------------|
| m2 | Jaws Theme | Für Elise |
| M2 | Happy Birthday | Mary Had a Little Lamb |
| m3 | Greensleeves | Hey Jude |
| M3 | When the Saints | Summertime |
| P4 | Here Comes the Bride | I've Been Working |
| TT | The Simpsons | Maria (West Side) |
| P5 | Star Wars | Flintstones |
| m6 | The Entertainer | Love Story |
| M6 | My Bonnie | Nobody Knows |
| m7 | Somewhere (West Side) | Watermelon Man |
| M7 | Take On Me | I Love You (Cole Porter) |
| P8 | Somewhere Over Rainbow | Willow Weep for Me |

---

*Document Version: 3.0*  
*Last Updated: January 31, 2026*  
*For: FretMemo.net Development Team*

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Phase 1: Audio Foundation & Core Ear Training](#2-phase-1-audio-foundation--core-ear-training-weeks-1-4)
3. [Phase 2: Music Theory Modules](#3-phase-2-music-theory-modules-weeks-5-8)
4. [Phase 3: Advanced Ear Training](#4-phase-3-advanced-ear-training-weeks-9-12)
5. [Phase 4: Integration & Gamification](#5-phase-4-integration--gamification-weeks-13-16)
6. [Technical Specifications](#6-technical-specifications)
7. [Data Models & Storage](#7-data-models--storage)
8. [UI/UX Design Specifications](#8-uiux-design-specifications)
9. [Exercise Catalog](#9-exercise-catalog)
10. [Implementation Checklist](#10-implementation-checklist)

---

## 1. Architecture Overview

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FretMemo Application Layer                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Guess Note │  │Play Practice│  │  Technique  │  │Theory & Ear │   │
│  │   (exists)  │  │  (exists)   │  │  (exists)   │  │   (NEW)     │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                          Shared Services Layer                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │   Audio Engine  │  │  Theory Engine  │  │ Fretboard Mapper│        │
│  │   (Tone.js)     │  │   (Tonal.js)    │  │  (Custom)       │        │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘        │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │ Pitch Detection │  │   SRS Engine    │  │ Progress Tracker│        │
│  │ (Autocorrelation)│ │    (SM-2)       │  │  (IndexedDB)    │        │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘        │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                          Storage Layer                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐     │
│  │      localStorage           │  │        IndexedDB            │     │
│  │  • Settings                 │  │  • Exercise History         │     │
│  │  • Streak Data              │  │  • SRS Card Data            │     │
│  │  • Achievements             │  │  • Position Statistics      │     │
│  │  • XP/Level                 │  │  • Audio Recordings         │     │
│  └─────────────────────────────┘  └─────────────────────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Library Dependencies

| Library | Version | Purpose | Size | CDN Available |
|---------|---------|---------|------|---------------|
| Tone.js | 15.0+ | Audio synthesis, scheduling | ~150KB | ✅ cdnjs |
| Tonal.js | 5.0+ | Music theory calculations | ~6KB gzip | ✅ cdnjs |
| PitchDetect | Custom | Microphone pitch detection | ~5KB | Self-host |
| Dexie.js | 4.0+ | IndexedDB wrapper | ~20KB | ✅ cdnjs |

### 1.3 Guitar-Specific Considerations

The guitar presents unique challenges for ear training:

1. **Non-linear interval layout**: The G-B string "warp" (Major 3rd vs Perfect 4th elsewhere)
2. **Isomorphic redundancy**: Same pitch exists at multiple fretboard locations
3. **Timbral variation**: Same note sounds different on different strings/positions
4. **Polyphonic complexity**: Chord voicings vs single notes

---

## 2. Phase 1: Audio Foundation & Core Ear Training (Weeks 1-4)

### 2.1 Audio Engine Implementation

**Goal:** Create a robust, guitar-realistic audio synthesis system.

#### 2.1.1 PluckSynth Configuration Profiles

```javascript
const ACOUSTIC_PROFILES = {
  analytical: {
    dampening: 5000,
    resonance: 0.96,
    attackNoise: 0.8,
    description: "High clarity for interval identification"
  },
  rhythmic: {
    dampening: 2500,
    resonance: 0.30,
    attackNoise: 1.8,
    description: "Short decay for technique drills"
  },
  jazzWarm: {
    dampening: 2000,
    resonance: 0.90,
    attackNoise: 0.4,
    description: "Warm tone for chord identification"
  },
  nylonSoft: {
    dampening: 1500,
    resonance: 0.94,
    attackNoise: 0.2,
    description: "Fingerstyle for triad exercises"
  }
};
```

#### 2.1.2 Per-String Monophony Architecture

```javascript
class GuitarAudioEngine {
  constructor() {
    this.strings = [];
    this.context = null;
  }

  async initialize() {
    await Tone.start();
    // Create 6 independent PluckSynth instances
    for (let i = 0; i < 6; i++) {
      this.strings[i] = new Tone.PluckSynth({
        attackNoise: ACOUSTIC_PROFILES.analytical.attackNoise,
        dampening: ACOUSTIC_PROFILES.analytical.dampening,
        resonance: ACOUSTIC_PROFILES.analytical.resonance
      }).toDestination();
    }
  }

  playNote(stringIndex, note, duration = "4n") {
    // Enforce per-string monophony
    this.strings[stringIndex].triggerRelease();
    this.strings[stringIndex].triggerAttackRelease(note, duration);
  }

  playChord(notes, stringIndices, style = "strum") {
    if (style === "strum") {
      notes.forEach((note, i) => {
        Tone.Transport.scheduleOnce((time) => {
          this.playNote(stringIndices[i], note);
        }, `+${i * 0.03}`); // 30ms strum delay
      });
    } else {
      notes.forEach((note, i) => {
        this.playNote(stringIndices[i], note);
      });
    }
  }

  setProfile(profileName) {
    const profile = ACOUSTIC_PROFILES[profileName];
    this.strings.forEach(synth => {
      synth.dampening.value = profile.dampening;
      synth.resonance = profile.resonance;
      synth.attackNoise = profile.attackNoise;
    });
  }
}
```

#### 2.1.3 Audio Context Autoplay Handling

```javascript
// Required: User gesture to unlock audio
async function initializeAudio() {
  const button = document.getElementById('unlock-audio-btn');
  
  button.addEventListener('click', async () => {
    if (Tone.context.state !== 'running') {
      await Tone.start();
      console.log('Audio context started');
    }
    button.style.display = 'none';
  }, { once: true });
}
```

### 2.2 Note Ear Training Module

**Exercise:** Sound → Fretboard

**Description:** The app plays a tone; user clicks the matching position on the fretboard.

#### 2.2.1 Exercise Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. App generates random note within user's focus area          │
│  2. App plays note using PluckSynth                            │
│  3. User clicks position on fretboard                          │
│  4. System validates (accepts ANY position with correct pitch) │
│  5. Feedback: Show all valid positions, play correct/incorrect │
│  6. Update SRS data for that pitch class                       │
│  7. Award XP, update statistics                                │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.2.2 Implementation

```javascript
class NoteEarTraining {
  constructor(audioEngine, fretboardMapper, settings) {
    this.audio = audioEngine;
    this.mapper = fretboardMapper;
    this.settings = settings;
    this.currentNote = null;
    this.currentPositions = [];
  }

  generateQuestion() {
    // Get available positions based on user settings
    const { minFret, maxFret, strings } = this.settings.focusArea;
    const availablePositions = this.mapper.getPositionsInRange(
      minFret, maxFret, strings
    );
    
    // Select random position
    const position = availablePositions[
      Math.floor(Math.random() * availablePositions.length)
    ];
    
    this.currentNote = this.mapper.getNoteAtPosition(position);
    this.currentPositions = this.mapper.getAllPositionsForNote(
      this.currentNote, minFret, maxFret
    );
    
    return this.currentNote;
  }

  playCurrentNote() {
    this.audio.setProfile('analytical');
    this.audio.playNote(0, this.currentNote, "2n");
  }

  checkAnswer(clickedPosition) {
    const clickedNote = this.mapper.getNoteAtPosition(clickedPosition);
    const isCorrect = Note.chroma(clickedNote) === Note.chroma(this.currentNote);
    
    return {
      correct: isCorrect,
      expectedNote: this.currentNote,
      playedNote: clickedNote,
      allValidPositions: this.currentPositions,
      clickedPosition: clickedPosition
    };
  }
}
```

### 2.3 Interval Recognition Module

**Exercise Types:**
1. **Melodic intervals**: Two notes played sequentially
2. **Harmonic intervals**: Two notes played simultaneously

#### 2.3.1 Interval Data Structure

```javascript
const INTERVALS = {
  simple: [
    { name: "m2", semitones: 1, label: "Minor 2nd", songRef: "Jaws Theme" },
    { name: "M2", semitones: 2, label: "Major 2nd", songRef: "Happy Birthday" },
    { name: "m3", semitones: 3, label: "Minor 3rd", songRef: "Hey Jude (descending)" },
    { name: "M3", semitones: 4, label: "Major 3rd", songRef: "When the Saints" },
    { name: "P4", semitones: 5, label: "Perfect 4th", songRef: "Here Comes the Bride" },
    { name: "TT", semitones: 6, label: "Tritone", songRef: "The Simpsons" },
    { name: "P5", semitones: 7, label: "Perfect 5th", songRef: "Star Wars" },
    { name: "m6", semitones: 8, label: "Minor 6th", songRef: "The Entertainer" },
    { name: "M6", semitones: 9, label: "Major 6th", songRef: "My Bonnie" },
    { name: "m7", semitones: 10, label: "Minor 7th", songRef: "Somewhere (West Side)" },
    { name: "M7", semitones: 11, label: "Major 7th", songRef: "Take On Me" },
    { name: "P8", semitones: 12, label: "Octave", songRef: "Somewhere Over Rainbow" }
  ]
};

// Difficulty tiers
const INTERVAL_TIERS = {
  beginner: ["P8", "P5", "P4"],
  intermediate: ["M3", "m3", "M2", "m2"],
  advanced: ["M6", "m6", "M7", "m7", "TT"]
};
```

#### 2.3.2 Interval Exercise Implementation

```javascript
class IntervalEarTraining {
  constructor(audioEngine, settings) {
    this.audio = audioEngine;
    this.settings = settings;
    this.currentInterval = null;
    this.rootNote = null;
  }

  generateQuestion(mode = 'melodic') {
    // Select interval based on difficulty
    const tier = this.settings.difficulty;
    const availableIntervals = INTERVAL_TIERS[tier];
    const intervalName = availableIntervals[
      Math.floor(Math.random() * availableIntervals.length)
    ];
    
    this.currentInterval = INTERVALS.simple.find(i => i.name === intervalName);
    
    // Generate root note (randomize octave for variety)
    const rootPitchClass = ['C', 'D', 'E', 'F', 'G', 'A', 'B'][
      Math.floor(Math.random() * 7)
    ];
    const octave = Math.floor(Math.random() * 2) + 3; // 3 or 4
    this.rootNote = `${rootPitchClass}${octave}`;
    
    // Calculate target note
    this.targetNote = Note.transpose(this.rootNote, this.currentInterval.name);
    
    return {
      interval: this.currentInterval,
      root: this.rootNote,
      target: this.targetNote,
      mode: mode
    };
  }

  playInterval(mode = 'melodic') {
    this.audio.setProfile('analytical');
    
    if (mode === 'melodic') {
      this.audio.playNote(0, this.rootNote, "4n");
      Tone.Transport.scheduleOnce(() => {
        this.audio.playNote(0, this.targetNote, "4n");
      }, "+0.6");
    } else {
      // Harmonic - play simultaneously
      this.audio.playNote(0, this.rootNote, "2n");
      this.audio.playNote(1, this.targetNote, "2n");
    }
  }

  checkAnswer(selectedInterval) {
    return {
      correct: selectedInterval === this.currentInterval.name,
      expected: this.currentInterval,
      songReference: this.currentInterval.songRef
    };
  }
}
```

### 2.4 Pitch Detection System (Microphone Input)

**Purpose:** Allow users to play guitar and have the app verify the note.

#### 2.4.1 Autocorrelation Pitch Detection

```javascript
class PitchDetector {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.buffer = null;
    this.isListening = false;
  }

  async initialize() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);
      
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);
      
      this.buffer = new Float32Array(2048);
      return true;
    } catch (error) {
      console.error("Microphone access denied:", error);
      return false;
    }
  }

  detectPitch() {
    this.analyser.getFloatTimeDomainData(this.buffer);
    return this.autoCorrelate(this.buffer, this.audioContext.sampleRate);
  }

  autoCorrelate(buffer, sampleRate) {
    // Find RMS to check if there's enough signal
    let rms = 0;
    for (let i = 0; i < buffer.length; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / buffer.length);
    
    if (rms < 0.01) return -1; // Not enough signal

    // Autocorrelation
    let correlations = new Array(buffer.length).fill(0);
    for (let lag = 0; lag < buffer.length; lag++) {
      for (let i = 0; i < buffer.length - lag; i++) {
        correlations[lag] += buffer[i] * buffer[i + lag];
      }
    }

    // Find best correlation peak
    let maxCorrelation = 0;
    let bestLag = -1;
    
    // Start looking after first zero crossing
    let foundFirstPositive = false;
    for (let lag = 0; lag < buffer.length; lag++) {
      if (!foundFirstPositive && correlations[lag] > 0) {
        foundFirstPositive = true;
      }
      if (foundFirstPositive && correlations[lag] > maxCorrelation) {
        maxCorrelation = correlations[lag];
        bestLag = lag;
      }
    }

    if (bestLag === -1) return -1;
    
    return sampleRate / bestLag;
  }

  frequencyToNote(frequency) {
    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    const roundedNote = Math.round(noteNum) + 69;
    const noteName = Note.fromMidi(roundedNote);
    const cents = Math.round((noteNum - Math.round(noteNum)) * 100);
    
    return { note: noteName, cents: cents, frequency: frequency };
  }

  startListening(callback, interval = 100) {
    this.isListening = true;
    this.listenLoop(callback, interval);
  }

  listenLoop(callback, interval) {
    if (!this.isListening) return;
    
    const frequency = this.detectPitch();
    if (frequency > 0) {
      const noteInfo = this.frequencyToNote(frequency);
      callback(noteInfo);
    }
    
    setTimeout(() => this.listenLoop(callback, interval), interval);
  }

  stopListening() {
    this.isListening = false;
  }
}
```

#### 2.4.2 Tolerance Settings

```javascript
const PITCH_TOLERANCE = {
  beginner: 35,    // ±35 cents
  intermediate: 20, // ±20 cents
  advanced: 10,    // ±10 cents
  professional: 5  // ±5 cents
};
```

---

## 3. Phase 2: Music Theory Modules (Weeks 5-8)

### 3.1 Interactive Circle of Fifths

**Purpose:** Visual tool for understanding key relationships, key signatures, and harmonic proximity.

#### 3.1.1 Data Structure

```javascript
const CIRCLE_OF_FIFTHS = {
  major: [
    { key: "C", sharps: 0, flats: 0, position: 0 },
    { key: "G", sharps: 1, flats: 0, position: 1 },
    { key: "D", sharps: 2, flats: 0, position: 2 },
    { key: "A", sharps: 3, flats: 0, position: 3 },
    { key: "E", sharps: 4, flats: 0, position: 4 },
    { key: "B", sharps: 5, flats: 0, position: 5 },
    { key: "F#/Gb", sharps: 6, flats: 6, position: 6 },
    { key: "Db", sharps: 0, flats: 5, position: 7 },
    { key: "Ab", sharps: 0, flats: 4, position: 8 },
    { key: "Eb", sharps: 0, flats: 3, position: 9 },
    { key: "Bb", sharps: 0, flats: 2, position: 10 },
    { key: "F", sharps: 0, flats: 1, position: 11 }
  ],
  minor: [
    { key: "Am", relative: "C", position: 0 },
    { key: "Em", relative: "G", position: 1 },
    { key: "Bm", relative: "D", position: 2 },
    { key: "F#m", relative: "A", position: 3 },
    { key: "C#m", relative: "E", position: 4 },
    { key: "G#m", relative: "B", position: 5 },
    { key: "D#m/Ebm", relative: "F#/Gb", position: 6 },
    { key: "Bbm", relative: "Db", position: 7 },
    { key: "Fm", relative: "Ab", position: 8 },
    { key: "Cm", relative: "Eb", position: 9 },
    { key: "Gm", relative: "Bb", position: 10 },
    { key: "Dm", relative: "F", position: 11 }
  ]
};
```

#### 3.1.2 Exercise Modes

```javascript
const CIRCLE_EXERCISES = {
  keySignature: {
    prompt: "Which key has {n} sharps?",
    type: "selection",
    generate: () => {
      const sharps = Math.floor(Math.random() * 7);
      const answer = CIRCLE_OF_FIFTHS.major.find(k => k.sharps === sharps);
      return { question: sharps, answer: answer.key };
    }
  },
  relativeMinor: {
    prompt: "What is the relative minor of {key}?",
    type: "selection",
    generate: () => {
      const major = CIRCLE_OF_FIFTHS.major[Math.floor(Math.random() * 12)];
      const minor = CIRCLE_OF_FIFTHS.minor.find(m => m.relative === major.key);
      return { question: major.key, answer: minor.key };
    }
  },
  harmonicProximity: {
    prompt: "Which key is one fifth away from {key}?",
    type: "selection",
    generate: () => {
      const current = Math.floor(Math.random() * 12);
      const direction = Math.random() > 0.5 ? 1 : -1; // clockwise or counter
      const next = (current + direction + 12) % 12;
      return {
        question: CIRCLE_OF_FIFTHS.major[current].key,
        answer: CIRCLE_OF_FIFTHS.major[next].key
      };
    }
  }
};
```

### 3.2 Diatonic Chord Harmonization

**Purpose:** Understand which chords naturally occur in each key.

#### 3.2.1 Diatonic Chord Data

```javascript
const DIATONIC_PATTERNS = {
  major: {
    degrees: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
    qualities: ["maj", "min", "min", "maj", "maj", "min", "dim"],
    seventh: ["maj7", "min7", "min7", "maj7", "7", "min7", "m7b5"]
  },
  naturalMinor: {
    degrees: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
    qualities: ["min", "dim", "maj", "min", "min", "maj", "maj"],
    seventh: ["min7", "m7b5", "maj7", "min7", "min7", "maj7", "7"]
  },
  harmonicMinor: {
    degrees: ["i", "ii°", "III+", "iv", "V", "VI", "vii°"],
    qualities: ["min", "dim", "aug", "min", "maj", "maj", "dim"],
    seventh: ["minMaj7", "m7b5", "maj7#5", "min7", "7", "maj7", "dim7"]
  }
};

function getDiatonicChords(key, mode = 'major') {
  const scale = Scale.get(`${key} ${mode}`);
  const pattern = DIATONIC_PATTERNS[mode];
  
  return scale.notes.map((note, i) => ({
    root: note,
    degree: pattern.degrees[i],
    quality: pattern.qualities[i],
    chordSymbol: `${note}${pattern.qualities[i] === 'maj' ? '' : pattern.qualities[i]}`,
    seventh: `${note}${pattern.seventh[i]}`,
    notes: Chord.get(`${note} ${pattern.qualities[i]}`).notes
  }));
}
```

#### 3.2.2 Exercise Implementation

```javascript
class DiatonicChordExercise {
  constructor(audioEngine, fretboardMapper) {
    this.audio = audioEngine;
    this.mapper = fretboardMapper;
  }

  generateQuestion(key, exerciseType) {
    const chords = getDiatonicChords(key);
    
    switch (exerciseType) {
      case 'identifyDegree':
        // "In G major, what is the chord on the ii degree?"
        const degree = Math.floor(Math.random() * 7);
        return {
          prompt: `In ${key} major, build the chord on degree ${chords[degree].degree}`,
          answer: chords[degree],
          type: 'build'
        };
        
      case 'identifyQuality':
        // "In G major, what quality is the chord on degree V?"
        const deg = Math.floor(Math.random() * 7);
        return {
          prompt: `In ${key} major, what is the quality of the ${chords[deg].degree} chord?`,
          answer: chords[deg].quality,
          options: ['maj', 'min', 'dim', 'aug'],
          type: 'select'
        };
        
      case 'nameChord':
        // Show notes on fretboard, user names the chord
        const chord = chords[Math.floor(Math.random() * 7)];
        return {
          prompt: "Name this chord",
          displayNotes: chord.notes,
          answer: chord.chordSymbol,
          type: 'input'
        };
    }
  }

  playChord(chordData) {
    this.audio.setProfile('jazzWarm');
    // Find a playable voicing
    const voicing = this.mapper.findChordVoicing(chordData.notes);
    this.audio.playChord(voicing.notes, voicing.strings, 'strum');
  }
}
```

### 3.3 Interval Navigator (Fretboard Geometry)

**Purpose:** Train recognition of interval shapes on the fretboard, including the G-B string "warp."

#### 3.3.1 Fretboard Interval Mapper

```javascript
class FretboardMapper {
  constructor(tuning = ['E', 'A', 'D', 'G', 'B', 'E']) {
    this.tuning = tuning;
    this.tuningMidi = tuning.map(note => Note.midi(`${note}2`) + (tuning.indexOf(note) * 5));
  }

  getNoteAtPosition(string, fret) {
    const openMidi = this.getOpenStringMidi(string);
    return Note.fromMidi(openMidi + fret);
  }

  getOpenStringMidi(string) {
    // Standard tuning MIDI values: E2, A2, D3, G3, B3, E4
    const standardMidi = [40, 45, 50, 55, 59, 64];
    return standardMidi[string];
  }

  getAllPositionsForNote(note, minFret = 0, maxFret = 12) {
    const targetChroma = Note.chroma(note);
    const positions = [];
    
    for (let string = 0; string < 6; string++) {
      for (let fret = minFret; fret <= maxFret; fret++) {
        const noteAtPos = this.getNoteAtPosition(string, fret);
        if (Note.chroma(noteAtPos) === targetChroma) {
          positions.push({ string, fret, note: noteAtPos });
        }
      }
    }
    
    return positions;
  }

  getIntervalShape(rootString, rootFret, interval) {
    const rootNote = this.getNoteAtPosition(rootString, rootFret);
    const targetNote = Note.transpose(rootNote, interval);
    
    // Find closest position on same or adjacent string
    const shapes = [];
    
    // Same string
    const semitones = Interval.semitones(interval);
    shapes.push({
      type: 'sameString',
      targetString: rootString,
      targetFret: rootFret + semitones
    });
    
    // Adjacent strings (accounting for G-B warp)
    for (let stringOffset of [-1, 1]) {
      const targetString = rootString + stringOffset;
      if (targetString < 0 || targetString > 5) continue;
      
      // Calculate fret offset considering tuning intervals
      let tuningInterval = 5; // Perfect 4th = 5 semitones
      if ((rootString === 2 && stringOffset === 1) || 
          (rootString === 3 && stringOffset === -1)) {
        tuningInterval = 4; // G to B is Major 3rd = 4 semitones
      }
      
      const fretOffset = semitones - (tuningInterval * stringOffset);
      shapes.push({
        type: stringOffset > 0 ? 'higherString' : 'lowerString',
        targetString: targetString,
        targetFret: rootFret + fretOffset,
        isWarpAffected: tuningInterval === 4
      });
    }
    
    return shapes.filter(s => s.targetFret >= 0 && s.targetFret <= 24);
  }
}
```

#### 3.3.2 "Warp Hunter" Exercise

```javascript
class WarpHunterExercise {
  constructor(fretboardMapper, audioEngine) {
    this.mapper = fretboardMapper;
    this.audio = audioEngine;
  }

  generateQuestion() {
    // Force questions that cross the G-B string boundary
    const rootString = Math.random() > 0.5 ? 2 : 3; // G or B string
    const rootFret = Math.floor(Math.random() * 8) + 3; // Frets 3-10
    
    const intervals = ['M3', 'P4', 'P5', 'm3'];
    const interval = intervals[Math.floor(Math.random() * intervals.length)];
    
    const shapes = this.mapper.getIntervalShape(rootString, rootFret, interval);
    const crossStringShape = shapes.find(s => s.type !== 'sameString');
    
    return {
      rootPosition: { string: rootString, fret: rootFret },
      interval: interval,
      correctPosition: crossStringShape,
      isWarpAffected: crossStringShape?.isWarpAffected || false
    };
  }

  checkAnswer(clickedPosition, question) {
    const isCorrect = 
      clickedPosition.string === question.correctPosition.targetString &&
      clickedPosition.fret === question.correctPosition.targetFret;
    
    // Check if user made the "standard" mistake
    let feedback = '';
    if (!isCorrect && question.isWarpAffected) {
      const standardFret = question.correctPosition.targetFret + 
        (question.correctPosition.targetString < question.rootPosition.string ? -1 : 1);
      
      if (clickedPosition.fret === standardFret) {
        feedback = "Mind the Warp! The G-B string interval is a Major 3rd, not a Perfect 4th.";
      }
    }
    
    return { correct: isCorrect, feedback };
  }
}
```

### 3.4 Scale Visualization & Training

#### 3.4.1 Scale Data with CAGED Positions

```javascript
const SCALE_PATTERNS = {
  major: {
    formula: [0, 2, 4, 5, 7, 9, 11],
    modes: ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'],
    cagedPositions: {
      C: { startFret: 0, pattern: [[0,3], [0,2,3], [0,2], [0,2], [0,3], [0,3]] },
      A: { startFret: 2, pattern: [[0,2], [0,2,4], [1,2,4], [1,2,4], [0,2], [0,2]] },
      G: { startFret: 4, pattern: [[1,4], [1,2,4], [1,3,4], [1,3], [1,4], [1,4]] },
      E: { startFret: 7, pattern: [[0,2,4], [0,2,4], [1,2,4], [1,4], [0,2,4], [0,2,4]] },
      D: { startFret: 9, pattern: [[0,2], [0,2], [0,2,4], [0,2,4], [0,2,3], [0,2]] }
    }
  },
  minorPentatonic: {
    formula: [0, 3, 5, 7, 10],
    boxes: {
      box1: { relativeStart: 0, pattern: [[0,3], [0,3], [0,2], [0,2], [0,3], [0,3]] },
      box2: { relativeStart: 3, pattern: [[0,2], [0,2], [0,2], [0,2], [0,2], [0,2]] },
      box3: { relativeStart: 5, pattern: [[0,2], [0,2,4], [0,2], [0,2], [0,2], [0,2]] },
      box4: { relativeStart: 7, pattern: [[0,2], [0,2], [0,2], [0,2,4], [0,2], [0,2]] },
      box5: { relativeStart: 10, pattern: [[0,3], [0,2], [0,2], [0,2], [0,2], [0,3]] }
    }
  }
};

class ScaleVisualizer {
  getScalePositions(root, scaleType, position = 'full') {
    const scale = Scale.get(`${root} ${scaleType}`);
    const positions = [];
    
    for (let string = 0; string < 6; string++) {
      for (let fret = 0; fret <= 12; fret++) {
        const note = this.mapper.getNoteAtPosition(string, fret);
        if (scale.notes.includes(Note.pitchClass(note))) {
          const degree = scale.notes.indexOf(Note.pitchClass(note)) + 1;
          positions.push({
            string, fret, note,
            degree,
            isRoot: degree === 1,
            color: this.getDegreeColor(degree)
          });
        }
      }
    }
    
    return positions;
  }

  getDegreeColor(degree) {
    const colors = {
      1: '#EF4444', // Root - Red
      2: '#F97316', // 2nd - Orange
      3: '#3B82F6', // 3rd - Blue
      4: '#22C55E', // 4th - Green
      5: '#8B5CF6', // 5th - Purple
      6: '#EC4899', // 6th - Pink
      7: '#F59E0B'  // 7th - Amber
    };
    return colors[degree] || '#6B7280';
  }
}
```

---

## 4. Phase 3: Advanced Ear Training (Weeks 9-12)

### 4.1 Chord Quality Recognition

**Exercises:**
1. Major vs Minor triads
2. All triad qualities (maj/min/dim/aug)
3. Seventh chord qualities
4. Extended chords (9th, 11th, 13th)

#### 4.1.1 Implementation

```javascript
const CHORD_QUALITIES = {
  triads: {
    beginner: [
      { name: 'major', formula: [0, 4, 7], symbol: '' },
      { name: 'minor', formula: [0, 3, 7], symbol: 'm' }
    ],
    intermediate: [
      { name: 'diminished', formula: [0, 3, 6], symbol: 'dim' },
      { name: 'augmented', formula: [0, 4, 8], symbol: 'aug' },
      { name: 'sus2', formula: [0, 2, 7], symbol: 'sus2' },
      { name: 'sus4', formula: [0, 5, 7], symbol: 'sus4' }
    ]
  },
  sevenths: {
    intermediate: [
      { name: 'major7', formula: [0, 4, 7, 11], symbol: 'maj7' },
      { name: 'dominant7', formula: [0, 4, 7, 10], symbol: '7' },
      { name: 'minor7', formula: [0, 3, 7, 10], symbol: 'm7' }
    ],
    advanced: [
      { name: 'minorMajor7', formula: [0, 3, 7, 11], symbol: 'mMaj7' },
      { name: 'halfDiminished', formula: [0, 3, 6, 10], symbol: 'm7b5' },
      { name: 'diminished7', formula: [0, 3, 6, 9], symbol: 'dim7' }
    ]
  }
};

class ChordEarTraining {
  constructor(audioEngine) {
    this.audio = audioEngine;
  }

  generateQuestion(difficulty, chordType = 'triads') {
    const pool = [
      ...CHORD_QUALITIES[chordType].beginner || [],
      ...(difficulty !== 'beginner' ? CHORD_QUALITIES[chordType].intermediate || [] : []),
      ...(difficulty === 'advanced' ? CHORD_QUALITIES[chordType].advanced || [] : [])
    ];
    
    const quality = pool[Math.floor(Math.random() * pool.length)];
    const roots = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const root = roots[Math.floor(Math.random() * roots.length)];
    const octave = 3;
    
    const notes = quality.formula.map(semitones => 
      Note.transpose(`${root}${octave}`, Interval.fromSemitones(semitones))
    );
    
    return {
      quality: quality,
      root: root,
      notes: notes,
      symbol: `${root}${quality.symbol}`
    };
  }

  playChord(question, style = 'block') {
    this.audio.setProfile('jazzWarm');
    
    if (style === 'block') {
      question.notes.forEach((note, i) => {
        this.audio.playNote(i, note, "2n");
      });
    } else if (style === 'arpeggio') {
      question.notes.forEach((note, i) => {
        Tone.Transport.scheduleOnce(() => {
          this.audio.playNote(0, note, "8n");
        }, `+${i * 0.3}`);
      });
    }
  }
}
```

### 4.2 Functional Ear Training (Scale Degrees)

**The most valuable exercise for relative pitch development.**

#### 4.2.1 Drone-Based Degree Detection

```javascript
class FunctionalEarTraining {
  constructor(audioEngine) {
    this.audio = audioEngine;
    this.drone = null;
  }

  startDrone(root, mode = 'major') {
    // Create continuous tonic drone
    this.drone = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.5, decay: 0.1, sustain: 0.8, release: 1 }
    }).toDestination();
    
    this.drone.volume.value = -12; // Quiet background
    this.drone.triggerAttack(`${root}2`);
    
    this.currentKey = root;
    this.currentMode = mode;
  }

  stopDrone() {
    if (this.drone) {
      this.drone.triggerRelease();
      this.drone = null;
    }
  }

  generateQuestion() {
    const scale = Scale.get(`${this.currentKey} ${this.currentMode}`);
    const degreeIndex = Math.floor(Math.random() * scale.notes.length);
    const targetNote = scale.notes[degreeIndex];
    
    // Solfege names
    const solfege = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti'];
    const degreeNames = ['1', '2', '3', '4', '5', '6', '7'];
    
    return {
      note: `${targetNote}4`,
      degree: degreeIndex + 1,
      degreeName: degreeNames[degreeIndex],
      solfege: solfege[degreeIndex],
      scaleName: `${this.currentKey} ${this.currentMode}`
    };
  }

  playTargetNote(question) {
    this.audio.setProfile('analytical');
    this.audio.playNote(0, question.note, "2n");
  }

  checkAnswer(selectedDegree, question) {
    return {
      correct: selectedDegree === question.degree,
      expected: question,
      hint: `Scale degree ${question.degree} (${question.solfege}) in ${question.scaleName}`
    };
  }
}
```

### 4.3 Chord Progression Recognition

#### 4.3.1 Common Progressions Database

```javascript
const COMMON_PROGRESSIONS = {
  pop: [
    { name: "Pop Anthem", degrees: ["I", "V", "vi", "IV"], example: "Let It Be" },
    { name: "50s Doo-Wop", degrees: ["I", "vi", "IV", "V"], example: "Stand By Me" },
    { name: "Axis of Awesome", degrees: ["I", "V", "vi", "IV"], example: "No Woman No Cry" }
  ],
  rock: [
    { name: "Basic Rock", degrees: ["I", "IV", "V", "I"], example: "Johnny B. Goode" },
    { name: "Grunge", degrees: ["I", "IV", "I", "V"], example: "Smells Like Teen Spirit" }
  ],
  jazz: [
    { name: "ii-V-I", degrees: ["ii", "V", "I"], example: "Autumn Leaves" },
    { name: "Rhythm Changes A", degrees: ["I", "vi", "ii", "V"], example: "I Got Rhythm" },
    { name: "Minor ii-V-i", degrees: ["ii°", "V", "i"], example: "Solar" }
  ],
  blues: [
    { name: "12-Bar Blues", degrees: ["I", "I", "I", "I", "IV", "IV", "I", "I", "V", "IV", "I", "V"], example: "Sweet Home Chicago" }
  ]
};

class ProgressionEarTraining {
  generateQuestion(genre, key) {
    const pool = COMMON_PROGRESSIONS[genre] || COMMON_PROGRESSIONS.pop;
    const progression = pool[Math.floor(Math.random() * pool.length)];
    
    // Convert degrees to actual chords
    const diatonicChords = getDiatonicChords(key);
    const chords = progression.degrees.map(degree => {
      const degreeNum = this.romanToNumber(degree);
      return diatonicChords[degreeNum - 1];
    });
    
    return {
      progression: progression,
      key: key,
      chords: chords
    };
  }

  romanToNumber(roman) {
    const map = { 'I': 1, 'i': 1, 'II': 2, 'ii': 2, 'III': 3, 'iii': 3, 
                  'IV': 4, 'iv': 4, 'V': 5, 'v': 5, 'VI': 6, 'vi': 6, 
                  'VII': 7, 'vii': 7, 'ii°': 2, 'vii°': 7 };
    return map[roman.replace('°', '')] || 1;
  }

  playProgression(question) {
    this.audio.setProfile('jazzWarm');
    
    question.chords.forEach((chord, i) => {
      Tone.Transport.scheduleOnce(() => {
        // Play chord voicing
        const notes = chord.notes.map((n, j) => `${n}${3 + Math.floor(j / 3)}`);
        notes.forEach((note, j) => {
          this.audio.playNote(j, note, "2n");
        });
      }, `+${i * 1.5}`); // 1.5 seconds per chord
    });
  }
}
```

### 4.4 Melodic Dictation (Mini)

```javascript
class MiniDictation {
  constructor(audioEngine, fretboardMapper) {
    this.audio = audioEngine;
    this.mapper = fretboardMapper;
  }

  generateMelody(key, length = 5, difficulty = 'beginner') {
    const scale = Scale.get(`${key} major`);
    const melody = [];
    let currentDegree = 0; // Start on tonic
    
    for (let i = 0; i < length; i++) {
      // Constrain movement based on difficulty
      const maxJump = difficulty === 'beginner' ? 2 : 
                      difficulty === 'intermediate' ? 4 : 7;
      
      const movement = Math.floor(Math.random() * (maxJump * 2 + 1)) - maxJump;
      currentDegree = Math.max(0, Math.min(6, currentDegree + movement));
      
      melody.push({
        note: `${scale.notes[currentDegree]}4`,
        degree: currentDegree + 1,
        index: i
      });
    }
    
    return melody;
  }

  playMelody(melody) {
    this.audio.setProfile('analytical');
    
    melody.forEach((note, i) => {
      Tone.Transport.scheduleOnce(() => {
        this.audio.playNote(0, note.note, "4n");
      }, `+${i * 0.6}`);
    });
  }

  checkAnswer(userInput, melody) {
    const results = melody.map((note, i) => ({
      expected: note,
      provided: userInput[i],
      correct: userInput[i] && Note.chroma(userInput[i]) === Note.chroma(note.note)
    }));
    
    return {
      results: results,
      score: results.filter(r => r.correct).length,
      total: melody.length
    };
  }
}
```

---

## 5. Phase 4: Integration & Gamification (Weeks 13-16)

### 5.1 Spaced Repetition System (SM-2)

```javascript
class SpacedRepetitionEngine {
  constructor(storage) {
    this.storage = storage; // IndexedDB wrapper
  }

  async getCard(cardId) {
    return await this.storage.get('srsCards', cardId) || {
      id: cardId,
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReviewDate: new Date().toISOString().split('T')[0]
    };
  }

  calculateNextReview(card, quality) {
    // quality: 0-5 (0-2 = fail, 3-5 = success with varying difficulty)
    let { easeFactor, interval, repetitions } = card;
    
    if (quality < 3) {
      // Failed - reset
      repetitions = 0;
      interval = 1;
    } else {
      // Success
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
      
      // Adjust ease factor
      easeFactor = Math.max(1.3, 
        easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
      );
    }
    
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    
    return {
      ...card,
      easeFactor,
      interval,
      repetitions,
      nextReviewDate: nextDate.toISOString().split('T')[0],
      lastReviewDate: new Date().toISOString().split('T')[0]
    };
  }

  async saveCard(card) {
    await this.storage.put('srsCards', card);
  }

  async getDueCards(exerciseType) {
    const today = new Date().toISOString().split('T')[0];
    const allCards = await this.storage.getAllByIndex('srsCards', 'exerciseType', exerciseType);
    return allCards.filter(card => card.nextReviewDate <= today);
  }

  qualityFromResult(correct, responseTimeMs, difficulty) {
    if (!correct) {
      return responseTimeMs < 3000 ? 1 : 0; // Quick wrong = 1, slow wrong = 0
    }
    
    // Correct answers: 3-5 based on speed and difficulty
    const baseQuality = 3;
    const speedBonus = responseTimeMs < 2000 ? 1 : responseTimeMs < 4000 ? 0.5 : 0;
    const difficultyBonus = difficulty === 'hard' ? 0.5 : difficulty === 'easy' ? -0.5 : 0;
    
    return Math.min(5, Math.max(3, baseQuality + speedBonus + difficultyBonus));
  }
}
```

### 5.2 Achievement System for Theory & Ear Training

```javascript
const THEORY_EAR_ACHIEVEMENTS = [
  // Ear Training Milestones
  { id: 'first_interval', name: 'Interval Initiate', desc: 'Identify your first interval', condition: stats => stats.intervals.total >= 1 },
  { id: 'interval_10', name: 'Interval Explorer', desc: 'Identify 10 intervals correctly', condition: stats => stats.intervals.correct >= 10 },
  { id: 'interval_100', name: 'Interval Master', desc: 'Identify 100 intervals correctly', condition: stats => stats.intervals.correct >= 100 },
  { id: 'perfect_intervals', name: 'Perfect Pitch Detective', desc: '90%+ accuracy on P4, P5, P8', condition: stats => stats.intervals.perfectAccuracy >= 0.9 },
  
  // Chord Recognition
  { id: 'chord_quality_10', name: 'Chord Curious', desc: 'Identify 10 chord qualities', condition: stats => stats.chords.total >= 10 },
  { id: 'seventh_master', name: 'Seventh Heaven', desc: '80%+ accuracy on 7th chords', condition: stats => stats.chords.seventhAccuracy >= 0.8 },
  
  // Functional Ear Training
  { id: 'functional_start', name: 'Function Junction', desc: 'Complete 10 scale degree exercises', condition: stats => stats.functional.total >= 10 },
  { id: 'tonic_master', name: 'Home Sweet Home', desc: '95%+ accuracy identifying the tonic', condition: stats => stats.functional.tonicAccuracy >= 0.95 },
  
  // Theory
  { id: 'circle_explorer', name: 'Circle Navigator', desc: 'Complete all Circle of Fifths exercises', condition: stats => stats.circleOfFifths.completed },
  { id: 'diatonic_master', name: 'Diatonic Devotee', desc: 'Build all diatonic chords in 6 keys', condition: stats => stats.diatonic.keysCompleted >= 6 },
  
  // Speed Records
  { id: 'speed_demon_ear', name: 'Supersonic Ears', desc: '20 correct intervals in 60 seconds', condition: stats => stats.speedRecords.intervals20in60 },
  
  // Streaks
  { id: 'ear_streak_7', name: 'Ear Workout Week', desc: '7-day ear training streak', condition: stats => stats.earStreak >= 7 },
  { id: 'ear_streak_30', name: 'Ear Training Devotee', desc: '30-day ear training streak', condition: stats => stats.earStreak >= 30 }
];
```

### 5.3 Adaptive Difficulty System

```javascript
class AdaptiveDifficulty {
  constructor(storage) {
    this.storage = storage;
    this.sessionHistory = [];
  }

  async getRecommendedDifficulty(exerciseType) {
    const recentResults = await this.storage.getRecentResults(exerciseType, 20);
    
    if (recentResults.length < 5) {
      return 'beginner'; // Not enough data
    }
    
    const accuracy = recentResults.filter(r => r.correct).length / recentResults.length;
    const avgTime = recentResults.reduce((sum, r) => sum + r.responseTimeMs, 0) / recentResults.length;
    
    // Decision matrix
    if (accuracy > 0.85 && avgTime < 3000) {
      return this.increaseeDifficulty(exerciseType);
    } else if (accuracy < 0.6) {
      return this.decreaseDifficulty(exerciseType);
    }
    
    return await this.getCurrentDifficulty(exerciseType);
  }

  async adjustExerciseParameters(exerciseType, currentDifficulty) {
    // Identify weak areas
    const weakAreas = await this.identifyWeakAreas(exerciseType);
    
    return {
      difficulty: currentDifficulty,
      focus: weakAreas.slice(0, 3), // Top 3 weak areas
      excludeStrong: weakAreas.length > 0, // Don't waste time on mastered items
      tempo: this.recommendTempo(currentDifficulty)
    };
  }

  async identifyWeakAreas(exerciseType) {
    const allResults = await this.storage.getAllResults(exerciseType);
    const itemStats = {};
    
    allResults.forEach(result => {
      const key = result.itemId; // e.g., "interval_m3" or "chord_dim"
      if (!itemStats[key]) {
        itemStats[key] = { correct: 0, total: 0 };
      }
      itemStats[key].total++;
      if (result.correct) itemStats[key].correct++;
    });
    
    // Sort by accuracy (ascending = weakest first)
    return Object.entries(itemStats)
      .map(([key, stats]) => ({
        item: key,
        accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
        attempts: stats.total
      }))
      .filter(item => item.attempts >= 3) // Need minimum data
      .sort((a, b) => a.accuracy - b.accuracy);
  }
}
```

### 5.4 Progress Dashboard

```javascript
class ProgressDashboard {
  constructor(storage) {
    this.storage = storage;
  }

  async getOverviewStats() {
    return {
      earTraining: {
        intervals: await this.getExerciseStats('intervals'),
        chords: await this.getExerciseStats('chords'),
        functional: await this.getExerciseStats('functional'),
        dictation: await this.getExerciseStats('dictation')
      },
      theory: {
        circleOfFifths: await this.getExerciseStats('circleOfFifths'),
        diatonic: await this.getExerciseStats('diatonic'),
        intervals: await this.getExerciseStats('intervalTheory'),
        scales: await this.getExerciseStats('scales')
      },
      streak: await this.storage.get('settings', 'streak'),
      totalXP: await this.storage.get('settings', 'xp'),
      achievements: await this.getUnlockedAchievements()
    };
  }

  async getExerciseStats(exerciseType) {
    const results = await this.storage.getAllResults(exerciseType);
    const last7Days = results.filter(r => 
      new Date(r.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    
    return {
      totalAttempts: results.length,
      totalCorrect: results.filter(r => r.correct).length,
      accuracy: results.length > 0 ? 
        results.filter(r => r.correct).length / results.length : 0,
      last7DaysAttempts: last7Days.length,
      last7DaysAccuracy: last7Days.length > 0 ?
        last7Days.filter(r => r.correct).length / last7Days.length : 0,
      averageResponseTime: results.length > 0 ?
        results.reduce((sum, r) => sum + r.responseTimeMs, 0) / results.length : 0,
      trend: this.calculateTrend(results)
    };
  }

  calculateTrend(results) {
    if (results.length < 10) return 'insufficient_data';
    
    const recent = results.slice(-10);
    const older = results.slice(-20, -10);
    
    const recentAccuracy = recent.filter(r => r.correct).length / recent.length;
    const olderAccuracy = older.filter(r => r.correct).length / older.length;
    
    const diff = recentAccuracy - olderAccuracy;
    if (diff > 0.1) return 'improving';
    if (diff < -0.1) return 'declining';
    return 'stable';
  }

  async generateHeatmap(exerciseType) {
    // For intervals: show accuracy per interval type
    // For notes: show accuracy per fretboard position
    const results = await this.storage.getAllResults(exerciseType);
    const heatmapData = {};
    
    results.forEach(result => {
      const key = result.itemId;
      if (!heatmapData[key]) {
        heatmapData[key] = { correct: 0, total: 0 };
      }
      heatmapData[key].total++;
      if (result.correct) heatmapData[key].correct++;
    });
    
    return Object.entries(heatmapData).map(([key, data]) => ({
      item: key,
      accuracy: data.correct / data.total,
      attempts: data.total,
      color: this.accuracyToColor(data.correct / data.total)
    }));
  }

  accuracyToColor(accuracy) {
    if (accuracy >= 0.85) return '#22C55E'; // Green
    if (accuracy >= 0.6) return '#EAB308';  // Yellow
    return '#EF4444'; // Red
  }
}
```

---