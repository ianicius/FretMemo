# FretMemo Technique Exercises Implementation Plan

## Executive Summary

This document outlines the implementation plan for expanding the "Technique" tab in FretMemo beyond the existing Spider Walk exercise. The goal is to transform FretMemo from a warm-up tool into a comprehensive technical development platform by adding exercises that complement and extend the Spider Walk's benefits.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Proposed Exercise Categories](#2-proposed-exercise-categories)
3. [Exercise Specifications](#3-exercise-specifications)
4. [Data Models](#4-data-models)
5. [UI/UX Requirements](#5-uiux-requirements)
6. [Feature Specifications](#6-feature-specifications)
7. [Implementation Phases](#7-implementation-phases)
8. [Technical Considerations](#8-technical-considerations)

---

## 1. Current State Analysis

### 1.1 Existing Spider Walk Features
- Start fret configuration
- Metronome integration (tempo, note duration, auto-acceleration)
- Visual fretboard display
- Left-handed mode support
- Dark mode support

### 1.2 Spider Walk Limitations (What New Exercises Must Address)
| Limitation | Description |
|------------|-------------|
| Sequential fingers only | Always plays 1-2-3-4, creating neural dependency |
| Adjacent strings only | No training for string skipping/targeting |
| Static hand position | No horizontal shifting along the neck |
| Pick-dependent | No legato/hammer-on training |
| Fixed 4-fret span | No wide interval stretching |
| Uniform rhythm | No metric variation training |

---

## 2. Proposed Exercise Categories

Organize the Technique tab into **6 categories** (including Spider Walk):

```
Technique Tab
├── 🕷️ Spider Walk (existing)
├── 🔀 Permutation Trainer (NEW)
├── ↗️ Diagonal Patterns (NEW)
├── ⏭️ String Skipping (NEW)
├── 🎸 Legato Builder (NEW)
└── ↔️ Linear Shifter (NEW)
```

### Category Overview Table

| Category | Primary Benefit | Complements Spider Walk By |
|----------|----------------|---------------------------|
| Spider Walk | Synchronization, adjacent string crossing | *Baseline exercise* |
| Permutation Trainer | Finger independence | Non-sequential finger movement |
| Diagonal Patterns | Shape shifting, economy picking | Moving "shapes" vs static "blocks" |
| String Skipping | Pick accuracy, targeting | Non-adjacent string movement |
| Legato Builder | Left hand strength, stamina | Removing pick dependency |
| Linear Shifter | Horizontal shifting, arm movement | Horizontal vs vertical motion |

---

## 3. Exercise Specifications

### 3.1 Permutation Trainer

**Purpose:** Train all 24 finger permutations to break neural dependencies and develop true finger independence.

#### 3.1.1 The 24 Permutations (organized by difficulty tier)

**Tier 1 - Beginner (Sequential)**
```
1-2-3-4  (Standard Spider)
4-3-2-1  (Reverse Spider)
```

**Tier 2 - Intermediate (Alternating Pairs)**
```
1-2-4-3    1-3-2-4    1-3-4-2    1-4-2-3    1-4-3-2
2-1-3-4    2-1-4-3    2-3-1-4    2-3-4-1    2-4-1-3    2-4-3-1
```

**Tier 3 - Advanced (Ring/Pinky Start - "Tendon Breakers")**
```
3-1-2-4    3-1-4-2    3-2-1-4    3-2-4-1    3-4-1-2    3-4-2-1
4-1-2-3    4-1-3-2    4-2-1-3    4-2-3-1    4-3-1-2
```

#### 3.1.2 Exercise Modes

| Mode | Description |
|------|-------------|
| **Single Permutation** | User selects one permutation to practice |
| **Daily Challenge** | App randomly selects a "Permutation of the Day" |
| **Sequential Trainer** | Cycles through all 24 permutations systematically |
| **Random Mode** | Randomly switches permutations every X bars |

#### 3.1.3 Settings

```javascript
permutationSettings = {
  selectedPermutation: [1,2,3,4],  // Array of finger numbers
  mode: 'single' | 'daily' | 'sequential' | 'random',
  tier: 1 | 2 | 3 | 'all',
  stringsToPlay: 6,  // 1-6
  startFret: 5,
  direction: 'ascending' | 'descending' | 'both',
  holdFingersDown: false  // Spider-style: keep fingers planted
}
```

---

### 3.2 Diagonal Patterns

**Purpose:** Train shape-shifting, economy picking, and dynamic hand positioning.

#### 3.2.1 Pattern Types

**Ascending Diagonal (Method 1)**
```
String 6 (E): Fret N   → Finger 1
String 5 (A): Fret N+1 → Finger 2
String 4 (D): Fret N+2 → Finger 3
String 3 (G): Fret N+3 → Finger 4
```
*Then shift: Index jumps to String 5, Fret N and repeat*

**Descending Diagonal (Method 2)**
```
String 3 (G): Fret N+3 → Finger 4
String 4 (D): Fret N+2 → Finger 3
String 5 (A): Fret N+1 → Finger 2
String 6 (E): Fret N   → Finger 1
```

**Full Diagonal Run**
- Combine ascending and descending across all 6 strings
- Shift position when reaching string boundaries

#### 3.2.2 Settings

```javascript
diagonalSettings = {
  pattern: 'ascending' | 'descending' | 'full',
  startFret: 3,
  stringsPerGroup: 4,  // How many strings before shifting
  pickingStyle: 'alternate' | 'economy',  // Suggest sweeping for economy
  showPickDirection: true
}
```

---

### 3.3 String Skipping

**Purpose:** Train pick accuracy and right-hand targeting for non-adjacent strings.

#### 3.3.1 Skip Patterns

| Pattern Name | String Sequence | Difficulty |
|--------------|-----------------|------------|
| Single Skip | 6-4-5-3-4-2-3-1 | Beginner |
| Octave Skip | 6-4, 5-3, 4-2, 3-1 | Intermediate |
| Double Skip | 6-3, 5-2, 4-1 | Intermediate |
| Wide Skip | 6-1, 5-2, 4-3 | Advanced |

#### 3.3.2 Inside vs Outside Picking Training

```
Outside Picking: Last note = Downstroke → First note on new string = Upstroke
Inside Picking:  Last note = Upstroke → First note on new string = Downstroke
```

#### 3.3.3 Settings

```javascript
stringSkipSettings = {
  skipPattern: 'single' | 'octave' | 'double' | 'wide' | 'custom',
  customPattern: [6,4,5,3],  // Custom string sequence
  fingerPattern: [1,2,3,4],  // Which fingers per string
  pickingFocus: 'alternate' | 'inside' | 'outside',
  startPickDirection: 'down' | 'up',
  showPickIndicators: true,
  startFret: 5
}
```

---

### 3.4 Legato Builder

**Purpose:** Develop left-hand strength, stamina, and tone production without pick dependency.

#### 3.4.1 Exercise Types

**Trill Exercises**
| Finger Pair | Frets (Example at Position 5) | Difficulty |
|-------------|-------------------------------|------------|
| 1-2 | 5-6 | Easy |
| 1-3 | 5-7 | Medium |
| 1-4 | 5-8 | Medium |
| 2-3 | 6-7 | Hard (shared tendon) |
| 2-4 | 6-8 | Medium |
| 3-4 | 7-8 | Hard (weak fingers) |

**Hammer-On Only Spider**
- Play 1-2-3-4 pattern but pick only the first note per string
- All subsequent notes are hammer-ons

**Pull-Off Descending**
- Descending 4-3-2-1 using only pull-offs after initial pick

**3-Note Legato Scale**
- Pick once, hammer-on twice per string (common rock/metal technique)

#### 3.4.2 Settings

```javascript
legatoSettings = {
  exerciseType: 'trill' | 'hammerOnly' | 'pullOnly' | 'threeNote',
  trillPair: [1,2],  // For trill mode
  duration: 15,  // Seconds for trill endurance
  showHPIndicators: true,  // Show H/P symbols on tab
  targetVolume: 'even',  // Visual feedback goal
  startFret: 5
}
```

---

### 3.5 Linear Shifter (Caterpillar)

**Purpose:** Train horizontal movement, position shifting, and arm coordination.

#### 3.5.1 Exercise Types

**Single String Chromatic**
```
Play 1-2-3-4 on frets 1-2-3-4 → Shift → Play 1-2-3-4 on frets 2-3-4-5 → Continue to fret 12+
```

**Grouped Shifting (Petrucci Style)**
- Play groups of 5 or 6 notes before shifting
- Creates rhythmic displacement for advanced training

**Round Trip**
- Ascend from fret 1 to 12, then descend back

#### 3.5.2 Settings

```javascript
linearSettings = {
  string: 1,  // Which string (1-6)
  startFret: 1,
  endFret: 12,
  notesPerShift: 4,  // 4, 5, or 6 notes before shifting
  direction: 'ascending' | 'descending' | 'roundTrip',
  shiftAmount: 1,  // Frets to shift (usually 1)
  pickingStyle: 'alternate' | 'legato'
}
```

---

### 3.6 Bonus: Burst Mode (Cross-Exercise Feature)

**Purpose:** Train hand synchronization at speed by alternating slow and fast segments.

#### 3.6.1 Implementation

This is a **modifier** that can be applied to ANY exercise:

```javascript
burstModeSettings = {
  enabled: false,
  slowBeats: 4,      // Number of beats at slow tempo
  fastBeats: 2,      // Number of beats at fast tempo (2x speed)
  speedMultiplier: 2 // How much faster the burst is
}
```

**Visual Feedback:** Change metronome/background color during burst sections (Green = Slow, Red = Burst)

---

## 4. Data Models

### 4.1 Exercise Schema

```typescript
interface Exercise {
  id: string;
  name: string;
  category: 'spider' | 'permutation' | 'diagonal' | 'stringSkip' | 'legato' | 'linear';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  description: string;
  benefits: string[];
  settings: ExerciseSettings;
  defaultTempo: number;
}

interface ExerciseSettings {
  startFret: number;
  fingerPattern: number[];
  stringPattern?: number[];
  direction: 'ascending' | 'descending' | 'both';
  pickingStyle?: 'alternate' | 'economy' | 'legato';
  // ... category-specific settings
}
```

### 4.2 User Progress Schema

```typescript
interface UserProgress {
  odayId: string;
  completedExercises: string[];  // Exercise IDs
  permutationsCompleted: number[];  // Track 0-23
  totalPracticeTime: number;  // Minutes
  streakDays: number;
  personalBests: {
    exerciseId: string;
    maxTempo: number;
    date: Date;
  }[];
}
```

### 4.3 Daily Challenge Schema

```typescript
interface DailyChallenge {
  date: string;  // YYYY-MM-DD
  permutationIndex: number;  // 0-23
  featuredExercise: string;
  bonusChallenge?: string;
}
```

---

## 5. UI/UX Requirements

### 5.1 Technique Tab Redesign

```
┌─────────────────────────────────────────────────────┐
│ Technique                                           │
├─────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │ 🕷️ Spider   │ │ 🔀 Permute  │ │ ↗️ Diagonal │    │
│ │    Walk     │ │   Trainer   │ │  Patterns   │    │
│ └─────────────┘ └─────────────┘ └─────────────┘    │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │ ⏭️ String   │ │ 🎸 Legato   │ │ ↔️ Linear   │    │
│ │  Skipping   │ │  Builder    │ │  Shifter    │    │
│ └─────────────┘ └─────────────┘ └─────────────┘    │
├─────────────────────────────────────────────────────┤
│ 📅 Daily Challenge: Permutation 1-3-2-4            │
│ Progress: 12/24 permutations mastered              │
└─────────────────────────────────────────────────────┘
```

### 5.2 Exercise View Layout

```
┌─────────────────────────────────────────────────────┐
│ ← Back    Permutation Trainer         ⚙️ Settings  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Current Pattern: 1 → 3 → 2 → 4                    │
│  [1] [3] [2] [4]  ← Finger indicators (color-coded)│
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │         FRETBOARD VISUALIZATION               │ │
│  │  (highlight next note, show finger numbers)   │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │         TAB/NOTATION VIEW                     │ │
│  │  (scrolling tab with H/P indicators)          │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [▶️ Start]  60 BPM  [Burst Mode: OFF]             │
└─────────────────────────────────────────────────────┘
```

### 5.3 Visual Elements

#### Finger Color Coding
```css
--finger-1-index: #3B82F6;  /* Blue */
--finger-2-middle: #22C55E; /* Green */
--finger-3-ring: #EAB308;   /* Yellow */
--finger-4-pinky: #EF4444;  /* Red */
```

#### Pick Direction Indicators
- ↓ Downstroke
- ↑ Upstroke
- Display above/below notes in tab view

#### Legato Indicators
- **H** = Hammer-on
- **P** = Pull-off
- Display between notes in tab view

### 5.4 Settings Panel for Each Exercise

Each exercise category should have a collapsible settings panel:

```
⚙️ Exercise Settings
├── Start Fret: [5] ▲▼
├── Pattern: [1-3-2-4] [Random] [Daily]
├── Direction: (○ Ascending) (● Both) (○ Descending)
├── Strings: [All 6 ▼]
├── Show Pick Direction: [✓]
├── Hold Fingers Down: [ ]
└── Burst Mode: [ ] Enable
    ├── Slow beats: [4]
    └── Fast beats: [2]
```

---

## 6. Feature Specifications

### 6.1 Daily Challenge System

**Algorithm:**
```javascript
function getDailyPermutation(date) {
  // Deterministic random based on date
  const seed = dateToSeed(date);
  return permutations[seed % 24];
}
```

**Display:**
- Show on Technique tab landing
- Badge/notification if not completed today
- Track streak of consecutive days

### 6.2 Progress Tracking

**Metrics to Track:**
- Permutations completed (0-24)
- Exercises practiced per category
- Total practice time
- Max tempo achieved per exercise
- Streak days

**Display:**
- Progress bar for permutation completion
- Category completion percentages
- Personal best indicators

### 6.3 Step-Through Mode

For learning new exercises:
- Pause between each note
- User presses "Next" or spacebar to advance
- Highlights current and next note
- Shows finger number and pick direction

### 6.4 Metronome Integration

Extend existing metronome:
```javascript
metronomeSettings = {
  tempo: 60,
  noteDuration: 1,
  accentFirst: true,  // Accent first beat of group
  accentInterval: 4,  // Accent every N beats
  burstMode: {
    enabled: false,
    slowBeats: 4,
    fastMultiplier: 2
  }
}
```

### 6.5 Pre-Built Workouts (Future Feature)

Combine multiple exercises into routines:

```javascript
workouts = [
  {
    name: "5-Minute Wake Up",
    exercises: [
      { id: 'spider-walk', duration: 60 },
      { id: 'diagonal-ascending', duration: 120 },
      { id: 'linear-roundtrip', duration: 120 }
    ]
  },
  {
    name: "Finger Independence",
    exercises: [
      { id: 'permutation-tier2-random', duration: 180 },
      { id: 'string-skip-octave', duration: 180 },
      { id: 'legato-trill-23', duration: 120 }
    ]
  }
]
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Refactor Technique tab to support multiple exercise categories
- [ ] Create exercise selection UI (card grid)
- [ ] Implement shared settings components
- [ ] Add finger color-coding to fretboard visualization
- [ ] Create data models for exercises

### Phase 2: Permutation Trainer (Week 3-4)
- [ ] Implement all 24 permutations
- [ ] Build permutation selection UI (tier-based)
- [ ] Add "Daily Challenge" algorithm
- [ ] Create progress tracking for permutations (0/24)
- [ ] Add "Random" and "Sequential" modes

### Phase 3: Linear Shifter (Week 5)
- [ ] Implement single-string chromatic exercise
- [ ] Add horizontal scrolling tab visualization
- [ ] Implement round-trip mode
- [ ] Add grouped shifting (5-6 note groups)

### Phase 4: Diagonal Patterns (Week 6)
- [ ] Implement ascending/descending diagonal patterns
- [ ] Add economy picking suggestion
- [ ] Create visual showing diagonal movement across fretboard

### Phase 5: String Skipping (Week 7-8)
- [ ] Implement skip patterns (single, octave, double, wide)
- [ ] Add inside/outside picking indicators
- [ ] Create custom pattern builder
- [ ] Add visual string-skip animation

### Phase 6: Legato Builder (Week 9-10)
- [ ] Implement trill exercises (all 6 finger pairs)
- [ ] Add timer-based trill endurance mode
- [ ] Implement hammer-on only Spider variant
- [ ] Add H/P indicators to tab view

### Phase 7: Burst Mode & Polish (Week 11-12)
- [ ] Implement burst mode as cross-exercise feature
- [ ] Add visual tempo change indicators
- [ ] Implement pre-built workout system
- [ ] Add user progress dashboard
- [ ] Performance testing and optimization

---

## 8. Technical Considerations

### 8.1 Fretboard Generation Logic

Each exercise needs to generate a sequence of notes. Create a shared utility:

```javascript
function generateExerciseSequence(config) {
  const {
    fingerPattern,    // e.g., [1,3,2,4]
    stringPattern,    // e.g., [6,5,4,3,2,1] or [6,4,5,3]
    startFret,
    direction,
    repetitions
  } = config;
  
  // Returns array of { string, fret, finger, pickDirection }
  return sequence;
}
```

### 8.2 Tab Visualization

For exercises with horizontal movement (Linear Shifter), implement scrolling tab:
- Show 8-12 notes visible at once
- Auto-scroll as exercise progresses
- Highlight current note

### 8.3 Audio Feedback (Optional Enhancement)

If implementing audio playback:
- Use Web Audio API
- Generate tones for each note
- Consider using Tone.js library (already available)

### 8.4 Mobile Responsiveness

- Exercise cards should stack on mobile
- Fretboard may need horizontal scroll on small screens
- Settings panel should be modal on mobile

### 8.5 Accessibility

- Keyboard navigation for step-through mode
- Color-blind friendly finger indicators (use shapes + colors)
- Screen reader support for exercise descriptions

---

## Appendix A: Complete Permutation List

| Index | Pattern | Tier | Notes |
|-------|---------|------|-------|
| 0 | 1-2-3-4 | 1 | Standard Spider |
| 1 | 1-2-4-3 | 2 | |
| 2 | 1-3-2-4 | 2 | Diminished feel |
| 3 | 1-3-4-2 | 2 | |
| 4 | 1-4-2-3 | 2 | |
| 5 | 1-4-3-2 | 2 | |
| 6 | 2-1-3-4 | 2 | |
| 7 | 2-1-4-3 | 2 | |
| 8 | 2-3-1-4 | 3 | |
| 9 | 2-3-4-1 | 2 | |
| 10 | 2-4-1-3 | 2 | |
| 11 | 2-4-3-1 | 3 | |
| 12 | 3-1-2-4 | 3 | Ring start - hard |
| 13 | 3-1-4-2 | 3 | |
| 14 | 3-2-1-4 | 3 | |
| 15 | 3-2-4-1 | 3 | Tendon breaker |
| 16 | 3-4-1-2 | 3 | |
| 17 | 3-4-2-1 | 3 | |
| 18 | 4-1-2-3 | 3 | Pinky start |
| 19 | 4-1-3-2 | 3 | |
| 20 | 4-2-1-3 | 3 | |
| 21 | 4-2-3-1 | 3 | |
| 22 | 4-3-1-2 | 3 | |
| 23 | 4-3-2-1 | 1 | Reverse Spider |

---

## Appendix B: Exercise Benefits Summary

| Exercise | Left Hand | Right Hand | Both Hands |
|----------|-----------|------------|------------|
| Spider Walk | Finger placement | Adjacent picking | Synchronization |
| Permutations | Independence | - | Coordination |
| Diagonals | Shape shifting | Economy picking | Position awareness |
| String Skip | Muting | Accuracy/targeting | Wide leaps |
| Legato | Strength/stamina | - | Tone consistency |
| Linear | Shifting | - | Arm coordination |
| Burst Mode | - | - | Speed transitions |

---

## Appendix C: Safety Warnings

Include these warnings in the app for relevant exercises:

**Wide Stretching Exercises:**
> ⚠️ Stop immediately if you feel sharp pain. Stretching exercises carry injury risk. Always warm up first. Keep your thumb on the back of the neck.

**Legato Endurance:**
> ⚠️ If your hand cramps or fatigues significantly, take a break. Build endurance gradually over weeks, not days.

**High-Speed Burst Mode:**
> ⚠️ Attempting speeds beyond your capability can reinforce bad habits. Only use burst mode after mastering the exercise at slower tempos.

---

*Document Version: 1.0*
*Last Updated: January 2026*
*For: FretMemo.net Development Team*
