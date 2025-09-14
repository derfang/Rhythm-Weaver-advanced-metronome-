# Rhythm Weaver 🎵

Rhythm Weaver is an advanced, web-based polyrhythmic metronome designed for musicians, producers, and anyone looking to explore complex rhythms. Unlike a standard metronome, it allows you to build and loop entire sequences of measures, each with its own unique rhythmic subdivision and accent pattern.



## ✨ Features

* **Polyrhythmic Sequencing:** Create rhythmic cycles where each measure can have a different number of subdivisions (e.g., a measure of 4 followed by a measure of 3, then a measure of 7), all while maintaining the same total duration.
* **Advanced Pattern Editor:** Click on any measure to open a detailed editor. Each pulse in a measure can be set to one of three states: **Off**, **On**, or **Accent**.
* **Unique Visualizer:** An intuitive two-square display for each pulse makes it easy to see the state of your rhythm at a glance (Off: 0 squares lit, On: 1 square lit, Accent: 2 squares lit).
* **Count-in Measure:** When you press play, the metronome plays the *last* measure of your sequence once as a preparatory count-in before looping to the beginning.
* **Instant Tempo Response:** Tempo changes are reflected immediately on the very next pulse, not the next measure, giving you precise, real-time control.
* **Session Persistence:** Your work is automatically saved in your browser. When you close the tab and come back, your last rhythmic creation will be waiting for you.
* **Save & Load:** Manually save your complex rhythmic sequences to a JSON file to share or use later, and load them back into the app at any time.

---
## 🚀 How to Use

1.  **Launch:** Simply open the `index.html` file in any modern web browser.
2.  **Build Your Sequence:** Use the **"+ Add Measure"** button to create your rhythmic cycle.
3.  **Edit a Measure:** Click on any measure block (e.g., "[Measure 1]") to open the editor.
4.  **Create Your Rhythm:**
    * Set the number of **Subdivisions** for that measure.
    * Click on the two-square toggles to cycle each pulse through its **Off**, **On**, and **Accent** states.
5.  **Play:** Adjust the master tempo and press the **Play** button!

---
## 🛠️ Tech Stack

* **HTML5**
* **CSS3**
* **Modern JavaScript (ES6+)**
* **Web Audio API:** Used for sample-accurate, low-latency sound scheduling to ensure the metronome's timing is perfectly stable.