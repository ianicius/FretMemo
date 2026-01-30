# What's Coming to FretMemo (And Why I'm Building It)

I've been reading your feedback. Forum posts, emails, the occasional Reddit thread where someone mentions the app. And I've been taking notes.

A lot of notes.

Today I want to share what's in the pipeline for FretMemo — not vague promises about "exciting updates coming soon," but actual features I'm actively building. Some of these will roll out in the next few weeks. Others will take a bit longer. But they're all coming, and they're all staying free.

Let me walk you through what's happening.

## Streaks Are Coming (And Yes, You Can Freeze Them)

You asked for this one more than anything else.

The idea is simple: practice every day, watch your streak grow. Miss a day, it resets. That little fire icon next to a growing number creates surprisingly powerful motivation — there's actual research showing streak mechanics boost daily engagement by 40-60%.

But here's the thing. Life happens. You get sick. You travel. Your guitar breaks a string and you can't get to the shop until tomorrow. Resetting a 30-day streak because of one unavoidable day feels brutal.

So I'm building in streak freezes. Earn one for every 7-day streak you complete. Bank them for emergencies. Use one, your streak survives the gap.

It's a small thing, but it changes the psychology completely. You're not punished for being human. You're rewarded for consistency while having a safety net for reality.

## The Fretboard Heat Map (See Your Weak Spots)

This one's been living in my head for months.

Imagine your fretboard, but every position is color-coded by your accuracy. Green for notes you nail every time. Yellow for the ones that take a second. Red for the spots where you consistently hesitate or miss.

At a glance, you'll see exactly where your knowledge gaps are. Maybe you're solid on the E and A strings but shaky on the B. Maybe frets 7-9 are a blind spot. Maybe you know all the natural notes but sharps and flats trip you up.

The heat map makes the invisible visible. No more guessing what to practice — the colors tell you.

And here's the fun part: watching those red spots turn yellow, then green over time. That's the visual proof that you're actually learning. Progress you can literally see.

## Practice Focus Mode (Finally)

I know, I know. This should have been there from the start.

Soon you'll be able to restrict practice to specific regions of the fretboard. Only want to drill frets 1-5? Done. Just the E and A strings? Sure. Ready to tackle frets 5-12 after mastering the open positions? Go for it.

There's also an option to hide fret numbers entirely. Once you're ready to stop using the dots as crutches, flip that switch and see if you really know where you are.

This is how serious fretboard memorization works — small sections, mastered completely, then expanded. The app should support that workflow instead of throwing the entire 12-fret, 6-string grid at you from day one.

## Spaced Repetition (The Algorithm That Actually Works)

Here's something most fretboard apps don't do: remember what you got wrong.

I'm implementing the SM-2 algorithm — the same one that powers Anki and other serious memorization tools. The short version: notes you struggle with appear more often. Notes you've mastered fade into the background. The app automatically prioritizes your weak spots without you having to think about it.

This isn't just random drilling anymore. It's intelligent practice that adapts to your actual performance.

Every position on the fretboard will have its own "ease factor" and review schedule. Get a note right quickly? You won't see it again for a while. Hesitate or miss? It comes back sooner. Over time, the algorithm learns exactly what you need to practice.

The result: more efficient sessions. Less time drilling notes you already know. More time on the ones that actually need work.

## Ear Training Mode (Connect Sound to Position)

This is a big one.

Knowing where C is on the fretboard is useful. Hearing a note and knowing where to find it? That's a different level entirely.

The new Ear Training mode will play a tone through your speakers, and you'll find it on the fretboard. No visual prompt — just sound. Your job is to connect what you hear with what you know.

I'm also building interval recognition training. The app plays two notes, you identify the interval. Start with easy ones (perfect fifth, octave) and work up to the trickier intervals (minor seconds, tritones).

And chord quality recognition — major, minor, diminished, augmented. Hear the chord, name it. Eventually seventh chords and beyond.

All of this uses the Web Audio API to generate tones directly in your browser. No downloads, no external audio files. Works offline once you've loaded the page.

This is where fretboard knowledge stops being theoretical and starts being musical.

## Alternate Tunings (For Real This Time)

Drop D. Open G. DADGAD. Half-step down for your SRV covers.

Most apps either don't support alternate tunings at all, or lock them behind a paywall. I'm building in support for the most common tunings — plus a custom tuning option where you can set each string to whatever note you want.

Switch tunings, and the entire app recalculates. Every note position, every practice exercise, every quiz question adapts to your actual tuning.

If you spend most of your time in Drop D, you shouldn't be drilling standard tuning positions. Now you won't have to.

## Achievement Badges (Because Progress Deserves Recognition)

I'm adding a badge system. Not the obnoxious gamification that makes you feel like you're playing a mobile game designed for children — just clear milestones that recognize your progress.

