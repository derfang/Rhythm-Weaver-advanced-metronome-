document.addEventListener('DOMContentLoaded', () => {
    // --- Database and App State ---
    let db;
    let audioContext;
    let schedulerTimerID;
    let nextNoteTime = 0.0;
    const scheduleAheadTime = 0.1;
    let currentMeasure = 0;
    let currentPulse = 0;
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
    const presetBtn = document.getElementById('preset-btn');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importInput = document.getElementById('import-input');
    const presetModal = document.getElementById('preset-modal');
    const presetList = document.getElementById('preset-list');
    const presetNameInput = document.getElementById('preset-name-input');
    const savePresetBtn = document.getElementById('save-preset-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // =================================================================
    // INDEXEDDB DATABASE FUNCTIONS
    // =================================================================

    function initDB() {
        try {
            const request = indexedDB.open('RhythmWeaverDB', 1);
            request.onerror = (event) => console.error('Database error:', event.target.errorCode);
            request.onsuccess = (event) => {
                db = event.target.result;
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                db.createObjectStore('presets', { keyPath: 'name' });
            };
        } catch (error) {
            console.error("Could not initialize IndexedDB. Presets will not be available.", error);
            // Disable preset button if DB fails to initialize
            presetBtn.disabled = true;
            presetBtn.textContent = "Presets Disabled";
        }
    }

    function savePreset(name, data) {
        if (!db) return;
        const transaction = db.transaction(['presets'], 'readwrite');
        const store = transaction.objectStore('presets');
        store.put({ name, data });
        transaction.oncomplete = () => openPresetModal();
    }

    function getAllPresets(callback) {
        if (!db) return callback([]);
        const transaction = db.transaction(['presets'], 'readonly');
        const store = transaction.objectStore('presets');
        const request = store.getAll();
        request.onerror = () => callback([]);
        request.onsuccess = () => callback(request.result);
    }
    
    function deletePreset(name) {
        if (!db) return;
        const transaction = db.transaction(['presets'], 'readwrite');
        const store = transaction.objectStore('presets');
        store.delete(name);
        transaction.oncomplete = () => openPresetModal();
    }

    // =================================================================
    // PRESET MODAL FUNCTIONS
    // =================================================================

    function openPresetModal() {
        if (!db) {
            alert("Preset manager is unavailable. Your browser may be blocking database access.");
            return;
        }
        getAllPresets(presets => {
            presetList.innerHTML = '';
            if (presets.length === 0) {
                presetList.innerHTML = '<li>No presets saved yet.</li>';
            } else {
                presets.forEach(preset => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span class="preset-item-name">${preset.name}</span>
                        <div class="preset-item-actions">
                            <button class="load-preset-btn" data-name="${preset.name}">Load</button>
                            <button class="delete-btn" data-name="${preset.name}">Delete</button>
                        </div>
                    `;
                    presetList.appendChild(li);
                });
            }
        });
        presetModal.classList.remove('is-hidden');
    }

    function closePresetModal() {
        presetModal.classList.add('is-hidden');
        presetNameInput.value = '';
    }

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
            if (pulseState > 0) playSound(nextNoteTime, pulseState);
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
        let frequency = 440.0;
        if (pulseState === 2) frequency = 880.0;
        osc.frequency.setValueAtTime(frequency, time);
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        osc.start(time);
        osc.stop(time + 0.05);
    }

    function scheduleVisualFeedback(measureIndex, pulseIndex, time) {
        const delay = (time - audioContext.currentTime) * 1000;
        setTimeout(() => {
            document.querySelectorAll('.measure-block').forEach((block, index) => block.classList.toggle('is-playing', index === measureIndex));
            if (state.currentEditingMeasure === measureIndex) {
                document.querySelectorAll('.pulse-toggle').forEach((toggle, index) => toggle.classList.toggle('is-playing', index === pulseIndex));
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
            if (pulseState === 1) {
                bottomSquare.classList.add('is-lit');
            } else if (pulseState === 2) {
                bottomSquare.classList.add('is-lit');
                topSquare.classList.add('is-lit');
            }
            pulseToggle.appendChild(topSquare);
            pulseToggle.appendChild(bottomSquare);
            patternGrid.appendChild(pulseToggle);
        }
        measureEditor.classList.remove('is-hidden');
    }

    function saveStateToLocalStorage() {
        try {
            const stateToSave = { tempo: state.tempo, measures: state.measures };
            localStorage.setItem('rhythmWeaverState', JSON.stringify(stateToSave));
        } catch (error) {
            console.warn("Could not save state to localStorage.", error);
        }
    }

    function loadStateFromLocalStorage() {
        try {
            const savedState = localStorage.getItem('rhythmWeaverState');
            if (savedState) {
                const loadedState = JSON.parse(savedState);
                state.tempo = loadedState.tempo || 120;
                state.measures = loadedState.measures || [];
            }
        } catch (error) {
            console.warn("Could not load state from localStorage.", error);
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
            if (index === state.currentEditingMeasure) measureBlock.classList.add('is-active');
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
            if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (state.measures.length === 0) return alert("Please add at least one measure before playing.");
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

    tempoInput.addEventListener('change', (e) => { e.target.value = state.tempo; });

    addMeasureBtn.addEventListener('click', () => {
        state.measures.push({ subdivisions: 4, pattern: [2, 1, 1, 1] });
        renderSequencer();
        saveStateToLocalStorage();
    });

    sequencerContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-measure-btn');
        if (removeBtn) {
            const indexToRemove = parseInt(removeBtn.dataset.index, 10);
            if (state.isPlaying) stopBtn.click();
            state.measures.splice(indexToRemove, 1);
            if (state.currentEditingMeasure === indexToRemove) state.currentEditingMeasure = -1;
            else if (state.currentEditingMeasure > indexToRemove) state.currentEditingMeasure--;
            updateUI();
            saveStateToLocalStorage();
            return;
        }
        const measureBlock = e.target.closest('.measure-block');
        if (measureBlock) {
            const index = parseInt(measureBlock.dataset.index, 10);
            state.currentEditingMeasure = index;
            renderSequencer();
            renderEditor();
        }
    });

    subdivisionsInput.addEventListener('input', (e) => {
        if (state.currentEditingMeasure < 0) return;
        const measure = state.measures[state.currentEditingMeasure];
        const newSubdivisions = parseInt(e.target.value, 10);
        if (newSubdivisions > 0 && newSubdivisions <= 16) {
            const oldLength = measure.pattern.length;
            if (newSubdivisions > oldLength) measure.pattern = measure.pattern.concat(Array(newSubdivisions - oldLength).fill(1));
            else measure.pattern = measure.pattern.slice(0, newSubdivisions);
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
            measure.pattern[index] = (measure.pattern[index] + 1) % 3;
            renderEditor();
            saveStateToLocalStorage();
        }
    });

    closeEditorBtn.addEventListener('click', () => {
        state.currentEditingMeasure = -1;
        renderSequencer();
        renderEditor();
    });

    presetBtn.addEventListener('click', openPresetModal);
    closeModalBtn.addEventListener('click', closePresetModal);
    presetModal.addEventListener('click', (e) => { if (e.target === presetModal) closePresetModal(); });

    savePresetBtn.addEventListener('click', () => {
        const name = presetNameInput.value.trim();
        if (!name) return alert('Please enter a name for your preset.');
        const dataToSave = { tempo: state.tempo, measures: state.measures };
        savePreset(name, dataToSave);
        presetNameInput.value = '';
    });

    presetList.addEventListener('click', (e) => {
        const target = e.target;
        const presetName = target.dataset.name;
        if (target.classList.contains('load-preset-btn')) {
            getAllPresets(presets => {
                const presetToLoad = presets.find(p => p.name === presetName);
                if (presetToLoad) {
                    state.tempo = presetToLoad.data.tempo || 120;
                    state.measures = presetToLoad.data.measures || [];
                    state.currentEditingMeasure = -1;
                    if (state.isPlaying) stopBtn.click();
                    updateUI();
                    saveStateToLocalStorage();
                    closePresetModal();
                }
            });
        }
        if (target.classList.contains('delete-btn')) {
            if (confirm(`Are you sure you want to delete the preset "${presetName}"?`)) deletePreset(presetName);
        }
    });

    exportBtn.addEventListener('click', () => {
        const stateToSave = { tempo: state.tempo, measures: state.measures };
        const jsonString = JSON.stringify(stateToSave, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rhythm-weaver-session.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    importBtn.addEventListener('click', () => { importInput.click(); });

    importInput.addEventListener('change', (e) => {
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
                alert('Error: Could not load the file.');
                console.error('File parsing error:', error);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });
    
    // =================================================================
    // INITIALIZATION (Now wrapped in try...catch for safety)
    // =================================================================
    try {
        initDB();
        loadStateFromLocalStorage();
        if (state.measures.length === 0) {
            state.measures.push({
                subdivisions: 4,
                pattern: [2, 1, 1, 1]
            });
        }
        updateUI();
    } catch (error) {
        console.error("A critical error occurred during initialization:", error);
        alert("Rhythm Weaver could not start correctly. Storage may be blocked by your browser's settings (e.g., in private mode). Some features like saving may not work, but the core metronome should be functional.");
        // Fallback UI update
        if (state.measures.length === 0) {
            state.measures.push({ subdivisions: 4, pattern: [2, 1, 1, 1] });
        }
        updateUI();
    }
});