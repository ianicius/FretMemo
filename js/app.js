document.addEventListener('DOMContentLoaded', () => {
    // --- Data Model ---
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    let currentTuningName = localStorage.getItem('fretmemoTuningName') || 'Standard';

    const TUNINGS = {
        'Standard': ['E', 'B', 'G', 'D', 'A', 'E'],
        'Drop D': ['E', 'B', 'G', 'D', 'A', 'D'],
        'DADGAD': ['D', 'A', 'G', 'D', 'A', 'D'],
        'Open G': ['D', 'B', 'G', 'D', 'G', 'D'],
        'Open D': ['D', 'A', 'F#', 'D', 'A', 'D'],
        'Double Drop D': ['D', 'B', 'G', 'D', 'A', 'D'],
        'E Flat': ['D#', 'A#', 'F#', 'C#', 'G#', 'D#']
    };

    // Initialize tuning from memory or default
    let tuning = [...TUNINGS[currentTuningName]];

    const FRET_COUNT = 12;
    const SPIDER_FINGERS = 4;
    const scalePatterns = {
        majorScale: [2, 2, 1, 2, 2, 2, 1],
        minorScale: [2, 1, 2, 2, 1, 2, 2],
        majorPentatonic: [2, 2, 3, 2, 3],
        minorPentatonic: [3, 2, 2, 3, 2],
    };

    // --- Tuning Logic ---
    function setTuning(tuningName) {
        if (!TUNINGS[tuningName]) return;
        currentTuningName = tuningName;
        // Update the global tuning array in place
        const newEx = TUNINGS[tuningName];
        for (let i = 0; i < 6; i++) {
            tuning[i] = newEx[i];
        }
        localStorage.setItem('fretmemoTuningName', tuningName);

        // Redraw components
        createFretboard();
        if (heatMapEnabled) updateHeatMap();

        // Update pitch detection logic?
        // No, noteFromPitch is chromatic. getNote() uses the updated 'tuning' array automatically.
        // We just need to refresh the current practice note if it relied on position.
        if (currentPracticeMode === 'noteNames' && currentPracticePos) {
            // Refresh target note display
            // This might happen naturally on next question
            newQuestion();
        }

        console.log(`Tuning set to: ${tuningName}`, tuning);
    }

    // Expose for UI
    window.setTuning = setTuning;


    // --- Exercise Data Models ---
    const EXERCISES = {
        spiderWalk: {
            id: 'spiderWalk',
            name: 'Spider Walk',
            icon: '🕷️',
            description: 'Baseline synchronization exercise',
            difficulty: 'beginner',
            benefits: ['Synchronization', 'Adjacent string crossing', 'Finger placement'],
            category: 'spider'
        },
        permutation: {
            id: 'permutation',
            name: 'Permutation Trainer',
            icon: '🔀',
            description: '24 finger patterns for independence',
            difficulty: 'intermediate',
            benefits: ['Finger independence', 'Non-sequential movement', 'Coordination'],
            category: 'permutation'
        },
        diagonal: {
            id: 'diagonal',
            name: 'Diagonal Patterns',
            icon: '↗️',
            description: 'Shape shifting across strings',
            difficulty: 'intermediate',
            benefits: ['Shape shifting', 'Economy picking', 'Position awareness'],
            category: 'diagonal'
        },
        stringSkip: {
            id: 'stringSkip',
            name: 'String Skipping',
            icon: '⏭️',
            description: 'Non-adjacent string targeting',
            difficulty: 'intermediate',
            benefits: ['Pick accuracy', 'Targeting', 'Wide leaps'],
            category: 'stringSkip'
        },
        legato: {
            id: 'legato',
            name: 'Legato Builder',
            icon: '🎸',
            description: 'Hammer-ons and pull-offs',
            difficulty: 'intermediate',
            benefits: ['Left hand strength', 'Stamina', 'Tone consistency'],
            category: 'legato'
        },
        linear: {
            id: 'linear',
            name: 'Linear Shifter',
            icon: '↔️',
            description: 'Horizontal position shifting',
            difficulty: 'intermediate',
            benefits: ['Horizontal shifting', 'Arm movement', 'Position shifting'],
            category: 'linear'
        }
    };

    // --- Pre-Built Workouts ---
    const WORKOUTS = [
        {
            id: 'daily_warmup',
            title: 'Daily Warmup',
            description: 'Essential activation for all fingers.',
            totalTime: '3 mins',
            exercises: [
                { type: 'spiderWalk', name: 'Spider Walk', duration: 60, settings: { bpm: 60 } },
                { type: 'linear', name: 'Linear Shift', duration: 60, settings: { bpm: 60 } },
                { type: 'permutation', name: 'Reverse Spider', duration: 60, settings: { permutationIndex: 23, bpm: 60 } }
            ]
        },
        {
            id: 'finger_independence',
            title: 'Finger Independence',
            description: 'Challenging patterns to break finger coupling.',
            totalTime: '4 mins',
            exercises: [
                { type: 'permutation', name: 'Permutation 1-3-2-4', duration: 60, settings: { permutationIndex: 2, bpm: 60 } },
                { type: 'permutation', name: 'Permutation 4-2-3-1', duration: 60, settings: { permutationIndex: 21, bpm: 60 } },
                { type: 'stringSkip', name: 'String Skipping', duration: 120, settings: { bpm: 60 } }
            ]
        }
    ];

    // --- 24 Finger Permutations (Appendix A) ---
    const PERMUTATIONS = [
        { index: 0, pattern: [1, 2, 3, 4], tier: 1, name: 'Standard Spider' },
        { index: 1, pattern: [1, 2, 4, 3], tier: 2, name: '' },
        { index: 2, pattern: [1, 3, 2, 4], tier: 2, name: 'Diminished feel' },
        { index: 3, pattern: [1, 3, 4, 2], tier: 2, name: '' },
        { index: 4, pattern: [1, 4, 2, 3], tier: 2, name: '' },
        { index: 5, pattern: [1, 4, 3, 2], tier: 2, name: '' },
        { index: 6, pattern: [2, 1, 3, 4], tier: 2, name: '' },
        { index: 7, pattern: [2, 1, 4, 3], tier: 2, name: '' },
        { index: 8, pattern: [2, 3, 1, 4], tier: 3, name: '' },
        { index: 9, pattern: [2, 3, 4, 1], tier: 2, name: '' },
        { index: 10, pattern: [2, 4, 1, 3], tier: 2, name: '' },
        { index: 11, pattern: [2, 4, 3, 1], tier: 3, name: '' },
        { index: 12, pattern: [3, 1, 2, 4], tier: 3, name: 'Ring start - hard' },
        { index: 13, pattern: [3, 1, 4, 2], tier: 3, name: '' },
        { index: 14, pattern: [3, 2, 1, 4], tier: 3, name: '' },
        { index: 15, pattern: [3, 2, 4, 1], tier: 3, name: 'Tendon breaker' },
        { index: 16, pattern: [3, 4, 1, 2], tier: 3, name: '' },
        { index: 17, pattern: [3, 4, 2, 1], tier: 3, name: '' },
        { index: 18, pattern: [4, 1, 2, 3], tier: 3, name: 'Pinky start' },
        { index: 19, pattern: [4, 1, 3, 2], tier: 3, name: '' },
        { index: 20, pattern: [4, 2, 1, 3], tier: 3, name: '' },
        { index: 21, pattern: [4, 2, 3, 1], tier: 3, name: '' },
        { index: 22, pattern: [4, 3, 1, 2], tier: 3, name: '' },
        { index: 23, pattern: [4, 3, 2, 1], tier: 1, name: 'Reverse Spider' }
    ];

    // --- String Skip Patterns ---
    const SKIP_PATTERNS = {
        single: { sequence: [5, 3, 4, 2, 3, 1, 2, 0], name: 'Single Skip' },
        octave: { sequence: [5, 3, 4, 2, 3, 1, 2, 0], pairs: [[5, 3], [4, 2], [3, 1], [2, 0]], name: 'Octave Skip' },
        double: { sequence: [5, 2, 4, 1, 3, 0], pairs: [[5, 2], [4, 1], [3, 0]], name: 'Double Skip' },
        wide: { sequence: [5, 0, 4, 1, 3, 2], pairs: [[5, 0], [4, 1], [3, 2]], name: 'Wide Skip' }
    };

    // --- Exercise State ---
    let currentExercise = 'spiderWalk';
    let exerciseState = {
        permutation: {
            currentPermutationIndex: 0,
            mode: 'single', // single, daily, sequential, random
            tier: 'all',
            direction: 'ascending'
        },
        linear: {
            currentFret: 1,
            direction: 'ascending',
            notesPlayed: 0
        },
        diagonal: {
            currentString: 0,
            currentFret: 3,
            direction: 'ascending'
        },
        stringSkip: {
            currentStep: 0
        },
        legato: {
            currentType: 'trill',
            trillPair: [1, 2],
            duration: 15
        },
        // Sequence tracking for all exercises
        currentSequence: [],
        sequenceIndex: 0
    };

    // --- User Progress ---
    let userProgress = {
        permutationsCompleted: new Set(),
        totalPracticeTime: 0,
        streakDays: 0,
        lastPracticeDate: null,
        exerciseStats: {}
    };

    // --- DOM Elements ---
    const bodyEl = document.body;
    const floatingControls = document.getElementById('floating-controls');
    const fretboardEl = document.getElementById('fretboard');
    const fretboardContainer = document.getElementById('fretboard-container');
    const fretNumbersEl = document.querySelector('#fret-numbers div');
    const answerOptionsEl = document.getElementById('answer-options');
    const feedbackEl = document.getElementById('feedback');
    const nextBtn = document.getElementById('next-btn');
    const sidePanel = document.getElementById('side-panel');
    const settingsToggleBtn = document.getElementById('settings-toggle-btn');
    const sidePanelOverlay = document.getElementById('side-panel-overlay');
    const bpmSlider = document.getElementById('bpm-slider');
    const bpmDisplay = document.getElementById('bpm-display');
    const metronomeBtn = document.getElementById('metronome-btn');
    const metronomeBtnLabel = metronomeBtn ? metronomeBtn.querySelector('.metronome-toggle__label') : null;
    const metronomeMiniBpm = document.getElementById('metronome-mini-bpm');
    const noteDurationInput = document.getElementById('note-duration');
    const speedUpToggle = document.getElementById('speed-up-toggle');
    const speedUpControls = document.getElementById('speed-up-controls');
    const speedUpAmount = document.getElementById('speed-up-amount');
    const speedUpInterval = document.getElementById('speed-up-interval');
    const correctCountEl = document.getElementById('correct-count');
    const incorrectCountEl = document.getElementById('incorrect-count');
    const statsDisplay = document.getElementById('stats-display');
    const statsBtn = document.getElementById('stats-btn');
    const statsModalOverlay = document.getElementById('stats-modal-overlay');
    const statsModal = document.getElementById('stats-modal');
    const statsContentEl = document.getElementById('stats-content');
    const closeStatsBtn = document.getElementById('close-stats-btn');
    const moduleSwitchBtns = document.querySelectorAll('.module-switch-btn');
    const practiceNoteContainer = document.getElementById('practice-note-container');
    const practiceTabView = document.getElementById('practice-tab-view');
    const nextPracticeNoteEl = document.getElementById('next-practice-note');
    const beatDotsContainer = document.getElementById('beat-dots-container');
    const naturalsOnlyToggle = document.getElementById('naturals-only-toggle');
    const noteSelectionGrid = document.getElementById('note-selection-grid');
    const viewSwitcherContainer = document.getElementById('view-switcher-container');
    const practiceModeContainer = document.getElementById('practice-mode-container');
    const techniqueModeContainer = document.getElementById('technique-mode-container');
    const techniqueSettingsContainer = document.getElementById('technique-settings-container');
    const spiderStartFretInput = document.getElementById('spider-start-fret');

    // --- Exercise UI Elements ---
    const exerciseSelectionContainer = document.getElementById('exercise-selection-container');
    const exerciseViewContainer = document.getElementById('exercise-view-container');
    const exerciseCards = document.querySelectorAll('.exercise-card');
    const currentExerciseTitle = document.getElementById('current-exercise-title');
    const backToExercisesBtn = document.getElementById('back-to-exercises-btn');
    const exerciseSettingsToggle = document.getElementById('exercise-settings-toggle');
    const exercisePatternDisplay = document.getElementById('exercise-pattern-display');
    const exerciseInstruction = document.getElementById('exercise-instruction');
    const burstIndicator = document.getElementById('burst-indicator');
    const dailyChallengeBanner = document.getElementById('daily-challenge-banner');
    const dailyChallengePattern = document.getElementById('daily-challenge-pattern');
    const dailyChallengeBtn = document.getElementById('daily-challenge-btn');
    const progressSection = document.getElementById('progress-section');
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');

    // --- Exercise Settings Elements ---
    const permutationSettingsContainer = document.getElementById('permutation-settings-container');
    const permutationModeSelect = document.getElementById('permutation-mode');
    const permutationTierSelect = document.getElementById('permutation-tier');
    const permutationSelect = document.getElementById('permutation-select');
    const permutationDirectionSelect = document.getElementById('permutation-direction');
    const permutationHoldFingersToggle = document.getElementById('permutation-hold-fingers');

    const linearSettingsContainer = document.getElementById('linear-settings-container');
    const linearStringSelect = document.getElementById('linear-string');
    const linearStartFretInput = document.getElementById('linear-start-fret');
    const linearEndFretInput = document.getElementById('linear-end-fret');
    const linearNotesPerShiftSelect = document.getElementById('linear-notes-per-shift');
    const linearDirectionSelect = document.getElementById('linear-direction');

    const diagonalSettingsContainer = document.getElementById('diagonal-settings-container');
    const diagonalPatternSelect = document.getElementById('diagonal-pattern');
    const diagonalStartFretInput = document.getElementById('diagonal-start-fret');
    const diagonalShowPickToggle = document.getElementById('diagonal-show-pick');

    const stringskipSettingsContainer = document.getElementById('stringskip-settings-container');
    const skipPatternSelect = document.getElementById('skip-pattern');
    const skipStartFretInput = document.getElementById('skip-start-fret');
    const skipPickingFocusSelect = document.getElementById('skip-picking-focus');
    const skipShowPickToggle = document.getElementById('skip-show-pick');

    const legatoSettingsContainer = document.getElementById('legato-settings-container');
    const legatoTypeSelect = document.getElementById('legato-type');
    const trillPairSelect = document.getElementById('trill-pair');
    const trillDurationInput = document.getElementById('trill-duration');
    const legatoStartFretInput = document.getElementById('legato-start-fret');

    const burstSettingsContainer = document.getElementById('burst-settings-container');
    const burstModeToggle = document.getElementById('burst-mode-toggle');
    const burstSlowBeatsInput = document.getElementById('burst-slow-beats');
    const burstFastBeatsInput = document.getElementById('burst-fast-beats');
    const burstMultiplierSelect = document.getElementById('burst-multiplier');

    // --- Focus Area Elements ---
    const focusMinFretInput = document.getElementById('focus-min-fret');
    const focusMaxFretInput = document.getElementById('focus-max-fret');
    const focusStringCheckboxes = document.querySelectorAll('.focus-string-checkbox');

    // --- Layout: keep content clear of the fixed top controls (mobile + wraps) ---
    const setAppbarSpace = () => {
        if (!floatingControls) return;
        const rect = floatingControls.getBoundingClientRect();
        const space = Math.ceil(rect.bottom + 8); // breathing room
        document.documentElement.style.setProperty('--appbar-space', `${space}px`);
    };

    if (floatingControls) {
        setAppbarSpace();
        window.addEventListener('resize', setAppbarSpace, { passive: true });

        if ('ResizeObserver' in window) {
            const ro = new ResizeObserver(setAppbarSpace);
            ro.observe(floatingControls);
        }

        // Fonts can change button metrics after load.
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(setAppbarSpace).catch(() => { });
        }
    }
    const viewSwitchBtns = document.querySelectorAll('.view-switch-btn');
    const tabContainer = document.getElementById('tab-container');
    const noteToTabQuestionContainer = document.getElementById('note-to-tab-question-container');
    const practiceSettingsContainer = document.getElementById('practice-settings-container');
    const practiceModeBtns = document.querySelectorAll('.practice-mode-btn');
    const intervalSelect = document.getElementById('interval-select');
    const scaleRootContainer = document.getElementById('scale-root-container');
    const scaleRootSelect = document.getElementById('scale-root-select');
    const micEnableToggle = document.getElementById('mic-enable-toggle');
    const tunerDisplay = document.getElementById('tuner-display');
    const detectedNoteEl = document.getElementById('detected-note');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const leftyToggle = document.getElementById('lefty-toggle');

    // --- Application State ---
    let currentModule = 'guessNote';
    let currentView = 'fretboard';
    let currentPracticeMode = 'noteNames';
    let currentTechnique = 'spiderWalk';
    let correctAnswer = '';
    let isAnswered = false;
    let metronomeIntervalId = null;
    let isMetronomeOn = false;
    let isCountingIn = false;
    let countInCounter = 0;
    const COUNT_IN_BEATS = 4;
    let speedUpTickCounter = 0;
    let noteTickCounter = 0;
    let audioCtx;
    let analyser;
    let micStream;
    let pitchDetectionFrameId;
    let isPitchDetectionRunning = false;
    let correctCount = 0;
    let incorrectCount = 0;
    let noteMistakes = {};
    let currentPracticePos = null;
    let nextPracticePos = null;
    let fretboardDirection = 'up'; // 'up' or 'down'
    let currentScale = [];
    let currentScaleIndex = 0;
    let spiderState = {};
    let lastFocusedElement;
    let wakeLock = null;

    // --- Burst Mode State ---
    let burstBeatCounter = 0;
    let burstPhase = 'slow'; // 'slow' or 'fast'
    let burstBaseTempo = 0; // Original tempo before burst

    // --- Focus Area State ---
    let focusArea = {
        minFret: 0,
        maxFret: 12,
        strings: [true, true, true, true, true, true] // All 6 strings enabled
    };

    // --- Heat Map State ---
    let positionStats = {}; // Key: "string-fret", Value: { correct, total }
    let currentQuestionPos = null; // { string, fret } for tracking
    let heatMapEnabled = false;
    let isStepThroughMode = false;
    let isAudioAdvanceEnabled = false;
    let audioAdvanceCooldown = false;

    // --- Performance & UI Caching ---
    const highlightDot = document.createElement('div');
    highlightDot.id = 'highlight-dot';
    const spiderDots = [];

    // --- Audio & Pitch Detection Logic ---
    const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    function setupAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function playTick(isCountIn = false) {
        const tickCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = tickCtx.createOscillator();
        const gainNode = tickCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(tickCtx.destination);
        oscillator.type = isCountIn ? 'sine' : 'triangle';
        oscillator.frequency.setValueAtTime(isCountIn ? 440 : 880, tickCtx.currentTime);
        gainNode.gain.setValueAtTime(0.4, tickCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, tickCtx.currentTime + 0.05);
        oscillator.start(tickCtx.currentTime);
        oscillator.stop(tickCtx.currentTime + 0.05);
        setTimeout(() => tickCtx.close(), 100);
    }

    function noteFromPitch(frequency) {
        const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
        return noteStrings[Math.round(noteNum + 69) % 12];
    }

    function autoCorrelate(buf, sampleRate) {
        const SIZE = buf.length;
        let rms = 0;
        for (let i = 0; i < SIZE; i++) {
            const val = buf[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.02) return -1;

        let r1 = 0, r2 = SIZE - 1, thres = 0.2;
        for (let i = 0; i < SIZE / 2; i++) {
            if (Math.abs(buf[i]) < thres) { r1 = i; break; }
        }
        for (let i = 1; i < SIZE / 2; i++) {
            if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
        }

        buf = buf.slice(r1, r2);
        const newSize = buf.length;
        const c = new Array(newSize).fill(0);
        for (let i = 0; i < newSize; i++) {
            for (let j = 0; j < newSize - i; j++) {
                c[i] = c[i] + buf[j] * buf[j + i];
            }
        }

        let d = 0;
        while (d < c.length && c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < c.length; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }
        let T0 = maxpos;

        const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
        const a = (x1 + x3 - 2 * x2) / 2;
        const b = (x3 - x1) / 2;
        if (a) T0 = T0 - b / (2 * a);

        return sampleRate / T0;
    }

    function runPitchDetection() {
        if (!isPitchDetectionRunning && !isAudioAdvanceEnabled) return;

        const buffer = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buffer);

        // --- Audio Auto-Advance (Attack Detection) ---
        if (isAudioAdvanceEnabled && isStepThroughMode && isMetronomeOn && currentModule === 'technique') {
            let rms = 0;
            for (let i = 0; i < buffer.length; i++) {
                rms += buffer[i] * buffer[i]; // Sum of squares
            }
            rms = Math.sqrt(rms / buffer.length);

            // Threshold: 0.05 seems reasonable for a clear pluck. Can be tuned.
            if (rms > 0.05 && !audioAdvanceCooldown) {
                audioAdvanceCooldown = true;
                nextStep();
                // Simple visual feedback on the step controls?
                const nextBtn = document.getElementById('next-step-btn');
                if (nextBtn) {
                    nextBtn.classList.add('bg-green-600');
                    setTimeout(() => nextBtn.classList.remove('bg-green-600'), 150);
                }
                setTimeout(() => { audioAdvanceCooldown = false; }, 250); // 250ms debounce
            }
        }

        // --- Pitch Detection (Tuner) ---
        if (isPitchDetectionRunning) {
            const fundamental = autoCorrelate(buffer, audioCtx.sampleRate);
            if (fundamental !== -1) {
                const detectedNote = noteFromPitch(fundamental);
                detectedNoteEl.textContent = detectedNote;
                let targetNote;
                if (currentPracticeMode === 'noteNames') {
                    targetNote = practiceNoteContainer.querySelector('.current-practice-note').textContent;
                } else if (currentPracticePos) {
                    targetNote = getNote(currentPracticePos.string, currentPracticePos.fret);
                }

                if (targetNote && detectedNote === targetNote) {
                    tunerDisplay.classList.add('correct');
                    detectedNoteEl.textContent = "Correct!";
                } else {
                    tunerDisplay.classList.remove('correct');
                }

            } else {
                detectedNoteEl.textContent = "--";
                tunerDisplay.classList.remove('correct');
            }
        }

        pitchDetectionFrameId = requestAnimationFrame(runPitchDetection);
    }

    async function startMicStream() {
        if (micStream && audioCtx && audioCtx.state === 'running') return true;
        try {
            if (!micStream) {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
            setupAudio();
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }
            if (!analyser) {
                analyser = audioCtx.createAnalyser();
                analyser.fftSize = 2048;
                const source = audioCtx.createMediaStreamSource(micStream);
                source.connect(analyser);
            }
            return true;
        } catch (err) {
            console.error("Microphone access error:", err);
            alert("Microphone access denied. Please allow microphone access in your browser settings.");
            if (micEnableToggle) micEnableToggle.checked = false;
            const audioAdvToggle = document.getElementById('audio-advance-toggle');
            if (audioAdvToggle) audioAdvToggle.checked = false;
            return false;
        }
    }

    function stopMicStream() {
        if (isPitchDetectionRunning || isAudioAdvanceEnabled) return;

        cancelAnimationFrame(pitchDetectionFrameId);
        if (micStream) {
            micStream.getTracks().forEach(track => track.stop());
            micStream = null;
        }
        if (audioCtx && audioCtx.state !== 'closed') {
            audioCtx.suspend();
        }
        analyser = null;
    }

    async function toggleMicInput(enable) {
        if (enable) {
            if (await startMicStream()) {
                tunerDisplay.classList.remove('hidden');
                isPitchDetectionRunning = true;
                runPitchDetection();
            }
        } else {
            isPitchDetectionRunning = false;
            tunerDisplay.classList.add('hidden');
            stopMicStream();
        }
    }

    async function toggleAudioAdvance(enable) {
        if (enable) {
            if (await startMicStream()) {
                isAudioAdvanceEnabled = true;
                runPitchDetection();
            }
        } else {
            isAudioAdvanceEnabled = false;
            stopMicStream();
        }
    }

    // --- Screen Wake Lock API ---
    const requestWakeLock = async () => {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen Wake Lock is active.');
            } catch (err) {
                console.error(`${err.name}, ${err.message}`);
            }
        } else {
            console.log('Wake Lock API not supported.');
        }
    };

    const releaseWakeLock = async () => {
        if (wakeLock !== null) {
            try {
                await wakeLock.release();
                wakeLock = null;
                console.log('Screen Wake Lock released.');
            } catch (err) {
                console.error(`${err.name}, ${err.message}`);
            }
        }
    };


    // --- UI Creation ---
    function createFretboard() {
        fretboardEl.innerHTML = '';
        fretNumbersEl.innerHTML = '';

        const gridTemplate = `5% repeat(${FRET_COUNT}, 1fr)`;
        fretboardEl.style.gridTemplateColumns = gridTemplate;
        fretboardEl.style.gridTemplateRows = `repeat(${tuning.length}, var(--fret-row, 3rem))`;
        fretNumbersEl.style.gridTemplateColumns = gridTemplate;
        const stringThickness = [1.4, 1.7, 2.0, 2.3, 2.6, 3.0]; // Thin to Thick (make strings clearly visible)

        for (let i = 0; i < tuning.length; i++) {
            for (let j = 0; j <= FRET_COUNT; j++) {
                const fretEl = document.createElement('div');
                fretEl.classList.add('fret', 'fret-cell', 'relative', 'flex', 'items-center', 'justify-center');
                fretEl.dataset.string = i;
                fretEl.dataset.fret = j;
                const stringLine = document.createElement('div');
                stringLine.classList.add('string-line', 'w-full', 'absolute');
                stringLine.style.height = `${stringThickness[i]}px`;
                fretEl.appendChild(stringLine);
                fretboardEl.appendChild(fretEl);
            }
        }
        const markers = { 3: [2], 5: [2], 7: [2], 9: [2], 12: [1, 3] };
        for (const fret in markers) {
            markers[fret].forEach(stringIndex => {
                const targetFret = fretboardEl.querySelector(`.fret[data-string='${stringIndex}'][data-fret='${fret}']`);
                if (targetFret) {
                    const markerDot = document.createElement('div');
                    markerDot.classList.add('marker-dot', 'absolute', 'w-5', 'h-5', 'rounded-full', 'left-1/2', 'z-0');
                    markerDot.style.top = '100%';
                    markerDot.style.transform = 'translate(-50%, -50%)';
                    targetFret.appendChild(markerDot);
                }
            });
        }

        const emptyFretDiv = document.createElement('div');
        fretNumbersEl.appendChild(emptyFretDiv);
        for (let j = 1; j <= FRET_COUNT; j++) {
            const fretNumEl = document.createElement('div');
            fretNumEl.classList.add('relative', 'flex', 'justify-center', 'text-sm');
            fretNumEl.style.color = 'var(--text-light)';
            if ([3, 5, 7, 9, 12].includes(j)) {
                fretNumEl.textContent = j;
            }
            fretNumbersEl.appendChild(fretNumEl);
        }

        fretboardContainer.appendChild(highlightDot);
        highlightDot.style.display = 'none';

        for (let i = 0; i < SPIDER_FINGERS; i++) {
            const dot = document.createElement('div');
            dot.className = 'spider-dot';
            dot.style.display = 'none';
            dot.style.borderColor = `hsl(${i * 60}, 70%, 50%)`; // Different color for each finger
            fretboardContainer.appendChild(dot);
            spiderDots.push(dot);
        }

        // Initialize Legato Overlay if not exists
        let legatoOverlay = document.getElementById('legato-overlay');
        if (!legatoOverlay) {
            legatoOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            legatoOverlay.id = "legato-overlay";
            fretboardContainer.appendChild(legatoOverlay); // Appended after board, but before dots if logic allows, but here appended at end. Z-index controls layer.
        }
        legatoOverlay.innerHTML = ''; // Clear arcs on reset
    }

    function createTabView() {
        tabContainer.innerHTML = '';
        tuning.forEach((stringName, stringIndex) => {
            const stringEl = document.createElement('div');
            stringEl.classList.add('tab-string');
            stringEl.dataset.stringIndex = stringIndex;
            stringEl.innerHTML = `
                        <span class="w-4" style="color: var(--text-light);">${stringName}</span>
                        <span>|--</span>
                        <span class="tab-fret-number">-</span>
                        <span>--|</span>
                    `;
            tabContainer.appendChild(stringEl);
        });
    }

    // --- Exercise Sequence Generator ---
    function generateExerciseSequence(config) {
        const {
            exerciseType,
            fingerPattern,
            stringPattern,
            startFret,
            direction,
            repetitions = 1
        } = config;

        const sequence = [];

        for (let r = 0; r < repetitions; r++) {
            if (exerciseType === 'spider' || exerciseType === 'permutation') {
                // Spider-like exercises: 4 fingers across strings
                for (let s = 0; s < stringPattern.length; s++) {
                    const string = stringPattern[s];
                    for (let f = 0; f < fingerPattern.length; f++) {
                        const finger = fingerPattern[f];
                        const fret = startFret + f;
                        const pickDirection = (s * 4 + f) % 2 === 0 ? 'down' : 'up';
                        sequence.push({
                            string,
                            fret,
                            finger,
                            pickDirection,
                            legato: null
                        });
                    }
                }
            } else if (exerciseType === 'linear') {
                // Linear: single string, shifting positions
                const string = stringPattern[0];
                let currentFret = startFret;
                let notesPlayed = 0;
                const notesPerShift = config.notesPerShift || 4;
                const endFret = config.endFret || 12;

                while (currentFret <= endFret - 3) {
                    for (let i = 0; i < 4 && notesPlayed < notesPerShift; i++) {
                        sequence.push({
                            string,
                            fret: currentFret + i,
                            finger: i + 1,
                            pickDirection: notesPlayed % 2 === 0 ? 'down' : 'up',
                            legato: null
                        });
                        notesPlayed++;
                    }
                    if (notesPlayed >= notesPerShift) {
                        currentFret++;
                        notesPlayed = 0;
                    }
                }
            } else if (exerciseType === 'diagonal') {
                // Diagonal: shifting across strings and frets
                for (let i = 0; i < stringPattern.length; i++) {
                    const string = stringPattern[i];
                    const fret = startFret + i;
                    const pickDirection = i % 2 === 0 ? 'down' : 'up';
                    sequence.push({
                        string,
                        fret,
                        finger: i + 1,
                        pickDirection,
                        legato: null
                    });
                }
            } else if (exerciseType === 'stringSkip') {
                // String skipping patterns
                for (let i = 0; i < stringPattern.length; i++) {
                    const string = stringPattern[i];
                    const pickDirection = i % 2 === 0 ? 'down' : 'up';
                    sequence.push({
                        string,
                        fret: startFret,
                        finger: 1,
                        pickDirection,
                        legato: null
                    });
                }
            } else if (exerciseType === 'legato') {
                // Legato patterns
                const string = stringPattern[0];
                if (config.legatoType === 'trill') {
                    const [f1, f2] = config.trillPair || [1, 2];
                    for (let i = 0; i < 8; i++) {
                        sequence.push({
                            string,
                            fret: startFret + (i % 2 === 0 ? 0 : f2 - f1),
                            finger: i % 2 === 0 ? f1 : f2,
                            pickDirection: i === 0 ? 'down' : null,
                            legato: i === 0 ? null : (i % 2 === 0 ? 'pull' : 'hammer')
                        });
                    }
                }
            }
        }

        return sequence;
    }

    // --- Daily Challenge Algorithm ---
    function getDailyPermutation(date) {
        // Deterministic random based on date
        const dateStr = date.toISOString().split('T')[0];
        let seed = 0;
        for (let i = 0; i < dateStr.length; i++) {
            seed = ((seed << 5) - seed) + dateStr.charCodeAt(i);
            seed |= 0;
        }
        const index = Math.abs(seed) % 24;
        return PERMUTATIONS[index];
    }

    // --- Permutation Utilities ---
    function getPermutationsByTier(tier) {
        if (tier === 'all') return PERMUTATIONS;
        return PERMUTATIONS.filter(p => p.tier === parseInt(tier));
    }

    function formatPermutation(pattern) {
        return pattern.join('-');
    }

    // --- Progress Management ---
    function loadProgress() {
        try {
            const stored = localStorage.getItem('fretmemoProgress');
            if (stored) {
                const parsed = JSON.parse(stored);
                userProgress.permutationsCompleted = new Set(parsed.permutationsCompleted || []);
                userProgress.totalPracticeTime = parsed.totalPracticeTime || 0;
                userProgress.streakDays = parsed.streakDays || 0;
                userProgress.lastPracticeDate = parsed.lastPracticeDate;
                userProgress.exerciseStats = parsed.exerciseStats || {};
            }
        } catch (e) {
            console.error('Failed to load progress:', e);
        }
    }

    function saveProgress() {
        try {
            const toStore = {
                permutationsCompleted: Array.from(userProgress.permutationsCompleted),
                totalPracticeTime: userProgress.totalPracticeTime,
                streakDays: userProgress.streakDays,
                lastPracticeDate: userProgress.lastPracticeDate,
                exerciseStats: userProgress.exerciseStats
            };
            localStorage.setItem('fretmemoProgress', JSON.stringify(toStore));
        } catch (e) {
            console.error('Failed to save progress:', e);
        }
    }

    function updateStreak() {
        const today = new Date().toISOString().split('T')[0];
        if (userProgress.lastPracticeDate === today) return;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (userProgress.lastPracticeDate === yesterdayStr) {
            userProgress.streakDays++;
        } else {
            userProgress.streakDays = 1;
        }
        userProgress.lastPracticeDate = today;
        saveProgress();
    }

    function markPermutationComplete(index) {
        userProgress.permutationsCompleted.add(index);
        updateStreak();
        saveProgress();
        updateProgressDisplay();
    }

    function updateProgressDisplay() {
        const completed = userProgress.permutationsCompleted.size;
        const total = 24;
        const percentage = (completed / total) * 100;

        if (progressText) {
            progressText.textContent = `${completed}/${total}`;
        }
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
    }

    // --- Core Logic ---
    function getNote(stringIndex, fretNumber) {
        const openNote = tuning[stringIndex];
        const openNoteIndex = notes.indexOf(openNote);
        const noteIndex = (openNoteIndex + fretNumber) % 12;
        return notes[noteIndex];
    }

    function drawBeatDots() {
        beatDotsContainer.innerHTML = '';
        const duration = parseInt(noteDurationInput.value) || 1;
        const dotsToDraw = Math.min(duration, 16);
        for (let i = 0; i < dotsToDraw; i++) {
            const dot = document.createElement('div');
            dot.classList.add('beat-dot', 'w-3', 'h-3', 'bg-gray-300', 'rounded-full');
            beatDotsContainer.appendChild(dot);
        }
    }

    function updateActiveDot(beatIndex) {
        const dots = beatDotsContainer.children;
        if (!dots) return;
        for (let i = 0; i < dots.length; i++) {
            dots[i].classList.toggle('active', i === beatIndex);
            dots[i].classList.toggle('bg-gray-300', i !== beatIndex);
        }
    }

    function getActiveNotes() {
        if (naturalsOnlyToggle.checked) {
            return notes.filter(n => !n.includes('#'));
        }
        const selectedNotes = Array.from(document.querySelectorAll('.note-select-checkbox:checked')).map(cb => cb.dataset.note);
        if (selectedNotes.length === 0) {
            document.querySelectorAll('.note-select-checkbox').forEach(cb => cb.checked = true);
            return notes;
        }
        return selectedNotes;
    }

    function getNextNoteInSequence(currentNote, sequenceType) {
        if (sequenceType.includes('Scale')) {
            if (currentScale.length === 0) return null;
            const currentIndex = currentScale.indexOf(currentNote);
            let nextIndex;
            if (fretboardDirection === 'up') {
                nextIndex = (currentIndex + 1) % currentScale.length;
            } else {
                nextIndex = (currentIndex - 1 + currentScale.length) % currentScale.length;
            }
            currentScaleIndex = nextIndex;
            return currentScale[nextIndex];
        }

        let interval;
        switch (sequenceType) {
            case 'minorThirds': interval = 3; break;
            case 'majorThirds': interval = 4; break;
            case 'fourths': interval = 5; break;
            case 'fifths': interval = 7; break;
            case 'sevenths': interval = Math.random() < 0.5 ? 10 : 11; break;
            default: return null;
        }

        const currentNoteIndex = notes.indexOf(currentNote);
        const nextNoteIndex = (currentNoteIndex + interval) % 12;
        return notes[nextNoteIndex];
    }

    function getClosestPosition(currentPos, targetNote) {
        const allOccurrences = [];
        for (let i = 0; i < tuning.length; i++) {
            for (let j = 0; j <= FRET_COUNT; j++) {
                if (getNote(i, j) === targetNote) {
                    allOccurrences.push({ string: i, fret: j });
                }
            }
        }
        if (allOccurrences.length === 0) return null;

        // Priorytet: inna struna niż obecna
        let differentStringOccurrences = allOccurrences.filter(p => p.string !== currentPos.string);

        // Fallback: jeśli wszystkie opcje są na tej samej strunie, użyj wszystkich
        if (differentStringOccurrences.length === 0) {
            differentStringOccurrences = allOccurrences;
        }

        let candidates;
        if (fretboardDirection === 'up') {
            candidates = differentStringOccurrences.filter(p => p.fret > currentPos.fret);
            if (candidates.length === 0) {
                fretboardDirection = 'down';
                candidates = differentStringOccurrences.filter(p => p.fret < currentPos.fret);
                if (candidates.length === 0) candidates = differentStringOccurrences; // Fallback
            }
        } else { // 'down'
            candidates = differentStringOccurrences.filter(p => p.fret < currentPos.fret);
            if (candidates.length === 0) {
                fretboardDirection = 'up';
                candidates = differentStringOccurrences.filter(p => p.fret > currentPos.fret);
                if (candidates.length === 0) candidates = differentStringOccurrences; // Fallback
            }
        }

        let closestPos = candidates[0];
        let minDistance = 1000;

        for (const pos of candidates) {
            const distance = Math.abs(pos.string - currentPos.string) + Math.abs(pos.fret - currentPos.fret);
            if (distance < minDistance) {
                minDistance = distance;
                closestPos = pos;
            }
        }
        return closestPos;
    }

    function newQuestion() {
        if (currentModule === 'technique') {
            resetSpiderState();
            return;
        }

        let activeNotes = getActiveNotes();
        const sequenceType = intervalSelect.value;
        const isScaleMode = sequenceType.includes('Scale');

        if (isScaleMode) {
            if (currentScale.length === 0) updateCurrentScale();
            activeNotes = currentScale;
        }

        if (activeNotes.length === 0) {
            feedbackEl.textContent = 'Please select at least one note to practice!';
            return;
        }

        isAnswered = false;
        feedbackEl.textContent = '';
        highlightDot.style.display = 'none';

        if (currentModule === 'guessNote') {
            if (currentView === 'fretboard' || currentView === 'tab') {
                const targetNote = activeNotes[Math.floor(Math.random() * activeNotes.length)];
                const occurrences = [];
                for (let i = 0; i < tuning.length; i++) {
                    // Skip strings not in focus area
                    if (!focusArea.strings[i]) continue;
                    for (let j = focusArea.minFret; j <= Math.min(focusArea.maxFret, FRET_COUNT); j++) {
                        if (getNote(i, j) === targetNote) {
                            occurrences.push({ string: i, fret: j });
                        }
                    }
                }
                if (occurrences.length === 0) { newQuestion(); return; }
                const { string: randomString, fret: randomFret } = occurrences[Math.floor(Math.random() * occurrences.length)];
                correctAnswer = targetNote;
                currentQuestionPos = { string: randomString, fret: randomFret }; // Track for heat map

                if (currentView === 'fretboard') {
                    displayDotAt(highlightDot, randomString, randomFret);
                } else { // Tab view
                    tabContainer.querySelectorAll('.tab-fret-number').forEach(el => el.textContent = '-');
                    const targetStringEl = tabContainer.querySelector(`.tab-string[data-string-index='${randomString}'] .tab-fret-number`);
                    if (targetStringEl) {
                        targetStringEl.textContent = randomFret;
                    }
                }

                const options = new Set([correctAnswer]);
                while (options.size < 4) {
                    options.add(notes[Math.floor(Math.random() * notes.length)]);
                }
                answerOptionsEl.innerHTML = '';
                Array.from(options).sort(() => Math.random() - 0.5).forEach(note => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.textContent = note;
                    button.classList.add('answer-option-btn');
                    button.dataset.note = note;
                    button.addEventListener('click', handleAnswer);
                    answerOptionsEl.appendChild(button);
                });

            } else if (currentView === 'noteToTab') {
                const targetNote = activeNotes[Math.floor(Math.random() * activeNotes.length)];
                noteToTabQuestionContainer.querySelector('.current-practice-note').textContent = targetNote;

                const occurrences = [];
                for (let i = 0; i < tuning.length; i++) {
                    // Skip strings not in focus area
                    if (!focusArea.strings[i]) continue;
                    const minFret = Math.max(1, focusArea.minFret); // noteToTab starts at fret 1
                    for (let j = minFret; j <= Math.min(focusArea.maxFret, FRET_COUNT); j++) {
                        if (getNote(i, j) === targetNote) {
                            occurrences.push({ string: i, fret: j });
                        }
                    }
                }
                if (occurrences.length === 0) { newQuestion(); return; }
                const correctOccurrence = occurrences[Math.floor(Math.random() * occurrences.length)];
                correctAnswer = `${correctOccurrence.string}-${correctOccurrence.fret}`;
                currentQuestionPos = { string: correctOccurrence.string, fret: correctOccurrence.fret }; // Track for heat map

                const options = new Set([correctAnswer]);
                while (options.size < 4) {
                    const randomString = Math.floor(Math.random() * tuning.length);
                    const randomFret = Math.floor(Math.random() * 11) + 1;
                    const randomPosition = `${randomString}-${randomFret}`;
                    if (getNote(randomString, randomFret) !== targetNote) {
                        options.add(randomPosition);
                    }
                }

                answerOptionsEl.innerHTML = '';
                Array.from(options).sort(() => Math.random() - 0.5).forEach(pos => {
                    const [string, fret] = pos.split('-');
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.innerHTML = `<span class="answer-option__strong">${tuning[string]}</span> <span class="answer-option__hint">string</span> - <span class="answer-option__strong">${fret}</span> <span class="answer-option__hint">fret</span>`;
                    button.classList.add('answer-option-btn');
                    button.dataset.position = pos;
                    button.addEventListener('click', handleAnswer);
                    answerOptionsEl.appendChild(button);
                });
            }
        } else if (currentModule === 'playPractice') {
            if (currentPracticeMode === 'noteNames') {
                const nextNote = nextPracticePos ? getNote(nextPracticePos.string, nextPracticePos.fret) : activeNotes[Math.floor(Math.random() * activeNotes.length)];
                practiceNoteContainer.querySelector('.current-practice-note').textContent = nextNote;

                let newNextNoteName;
                if (sequenceType === 'random') {
                    const possibleNextNotes = activeNotes.filter(n => n !== nextNote);
                    newNextNoteName = (possibleNextNotes.length > 0) ? possibleNextNotes[Math.floor(Math.random() * possibleNextNotes.length)] : nextNote;
                } else {
                    newNextNoteName = getNextNoteInSequence(nextNote, sequenceType);
                }

                const currentPosForNext = nextPracticePos || { string: Math.floor(Math.random() * 6), fret: Math.floor(Math.random() * 5) };
                nextPracticePos = getClosestPosition(currentPosForNext, newNextNoteName);
                nextPracticeNoteEl.textContent = newNextNoteName;

            } else { // Tab Sequence
                currentPracticePos = nextPracticePos;
                if (!currentPracticePos) {
                    const randomNote = activeNotes[Math.floor(Math.random() * activeNotes.length)];
                    currentPracticePos = getClosestPosition({ string: 0, fret: 0 }, randomNote);
                }

                const currentNoteName = getNote(currentPracticePos.string, currentPracticePos.fret);
                let nextNoteName;
                if (sequenceType === 'random') {
                    const possibleNextNotes = activeNotes.filter(n => n !== currentNoteName);
                    nextNoteName = (possibleNextNotes.length > 0) ? possibleNextNotes[Math.floor(Math.random() * possibleNextNotes.length)] : currentNoteName;
                } else {
                    nextNoteName = getNextNoteInSequence(currentNoteName, sequenceType);
                }
                nextPracticePos = getClosestPosition(currentPracticePos, nextNoteName);
                renderTabSequence(currentPracticePos, nextPracticePos);
            }
            drawBeatDots();
            if (!isMetronomeOn) {
                updateActiveDot(0);
            }
        }
    }

    function displayDotAt(dot, string, fret) {
        const targetFret = fretboardEl.querySelector(`.fret[data-string='${string}'][data-fret='${fret}']`);
        if (targetFret) {
            const fretRect = targetFret.getBoundingClientRect();
            const containerRect = fretboardContainer.getBoundingClientRect();
            dot.style.left = `${fretRect.left - containerRect.left + (fretRect.width / 2) - 16}px`;
            dot.style.top = `${fretRect.top - containerRect.top + (fretRect.height / 2) - 16}px`;
            dot.style.display = 'block';
        } else {
            dot.style.display = 'none';
        }
    }

    function renderTabSequence(currentPos, nextPos) {
        practiceTabView.innerHTML = '';
        tuning.forEach((stringName, stringIndex) => {
            const stringEl = document.createElement('div');
            stringEl.classList.add('tab-string');
            stringEl.dataset.stringIndex = stringIndex;

            let currentFret = '-';
            let nextFret = '-';
            if (currentPos && currentPos.string === stringIndex) currentFret = currentPos.fret;
            if (nextPos && nextPos.string === stringIndex) nextFret = nextPos.fret;

            stringEl.innerHTML = `
                        <span class="w-4" style="color: var(--text-light);">${stringName}</span>
                        <span>|--</span>
                        <span class="tab-fret-number ${currentPos && currentPos.string === stringIndex ? 'current' : ''}">${currentFret}</span>
                        <span>-</span>
                        <span class="tab-fret-number">${nextFret}</span>
                        <span>--|</span>
                    `;
            practiceTabView.appendChild(stringEl);
        });
    }

    function updateStatsDisplay() {
        correctCountEl.textContent = correctCount;
        incorrectCountEl.textContent = incorrectCount;
    }

    function handleAnswer(e) {
        if (isAnswered) return;
        isAnswered = true;

        const allButtons = answerOptionsEl.querySelectorAll('button');
        allButtons.forEach(btn => { btn.disabled = true; });

        if (currentView === 'noteToTab') {
            const selectedPosition = e.currentTarget.dataset.position;
            if (selectedPosition === correctAnswer) {
                correctCount++;
                feedbackEl.textContent = 'Correct!';
                feedbackEl.className = 'mt-6 h-10 text-2xl font-semibold transition-opacity duration-300 text-green-600';
                e.currentTarget.classList.add('bg-green-100', 'border-green-400');
            } else {
                incorrectCount++;
                const [string, fret] = correctAnswer.split('-');
                noteMistakes[getNote(string, fret)] = (noteMistakes[getNote(string, fret)] || 0) + 1;
                feedbackEl.innerHTML = `Wrong! Correct was <span class="font-bold">${tuning[string]} string - ${fret} fret</span>`;
                feedbackEl.className = 'mt-6 h-10 text-xl font-semibold transition-opacity duration-300 text-red-600';
                e.currentTarget.classList.add('bg-red-100', 'border-red-400');
                allButtons.forEach(btn => {
                    if (btn.dataset.position === correctAnswer) {
                        btn.classList.add('bg-green-100', 'border-green-400');
                    }
                });
            }
        } else {
            const selectedNote = e.currentTarget.dataset.note;
            if (selectedNote === correctAnswer) {
                correctCount++;
                feedbackEl.textContent = 'Correct!';
                feedbackEl.className = 'mt-6 h-10 text-2xl font-semibold transition-opacity duration-300 text-green-600';
                e.currentTarget.classList.add('bg-green-100', 'border-green-400');
            } else {
                incorrectCount++;
                noteMistakes[correctAnswer] = (noteMistakes[correctAnswer] || 0) + 1;
                feedbackEl.textContent = `Wrong! The correct note was ${correctAnswer}`;
                feedbackEl.className = 'mt-6 h-10 text-2xl font-semibold transition-opacity duration-300 text-red-600';
                e.currentTarget.classList.add('bg-red-100', 'border-red-400');
                allButtons.forEach(btn => {
                    if (btn.dataset.note === correctAnswer) {
                        btn.classList.add('bg-green-100', 'border-green-400');
                    }
                });
            }
        }

        // Record position accuracy for heat map
        if (currentQuestionPos) {
            const key = `${currentQuestionPos.string}-${currentQuestionPos.fret}`;
            if (!positionStats[key]) {
                positionStats[key] = { correct: 0, total: 0 };
            }
            positionStats[key].total++;
            if ((currentView === 'noteToTab' && e.currentTarget.dataset.position === correctAnswer) ||
                (currentView !== 'noteToTab' && e.currentTarget.dataset.note === correctAnswer)) {
                positionStats[key].correct++;
            }
            savePositionStats();
            if (heatMapEnabled) updateHeatMap();
        }

        updateStatsDisplay();
        if (!isMetronomeOn) {
            setTimeout(newQuestion, 1200);
        }
    }

    // --- Metronome Logic ---
    function metronomeTick() {
        // --- Workout Timer Check ---
        if (workoutState.active) {
            if (workoutState.stepStartTime === 0) workoutState.stepStartTime = Date.now();
            const accum = workoutState.accumulatedTime || 0;
            const elapsed = ((Date.now() - workoutState.stepStartTime) + accum) / 1000;
            const workout = WORKOUTS.find(w => w.id === workoutState.id);
            // Ensure workout/step validity
            if (workout && workout.exercises[workoutState.currentStep]) {
                const stepDuration = workout.exercises[workoutState.currentStep].duration;
                if (metronomeBtnLabel) metronomeBtnLabel.textContent = `Time Remaining: ${Math.ceil(stepDuration - elapsed)}s`;

                if (elapsed >= stepDuration) {
                    stopMetronome();
                    const nextIndex = workoutState.currentStep + 1;
                    if (nextIndex < workout.exercises.length) {
                        loadWorkoutStep(nextIndex);
                        // Optional: Play a completion sound here
                    } else {
                        finishWorkout();
                    }
                    return;
                }
            }
        }

        if (isCountingIn) {
            playTick(true);
            feedbackEl.textContent = `Starting in ${COUNT_IN_BEATS - countInCounter}...`;
            feedbackEl.className = 'mt-6 h-10 text-2xl font-semibold transition-opacity duration-300 text-yellow-600';
            countInCounter++;
            if (countInCounter >= COUNT_IN_BEATS) {
                isCountingIn = false;
                noteTickCounter = 0;
                feedbackEl.textContent = '';
            }
            return;
        }

        playTick(false);
        speedUpTickCounter++;

        if (speedUpToggle.checked) {
            const speedInterval = parseInt(speedUpInterval.value) || 8;
            if (speedUpTickCounter >= speedInterval) {
                speedUpTickCounter = 0;
                const amount = parseInt(speedUpAmount.value) || 5;
                const currentBpm = parseInt(bpmSlider.value);
                const newBpm = Math.min(parseInt(bpmSlider.max), currentBpm + amount);
                if (newBpm !== currentBpm) {
                    bpmSlider.value = newBpm;
                    bpmDisplay.textContent = `${newBpm} BPM`;
                    if (metronomeMiniBpm) metronomeMiniBpm.textContent = `${newBpm} BPM`;
                    try { localStorage.setItem('lastBpm', String(newBpm)); } catch (err) { }
                    clearInterval(metronomeIntervalId);
                    metronomeIntervalId = setInterval(metronomeTick, 60000 / newBpm);
                }
            }
        }

        // --- Burst Mode Logic (for Technique module) ---
        if (currentModule === 'technique' && burstModeToggle?.checked) {
            burstBeatCounter++;
            const slowBeats = parseInt(burstSlowBeatsInput?.value) || 4;
            const fastBeats = parseInt(burstFastBeatsInput?.value) || 2;
            const multiplier = parseFloat(burstMultiplierSelect?.value) || 2;

            let needsIntervalChange = false;
            let newTempo = burstBaseTempo;

            if (burstPhase === 'slow' && burstBeatCounter >= slowBeats) {
                // Switch to fast phase
                burstPhase = 'fast';
                burstBeatCounter = 0;
                newTempo = Math.round(burstBaseTempo * multiplier);
                needsIntervalChange = true;

                // Update indicator
                if (burstIndicator) {
                    burstIndicator.textContent = 'FAST';
                    burstIndicator.classList.remove('slow');
                    burstIndicator.classList.add('fast');
                }
            } else if (burstPhase === 'fast' && burstBeatCounter >= fastBeats) {
                // Switch back to slow phase
                burstPhase = 'slow';
                burstBeatCounter = 0;
                newTempo = burstBaseTempo;
                needsIntervalChange = true;

                // Update indicator
                if (burstIndicator) {
                    burstIndicator.textContent = 'SLOW';
                    burstIndicator.classList.remove('fast');
                    burstIndicator.classList.add('slow');
                }
            }

            if (needsIntervalChange) {
                clearInterval(metronomeIntervalId);
                metronomeIntervalId = setInterval(metronomeTick, 60000 / newTempo);
            }
        }

        if (currentModule === 'technique') {
            techniqueTick();
            return;
        }

        const noteDuration = parseInt(noteDurationInput.value) || 1;

        // At the start of a cycle, generate the new question/note.
        if (noteTickCounter === 0) {
            // Check for timeout on the PREVIOUS question in 'guessNote' mode.
            if (currentModule === 'guessNote' && !isAnswered && correctAnswer !== '') {
                incorrectCount++;
                if (currentView === 'noteToTab') {
                    const [string, fret] = correctAnswer.split('-');
                    noteMistakes[getNote(string, fret)] = (noteMistakes[getNote(string, fret)] || 0) + 1;
                } else {
                    noteMistakes[correctAnswer] = (noteMistakes[correctAnswer] || 0) + 1;
                }
                updateStatsDisplay();
                feedbackEl.textContent = `Too slow!`;
                feedbackEl.className = 'mt-6 h-10 text-2xl font-semibold transition-opacity duration-300 text-yellow-600';
            }
            newQuestion();
        }

        // Update the visual state for the CURRENT beat.
        if (currentModule === 'playPractice') {
            updateActiveDot(noteTickCounter);
        }

        // Advance the counter for the next beat.
        noteTickCounter++;

        // Reset the counter if the duration has been reached, so the next tick starts a new cycle.
        if (noteTickCounter >= noteDuration) {
            noteTickCounter = 0;
        }
    }

    function setMetronomeButtonUi(running) {
        if (!metronomeBtn) return;
        metronomeBtn.classList.toggle('is-running', running);
        metronomeBtn.setAttribute('aria-pressed', running ? 'true' : 'false');

        const nextLabel = running ? 'Stop Metronome' : 'Start Metronome';
        if (metronomeBtnLabel) {
            metronomeBtnLabel.textContent = nextLabel;
        } else {
            metronomeBtn.textContent = nextLabel;
        }
    }

    function stopMetronome() {
        if (!isMetronomeOn) return;

        // Handle Workout Pause
        if (typeof workoutState !== 'undefined' && workoutState.active && workoutState.stepStartTime > 0) {
            const now = Date.now();
            if (!workoutState.accumulatedTime) workoutState.accumulatedTime = 0;
            workoutState.accumulatedTime += (now - workoutState.stepStartTime);
            workoutState.stepStartTime = 0; // Paused
        }

        isMetronomeOn = false;
        releaseWakeLock();

        if (metronomeIntervalId) {
            clearInterval(metronomeIntervalId);
            metronomeIntervalId = null;
        }

        setMetronomeButtonUi(false);

        nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        nextBtn.disabled = false;

        isCountingIn = false;
        countInCounter = 0;
        noteTickCounter = 0;
        speedUpTickCounter = 0;

        // Reset burst mode state
        burstBeatCounter = 0;
        burstPhase = 'slow';
        if (burstIndicator) {
            burstIndicator.classList.add('hidden');
        }

        feedbackEl.textContent = '';

        // Hide step controls if active
        const stepControls = document.getElementById('step-controls');
        if (stepControls) stepControls.classList.add('hidden');
        if (metronomeBtn) metronomeBtn.classList.remove('hidden');
        if (metronomeBtnLabel) metronomeBtnLabel.textContent = isStepThroughMode ? 'Start Step Mode' : 'Start Metronome';

        if (currentModule === 'playPractice') {
            updateActiveDot(-1);
        }
        if (currentModule === 'technique') {
            resetSpiderState();
        }
    }

    function startMetronome() {
        if (isMetronomeOn) return;

        // Resume Workout Timer
        if (typeof workoutState !== 'undefined' && workoutState.active) {
            if (workoutState.stepStartTime === 0) {
                workoutState.stepStartTime = Date.now();
            }
        }

        isMetronomeOn = true;
        requestWakeLock();
        setupAudio();
        setMetronomeButtonUi(true);

        nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
        nextBtn.disabled = true;

        isCountingIn = true;
        countInCounter = 0;
        noteTickCounter = 0;
        speedUpTickCounter = 0;

        // Initialize burst mode state
        burstBeatCounter = 0;
        burstPhase = 'slow';
        burstBaseTempo = parseInt(bpmSlider.value);
        if (burstModeToggle?.checked && burstIndicator) {
            burstIndicator.textContent = 'SLOW';
            burstIndicator.classList.remove('fast', 'hidden');
            burstIndicator.classList.add('slow');
        }

        if (currentModule === 'technique') {
            resetSpiderState();
        }

        metronomeIntervalId = setInterval(metronomeTick, 60000 / parseInt(bpmSlider.value));
        metronomeTick();
    }

    function toggleMetronome() {
        if (isMetronomeOn) {
            stopMetronome();
        } else {
            if (isStepThroughMode && currentModule === 'technique') {
                startStepMode();
            } else {
                startMetronome();
            }
        }
    }

    function startStepMode() {
        if (isMetronomeOn) return;

        isMetronomeOn = true;
        setMetronomeButtonUi(true); // Updates is-running state

        // UI Swap
        if (metronomeBtn) metronomeBtn.classList.add('hidden');
        const stepControls = document.getElementById('step-controls');
        if (stepControls) stepControls.classList.remove('hidden');

        // Reset and Tick Once
        resetSpiderState();
        techniqueTick();
        updateStepInfo();
    }

    function nextStep() {
        if (!isMetronomeOn || !isStepThroughMode) return;
        techniqueTick();
        updateStepInfo();
    }

    function updateStepInfo() {
        const fingerEl = document.getElementById('step-finger-info');
        const pickEl = document.getElementById('step-pick-info');

        // Try to get info from active dot in DOM
        // This is a robust way without calculating state logic duplication
        const visibleDots = Array.from(document.querySelectorAll('.spider-dot')).filter(d => d.style.display !== 'none');

        if (visibleDots.length > 0) {
            // Find the one that was just added/moved? 
            // In single note exercises (Spider, Linear), usually 1 dot active or last one moved.
            // spiderDots array order?
            // Let's just take the last one visible (often the newest)
            const dot = visibleDots[visibleDots.length - 1];

            // Extract finger from class
            let finger = '-';
            if (dot.classList.contains('finger-1')) finger = '1 (Index)';
            else if (dot.classList.contains('finger-2')) finger = '2 (Middle)';
            else if (dot.classList.contains('finger-3')) finger = '3 (Ring)';
            else if (dot.classList.contains('finger-4')) finger = '4 (Pinky)';

            if (fingerEl) fingerEl.textContent = `Finger: ${finger}`;
        }

        // Pick direction estimation (parity of step)
        if (pickEl && spiderState) {
            const step = spiderState.step || 0;
            // step is incremented AFTER tick usually?
            // techniqueTick -> calls *Tick -> increments step at end?
            // If so, current step-1 was the one shown.
            // But resetSpiderState sets step=0. techniqueTick runs (uses step 0, then increments to 1).
            // So displayed note corresponds to step-1.
            // Parity: 0=Down, 1=Up for Alternating.
            const currentDisplayedStep = step > 0 ? step - 1 : 0;
            const direction = currentDisplayedStep % 2 === 0 ? 'Down' : 'Up';
            pickEl.textContent = `Pick: ${direction}`;
        }
    }

    // --- Sequence Generator Functions ---
    // Pre-computes exercise sequences for visualization and progress tracking

    function getPickDirection(index, startWith = 'down') {
        const directions = startWith === 'down' ? ['down', 'up'] : ['up', 'down'];
        return directions[index % 2];
    }

    function generateExerciseSequence(config) {
        const { exerciseType, ...params } = config;

        switch (exerciseType) {
            case 'spider':
            case 'spiderWalk':
                return generateSpiderSequence(params);
            case 'permutation':
                return generatePermutationSequence(params);
            case 'linear':
                return generateLinearSequence(params);
            case 'diagonal':
                return generateDiagonalSequence(params);
            case 'stringSkip':
                return generateStringSkipSequence(params);
            case 'legato':
                return generateLegatoSequence(params);
            default:
                return generateSpiderSequence(params);
        }
    }

    function generateSpiderSequence({ startFret = 5, direction = 'both', strings = 6 }) {
        const sequence = [];
        const fingerPattern = [1, 2, 3, 4];
        const stringOrder = direction === 'descending'
            ? Array.from({ length: strings }, (_, i) => i)  // 0,1,2,3,4,5 (high to low)
            : Array.from({ length: strings }, (_, i) => strings - 1 - i);  // 5,4,3,2,1,0 (low to high)

        let noteIndex = 0;
        stringOrder.forEach(string => {
            fingerPattern.forEach(finger => {
                sequence.push({
                    string,
                    fret: startFret + (finger - 1),
                    finger,
                    pickDirection: getPickDirection(noteIndex++)
                });
            });
        });

        // If direction is 'both', add descending
        if (direction === 'both') {
            const descendingStrings = Array.from({ length: strings }, (_, i) => i);
            descendingStrings.forEach(string => {
                [...fingerPattern].reverse().forEach(finger => {
                    sequence.push({
                        string,
                        fret: startFret + (finger - 1),
                        finger,
                        pickDirection: getPickDirection(noteIndex++)
                    });
                });
            });
        }

        return sequence;
    }

    function generatePermutationSequence({ pattern = [1, 2, 3, 4], startFret = 5, direction = 'both', strings = 6 }) {
        const sequence = [];
        const stringOrder = direction === 'descending'
            ? Array.from({ length: strings }, (_, i) => i)
            : Array.from({ length: strings }, (_, i) => strings - 1 - i);

        let noteIndex = 0;
        stringOrder.forEach(string => {
            pattern.forEach(finger => {
                sequence.push({
                    string,
                    fret: startFret + (finger - 1),
                    finger,
                    pickDirection: getPickDirection(noteIndex++)
                });
            });
        });

        if (direction === 'both') {
            const descendingStrings = Array.from({ length: strings }, (_, i) => i);
            descendingStrings.forEach(string => {
                [...pattern].reverse().forEach(finger => {
                    sequence.push({
                        string,
                        fret: startFret + (finger - 1),
                        finger,
                        pickDirection: getPickDirection(noteIndex++)
                    });
                });
            });
        }

        return sequence;
    }

    function generateLinearSequence({ string = 5, startFret = 1, endFret = 12, notesPerShift = 4 }) {
        const sequence = [];
        const fingerPattern = [1, 2, 3, 4];
        let noteIndex = 0;

        // Ascending
        for (let baseFret = startFret; baseFret <= endFret - 3; baseFret++) {
            for (let i = 0; i < notesPerShift && i < fingerPattern.length; i++) {
                const finger = fingerPattern[i];
                sequence.push({
                    string,
                    fret: baseFret + (finger - 1),
                    finger,
                    pickDirection: getPickDirection(noteIndex++)
                });
            }
        }

        // Descending
        for (let baseFret = endFret - 3; baseFret >= startFret; baseFret--) {
            for (let i = notesPerShift - 1; i >= 0 && i < fingerPattern.length; i--) {
                const finger = fingerPattern[i];
                sequence.push({
                    string,
                    fret: baseFret + (finger - 1),
                    finger,
                    pickDirection: getPickDirection(noteIndex++)
                });
            }
        }

        return sequence;
    }

    function generateDiagonalSequence({ startFret = 3, pattern = 'ascending', strings = 6 }) {
        const sequence = [];
        let noteIndex = 0;
        const fingerPattern = [1, 2, 3, 4];

        if (pattern === 'ascending' || pattern === 'full') {
            // Start from low E (5), move up strings while fret increases
            for (let i = 0; i < strings; i++) {
                const string = strings - 1 - i; // 5,4,3,2,1,0
                fingerPattern.forEach(finger => {
                    sequence.push({
                        string,
                        fret: startFret + i + (finger - 1),
                        finger,
                        pickDirection: getPickDirection(noteIndex++)
                    });
                });
            }
        }

        if (pattern === 'descending' || pattern === 'full') {
            // Start from high e (0), move down strings while fret decreases
            const descendStartFret = pattern === 'full' ? startFret + strings - 1 : startFret + strings - 1;
            for (let i = 0; i < strings; i++) {
                const string = i; // 0,1,2,3,4,5
                [...fingerPattern].reverse().forEach(finger => {
                    sequence.push({
                        string,
                        fret: descendStartFret - i + (4 - finger),
                        finger,
                        pickDirection: getPickDirection(noteIndex++)
                    });
                });
            }
        }

        return sequence;
    }

    function generateStringSkipSequence({ skipPattern = 'single', startFret = 5, fingerPattern = [1, 2, 3, 4] }) {
        const sequence = [];
        const patternData = SKIP_PATTERNS[skipPattern] || SKIP_PATTERNS.single;
        const stringSequence = patternData.sequence;
        let noteIndex = 0;

        stringSequence.forEach(string => {
            fingerPattern.forEach(finger => {
                sequence.push({
                    string,
                    fret: startFret + (finger - 1),
                    finger,
                    pickDirection: getPickDirection(noteIndex++)
                });
            });
        });

        return sequence;
    }

    function generateLegatoSequence({ type = 'trill', startFret = 5, trillPair = [1, 2], strings = 6 }) {
        const sequence = [];
        const stringOrder = Array.from({ length: strings }, (_, i) => strings - 1 - i);
        let noteIndex = 0;

        if (type === 'trill') {
            // Trill between two fingers
            stringOrder.forEach(string => {
                for (let rep = 0; rep < 4; rep++) {
                    trillPair.forEach(finger => {
                        sequence.push({
                            string,
                            fret: startFret + (finger - 1),
                            finger,
                            pickDirection: rep === 0 && finger === trillPair[0] ? 'down' : null,
                            legato: finger === trillPair[0] ? null : 'tr'
                        });
                    });
                }
            });
        } else if (type === 'hammerOnly') {
            // Ascending 1-2-3-4, hammer-ons
            stringOrder.forEach(string => {
                [1, 2, 3, 4].forEach((finger, i) => {
                    sequence.push({
                        string,
                        fret: startFret + (finger - 1),
                        finger,
                        pickDirection: i === 0 ? 'down' : null,
                        legato: i === 0 ? null : 'H'
                    });
                });
            });
        } else if (type === 'pullOnly') {
            // Descending 4-3-2-1, pull-offs
            stringOrder.forEach(string => {
                [4, 3, 2, 1].forEach((finger, i) => {
                    sequence.push({
                        string,
                        fret: startFret + (finger - 1),
                        finger,
                        pickDirection: i === 0 ? 'down' : null,
                        legato: i === 0 ? null : 'P'
                    });
                });
            });
        } else if (type === 'threeNote') {
            // 3-note pattern: 1-2-4 ascending, 4-2-1 descending
            const patternAsc = [1, 2, 4];
            const patternDesc = [4, 2, 1];
            const fretsAsc = [0, 1, 3];
            const fretsDesc = [3, 1, 0];

            stringOrder.forEach(string => {
                // Ascending (H-H)
                patternAsc.forEach((finger, i) => {
                    sequence.push({
                        string,
                        fret: startFret + fretsAsc[i],
                        finger,
                        pickDirection: i === 0 ? 'down' : null,
                        legato: i === 0 ? null : 'H'
                    });
                });
                // Descending (P-P)
                patternDesc.forEach((finger, i) => {
                    sequence.push({
                        string,
                        fret: startFret + fretsDesc[i],
                        finger,
                        pickDirection: null,
                        legato: i === 0 ? null : 'P'
                    });
                });
            });
        }

        return sequence;
    }

    function resetExerciseSequence() {
        exerciseState.currentSequence = [];
        exerciseState.sequenceIndex = 0;
    }

    function initializeExerciseSequence(exerciseType, config = {}) {
        const sequence = generateExerciseSequence({ exerciseType, ...config });
        exerciseState.currentSequence = sequence;
        exerciseState.sequenceIndex = 0;
        return sequence;
    }

    // --- Technique Trainer Logic ---
    function resetSpiderState() {
        const userStartFret = parseInt(spiderStartFretInput.value, 10) || 1;
        spiderState = {
            startFret: userStartFret,
            step: 0,
            stringDirection: 'up', // Start from thick string and go up
            fretDirection: 'right',
            positions: [null, null, null, null]
        };
        spiderDots.forEach(dot => dot.style.display = 'none');
        highlightDot.style.display = 'none';
    }

    function spiderWalkTick() {
        let { startFret, step, stringDirection, fretDirection, positions } = spiderState;

        const fingerToMove = step % SPIDER_FINGERS;
        const stringGroup = Math.floor(step / SPIDER_FINGERS);

        let currentString;
        if (stringDirection === 'down') {
            currentString = stringGroup;
        } else {
            currentString = (tuning.length - 1) - stringGroup;
        }

        if (stringGroup >= tuning.length) {
            if (fretDirection === 'right') {
                startFret++;
                if (startFret > FRET_COUNT - SPIDER_FINGERS + 1) {
                    startFret--;
                    fretDirection = 'left';
                }
            } else { // 'left'
                startFret--;
                if (startFret < 1) {
                    startFret = 1;
                    fretDirection = 'right';
                }
            }
            step = 0;
            stringDirection = stringDirection === 'down' ? 'up' : 'down';
            positions = [null, null, null, null];

            spiderState = { startFret, step, stringDirection, fretDirection, positions };
            spiderWalkTick();
            return;
        }

        const currentFret = startFret + fingerToMove;
        positions[fingerToMove] = { string: currentString, fret: currentFret, finger: fingerToMove + 1 };

        spiderDots.forEach((dot, index) => {
            const pos = positions[index];
            if (pos) {
                displayFingerDot(dot, pos.string, pos.fret, pos.finger);
            } else {
                dot.style.display = 'none';
                dot.textContent = '';
            }
        });

        spiderState.step++;
        spiderState.positions = positions;
    }

    // --- Exercise Dispatcher ---
    function techniqueTick() {
        switch (currentExercise) {
            case 'spiderWalk':
                spiderWalkTick();
                break;
            case 'permutation':
                permutationTick();
                break;
            case 'linear':
                linearTick();
                break;
            case 'diagonal':
                diagonalTick();
                break;
            case 'stringSkip':
                stringSkipTick();
                break;
            case 'legato':
                legatoTick();
                break;
            default:
                spiderWalkTick();
        }
    }

    // --- Permutation Tick ---
    function permutationTick() {
        const perm = PERMUTATIONS[exerciseState.permutation.currentPermutationIndex];
        const fingerPattern = perm.pattern;
        const startFret = parseInt(spiderStartFretInput?.value, 10) || 5;

        // Initialize state if not present
        if (!spiderState.step && spiderState.step !== 0) {
            spiderState = {
                startFret: startFret,
                step: 0,
                stringDirection: 'up',
                fretDirection: 'right',
                positions: [null, null, null, null],
                cycleComplete: false
            };
        }

        let { step, stringDirection, fretDirection, positions } = spiderState;

        const fingerToMove = step % SPIDER_FINGERS;
        const stringGroup = Math.floor(step / SPIDER_FINGERS);

        let currentString;
        if (stringDirection === 'down') {
            currentString = stringGroup;
        } else {
            currentString = (tuning.length - 1) - stringGroup;
        }

        // Cycle complete - switch direction
        if (stringGroup >= tuning.length) {
            if (fretDirection === 'right') {
                spiderState.startFret++;
                if (spiderState.startFret > FRET_COUNT - SPIDER_FINGERS + 1) {
                    spiderState.startFret--;
                    fretDirection = 'left';
                }
            } else {
                spiderState.startFret--;
                if (spiderState.startFret < 1) {
                    spiderState.startFret = 1;
                    fretDirection = 'right';

                    // Full cycle complete - mark permutation complete
                    markPermutationComplete(exerciseState.permutation.currentPermutationIndex);

                    // Advance to next in sequential/random mode
                    const mode = permutationModeSelect ? permutationModeSelect.value : 'single';
                    if (mode === 'sequential') {
                        const tier = permutationTierSelect ? permutationTierSelect.value : 'all';
                        const perms = getPermutationsByTier(tier);
                        const currentIdx = perms.findIndex(p => p.index === exerciseState.permutation.currentPermutationIndex);
                        const nextIdx = (currentIdx + 1) % perms.length;
                        exerciseState.permutation.currentPermutationIndex = perms[nextIdx].index;
                    } else if (mode === 'random') {
                        const tier = permutationTierSelect ? permutationTierSelect.value : 'all';
                        const perms = getPermutationsByTier(tier);
                        exerciseState.permutation.currentPermutationIndex = perms[Math.floor(Math.random() * perms.length)].index;
                    }
                    updateExerciseDisplay();
                }
            }
            step = 0;
            stringDirection = stringDirection === 'down' ? 'up' : 'down';
            positions = [null, null, null, null];

            spiderState.step = step;
            spiderState.stringDirection = stringDirection;
            spiderState.fretDirection = fretDirection;
            spiderState.positions = positions;
            permutationTick();
            return;
        }

        // Get finger from pattern (1-indexed in pattern, convert to 0-indexed fret offset)
        const finger = fingerPattern[fingerToMove];
        const currentFret = spiderState.startFret + (finger - 1);
        positions[fingerToMove] = { string: currentString, fret: currentFret, finger: finger };

        spiderDots.forEach((dot, index) => {
            const pos = positions[index];
            if (pos) {
                displayFingerDot(dot, pos.string, pos.fret, pos.finger);
            } else {
                dot.style.display = 'none';
                dot.textContent = '';
            }
        });

        spiderState.step++;
        spiderState.positions = positions;
    }

    // --- Linear Tick ---
    function linearTick() {
        const string = parseInt(linearStringSelect?.value || 5);
        const startFret = parseInt(linearStartFretInput?.value || 1);
        const endFret = parseInt(linearEndFretInput?.value || 12);
        const notesPerShift = parseInt(linearNotesPerShiftSelect?.value || 4);
        const direction = linearDirectionSelect?.value || 'ascending';

        // Initialize if needed
        if (exerciseState.linear.currentFret === undefined) {
            exerciseState.linear.currentFret = startFret;
            exerciseState.linear.notesPlayed = 0;
            exerciseState.linear.direction = direction;
        }

        const { currentFret, notesPlayed } = exerciseState.linear;
        const finger = (notesPlayed % 4) + 1;
        const fret = currentFret + (notesPlayed % 4);

        // Display current position
        spiderDots.forEach((dot, index) => {
            if (index === notesPlayed % 4) {
                displayFingerDot(dot, string, fret, finger);
            } else {
                dot.style.display = 'none';
                dot.textContent = '';
            }
        });

        exerciseState.linear.notesPlayed++;

        // Shift after notesPerShift notes
        if (exerciseState.linear.notesPlayed >= notesPerShift) {
            exerciseState.linear.notesPlayed = 0;

            if (exerciseState.linear.direction === 'ascending') {
                exerciseState.linear.currentFret++;
                if (exerciseState.linear.currentFret > endFret - 3) {
                    if (direction === 'roundTrip') {
                        exerciseState.linear.direction = 'descending';
                    } else {
                        exerciseState.linear.currentFret = startFret;
                    }
                }
            } else {
                exerciseState.linear.currentFret--;
                if (exerciseState.linear.currentFret < startFret) {
                    if (direction === 'roundTrip') {
                        exerciseState.linear.direction = 'ascending';
                    } else {
                        exerciseState.linear.currentFret = endFret - 3;
                    }
                }
            }
        }
    }

    // --- Diagonal Tick ---
    function diagonalTick() {
        const pattern = diagonalPatternSelect?.value || 'ascending';
        const startFret = parseInt(diagonalStartFretInput?.value || 3);

        // Initialize if needed
        if (exerciseState.diagonal.currentStep === undefined) {
            exerciseState.diagonal.currentStep = 0;
            exerciseState.diagonal.currentString = pattern === 'descending' ? 0 : 5;
            exerciseState.diagonal.currentFret = pattern === 'descending' ? startFret + 5 : startFret;
            exerciseState.diagonal.direction = pattern === 'descending' ? 'descending' : 'ascending';
            exerciseState.diagonal.positions = [null, null, null, null];
        }

        let { currentStep, currentString, currentFret, direction, positions } = exerciseState.diagonal;

        // 4 fingers per string position
        const fingerIndex = currentStep % 4;
        const finger = fingerIndex + 1;
        const fret = currentFret + fingerIndex;

        // Update position for this finger
        positions[fingerIndex] = { string: currentString, fret: fret, finger: finger };

        // Display all 4 dots, highlight current
        spiderDots.forEach((dot, index) => {
            const pos = positions[index];
            if (pos) {
                displayFingerDot(dot, pos.string, pos.fret, pos.finger);
                dot.classList.toggle('active-finger', index === fingerIndex);
            } else {
                dot.style.display = 'none';
                dot.textContent = '';
            }
        });

        exerciseState.diagonal.currentStep++;

        // After 4 notes, move to next string diagonally
        if (exerciseState.diagonal.currentStep % 4 === 0) {
            exerciseState.diagonal.positions = [null, null, null, null];

            if (direction === 'ascending') {
                exerciseState.diagonal.currentString--;
                exerciseState.diagonal.currentFret++;

                if (exerciseState.diagonal.currentString < 0) {
                    if (pattern === 'full') {
                        exerciseState.diagonal.direction = 'descending';
                        exerciseState.diagonal.currentString = 0;
                        // Don't change fret - continue from where we are
                    } else {
                        exerciseState.diagonal.currentString = 5;
                        exerciseState.diagonal.currentFret = startFret;
                    }
                }
            } else {
                exerciseState.diagonal.currentString++;
                exerciseState.diagonal.currentFret--;

                if (exerciseState.diagonal.currentString > 5) {
                    if (pattern === 'full') {
                        exerciseState.diagonal.direction = 'ascending';
                        exerciseState.diagonal.currentString = 5;
                        exerciseState.diagonal.currentFret = startFret;
                    } else {
                        exerciseState.diagonal.currentString = 0;
                        exerciseState.diagonal.currentFret = startFret + 5;
                    }
                }
            }
        }
    }

    // --- String Skip Tick ---
    function stringSkipTick() {
        const patternName = document.getElementById('skip-pattern')?.value || 'single';
        const pattern = SKIP_PATTERNS[patternName];
        const startFret = parseInt(document.getElementById('skip-start-fret')?.value || 5);
        const showPick = document.getElementById('skip-show-pick')?.checked !== false;

        if (!pattern) {
            spiderWalkTick();
            return;
        }

        // Initialize state
        if (exerciseState.stringSkip.currentStep === undefined) {
            exerciseState.stringSkip.currentStep = 0;
        }

        const sequence = pattern.sequence;
        const step = exerciseState.stringSkip.currentStep;
        const currentString = sequence[step];

        // Finger cycles 1-2-3-4-1-2-3-4 across the pattern
        const finger = (step % 4) + 1;
        const fret = startFret + (finger - 1); // Fret position based on finger

        // Pick direction: alternating down/up based on step
        const isDownPick = step % 2 === 0;
        const pickDirection = isDownPick ? 'down' : 'up';

        // Hide all dots first
        spiderDots.forEach(dot => {
            dot.style.display = 'none';
            dot.textContent = '';
            dot.className = 'spider-dot';
        });

        // Show only the current note
        const dot = spiderDots[0];
        displayFingerDot(dot, currentString, fret, finger);
        dot.classList.add('active-finger');

        // Show pick direction indicator on the fretboard
        if (showPick) {
            displayPickDirection(currentString, fret, pickDirection);
        }

        // Advance to next step
        exerciseState.stringSkip.currentStep = (step + 1) % sequence.length;
    }

    // --- Display pick direction indicator ---
    function displayPickDirection(string, fret, direction) {
        // Get or create pick indicator element
        let indicator = document.getElementById('pick-direction-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'pick-direction-indicator';
            indicator.className = 'pick-direction-indicator';
            fretboardContainer.appendChild(indicator);
        }

        // Position next to the fretboard (right side)
        const fretboard = document.getElementById('fretboard');
        if (!fretboard) return;

        const fretboardRect = fretboard.getBoundingClientRect();
        const containerRect = fretboardContainer.getBoundingClientRect();

        // Calculate string position within fretboard
        const stringHeight = fretboardRect.height / 6;
        const topOffset = fretboardRect.top - containerRect.top + (string + 0.5) * stringHeight;

        indicator.textContent = direction === 'down' ? '↓' : '↑';
        indicator.className = `pick-direction-indicator pick-${direction}`;
        indicator.style.position = 'absolute';
        indicator.style.right = '0';
        indicator.style.top = `${topOffset}px`;
        indicator.style.display = 'flex';
    }

    // --- Legato Tick ---
    function legatoTick() {
        const type = legatoTypeSelect?.value || 'trill';
        const startFret = parseInt(legatoStartFretInput?.value || 5);

        // Check if type changed, reset if needed
        if (exerciseState.legato.currentType !== type) {
            resetLegatoState();
        }

        if (type === 'trill') {
            const pairStr = trillPairSelect?.value || '1-2';
            const [f1, f2] = pairStr.split('-').map(Number);

            // Initialize trill state
            if (typeof exerciseState.legato.step === 'undefined') {
                exerciseState.legato.step = 0;
            }

            const step = exerciseState.legato.step;
            const isFirstFinger = step % 2 === 0;
            const finger = isFirstFinger ? f1 : f2;
            // Keep trill on string 5 (A string) or 4 (D string) for middle of neck feel? Use default 5 (low E)
            const currentString = 5;
            const fret = startFret + (isFirstFinger ? 0 : (f2 - f1));

            spiderDots.forEach((dot, index) => {
                if (index < 2) {
                    const dotFinger = index === 0 ? f1 : f2;
                    const dotFret = startFret + (index === 0 ? 0 : (f2 - f1));
                    displayFingerDot(dot, currentString, dotFret, dotFinger);
                    // Highlight active finger
                    dot.classList.toggle('active-finger', dotFinger === finger);
                } else {
                    dot.style.display = 'none';
                    dot.textContent = '';
                }
            });

            exerciseState.legato.step++;

        } else if (type === 'hammerOnly') {
            // Ascending 1-2-3-4
            if (typeof exerciseState.legato.step === 'undefined') exerciseState.legato.step = 0;
            if (typeof exerciseState.legato.stringIndex === 'undefined') exerciseState.legato.stringIndex = 5;

            const currentString = exerciseState.legato.stringIndex;
            const noteIndex = exerciseState.legato.step % 4; // 0, 1, 2, 3
            const finger = noteIndex + 1; // 1, 2, 3, 4

            // Display all 4 dots
            spiderDots.forEach((dot, index) => {
                const dotFinger = index + 1;
                const dotFret = startFret + index;
                displayFingerDot(dot, currentString, dotFret, dotFinger);
                dot.classList.toggle('active-finger', dotFinger === finger);
            });

            exerciseState.legato.step++;

            // Change string every 4 notes (ascending strings logic: 5->4->3->2->1->0->5...)
            if (exerciseState.legato.step % 4 === 0) {
                exerciseState.legato.stringIndex--;
                if (exerciseState.legato.stringIndex < 0) exerciseState.legato.stringIndex = 5;
            }

        } else if (type === 'pullOnly') {
            // Descending 4-3-2-1
            if (typeof exerciseState.legato.step === 'undefined') exerciseState.legato.step = 0;
            if (typeof exerciseState.legato.stringIndex === 'undefined') exerciseState.legato.stringIndex = 5;

            const currentString = exerciseState.legato.stringIndex;
            const noteIndex = exerciseState.legato.step % 4; // 0, 1, 2, 3
            const finger = 4 - noteIndex; // 4, 3, 2, 1

            // Display all 4 dots
            spiderDots.forEach((dot, index) => {
                const dotFinger = index + 1;
                const dotFret = startFret + index;
                displayFingerDot(dot, currentString, dotFret, dotFinger);
                dot.classList.toggle('active-finger', dotFinger === finger);
            });

            exerciseState.legato.step++;

            // Change string every 4 notes
            if (exerciseState.legato.step % 4 === 0) {
                exerciseState.legato.stringIndex--;
                if (exerciseState.legato.stringIndex < 0) exerciseState.legato.stringIndex = 5;
            }

        } else if (type === 'threeNote') {
            // 3-Note per string: 1-2-4 Ascending then 4-2-1 Descending
            if (typeof exerciseState.legato.step === 'undefined') exerciseState.legato.step = 0;
            if (typeof exerciseState.legato.stringIndex === 'undefined') exerciseState.legato.stringIndex = 5;

            const currentString = exerciseState.legato.stringIndex;
            const cycleStep = exerciseState.legato.step % 6;
            const isAscending = cycleStep < 3;
            exerciseState.legato.direction = isAscending ? 'asc' : 'desc';

            const noteIndex = cycleStep % 3; // 0, 1, 2

            // Config: 1-2-4 pattern
            const patternAsc = [1, 2, 4];
            const patternDesc = [4, 2, 1];
            const fretsAsc = [0, 1, 3];
            const fretsDesc = [3, 1, 0];

            const currentFinger = isAscending ? patternAsc[noteIndex] : patternDesc[noteIndex];

            // Always map dots to 1, 2, 4 positions
            spiderDots.forEach((dot, index) => {
                if (index < 3) {
                    // Fixed positions for dots: 1, 2, 4
                    const dotFinger = patternAsc[index];
                    const dotFret = startFret + fretsAsc[index];
                    displayFingerDot(dot, currentString, dotFret, dotFinger);
                    dot.classList.toggle('active-finger', dotFinger === currentFinger);
                } else {
                    dot.style.display = 'none';
                    dot.textContent = '';
                }
            });

            exerciseState.legato.step++;

            // Change string every 6 notes (after full up/down cycle)
            if (exerciseState.legato.step % 6 === 0) {
                exerciseState.legato.stringIndex--;
                if (exerciseState.legato.stringIndex < 0) exerciseState.legato.stringIndex = 5;
            }
        }

        // Draw Legato Arcs
        drawLegatoArcs(type, startFret);
    }

    function drawLegatoArcs(type, startFret) {
        const overlay = document.getElementById('legato-overlay');
        if (!overlay) return;
        overlay.innerHTML = ''; // Clear previous

        // Helper to draw arc between two indices with label
        const draw = (idx1, idx2, label) => {
            const dot1 = spiderDots[idx1];
            const dot2 = spiderDots[idx2];
            if (dot1.style.display !== 'none' && dot2.style.display !== 'none') {
                renderLegatoArc(overlay, dot1, dot2, label);
            }
        };

        if (type === 'hammerOnly') {
            // Ascending -> Hammer-on
            draw(0, 1, 'H');
            draw(1, 2, 'H');
            draw(2, 3, 'H');
        } else if (type === 'pullOnly') {
            // Descending -> Pull-off
            draw(3, 2, 'P');
            draw(2, 1, 'P');
            draw(1, 0, 'P');
        } else if (type === 'threeNote') {
            // Dynamic: H if ascending, P if descending
            const direction = exerciseState.legato.direction || 'asc';
            if (direction === 'asc') {
                draw(0, 1, 'H');
                draw(1, 2, 'H');
            } else {
                draw(2, 1, 'P');
                draw(1, 0, 'P');
            }
        } else if (type === 'trill') {
            draw(0, 1, 'tr');
        }
    }

    function renderLegatoArc(svg, dot1, dot2, label) {
        // Get positions relative to container
        // dot.offsetLeft/Top are accurate relative to fretboardContainer (offsetParent)
        const x1 = dot1.offsetLeft + dot1.offsetWidth / 2;
        const y1 = dot1.offsetTop + dot1.offsetHeight / 2;
        const x2 = dot2.offsetLeft + dot2.offsetWidth / 2;
        const y2 = dot2.offsetTop + dot2.offsetHeight / 2;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

        // Calculate Control Point for curve
        // Curve should bow "upwards" (lower Y) or "outwards" based on distance
        const cx = (x1 + x2) / 2;

        // Dynamic bow height based on distance
        const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        const bow = Math.min(40, Math.max(20, dist * 0.25));
        const cy = (y1 + y2) / 2 - bow;

        path.setAttribute("d", `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
        path.setAttribute("class", "legato-arc");

        svg.appendChild(path);

        if (label) {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", cx);
            text.setAttribute("y", cy - 5); // Slightly above the arc peak
            text.setAttribute("class", "legato-label");
            text.textContent = label;
            svg.appendChild(text);
        }
    }

    function resetLegatoState() {
        exerciseState.legato.currentType = legatoTypeSelect ? legatoTypeSelect.value : 'trill';
        const pairStr = trillPairSelect ? trillPairSelect.value : '1-2';
        exerciseState.legato.trillPair = pairStr.split('-').map(Number);
        exerciseState.legato.duration = trillDurationInput ? parseInt(trillDurationInput.value) : 15;

        // Initialize common state
        exerciseState.legato.step = 0;
        exerciseState.legato.stringIndex = 5; // Start on Low E

        spiderDots.forEach(dot => {
            dot.style.display = 'none';
            dot.textContent = '';
            dot.classList.remove('active-finger');
        });
    }
    // --- Display helper with finger color ---
    function displayFingerDot(dotElement, stringIndex, fretNumber, fingerNumber) {
        displayDotAt(dotElement, stringIndex, fretNumber);

        // Remove previous finger classes
        dotElement.classList.remove('finger-1', 'finger-2', 'finger-3', 'finger-4', 'active-finger');

        // Add current finger class
        if (fingerNumber >= 1 && fingerNumber <= 4) {
            dotElement.classList.add(`finger-${fingerNumber}`);
        }

        // Add finger number label
        dotElement.textContent = fingerNumber;
    }

    // --- UI Management & Accessibility ---
    function trapFocusInModal(e) {
        const focusableElements = statsModal.querySelectorAll('button');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }

    function displayDetailedStats() {
        lastFocusedElement = document.activeElement;
        statsContentEl.innerHTML = '';
        const sortedMistakes = Object.entries(noteMistakes).sort((a, b) => b[1] - a[1]);

        if (sortedMistakes.length === 0) {
            statsContentEl.innerHTML = `<p class="text-center" style="color:var(--text-light)">No mistakes! Great job!</p>`;
        } else {
            const list = document.createElement('ul');
            list.className = 'space-y-3';
            sortedMistakes.forEach(([note, count]) => {
                const item = document.createElement('li');
                item.className = 'flex justify-between items-center p-3 rounded-lg';
                item.style.backgroundColor = 'var(--bg-panel)';
                item.innerHTML = `
                            <span class="font-bold text-lg" style="color:var(--text-dark)">${note}</span>
                            <span class="text-red-600">${count} ${count > 1 ? 'mistakes' : 'mistake'}</span>
                        `;
                list.appendChild(item);
            });
            statsContentEl.appendChild(list);
        }
        statsModalOverlay.classList.remove('hidden');
        closeStatsBtn.focus();
        statsModalOverlay.addEventListener('keydown', trapFocusInModal);
    }

    function closeStatsModal() {
        statsModalOverlay.classList.add('hidden');
        statsModalOverlay.removeEventListener('keydown', trapFocusInModal);
        if (lastFocusedElement) {
            lastFocusedElement.focus();
        }
    }

    function updatePracticeView() {
        practiceNoteContainer.classList.toggle('hidden', currentPracticeMode !== 'noteNames');
        practiceTabView.classList.toggle('hidden', currentPracticeMode !== 'tabSequence');
        resetPracticeState();
        newQuestion();
    }

    function setModule(moduleName) {
        if (isMetronomeOn && moduleName !== currentModule) {
            stopMetronome();
        }
        try { localStorage.setItem('lastModule', moduleName); } catch (e) { }
        currentModule = moduleName;
        moduleSwitchBtns.forEach(btn => {
            const isActive = btn.dataset.module === moduleName;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive);
        });

        const isGuessNote = moduleName === 'guessNote';
        const isPlayPractice = moduleName === 'playPractice';
        const isTechnique = moduleName === 'technique';

        viewSwitcherContainer.classList.toggle('hidden', !isGuessNote);
        practiceModeContainer.classList.toggle('hidden', !isPlayPractice);
        techniqueModeContainer.classList.toggle('hidden', true); // Legacy
        if (isTechnique) {
            clearHeatMap();
        } else if (heatMapEnabled) {
            updateHeatMap();
        }

        statsDisplay.classList.toggle('hidden', isTechnique);
        statsBtn.classList.toggle('hidden', isTechnique);
        practiceSettingsContainer.classList.toggle('hidden', !isPlayPractice);
        techniqueSettingsContainer.classList.toggle('hidden', !isTechnique);
        nextBtn.classList.toggle('hidden', isTechnique);

        // Exercise system visibility
        const techTabs = document.getElementById('technique-tabs');
        if (techTabs) techTabs.classList.toggle('hidden', !isTechnique);
        const workCont = document.getElementById('workout-selection-container');
        if (workCont) workCont.classList.add('hidden'); // Default hidden, managed by tabs

        if (!isTechnique) {
            exerciseSelectionContainer.classList.add('hidden');
        } else {
            // If entering technique, default to exercises tab
            showExerciseSelection();
        }
        exerciseViewContainer.classList.add('hidden');

        practiceNoteContainer.classList.add('hidden');
        practiceTabView.classList.add('hidden');
        answerOptionsEl.classList.add('hidden');
        tabContainer.classList.add('hidden');
        noteToTabQuestionContainer.classList.add('hidden');

        // Explicitly manage fretboard visibility based on module
        if (isPlayPractice) {
            fretboardContainer.classList.add('hidden');
        } else if (isTechnique) {
            fretboardContainer.classList.remove('hidden');
        }
        // For 'guessNote', visibility will be handled by the setView() call below

        highlightDot.style.display = 'none'; // Ensure highlight dot is hidden

        beatDotsContainer.innerHTML = '';
        feedbackEl.textContent = '';

        if (isPlayPractice) {
            updatePracticeView();
            return;
        }

        if (isTechnique) {
            showExerciseSelection();
            updateDailyChallenge();
            updateProgressDisplay();
            return;
        }

        // Guess Note
        answerOptionsEl.classList.remove('hidden');
        setView(currentView);
    }

    // --- Exercise Management Functions ---
    let areWorkoutsRendered = false;
    let currentTechniqueTab = 'exercises';

    function renderWorkouts() {
        const grid = document.getElementById('workouts-grid');
        if (!grid) return;

        grid.innerHTML = WORKOUTS.map(workout => `
            <div class="exercise-card" data-workout="${workout.id}">
                <div class="exercise-card__icon">🏋️</div>
                <div class="exercise-card__title">${workout.title}</div>
                <div class="exercise-card__desc">${workout.totalTime} • ${workout.exercises.length} Exercises</div>
            </div>
        `).join('');
    }

    function switchTechniqueTab(tab) {
        currentTechniqueTab = tab;
        const exercisesTab = document.getElementById('tab-exercises');
        const workoutsTab = document.getElementById('tab-workouts');
        const exerciseContainer = document.getElementById('exercise-selection-container');
        const workoutContainer = document.getElementById('workout-selection-container');

        if (exercisesTab) exercisesTab.classList.toggle('active', tab === 'exercises');
        if (workoutsTab) workoutsTab.classList.toggle('active', tab === 'workouts');

        if (exerciseContainer) exerciseContainer.classList.toggle('hidden', tab !== 'exercises');
        if (workoutContainer) workoutContainer.classList.toggle('hidden', tab !== 'workouts');

        if (tab === 'workouts' && !areWorkoutsRendered) {
            renderWorkouts();
            areWorkoutsRendered = true;
        }
    }

    function showExerciseSelection() {
        stopMetronome();

        const tabs = document.getElementById('technique-tabs');
        if (tabs) tabs.classList.remove('hidden');

        switchTechniqueTab(currentTechniqueTab);

        exerciseViewContainer.classList.add('hidden');

        // Hide fretboard and metronome on selection screen
        fretboardContainer.classList.add('hidden');
        const metronomeRow = document.getElementById('metronome-row');
        if (metronomeRow) metronomeRow.classList.add('hidden');

        // Update card active states
        exerciseCards.forEach(card => {
            card.classList.toggle('active', card.dataset.exercise === currentExercise);
        });

        // Show daily challenge and progress
        if (dailyChallengeBanner) dailyChallengeBanner.classList.remove('hidden');
        if (progressSection) progressSection.classList.remove('hidden');

        // Reset spider dots
        spiderDots.forEach(dot => {
            dot.style.display = 'none';
            dot.className = 'spider-dot';
            dot.textContent = '';
        });
    }

    function selectExercise(exerciseId) {
        currentExercise = exerciseId;

        // Update UI
        exerciseCards.forEach(card => {
            card.classList.toggle('active', card.dataset.exercise === exerciseId);
        });

        // Show exercise view
        exerciseSelectionContainer.classList.add('hidden');
        exerciseViewContainer.classList.remove('hidden');

        // Show fretboard and metronome (hidden on selection screen)
        fretboardContainer.classList.remove('hidden');
        const metronomeRow = document.getElementById('metronome-row');
        if (metronomeRow) metronomeRow.classList.remove('hidden');

        // Update title
        if (currentExerciseTitle) {
            currentExerciseTitle.textContent = EXERCISES[exerciseId].name;
        }

        // Show relevant settings
        updateVisibleSettings();

        // Reset and initialize exercise
        resetExerciseState();

        // Update pattern display
        updateExerciseDisplay();
    }

    // --- Workout Runner ---
    let workoutState = {
        active: false,
        id: null,
        currentStep: 0,
        stepStartTime: 0
    };

    function startWorkout(workoutId) {
        const workout = WORKOUTS.find(w => w.id === workoutId);
        if (!workout) return;

        workoutState = {
            active: true,
            id: workoutId,
            currentStep: 0,
            stepStartTime: 0,
            accumulatedTime: 0
        };

        loadWorkoutStep(0);
    }

    function loadWorkoutStep(index) {
        const workout = WORKOUTS.find(w => w.id === workoutState.id);
        if (!workout || index >= workout.exercises.length) {
            finishWorkout();
            return;
        }

        workoutState.currentStep = index;
        workoutState.stepStartTime = 0;
        workoutState.accumulatedTime = 0;
        const step = workout.exercises[index];

        // Hide selection containers explicitly
        document.getElementById('workout-selection-container').classList.add('hidden');
        document.getElementById('exercise-selection-container').classList.add('hidden');

        // Load exercise engine
        selectExercise(step.type);

        // Override UI
        if (currentExerciseTitle) {
            currentExerciseTitle.textContent = `${workout.title}: ${step.name} (${index + 1}/${workout.exercises.length})`;
        }

        // Update Metronome Button
        if (metronomeBtnLabel) metronomeBtnLabel.textContent = `Start Step ${index + 1} (${step.duration}s)`;

        // Apply Settings
        if (step.settings && step.settings.bpm) {
            bpm = step.settings.bpm;
            bpmDisplay.textContent = bpm;
        }

        // Set specific permutation if needed
        if (step.settings && step.settings.permutationIndex !== undefined) {
            currentPermutationIndex = step.settings.permutationIndex;
            resetExerciseState(); // Re-init with new permutation
            // Note: updateVisibleSettings might need to refresh
            const permSelect = document.getElementById('permutation-select');
            if (permSelect) permSelect.value = currentPermutationIndex;
            updateExerciseDisplay();
        }
    }

    function finishWorkout() {
        workoutState.active = false;
        alert("🎉 Workout Complete!");
        showExerciseSelection();
    }

    function updateVisibleSettings() {
        // Hide all exercise settings first
        if (permutationSettingsContainer) permutationSettingsContainer.classList.add('hidden');
        if (linearSettingsContainer) linearSettingsContainer.classList.add('hidden');
        if (diagonalSettingsContainer) diagonalSettingsContainer.classList.add('hidden');
        if (stringskipSettingsContainer) stringskipSettingsContainer.classList.add('hidden');
        if (legatoSettingsContainer) legatoSettingsContainer.classList.add('hidden');
        if (burstSettingsContainer) burstSettingsContainer.classList.add('hidden');

        // Show relevant settings
        switch (currentExercise) {
            case 'spiderWalk':
                if (techniqueSettingsContainer) techniqueSettingsContainer.classList.remove('hidden');
                break;
            case 'permutation':
                if (permutationSettingsContainer) permutationSettingsContainer.classList.remove('hidden');
                break;
            case 'linear':
                if (linearSettingsContainer) linearSettingsContainer.classList.remove('hidden');
                break;
            case 'diagonal':
                if (diagonalSettingsContainer) diagonalSettingsContainer.classList.remove('hidden');
                break;
            case 'stringSkip':
                if (stringskipSettingsContainer) stringskipSettingsContainer.classList.remove('hidden');
                break;
            case 'legato':
                if (legatoSettingsContainer) legatoSettingsContainer.classList.remove('hidden');
                break;
        }

        // Show burst settings for all exercises
        if (burstSettingsContainer) burstSettingsContainer.classList.remove('hidden');
    }

    function resetExerciseState() {
        // Reset sequence tracking
        resetExerciseSequence();

        switch (currentExercise) {
            case 'spiderWalk':
                resetSpiderState();
                initializeExerciseSequence('spider', {
                    startFret: parseInt(spiderStartFretInput?.value || 5),
                    direction: 'both'
                });
                break;
            case 'permutation':
                resetPermutationState();
                const perm = PERMUTATIONS[exerciseState.permutation.currentPermutationIndex];
                initializeExerciseSequence('permutation', {
                    pattern: perm?.pattern || [1, 2, 3, 4],
                    startFret: parseInt(spiderStartFretInput?.value || 5),
                    direction: 'both'
                });
                break;
            case 'linear':
                resetLinearState();
                initializeExerciseSequence('linear', {
                    string: parseInt(linearStringSelect?.value || 5),
                    startFret: parseInt(linearStartFretInput?.value || 1),
                    endFret: parseInt(linearEndFretInput?.value || 12),
                    notesPerShift: parseInt(linearNotesPerShiftInput?.value || 4)
                });
                break;
            case 'diagonal':
                resetDiagonalState();
                initializeExerciseSequence('diagonal', {
                    startFret: parseInt(diagonalStartFretInput?.value || 3),
                    pattern: diagonalPatternSelect?.value || 'ascending'
                });
                break;
            case 'stringSkip':
                resetStringSkipState();
                initializeExerciseSequence('stringSkip', {
                    skipPattern: skipPatternSelect?.value || 'single',
                    startFret: parseInt(skipStartFretInput?.value || 5)
                });
                break;
            case 'legato':
                resetLegatoState();
                initializeExerciseSequence('legato', {
                    type: legatoTypeSelect?.value || 'trill',
                    startFret: parseInt(legatoStartFretInput?.value || 5),
                    trillPair: [
                        parseInt(legatoFinger1Select?.value || 1),
                        parseInt(legatoFinger2Select?.value || 2)
                    ]
                });
                break;
        }
    }

    function resetPermutationState() {
        const mode = permutationModeSelect ? permutationModeSelect.value : 'single';

        if (mode === 'daily') {
            const daily = getDailyPermutation(new Date());
            exerciseState.permutation.currentPermutationIndex = daily.index;
        } else if (mode === 'sequential') {
            // Start from first uncompleted or 0
            const tier = permutationTierSelect ? permutationTierSelect.value : 'all';
            const perms = getPermutationsByTier(tier);
            const uncompleted = perms.find(p => !userProgress.permutationsCompleted.has(p.index));
            exerciseState.permutation.currentPermutationIndex = uncompleted ? uncompleted.index : 0;
        } else {
            exerciseState.permutation.currentPermutationIndex = permutationSelect ?
                parseInt(permutationSelect.value) : 0;
        }

        spiderDots.forEach(dot => {
            dot.style.display = 'none';
            dot.className = 'spider-dot';
            dot.textContent = '';
        });
    }

    function resetLinearState() {
        exerciseState.linear.currentFret = linearStartFretInput ?
            parseInt(linearStartFretInput.value) : 1;
        exerciseState.linear.direction = linearDirectionSelect ?
            linearDirectionSelect.value : 'ascending';
        exerciseState.linear.notesPlayed = 0;

        spiderDots.forEach(dot => dot.style.display = 'none');
    }

    function resetDiagonalState() {
        const pattern = diagonalPatternSelect?.value || 'ascending';
        const startFret = diagonalStartFretInput ? parseInt(diagonalStartFretInput.value) : 3;

        exerciseState.diagonal.currentStep = undefined; // Force reinit on tick
        exerciseState.diagonal.currentString = pattern === 'descending' ? 0 : 5;
        exerciseState.diagonal.currentFret = pattern === 'descending' ? startFret + 5 : startFret;
        exerciseState.diagonal.direction = pattern === 'descending' ? 'descending' : 'ascending';
        exerciseState.diagonal.positions = [null, null, null, null];

        spiderDots.forEach(dot => {
            dot.style.display = 'none';
            dot.className = 'spider-dot';
            dot.textContent = '';
        });
    }

    function resetStringSkipState() {
        exerciseState.stringSkip.currentStep = undefined; // Force reinit on tick
        exerciseState.stringSkip.fingerStep = 0;
        exerciseState.stringSkip.positions = [null, null, null, null];

        spiderDots.forEach(dot => {
            dot.style.display = 'none';
            dot.className = 'spider-dot';
            dot.textContent = '';
        });

        // Hide pick indicator when resetting/switching exercises
        const pickIndicator = document.getElementById('pick-direction-indicator');
        if (pickIndicator) pickIndicator.style.display = 'none';
    }

    function resetLegatoState() {
        exerciseState.legato.currentType = legatoTypeSelect ? legatoTypeSelect.value : 'trill';
        const pairStr = trillPairSelect ? trillPairSelect.value : '1-2';
        exerciseState.legato.trillPair = pairStr.split('-').map(Number);
        exerciseState.legato.duration = trillDurationInput ?
            parseInt(trillDurationInput.value) : 15;

        spiderDots.forEach(dot => dot.style.display = 'none');
    }

    function updateDailyChallenge() {
        const daily = getDailyPermutation(new Date());
        if (dailyChallengePattern) {
            dailyChallengePattern.textContent = formatPermutation(daily.pattern);
        }
    }

    function updateExerciseDisplay() {
        const exercise = EXERCISES[currentExercise];

        if (exercisePatternDisplay) {
            let patternText = '';

            switch (currentExercise) {
                case 'spiderWalk':
                    patternText = '1-2-3-4';
                    break;
                case 'permutation':
                    const perm = PERMUTATIONS[exerciseState.permutation.currentPermutationIndex];
                    patternText = formatPermutation(perm.pattern);
                    break;
                case 'linear':
                    patternText = `String ${parseInt(linearStringSelect?.value || 5) + 1}, Frets ${exerciseState.linear.currentFret}-${exerciseState.linear.currentFret + 3}`;
                    break;
                case 'diagonal':
                    const diagonalDir = exerciseState.diagonal.direction || diagonalPatternSelect?.value || 'ascending';
                    patternText = diagonalDir === 'ascending' ? 'Ascending Diagonal' :
                        diagonalDir === 'descending' ? 'Descending Diagonal' :
                            'Full Diagonal Run';
                    break;
                case 'stringSkip':
                    const skipPattern = skipPatternSelect?.value || 'single';
                    patternText = SKIP_PATTERNS[skipPattern]?.name || 'String Skipping';
                    break;
                case 'legato':
                    const type = legatoTypeSelect?.value || 'trill';
                    if (type === 'trill') {
                        const pair = trillPairSelect?.value || '1-2';
                        patternText = `Trill: Fingers ${pair}`;
                    } else {
                        patternText = type === 'hammerOnly' ? 'Hammer-On Only' :
                            type === 'pullOnly' ? 'Pull-Off Only' : '3-Note Legato';
                    }
                    break;
            }

            exercisePatternDisplay.textContent = patternText;
        }

        if (exerciseInstruction) {
            exerciseInstruction.textContent = exercise.description;
        }
    }

    function populatePermutationSelect() {
        if (!permutationSelect) return;

        const tier = permutationTierSelect ? permutationTierSelect.value : 'all';
        const perms = getPermutationsByTier(tier);

        permutationSelect.innerHTML = perms.map(p =>
            `<option value="${p.index}">${formatPermutation(p.pattern)}${p.name ? ` - ${p.name}` : ''}</option>`
        ).join('');
    }

    function setView(viewName) {
        if (isMetronomeOn && viewName !== 'none' && viewName !== currentView) {
            stopMetronome();
        }
        if (viewName !== 'none') {
            try { localStorage.setItem('lastView', viewName); } catch (e) { }
            currentView = viewName;
            viewSwitchBtns.forEach(btn => {
                const isActive = btn.dataset.view === viewName;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-selected', isActive);
            });
        }

        if (currentModule === 'guessNote') {
            fretboardContainer.classList.toggle('hidden', viewName !== 'fretboard');
            tabContainer.classList.toggle('hidden', viewName !== 'tab');
            noteToTabQuestionContainer.classList.toggle('hidden', viewName !== 'noteToTab');
        }

        newQuestion();
    }

    function generateScale(rootNote, pattern) {
        const scale = [rootNote];
        let currentNoteIndex = notes.indexOf(rootNote);
        for (const interval of pattern) {
            currentNoteIndex = (currentNoteIndex + interval) % 12;
            scale.push(notes[currentNoteIndex]);
        }
        return scale;
    }

    function updateCurrentScale() {
        const sequenceType = intervalSelect.value;
        if (sequenceType.includes('Scale')) {
            const rootNote = scaleRootSelect.value;
            const pattern = scalePatterns[sequenceType];
            currentScale = generateScale(rootNote, pattern);
        } else {
            currentScale = [];
        }
        resetPracticeState();
    }

    function resetPracticeState() {
        nextPracticePos = null;
        currentPracticePos = null;
        fretboardDirection = 'up';
        currentScaleIndex = 0;
    }

    function populateNoteSelection() {
        noteSelectionGrid.innerHTML = '';
        notes.forEach(note => {
            const container = document.createElement('div');
            container.classList.add('flex', 'items-center', 'gap-2');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `note-check-${note.replace('#', 's')}`;
            checkbox.dataset.note = note;
            checkbox.checked = true;
            checkbox.classList.add('note-select-checkbox');
            const label = document.createElement('label');
            label.htmlFor = `note-check-${note.replace('#', 's')}`;
            label.textContent = note;
            label.classList.add('font-medium');
            container.appendChild(checkbox);
            container.appendChild(label);
            noteSelectionGrid.appendChild(container);
        });

        scaleRootSelect.innerHTML = notes.map(note => `<option value="${note}">${note}</option>`).join('');
    }

    // --- Initialization & Event Listeners ---

    function applyStoredSettings() {
        try {
            const isDark = localStorage.getItem('darkMode') === 'true';
            bodyEl.classList.toggle('dark', isDark);
            darkModeToggle.checked = isDark;
            document.documentElement.dataset.mode = isDark ? 'dark' : 'light';
            document.documentElement.classList.toggle('dark', isDark);

            const themeMeta = document.querySelector('meta[name=\"theme-color\"]');
            if (themeMeta) themeMeta.setAttribute('content', isDark ? '#18181b' : '#fafafa');

            const isLefty = localStorage.getItem('leftyMode') === 'true';
            bodyEl.classList.toggle('lefty', isLefty);
            leftyToggle.checked = isLefty;

            // Session state (learning flow)
            const storedBpm = parseInt(localStorage.getItem('lastBpm') || '', 10);
            if (!Number.isNaN(storedBpm)) {
                const minBpm = parseInt(bpmSlider.min, 10) || 30;
                const maxBpm = parseInt(bpmSlider.max, 10) || 280;
                const clampedBpm = Math.min(maxBpm, Math.max(minBpm, storedBpm));
                bpmSlider.value = clampedBpm;
            }
            bpmDisplay.textContent = `${bpmSlider.value} BPM`;
            if (metronomeMiniBpm) metronomeMiniBpm.textContent = `${bpmSlider.value} BPM`;

            const storedModule = localStorage.getItem('lastModule');
            if (['guessNote', 'playPractice', 'technique'].includes(storedModule)) {
                currentModule = storedModule;
            }

            const storedView = localStorage.getItem('lastView');
            if (['fretboard', 'tab', 'noteToTab'].includes(storedView)) {
                currentView = storedView;
            }

            const storedPracticeMode = localStorage.getItem('practiceMode');
            if (['noteNames', 'tabSequence'].includes(storedPracticeMode)) {
                currentPracticeMode = storedPracticeMode;
            }

            practiceModeBtns.forEach(b => {
                const isActive = b.dataset.practiceMode === currentPracticeMode;
                b.classList.toggle('active', isActive);
                b.setAttribute('aria-checked', isActive);
            });

            const storedDuration = parseInt(localStorage.getItem('noteDuration') || '', 10);
            if (!Number.isNaN(storedDuration)) {
                noteDurationInput.value = Math.max(1, storedDuration);
            }

            const storedSpeedUp = localStorage.getItem('speedUp') === 'true';
            speedUpToggle.checked = storedSpeedUp;
            speedUpControls.classList.toggle('max-h-0', !storedSpeedUp);
            speedUpControls.classList.toggle('opacity-0', !storedSpeedUp);
            speedUpControls.classList.toggle('max-h-40', storedSpeedUp);
            speedUpControls.classList.toggle('opacity-100', storedSpeedUp);

            const storedSpeedUpAmount = parseInt(localStorage.getItem('speedUpAmount') || '', 10);
            if (!Number.isNaN(storedSpeedUpAmount)) speedUpAmount.value = Math.max(1, storedSpeedUpAmount);

            const storedSpeedUpInterval = parseInt(localStorage.getItem('speedUpInterval') || '', 10);
            if (!Number.isNaN(storedSpeedUpInterval)) speedUpInterval.value = Math.max(1, storedSpeedUpInterval);
        } catch (e) {
            // localStorage might be blocked; defaults will be used.
            bpmDisplay.textContent = `${bpmSlider.value} BPM`;
            if (metronomeMiniBpm) metronomeMiniBpm.textContent = `${bpmSlider.value} BPM`;
        }
    }

    populateNoteSelection();
    applyStoredSettings();

    if (naturalsOnlyToggle) {
        naturalsOnlyToggle.addEventListener('change', () => {
            const isChecked = naturalsOnlyToggle.checked;
            document.querySelectorAll('.note-select-checkbox').forEach(cb => {
                cb.disabled = isChecked;
                if (cb.parentElement) cb.parentElement.classList.toggle('opacity-50', isChecked);
            });
            if (!isMetronomeOn) newQuestion();
        });
    }

    document.querySelectorAll('.note-select-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            if (!isMetronomeOn) newQuestion();
        });
    });

    if (settingsToggleBtn) {
        settingsToggleBtn.addEventListener('click', () => {
            bodyEl.classList.toggle('panel-visible');
        });
    }

    if (sidePanelOverlay) {
        sidePanelOverlay.addEventListener('click', () => {
            bodyEl.classList.remove('panel-visible');
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            if (isStepThroughMode && isMetronomeOn && currentModule === 'technique') {
                nextStep();
            } else {
                toggleMetronome();
            }
        }

        if (['1', '2', '3', '4'].includes(e.key) && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            const buttons = answerOptionsEl.querySelectorAll('button');
            const index = parseInt(e.key) - 1;
            if (buttons[index] && !buttons[index].disabled) {
                buttons[index].click();
            }
        }

        if (e.key === 'Escape') {
            if (!statsModalOverlay.classList.contains('hidden')) {
                closeStatsModal();
            } else if (bodyEl.classList.contains('panel-visible')) {
                bodyEl.classList.remove('panel-visible');
            }
        }
    });

    bpmSlider.addEventListener('input', (e) => {
        bpmDisplay.textContent = `${e.target.value} BPM`;
        if (metronomeMiniBpm) metronomeMiniBpm.textContent = `${e.target.value} BPM`;
        try { localStorage.setItem('lastBpm', e.target.value); } catch (err) { }
        if (isMetronomeOn && !isCountingIn) {
            clearInterval(metronomeIntervalId);
            metronomeIntervalId = setInterval(metronomeTick, 60000 / parseInt(e.target.value));
        }
    });
    noteDurationInput.addEventListener('input', () => {
        try { localStorage.setItem('noteDuration', noteDurationInput.value); } catch (err) { }
        if (currentModule === 'playPractice' && !isMetronomeOn) {
            drawBeatDots();
            updateActiveDot(-1);
        }
    });
    speedUpToggle.addEventListener('change', (e) => {
        speedUpControls.classList.toggle('max-h-0', !e.target.checked);
        speedUpControls.classList.toggle('opacity-0', !e.target.checked);
        speedUpControls.classList.toggle('max-h-40', e.target.checked);
        speedUpControls.classList.toggle('opacity-100', e.target.checked);
        try { localStorage.setItem('speedUp', e.target.checked); } catch (err) { }
    });
    speedUpAmount.addEventListener('input', () => {
        try { localStorage.setItem('speedUpAmount', speedUpAmount.value); } catch (err) { }
    });
    speedUpInterval.addEventListener('input', () => {
        try { localStorage.setItem('speedUpInterval', speedUpInterval.value); } catch (err) { }
    });
    if (metronomeBtn) metronomeBtn.addEventListener('click', toggleMetronome);
    if (nextBtn) nextBtn.addEventListener('click', newQuestion);

    const stepModeToggle = document.getElementById('step-mode-toggle');
    const audioAdvanceSetting = document.getElementById('audio-advance-setting');
    const audioAdvanceToggle = document.getElementById('audio-advance-toggle');

    if (stepModeToggle) {
        stepModeToggle.addEventListener('change', () => {
            isStepThroughMode = stepModeToggle.checked;
            if (isMetronomeOn) {
                stopMetronome();
            }
            if (metronomeBtnLabel) metronomeBtnLabel.textContent = isStepThroughMode ? 'Start Step Mode' : 'Start Metronome';

            if (audioAdvanceSetting) {
                audioAdvanceSetting.classList.toggle('hidden', !isStepThroughMode);
            }

            // Force disable audio advance if step mode is off
            if (!isStepThroughMode && audioAdvanceToggle && audioAdvanceToggle.checked) {
                audioAdvanceToggle.checked = false;
                toggleAudioAdvance(false);
            }
        });
    }

    if (audioAdvanceToggle) {
        audioAdvanceToggle.addEventListener('change', () => {
            toggleAudioAdvance(audioAdvanceToggle.checked);
        });
    }

    const nextStepBtn = document.getElementById('next-step-btn');
    if (nextStepBtn) {
        nextStepBtn.addEventListener('click', nextStep);
    }
    if (statsBtn) statsBtn.addEventListener('click', displayDetailedStats);
    statsDisplay.addEventListener('click', () => {
        if (!statsDisplay.classList.contains('hidden')) displayDetailedStats();
    });
    statsDisplay.addEventListener('keydown', (e) => {
        if (statsDisplay.classList.contains('hidden')) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            displayDetailedStats();
        }
    });
    closeStatsBtn.addEventListener('click', closeStatsModal);
    statsModalOverlay.addEventListener('click', (e) => {
        if (e.target === statsModalOverlay) {
            closeStatsModal();
        }
    });
    moduleSwitchBtns.forEach(btn => {
        btn.addEventListener('click', () => setModule(btn.dataset.module));
    });
    viewSwitchBtns.forEach(btn => {
        btn.addEventListener('click', () => setView(btn.dataset.view));
    });
    practiceModeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const nextMode = btn.dataset.practiceMode;
            if (isMetronomeOn && nextMode !== currentPracticeMode) {
                stopMetronome();
            }
            currentPracticeMode = nextMode;
            try { localStorage.setItem('practiceMode', currentPracticeMode); } catch (err) { }
            practiceModeBtns.forEach(b => {
                const isBActive = b.dataset.practiceMode === currentPracticeMode;
                b.classList.toggle('active', isBActive);
                b.setAttribute('aria-checked', isBActive);
            });
            updatePracticeView();
        });
    });
    intervalSelect.addEventListener('change', () => {
        const isScale = intervalSelect.value.includes('Scale');
        scaleRootContainer.classList.toggle('hidden', !isScale);
        naturalsOnlyToggle.parentElement.parentElement.classList.toggle('hidden', isScale);
        updateCurrentScale();
        if (!isMetronomeOn) newQuestion();
    });
    scaleRootSelect.addEventListener('change', () => {
        updateCurrentScale();
        if (!isMetronomeOn) newQuestion();
    });
    micEnableToggle.addEventListener('change', (e) => {
        toggleMicInput(e.target.checked);
    });
    darkModeToggle.addEventListener('change', (e) => {
        const isDark = e.target.checked;
        bodyEl.classList.toggle('dark', isDark);
        document.documentElement.dataset.mode = isDark ? 'dark' : 'light';
        document.documentElement.classList.toggle('dark', isDark);
        const themeMeta = document.querySelector('meta[name=\"theme-color\"]');
        if (themeMeta) themeMeta.setAttribute('content', isDark ? '#18181b' : '#fafafa');
        localStorage.setItem('darkMode', isDark);
    });
    leftyToggle.addEventListener('change', (e) => {
        bodyEl.classList.toggle('lefty', e.target.checked);
        localStorage.setItem('leftyMode', e.target.checked);
    });
    if (spiderStartFretInput) {
        spiderStartFretInput.addEventListener('input', () => {
            if (!isMetronomeOn) {
                resetSpiderState();
            }
        });
    }

    // Handle screen lock on visibility change
    const handleVisibilityChange = async () => {
        if (isMetronomeOn && document.visibilityState === 'visible') {
            requestWakeLock();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // --- Exercise Event Listeners ---
    exerciseCards.forEach(card => {
        card.addEventListener('click', () => selectExercise(card.dataset.exercise));
    });

    if (backToExercisesBtn) {
        backToExercisesBtn.addEventListener('click', () => {
            stopMetronome();
            showExerciseSelection();
        });
    }

    if (exerciseSettingsToggle) {
        exerciseSettingsToggle.addEventListener('click', () => {
            // Open the side panel (same as main Settings button)
            bodyEl.classList.add('panel-visible');
            // Ensure current exercise settings are visible in the panel
            updateVisibleSettings();

            // Scroll to relevant settings container
            setTimeout(() => {
                let targetContainer = null;
                switch (currentExercise) {
                    case 'spiderWalk':
                        targetContainer = techniqueSettingsContainer;
                        break;
                    case 'permutation':
                        targetContainer = permutationSettingsContainer;
                        break;
                    case 'linear':
                        targetContainer = linearSettingsContainer;
                        break;
                    case 'diagonal':
                        targetContainer = diagonalSettingsContainer;
                        break;
                    case 'stringSkip':
                        targetContainer = stringskipSettingsContainer;
                        break;
                    case 'legato':
                        targetContainer = legatoSettingsContainer;
                        break;
                }
                if (targetContainer) {
                    targetContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        });
    }

    if (dailyChallengeBtn) {
        dailyChallengeBtn.addEventListener('click', () => {
            selectExercise('permutation');
            if (permutationModeSelect) permutationModeSelect.value = 'daily';
            resetPermutationState();
            updateExerciseDisplay();
        });
    }

    // Permutation settings
    if (permutationTierSelect) {
        permutationTierSelect.addEventListener('change', () => {
            populatePermutationSelect();
            if (!isMetronomeOn) resetPermutationState();
        });
    }

    if (permutationModeSelect) {
        permutationModeSelect.addEventListener('change', () => {
            const mode = permutationModeSelect.value;
            const showSelect = mode === 'single';
            const permSelectContainer = document.getElementById('permutation-select-container');
            if (permSelectContainer) {
                permSelectContainer.classList.toggle('hidden', !showSelect);
            }
            if (!isMetronomeOn) resetPermutationState();
        });
    }

    if (permutationSelect) {
        permutationSelect.addEventListener('change', () => {
            if (!isMetronomeOn) resetPermutationState();
        });
    }

    // Linear settings
    if (linearDirectionSelect) {
        linearDirectionSelect.addEventListener('change', () => {
            if (!isMetronomeOn) resetLinearState();
        });
    }

    if (linearStartFretInput) {
        linearStartFretInput.addEventListener('input', () => {
            if (!isMetronomeOn) resetLinearState();
        });
    }

    // Legato settings
    if (legatoTypeSelect) {
        legatoTypeSelect.addEventListener('change', () => {
            const showTrill = legatoTypeSelect.value === 'trill';
            const trillContainer = document.getElementById('trill-pair-container');
            const durationContainer = document.getElementById('trill-duration-container');
            if (trillContainer) trillContainer.classList.toggle('hidden', !showTrill);
            if (durationContainer) durationContainer.classList.toggle('hidden', !showTrill);
            if (!isMetronomeOn) resetLegatoState();
            updateExerciseDisplay();
        });
    }

    if (trillPairSelect) {
        trillPairSelect.addEventListener('change', () => {
            if (!isMetronomeOn) resetLegatoState();
            updateExerciseDisplay();
        });
    }

    // Skip pattern change - update displayed name
    if (skipPatternSelect) {
        skipPatternSelect.addEventListener('change', () => {
            if (!isMetronomeOn) resetStringSkipState();
            updateExerciseDisplay();
        });
    }

    // Diagonal pattern change - update displayed name
    if (diagonalPatternSelect) {
        diagonalPatternSelect.addEventListener('change', () => {
            if (!isMetronomeOn) resetDiagonalState();
            updateExerciseDisplay();
        });
    }

    // Burst mode
    if (burstModeToggle) {
        burstModeToggle.addEventListener('change', () => {
            if (burstIndicator) {
                burstIndicator.classList.toggle('hidden', !burstModeToggle.checked);
            }
        });
    }

    // --- Focus Area Settings ---
    function saveFocusArea() {
        try {
            localStorage.setItem('fretmemoFocusArea', JSON.stringify(focusArea));
        } catch (e) {
            console.error('Failed to save focus area:', e);
        }
    }

    function loadFocusArea() {
        try {
            const stored = localStorage.getItem('fretmemoFocusArea');
            if (stored) {
                const parsed = JSON.parse(stored);
                focusArea.minFret = parsed.minFret ?? 0;
                focusArea.maxFret = parsed.maxFret ?? 12;
                focusArea.strings = parsed.strings ?? [true, true, true, true, true, true];

                // Update UI to reflect loaded values
                if (focusMinFretInput) focusMinFretInput.value = focusArea.minFret;
                if (focusMaxFretInput) focusMaxFretInput.value = focusArea.maxFret;
                focusStringCheckboxes.forEach(cb => {
                    const stringIndex = parseInt(cb.dataset.string, 10);
                    cb.checked = focusArea.strings[stringIndex];
                });
            }
        } catch (e) {
            console.error('Failed to load focus area:', e);
        }
    }

    if (focusMinFretInput) {
        focusMinFretInput.addEventListener('change', () => {
            focusArea.minFret = Math.max(0, Math.min(parseInt(focusMinFretInput.value, 10) || 0, focusArea.maxFret));
            focusMinFretInput.value = focusArea.minFret;
            saveFocusArea();
        });
    }

    if (focusMaxFretInput) {
        focusMaxFretInput.addEventListener('change', () => {
            focusArea.maxFret = Math.max(focusArea.minFret, parseInt(focusMaxFretInput.value, 10) || 12);
            focusMaxFretInput.value = focusArea.maxFret;
            saveFocusArea();
        });
    }

    focusStringCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const stringIndex = parseInt(cb.dataset.string, 10);
            focusArea.strings[stringIndex] = cb.checked;

            // Ensure at least one string is always selected
            const anySelected = focusArea.strings.some(s => s);
            if (!anySelected) {
                focusArea.strings[stringIndex] = true;
                cb.checked = true;
            }
            saveFocusArea();
        });
    });

    // --- Heat Map Functions ---
    function savePositionStats() {
        try {
            localStorage.setItem('fretmemoPositionStats', JSON.stringify(positionStats));
        } catch (e) {
            console.error('Failed to save position stats:', e);
        }
    }

    function loadPositionStats() {
        try {
            const stored = localStorage.getItem('fretmemoPositionStats');
            if (stored) {
                positionStats = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to load position stats:', e);
        }
    }

    function getPositionAccuracy(string, fret) {
        const key = `${string}-${fret}`;
        const stats = positionStats[key];
        if (!stats || stats.total === 0) return null; // No data
        return stats.correct / stats.total;
    }

    function getHeatMapClass(accuracy) {
        if (accuracy === null) return ''; // No data
        if (accuracy >= 0.85) return 'heatmap-mastered'; // Green
        if (accuracy >= 0.60) return 'heatmap-learning'; // Yellow
        return 'heatmap-focus'; // Red
    }

    function updateHeatMap() {
        if (!heatMapEnabled) return;
        const cells = fretboardEl.querySelectorAll('.fret-cell');
        cells.forEach(cell => {
            const string = parseInt(cell.dataset.string, 10);
            const fret = parseInt(cell.dataset.fret, 10);
            // Remove old heat map classes
            cell.classList.remove('heatmap-mastered', 'heatmap-learning', 'heatmap-focus');
            const accuracy = getPositionAccuracy(string, fret);
            const heatClass = getHeatMapClass(accuracy);
            if (heatClass) {
                cell.classList.add(heatClass);
            }
        });
    }

    function clearHeatMap() {
        const cells = fretboardEl.querySelectorAll('.fret-cell');
        cells.forEach(cell => {
            cell.classList.remove('heatmap-mastered', 'heatmap-learning', 'heatmap-focus');
        });
    }

    const heatMapToggle = document.getElementById('heat-map-toggle');
    if (heatMapToggle) {
        heatMapToggle.addEventListener('change', () => {
            heatMapEnabled = heatMapToggle.checked;
            localStorage.setItem('fretmemoHeatMapEnabled', heatMapEnabled);
            if (heatMapEnabled) {
                updateHeatMap();
            } else {
                clearHeatMap();
            }
        });
        // Load saved state
        const savedEnabled = localStorage.getItem('fretmemoHeatMapEnabled');
        if (savedEnabled === 'true') {
            heatMapEnabled = true;
            heatMapToggle.checked = true;
        }
    }

    const resetHeatmapBtn = document.getElementById('reset-heatmap-btn');
    if (resetHeatmapBtn) {
        resetHeatmapBtn.addEventListener('click', () => {
            if (confirm('Clear all heat map data? This cannot be undone.')) {
                positionStats = {};
                localStorage.removeItem('fretmemoPositionStats');
                clearHeatMap();
            }
        });
    }

    loadPositionStats();
    loadFocusArea();
    createFretboard();
    createTabView();
    loadProgress();
    populatePermutationSelect();
    if (heatMapEnabled) updateHeatMap(); // Apply heat map on load

    // Defer initial question to prevent race condition on load
    setTimeout(() => {
        setModule(currentModule); // Restore last mode (fallbacks to defaults)
    }, 0);

    // --- Pre-Built Workouts Listeners ---
    document.querySelectorAll('.switcher-btn[data-tab]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTechniqueTab(e.target.dataset.tab);
        });
    });

    const workoutsGrid = document.getElementById('workouts-grid');
    if (workoutsGrid) {
        workoutsGrid.addEventListener('click', (e) => {
            const card = e.target.closest('[data-workout]');
            if (card) {
                startWorkout(card.dataset.workout);
            }
        });
    }

    // --- Tuning Selector ---
    const tuningSelect = document.getElementById('tuning-select');
    if (tuningSelect) {
        Object.keys(TUNINGS).forEach(tName => {
            const opt = document.createElement('option');
            opt.value = tName;
            opt.textContent = tName;
            tuningSelect.appendChild(opt);
        });
        tuningSelect.value = currentTuningName;
        tuningSelect.addEventListener('change', (e) => {
            setTuning(e.target.value);
        });
    }

    // --- PWA registration (tool only) ---
    // Avoid service worker caching during local development (localhost).
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator) {
        if (isLocalhost || location.protocol === 'file:') {
            navigator.serviceWorker.getRegistrations()
                .then((regs) => Promise.all(regs.map((r) => r.unregister())))
                .catch(() => { });
        } else {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => { });
            });
        }
    }
});