First 100 notes identified. First 7-day streak. Mastering all notes on a single string. Completing all 24 permutations in the technique trainer. Hitting 30 correct answers in 60 seconds.

Badges you've earned light up. Badges you haven't are greyed out, showing you what's possible. It's a simple system, but it gives you concrete goals beyond "get better at guitar."

## The Daily Challenge Expansion

The daily challenge system is getting a serious upgrade.

Right now it rotates through permutation patterns. Soon it'll include:

**Speed Blitz** — Identify 30 notes in 60 seconds. Race the clock.

**Precision Practice** — Get 20 correct with a maximum of 2 mistakes. Accuracy over speed.

**String Master** — Today's challenge: master all notes on the G string. Tomorrow, a different string.

**Position Challenge** — Focus only on frets 5-9 today. A different zone tomorrow.

Each day brings a different challenge type, keeping practice fresh. Complete the daily challenge for bonus XP and streak-boosting rewards.

## XP and Levels (Optional Gamification)

Some of you love tracking progress with numbers. Others don't care. So I'm making this optional.

If you enable it, you'll earn XP for correct answers, completed challenges, and achievements unlocked. XP accumulates into levels. Your streak multiplies XP earned — the longer your streak, the faster you level.

There's an XP bar showing progress to your next level. A level badge showing where you stand. But if you find it distracting, you can turn the whole thing off in settings and just practice without the numbers.

Gamification should be a tool, not an obligation.

## "Find All Notes" Challenge

Here's a mode that's been requested a lot: instead of finding one random note, find ALL occurrences of a specific note.

The app says "Find all the A notes." You click every A on the fretboard — and there are several of them spread across different strings and positions. A counter shows how many you've found out of the total.

This is incredibly effective for building that instant recognition. When you've hunted down every A, every Bb, every F# multiple times, you stop thinking "where is it?" and start just knowing.

Optional timer for those who want to race themselves. High scores for those who want to compete with their own records.

## Timed Challenge Modes

Speaking of racing yourself:

**60-Second Blitz** — How many correct answers can you get in one minute? Personal best tracking. Push yourself faster.

**Survival Mode** — Keep going until you miss. How long can you last? Streak-style pressure with no time limit.

**Speed Ladder** — Start slow, tempo increases every few correct answers. See how fast you can go before you crack.

These modes turn practice into a game. Not everyone wants that, but for those who do, it's surprisingly effective at building rapid recall.

## Scale and Chord Visualization

Not just drilling notes — understanding how they connect.

The Scale Explorer will let you pick any scale (major, minor, pentatonic, modes, you name it) and see it laid out across the entire fretboard. Color-coded by scale degree so you can see the patterns. Toggle between showing note names or interval numbers.

Chord diagrams are coming too. See any chord shape displayed clearly, understand which notes it contains, and practice finding those notes across the fretboard.

This bridges the gap between "I know where C is" and "I understand how C major relates to the notes around it."

## PWA Support (Offline Practice, Home Screen Access)

FretMemo will become a proper Progressive Web App.

What that means for you: you can "install" it to your phone's home screen. It'll work offline. It'll load faster. It'll feel like a native app without requiring a download from any app store.

No subscription. No account required. Just a guitar trainer that lives on your phone and works wherever you are.

## Data Export and Import

Your progress should belong to you.

Soon you'll be able to export all your data — stats, streaks, achievements, practice history — as a JSON file. Back it up. Transfer it to a new device. Keep it forever.

Import works too. Load your data on a new phone or browser, pick up exactly where you left off.

No account system means no cloud sync, but this gives you full control over your own progress data.

## The Timeline (Roughly)

I'm not going to promise specific dates because software development doesn't work that way. But here's the general order:

**Coming Soon:**
- Streak system with freezes
- Heat map visualization
- Practice focus mode (fret/string selection)
- Basic achievement badges
- PWA support

**After That:**
- Spaced repetition algorithm
- XP and leveling
- Alternate tuning support
- Enhanced daily challenges
- Data export/import

**Later:**
- Ear training mode
- Interval training
- Scale and chord visualization
- Timed challenge modes
- Find All Notes mode

I'm one person building this in my spare time, so things take as long as they take. But they're all coming.

## One More Thing

Everything I just described will be free.

No premium tier. No "unlock full fretboard for $9.99." No subscription that charges you monthly for what amounts to a flashcard app.

I built FretMemo because I needed it. I'm adding these features because you've asked for them and because they'll make the tool genuinely better. The goal has always been simple: help people learn the fretboard without the frustration of apps that treat users like revenue sources.

That's not changing.

If you've been using FretMemo, thank you. Your feedback has shaped everything on this roadmap. Keep it coming — I read all of it.

And if you haven't tried it yet, now you know what's coming. Might be worth checking in.

---

*Have a feature request I didn't mention? Something you think would make practice better? Drop a comment or reach out directly. The roadmap isn't set in stone — it's built from what you actually need.*
