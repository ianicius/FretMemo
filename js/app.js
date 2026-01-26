document.addEventListener('DOMContentLoaded', () => {
            // --- Data Model ---
            const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const tuning = ['E', 'B', 'G', 'D', 'A', 'E']; // Thin to Thick (Top to Bottom)
            const FRET_COUNT = 12;
            const SPIDER_FINGERS = 4;
            const scalePatterns = {
                majorScale: [2, 2, 1, 2, 2, 2, 1],
                minorScale: [2, 1, 2, 2, 1, 2, 2],
                majorPentatonic: [2, 2, 3, 2, 3],
                minorPentatonic: [3, 2, 2, 3, 2],
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
                    document.fonts.ready.then(setAppbarSpace).catch(() => {});
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
            const cyberStyleToggle = document.getElementById('cyber-style-toggle');
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
                if (!isPitchDetectionRunning) return;
                const buffer = new Float32Array(analyser.fftSize);
                analyser.getFloatTimeDomainData(buffer);
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
                    
                    if(targetNote && detectedNote === targetNote) {
                        tunerDisplay.classList.add('correct');
                        detectedNoteEl.textContent = "Correct!";
                    } else {
                        tunerDisplay.classList.remove('correct');
                    }

                } else {
                    detectedNoteEl.textContent = "--";
                     tunerDisplay.classList.remove('correct');
                }
                pitchDetectionFrameId = requestAnimationFrame(runPitchDetection);
            }

            async function toggleMicInput(enable) {
                if (enable) {
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        micStream = stream;
                        setupAudio();
                        analyser = audioCtx.createAnalyser();
                        analyser.fftSize = 2048;
                        const source = audioCtx.createMediaStreamSource(stream);
                        source.connect(analyser);
                        tunerDisplay.classList.remove('hidden');
                        isPitchDetectionRunning = true;
                        runPitchDetection();
                    } catch (err) {
                        console.error("Microphone access error:", err);
                        alert("Microphone access denied. Please allow microphone access in your browser settings.");
                        micEnableToggle.checked = false;
                    }
                } else {
                    isPitchDetectionRunning = false;
                    cancelAnimationFrame(pitchDetectionFrameId);
                    if(micStream) {
                        micStream.getTracks().forEach(track => track.stop());
                        micStream = null;
                    }
                    if(audioCtx && audioCtx.state !== 'closed') {
                         audioCtx.suspend();
                    }
                    tunerDisplay.classList.add('hidden');
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
                fretNumbersEl.style.gridTemplateColumns = gridTemplate;
                const stringThickness = [1, 1.2, 1.5, 1.8, 2.1, 2.4]; // Thin to Thick

                for (let i = 0; i < tuning.length; i++) {
                    for (let j = 0; j <= FRET_COUNT; j++) {
                        const fretEl = document.createElement('div');
                        fretEl.classList.add('fret', 'relative', 'flex', 'items-center', 'justify-center', 'h-12');
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
                         if(targetFret) {
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
                    if(currentScale.length === 0) updateCurrentScale();
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
                            for (let j = 0; j <= FRET_COUNT; j++) {
                                if (getNote(i, j) === targetNote) {
                                    occurrences.push({ string: i, fret: j });
                                }
                            }
                        }
                        if (occurrences.length === 0) { newQuestion(); return; }
                        const { string: randomString, fret: randomFret } = occurrences[Math.floor(Math.random() * occurrences.length)];
                        correctAnswer = targetNote;
                        
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
                            button.textContent = note;
                            button.classList.add('p-4', 'border', 'hover:bg-gray-100', 'rounded-lg', 'text-lg', 'font-semibold', 'transition-colors', 'duration-200');
                            button.style.backgroundColor = 'var(--bg-light)';
                            button.style.borderColor = 'var(--border-color)';
                            button.dataset.note = note;
                            button.addEventListener('click', handleAnswer);
                            answerOptionsEl.appendChild(button);
                        });

                    } else if (currentView === 'noteToTab') {
                        const targetNote = activeNotes[Math.floor(Math.random() * activeNotes.length)];
                        noteToTabQuestionContainer.querySelector('.current-practice-note').textContent = targetNote;

                        const occurrences = [];
                        for (let i = 0; i < tuning.length; i++) {
                            for (let j = 1; j < FRET_COUNT; j++) {
                                if (getNote(i, j) === targetNote) {
                                    occurrences.push({ string: i, fret: j });
                                }
                            }
                        }
                        if (occurrences.length === 0) { newQuestion(); return; }
                        const correctOccurrence = occurrences[Math.floor(Math.random() * occurrences.length)];
                        correctAnswer = `${correctOccurrence.string}-${correctOccurrence.fret}`;

                        const options = new Set([correctAnswer]);
                        while(options.size < 4) {
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
                            button.innerHTML = `<span class="font-bold">${tuning[string]}</span> <span style="color:var(--text-light)">string</span> - <span class="font-bold">${fret}</span> <span style="color:var(--text-light)">fret</span>`;
                            button.classList.add('p-4', 'border', 'hover:bg-gray-100', 'rounded-lg', 'text-lg', 'transition-colors', 'duration-200');
                             button.style.backgroundColor = 'var(--bg-light)';
                            button.style.borderColor = 'var(--border-color)';
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
                        
                        const currentPosForNext = nextPracticePos || {string: Math.floor(Math.random()*6), fret: Math.floor(Math.random()*5)};
                        nextPracticePos = getClosestPosition(currentPosForNext, newNextNoteName);
                        nextPracticeNoteEl.textContent = newNextNoteName;

                    } else { // Tab Sequence
                        currentPracticePos = nextPracticePos;
                        if (!currentPracticePos) {
                            const randomNote = activeNotes[Math.floor(Math.random() * activeNotes.length)];
                            currentPracticePos = getClosestPosition({string: 0, fret: 0}, randomNote);
                        }
                        
                        const currentNoteName = getNote(currentPracticePos.string, currentPracticePos.fret);
                        let nextNoteName;
                        if(sequenceType === 'random'){
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
                
                updateStatsDisplay();
                if (!isMetronomeOn) {
                    setTimeout(newQuestion, 1200);
                }
            }

            // --- Metronome Logic ---
            function metronomeTick() {
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
                            try { localStorage.setItem('lastBpm', String(newBpm)); } catch (err) {}
                            clearInterval(metronomeIntervalId);
                            metronomeIntervalId = setInterval(metronomeTick, 60000 / newBpm);
                        }
                    }
                }

                if (currentModule === 'technique') {
                    spiderWalkTick();
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

                feedbackEl.textContent = '';

                if (currentModule === 'playPractice') {
                    updateActiveDot(-1);
                }
                if (currentModule === 'technique') {
                    resetSpiderState();
                }
            }

            function startMetronome() {
                if (isMetronomeOn) return;

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
                    startMetronome();
                }
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
                positions[fingerToMove] = { string: currentString, fret: currentFret };

                spiderDots.forEach((dot, index) => {
                    const pos = positions[index];
                    if (pos) {
                        displayDotAt(dot, pos.string, pos.fret);
                    } else {
                        dot.style.display = 'none';
                    }
                });

                spiderState.step++;
                spiderState.positions = positions;
                spiderState.startFret = startFret;
                spiderState.stringDirection = stringDirection;
                spiderState.fretDirection = fretDirection;
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
                try { localStorage.setItem('lastModule', moduleName); } catch (e) {}
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
                techniqueModeContainer.classList.toggle('hidden', !isTechnique);

                statsDisplay.classList.toggle('hidden', isTechnique);
                statsBtn.classList.toggle('hidden', isTechnique);
                practiceSettingsContainer.classList.toggle('hidden', !isPlayPractice);
                techniqueSettingsContainer.classList.toggle('hidden', !isTechnique);
                nextBtn.classList.toggle('hidden', isTechnique);
                
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
                    newQuestion();
                    return;
                }

                // Guess Note
                answerOptionsEl.classList.remove('hidden');
                setView(currentView);
            }

            function setView(viewName) {
                if (isMetronomeOn && viewName !== 'none' && viewName !== currentView) {
                    stopMetronome();
                }
                if (viewName !== 'none') {
                    try { localStorage.setItem('lastView', viewName); } catch (e) {}
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
                for(const interval of pattern) {
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
                    if (themeMeta) themeMeta.setAttribute('content', isDark ? '#0b0f17' : '#fcfbf8');

                    const style = localStorage.getItem('visualStyle') === 'cyber' ? 'cyber' : 'classic';
                    bodyEl.classList.toggle('cyber', style === 'cyber');
                    cyberStyleToggle.checked = style === 'cyber';
                    document.documentElement.dataset.style = style;

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
            
            naturalsOnlyToggle.addEventListener('change', () => {
                const isChecked = naturalsOnlyToggle.checked;
                document.querySelectorAll('.note-select-checkbox').forEach(cb => {
                    cb.disabled = isChecked;
                    cb.parentElement.classList.toggle('opacity-50', isChecked);
                });
                if (!isMetronomeOn) newQuestion();
            });

            document.querySelectorAll('.note-select-checkbox').forEach(cb => {
                cb.addEventListener('change', () => {
                    if (!isMetronomeOn) newQuestion();
                });
            });

            settingsToggleBtn.addEventListener('click', () => {
                bodyEl.classList.toggle('panel-visible');
            });

            sidePanelOverlay.addEventListener('click', () => {
                bodyEl.classList.remove('panel-visible');
            });
            
            document.addEventListener('keydown', (e) => {
                if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
                    e.preventDefault();
                    toggleMetronome();
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
                try { localStorage.setItem('lastBpm', e.target.value); } catch (err) {}
                if (isMetronomeOn && !isCountingIn) {
                    clearInterval(metronomeIntervalId);
                    metronomeIntervalId = setInterval(metronomeTick, 60000 / parseInt(e.target.value));
                }
            });
            noteDurationInput.addEventListener('input', () => {
                try { localStorage.setItem('noteDuration', noteDurationInput.value); } catch (err) {}
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
                try { localStorage.setItem('speedUp', e.target.checked); } catch (err) {}
            });
            speedUpAmount.addEventListener('input', () => {
                try { localStorage.setItem('speedUpAmount', speedUpAmount.value); } catch (err) {}
            });
            speedUpInterval.addEventListener('input', () => {
                try { localStorage.setItem('speedUpInterval', speedUpInterval.value); } catch (err) {}
            });
            metronomeBtn.addEventListener('click', toggleMetronome);
            nextBtn.addEventListener('click', newQuestion);
            statsBtn.addEventListener('click', displayDetailedStats);
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
                    try { localStorage.setItem('practiceMode', currentPracticeMode); } catch (err) {}
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
                if (themeMeta) themeMeta.setAttribute('content', isDark ? '#0b0f17' : '#fcfbf8');
                localStorage.setItem('darkMode', isDark);
            });
            cyberStyleToggle.addEventListener('change', (e) => {
                const style = e.target.checked ? 'cyber' : 'classic';
                bodyEl.classList.toggle('cyber', style === 'cyber');
                document.documentElement.dataset.style = style;
                localStorage.setItem('visualStyle', style);
            });
            leftyToggle.addEventListener('change', (e) => {
                bodyEl.classList.toggle('lefty', e.target.checked);
                localStorage.setItem('leftyMode', e.target.checked);
            });
             spiderStartFretInput.addEventListener('input', () => {
                if (!isMetronomeOn) {
                    resetSpiderState();
                }
            });
            
            // Handle screen lock on visibility change
            const handleVisibilityChange = async () => {
                if (isMetronomeOn && document.visibilityState === 'visible') {
                    requestWakeLock();
                }
            };
            document.addEventListener('visibilitychange', handleVisibilityChange);

            createFretboard();
            createTabView();
            
            // Defer initial question to prevent race condition on load
            setTimeout(() => {
                setModule(currentModule); // Restore last mode (fallbacks to defaults)
            }, 0);

            // --- PWA registration (tool only) ---
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
            }
        });
