Guitar Fretboard Trainer
An interactive, browser-based application designed to help guitarists of all levels master the fretboard. This tool offers a variety of training modes, from basic note identification to advanced scale sequencing, all within a single, self-contained HTML file.

Live Demo: https://fretmemo.net/

Features
The application is packed with features to provide a comprehensive and customizable practice experience.

🎸 Core Training Modules
Guess the Note: A quiz-style mode to test your fretboard knowledge.

Fretboard → Note: Identify the note for a highlighted position on the fretboard.

Tab → Note: Read a single-note tab and identify the correct note name.

Note → Tab: Find the correct fretboard position for a given note name.

Playing Practice: A dynamic mode for practicing sequences and improving dexterity.

Note Names Mode: The application displays the name of the next note to play.

Tab Sequence Mode: A dynamic tablature shows the current and next note to play, simulating reading music and encouraging fluid movement across the neck.

🎼 Advanced Sequence Generation
The "Playing Practice" mode is powered by an intelligent sequence generator:

Intervals: Practice moving between notes based on specific intervals (Minor/Major Thirds, Fourths, Fifths, Sevenths).

Scales: Learn and practice scales in any key.

Major Scale

Natural Minor Scale

Major Pentatonic

Minor Pentatonic

Smart Fretboard Traversal: The algorithm guides the user up and down the entire length of the fretboard, teaching practical and economical fingering by finding the closest logical position for the next note in the sequence.

🛠️ Tools & Utilities
Built-in Metronome: A fully-featured metronome with:

Adjustable Tempo (30-280 BPM).

Customizable Note Duration.

Optional "Count-in" before starting.

Auto-acceleration to gradually increase speed.

Microphone Input: Enable your microphone for real-time pitch detection to verify the notes you are playing.

⚙️ Customization & Accessibility
Note Selection: Isolate specific notes to practice or focus only on natural notes.

Appearance:

Light & Dark Mode.

Left-Handed Mode (flips the fretboard horizontally).

Accessibility:

Keyboard shortcuts for answering questions (1, 2, 3, 4) and controlling the metronome (Space).

ARIA attributes for better screen reader support.

Trapped focus within modals for improved keyboard navigation.

📊 Progress Tracking
Live Score: Keep track of correct and incorrect answers in real-time.

Mistake Statistics: A detailed modal shows which notes you struggle with the most, helping you identify and focus on your weak spots.

Technologies Used
This project is built with a focus on simplicity and performance, using only front-end technologies with zero dependencies or build steps.

HTML5

CSS3 (with Tailwind CSS via CDN for styling)

Vanilla JavaScript (ES6+)

Web Audio API (for metronome clicks and pitch detection)

How to Use

For best results, run it from a local web server (recommended). This avoids browser caching quirks and enables features that require an HTTP origin (PWA/service worker, consistent asset loading).

**Option A (Python)**
1) Open a terminal in the project folder (the one containing `index.html`).
2) Run:
   - `py -m http.server 8000` (Windows), or `python -m http.server 8000`
3) Open: `http://localhost:8000/`

**Option B (VS Code)**
- Use the “Live Server” extension and open `index.html`.

If you previously ran the app on `https://fretmemo.net/`, your browser may have a service worker cached. Do a hard refresh (Ctrl+F5) or clear site data if you’re not seeing updates.

Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

License
This project is licensed under the MIT License. See the LICENSE file for details.

Contact
Feel free to share any feedback at raf.janicki@gmail.com.
