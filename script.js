document.addEventListener('DOMContentLoaded', () => {
    // --- Audio Context Setup ---
    let audioContext;
    let schedulerTimerID;
    let nextNoteTime = 0.0;
    const scheduleAheadTime = 0.1;

    // --- Metronome State ---
    let currentMeasure = 0;
    let currentPulse = 0;

    // --- Application State ---
    let state = {
        isPlaying: false,
        tempo: 120,
        measures: [],
        currentEditingMeasure: -1,
    };

    // --- DOM Element References ---
    const tempoSlider = document.getElementById('tempo');
    const tempoInput = document.getElementById('tempo-input');
    const playBtn = document.getElementById('play-btn');
    const stopBtn = document.getElementById('stop-btn');
    const addMeasureBtn = document.getElementById('add-measure-btn');
    const sequencerContainer = document.getElementById('sequencer-container');
    const measureEditor = document.getElementById('measure-editor');
    const editorTitle = document.getElementById('editor-title');
    const subdivisionsInput = document.getElementById('subdivisions');
    const patternGrid = document.getElementById('pattern-grid');
    const closeEditorBtn = document.getElementById('close-editor-btn');
    const saveBtn = document.getElementById('save-btn');
    const loadBtn = document.getElementById('load-btn');
    const loadInput = document.getElementById('load-input');

    // =================================================================
    // CORE METRONOME AND UI FUNCTIONS
    // =================================================================

    function scheduleNotes() {
        while (nextNoteTime < audioContext.currentTime + scheduleAheadTime) {
            if (state.measures.length === 0) return;
            const measure = state.measures[currentMeasure];
            const subdivisions = measure.subdivisions;
            const pulseDuration = (60.0 / state.tempo) / subdivisions;
            
            const pulseState = measure.pattern[currentPulse];

            if (pulseState > 0) { // If pulse is On (1) or Accent (2)
                playSound(nextNoteTime, pulseState);
            }

            scheduleVisualFeedback(currentMeasure, currentPulse, nextNoteTime);
            nextNoteTime += pulseDuration;
            currentPulse++;
            if (currentPulse >= subdivisions) {
                currentPulse = 0;
                currentMeasure = (currentMeasure + 1) % state.measures.length;
            }
        }
    }

    function playSound(time, pulseState) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);

        let frequency = 440.0; // Default: Regular beat (On)
        if (pulseState === 2) { // Accent beat
            frequency = 880.0;
        }
        
        osc.frequency.setValueAtTime(frequency, time);
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        osc.start(time);
        osc.stop(time + 0.05);
    }

    function scheduleVisualFeedback(measureIndex, pulseIndex, time) {
        const delay = (time - audioContext.currentTime) * 1000;
        setTimeout(() => {
            document.querySelectorAll('.measure-block').forEach((block, index) => {
                block.classList.toggle('is-playing', index === measureIndex);
            });
            if (state.currentEditingMeasure === measureIndex) {
                 document.querySelectorAll('.pulse-toggle').forEach((toggle, index) => {
                    toggle.classList.toggle('is-playing', index === pulseIndex);
                 });
            }
        }, delay);
    }

    function scheduler() {
        scheduleNotes();
        schedulerTimerID = setTimeout(scheduler, 25);
    }

    function renderEditor() {
        if (state.currentEditingMeasure < 0 || !state.measures[state.currentEditingMeasure]) {
            measureEditor.classList.add('is-hidden');
            return;
        }
        const measure = state.measures[state.currentEditingMeasure];
        editorTitle.textContent = `Edit Measure ${state.currentEditingMeasure + 1}`;
        subdivisionsInput.value = measure.subdivisions;
        patternGrid.innerHTML = '';

        for (let i = 0; i < measure.subdivisions; i++) {
            const pulseToggle = document.createElement('div');
            pulseToggle.className = 'pulse-toggle';
            pulseToggle.dataset.index = i;

            const topSquare = document.createElement('div');
            topSquare.className = 'pulse-square';
            const bottomSquare = document.createElement('div');
            bottomSquare.className = 'pulse-square';
            
            const pulseState = measure.pattern[i];

            if (pulseState === 1) { // "On" state
                bottomSquare.classList.add('is-lit');
            } else if (pulseState === 2) { // "Accent" state
                bottomSquare.classList.add('is-lit');
                topSquare.classList.add('is-lit');
            }

            pulseToggle.appendChild(topSquare);
            pulseToggle.appendChild(bottomSquare);
            patternGrid.appendChild(pulseToggle);
        }
        measureEditor.classList.remove('is-hidden');
    }

    // =================================================================
    // SAVE/LOAD AND OTHER UI FUNCTIONS
    // =================================================================

    function saveStateToLocalStorage() {
        const stateToSave = {
            tempo: state.tempo,
            measures: state.measures,
        };
        localStorage.setItem('rhythmWeaverState', JSON.stringify(stateToSave));
    }

    function loadStateFromLocalStorage() {
        const savedState = localStorage.getItem('rhythmWeaverState');
        if (savedState) {
            const loadedState = JSON.parse(savedState);
            state.tempo = loadedState.tempo || 120;
            state.measures = loadedState.measures || [];
        }
    }

    function updateUI() {
        tempoSlider.value = state.tempo;
        tempoInput.value = state.tempo;
        renderSequencer();
        renderEditor();
    }

    function renderSequencer() {
        sequencerContainer.innerHTML = '';
        state.measures.forEach((measure, index) => {
            const measureBlock = document.createElement('div');
            measureBlock.className = 'measure-block';
            measureBlock.textContent = `Measure ${index + 1} (${measure.subdivisions})`;
            measureBlock.dataset.index = index;
            if (index === state.currentEditingMeasure) {
                measureBlock.classList.add('is-active');
            }
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-measure-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.dataset.index = index;
            measureBlock.appendChild(removeBtn);
            sequencerContainer.appendChild(measureBlock);
        });
    }

    // =================================================================
    // EVENT HANDLERS
    // =================================================================

    playBtn.addEventListener('click', () => {
        if (!state.isPlaying) {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (state.measures.length === 0) {
                alert("Please add at least one measure before playing.");
                return;
            }
            state.isPlaying = true;
            nextNoteTime = audioContext.currentTime + 0.1;
            currentMeasure = state.measures.length > 1 ? state.measures.length - 1 : 0;
            currentPulse = 0;
            scheduler();
            playBtn.textContent = 'Pause';
        } else {
            state.isPlaying = false;
            clearTimeout(schedulerTimerID);
            playBtn.textContent = 'Play';
        }
    });

    stopBtn.addEventListener('click', () => {
        state.isPlaying = false;
        clearTimeout(schedulerTimerID);
        playBtn.textContent = 'Play';
        currentMeasure = 0;
        currentPulse = 0;
        document.querySelectorAll('.is-playing').forEach(el => el.classList.remove('is-playing'));
    });

    tempoSlider.addEventListener('input', (e) => {
        state.tempo = parseInt(e.target.value, 10);
        tempoInput.value = state.tempo;
        saveStateToLocalStorage();
    });

    tempoInput.addEventListener('input', (e) => {
        const newTempo = parseInt(e.target.value, 10);
        if (isNaN(newTempo)) return;
        const clampedTempo = Math.max(1, Math.min(300, newTempo));
        state.tempo = clampedTempo;
        tempoSlider.value = clampedTempo;
        saveStateToLocalStorage();
    });

    tempoInput.addEventListener('change', (e) => {
        e.target.value = state.tempo;
    });

    addMeasureBtn.addEventListener('click', () => {
        state.measures.push({
            subdivisions: 4,
            pattern: [2, 1, 1, 1]
        });
        renderSequencer();
        saveStateToLocalStorage();
    });

    // ############ DIAGNOSTIC VERSION OF THIS LISTENER ############
    sequencerContainer.addEventListener('click', (e) => {
        console.log("Sequencer container was clicked. The element you clicked on is:", e.target);

        const removeBtn = e.target.closest('.remove-measure-btn');
        if (removeBtn) {
            console.log("Action: Found a remove button.");
            const indexToRemove = parseInt(removeBtn.dataset.index, 10);
            if (state.isPlaying) stopBtn.click();
            state.measures.splice(indexToRemove, 1);
            if (state.currentEditingMeasure === indexToRemove) {
                state.currentEditingMeasure = -1;
            } else if (state.currentEditingMeasure > indexToRemove) {
                state.currentEditingMeasure--;
            }
            updateUI();
            saveStateToLocalStorage();
            return;
        }
        
        const measureBlock = e.target.closest('.measure-block');
        if (measureBlock) {
            console.log("Action: Found a measure block.", measureBlock);
            const index = parseInt(measureBlock.dataset.index, 10);
            console.log("Attempting to open editor for measure index:", index);
            state.currentEditingMeasure = index;
            renderSequencer();
            renderEditor();
        } else {
            console.error("ERROR: No measure block was found. This is the source of the bug.");
        }
    });
    
    subdivisionsInput.addEventListener('input', (e) => {
        if (state.currentEditingMeasure < 0) return;
        const measure = state.measures[state.currentEditingMeasure];
        const newSubdivisions = parseInt(e.target.value, 10);
        if (newSubdivisions > 0 && newSubdivisions <= 16) {
            const oldLength = measure.pattern.length;
            if (newSubdivisions > oldLength) {
                measure.pattern = measure.pattern.concat(Array(newSubdivisions - oldLength).fill(1));
            } else {
                measure.pattern = measure.pattern.slice(0, newSubdivisions);
            }
            measure.subdivisions = newSubdivisions;
            renderEditor();
            renderSequencer();
            saveStateToLocalStorage();
        }
    });

    patternGrid.addEventListener('click', (e) => {
        const pulseToggle = e.target.closest('.pulse-toggle');
        if (pulseToggle) {
            const index = parseInt(pulseToggle.dataset.index, 10);
            const measure = state.measures[state.currentEditingMeasure];
            const currentState = measure.pattern[index];
            const nextState = (currentState + 1) % 3;
            measure.pattern[index] = nextState;
            renderEditor();
            saveStateToLocalStorage();
        }
    });

    closeEditorBtn.addEventListener('click', () => {
        state.currentEditingMeasure = -1;
        renderSequencer();
        renderEditor();
    });

    saveBtn.addEventListener('click', () => {
        const stateToSave = {
            tempo: state.tempo,
            measures: state.measures,
        };
        const jsonString = JSON.stringify(stateToSave, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rhythm-weaver-session.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    loadBtn.addEventListener('click', () => {
        loadInput.click();
    });

    loadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const loadedState = JSON.parse(event.target.result);
                state.tempo = loadedState.tempo || 120;
                state.measures = loadedState.measures || [];
                state.currentEditingMeasure = -1;
                if (state.isPlaying) stopBtn.click();
                updateUI();
                saveStateToLocalStorage();
            } catch (error) {
                alert('Error: Could not load the file. Please ensure it is a valid session file.');
                console.error('File parsing error:', error);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });
    
    // =================================================================
    // INITIALIZATION
    // =================================================================
    loadStateFromLocalStorage();
    if (state.measures.length === 0) {
        state.measures.push({
            subdivisions: 4,
            pattern: [2, 1, 1, 1] // Start with an accent on beat 1
        });
    }
    updateUI();
});