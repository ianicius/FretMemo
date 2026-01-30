# FretMemo Premium Visual Upgrade Plan

## Design Philosophy: "Gold Standard"

A luxury gold/graphite aesthetic that evokes premium guitar hardware, vintage amplifiers, and professional studio equipment.

---

## Color System

### CSS Custom Properties (Add to `:root`)

```css
/* Premium Gold Palette */
--gold-50: #FFFBEB;
--gold-100: #FEF3C7;
--gold-200: #FDE68A;
--gold-300: #FCD34D;
--gold-400: #FBBF24;
--gold-500: #F59E0B;
--gold-600: #D97706;
--gold-700: #B45309;
--gold-800: #92400E;
--gold-900: #78350F;

/* Graphite Palette */
--graphite-50: #FAFAF9;
--graphite-100: #F5F5F4;
--graphite-200: #E7E5E4;
--graphite-300: #D6D3D1;
--graphite-400: #A8A29E;
--graphite-500: #78716C;
--graphite-600: #57534E;
--graphite-700: #44403C;
--graphite-800: #292524;
--graphite-900: #1C1917;
--graphite-950: #0C0A09;

/* Accent Assignments */
--accent-gold: var(--gold-500);
--accent-gold-light: var(--gold-400);
--accent-gold-dark: var(--gold-600);
--accent-gold-glow: rgba(245, 158, 11, 0.35);
--accent-gold-subtle: rgba(245, 158, 11, 0.12);
```

---

## Component Upgrades

### 1. Primary Button (`.control-btn--primary`)

**Current Issues:**
- Flat gradient, lacks depth
- No distinctive premium feel

**Premium Treatment:**
```css
.control-btn--primary {
  /* 3D Beveled Base */
  background: linear-gradient(
    180deg,
    #FCD34D 0%,
    #F59E0B 45%,
    #D97706 100%
  );
  
  /* Rich Border */
  border: 1px solid #B45309;
  border-bottom-width: 3px;
  
  /* Premium Shadow */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    0 4px 0 #92400E,
    0 6px 12px rgba(146, 64, 14, 0.35),
    0 8px 24px rgba(245, 158, 11, 0.25);
  
  /* Typography */
  color: #451A03;
  font-weight: 800;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3);
  letter-spacing: 0.02em;
  
  /* Transitions */
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.control-btn--primary:hover {
  transform: translateY(-2px);
  background: linear-gradient(
    180deg,
    #FDE68A 0%,
    #FBBF24 45%,
    #F59E0B 100%
  );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    0 6px 0 #92400E,
    0 8px 20px rgba(146, 64, 14, 0.4),
    0 12px 32px rgba(245, 158, 11, 0.35);
}

.control-btn--primary:active {
  transform: translateY(3px);
  border-bottom-width: 1px;
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.2),
    0 1px 0 #92400E;
}
```

### 2. Secondary Buttons (`.control-btn`)

**Premium Treatment:**
```css
.control-btn {
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(250, 250, 249, 0.9) 100%
  );
  border: 1px solid var(--graphite-200);
  border-bottom-width: 2px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.05),
    0 2px 4px rgba(0, 0, 0, 0.03);
  color: var(--graphite-700);
  transition: all 0.2s ease;
}

.control-btn:hover {
  border-color: var(--gold-400);
  background: linear-gradient(
    180deg,
    rgba(255, 251, 235, 0.95) 0%,
    rgba(255, 255, 255, 0.95) 100%
  );
  box-shadow:
    0 0 0 1px var(--gold-200),
    0 4px 12px rgba(245, 158, 11, 0.15);
}

.control-btn:active {
  transform: translateY(1px);
  border-bottom-width: 1px;
}
```

### 3. Answer Option Buttons (`.answer-option-btn`)

**Current:** Basic flat cards

**Premium - "Tactile Keycap":**
```css
.answer-option-btn {
  /* Keycap 3D Base */
  background: linear-gradient(
    180deg,
    #FAFAF9 0%,
    #F5F5F4 50%,
    #E7E5E4 100%
  );
  
  border: 1px solid #D6D3D1;
  border-bottom-width: 4px;
  border-radius: 12px;
  
  /* Keycap Lighting */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    0 1px 2px rgba(0, 0, 0, 0.05);
  
  /* Typography */
  color: var(--graphite-800);
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.01em;
  
  transition: all 0.1s ease;
}

.answer-option-btn:hover {
  background: linear-gradient(
    180deg,
    #FFFBEB 0%,
    #FEF3C7 50%,
    #FDE68A 100%
  );
  border-color: var(--gold-400);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 0 20px var(--accent-gold-subtle);
}

.answer-option-btn:active {
  transform: translateY(3px);
  border-bottom-width: 1px;
  background: linear-gradient(
    180deg,
    #E7E5E4 0%,
    #D6D3D1 100%
  );
}

/* Correct/Wrong States */
.answer-option-btn.correct {
  background: linear-gradient(
    180deg,
    #86EFAC 0%,
    #22C55E 50%,
    #16A34A 100%
  );
  border-color: #15803D;
  color: #052E16;
}

.answer-option-btn.wrong {
  background: linear-gradient(
    180deg,
    #FCA5A5 0%,
    #EF4444 50%,
    #DC2626 100%
  );
  border-color: #B91C1C;
  color: #450A0A;
}
```

### 4. Segmented Controls (`.switcher-btn`)

**Premium Treatment:**
```css
.segmented-control {
  background: linear-gradient(
    180deg,
    var(--graphite-100) 0%,
    var(--graphite-200) 100%
  );
  border: 1px solid var(--graphite-300);
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.05),
    0 1px 0 rgba(255, 255, 255, 0.8);
  padding: 4px;
}

.switcher-btn {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  color: var(--graphite-600);
  font-weight: 600;
  transition: all 0.2s ease;
}

.switcher-btn:hover {
  background: rgba(255, 255, 255, 0.5);
  color: var(--graphite-800);
}

.switcher-btn.active {
  background: linear-gradient(
    180deg,
    #FFFFFF 0%,
    #F5F5F4 100%
  );
  border: 1px solid var(--graphite-300);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.1),
    0 1px 0 rgba(255, 255, 255, 0.8) inset;
  color: var(--graphite-900);
}

.switcher-btn.active:hover {
  background: linear-gradient(
    180deg,
    #FFFBEB 0%,
    #FEF3C7 100%
  );
  border-color: var(--gold-300);
}
```

### 5. Fretboard Enhancement

**Premium Graphite/Wood Treatment:**
```css
#fretboard {
  /* Rich wood-like gradient base */
  background: 
    linear-gradient(
      90deg,
      rgba(120, 53, 15, 0.03) 0%,
      transparent 50%,
      rgba(120, 53, 15, 0.03) 100%
    ),
    linear-gradient(
      180deg,
      #FAFAF9 0%,
      #F5F5F4 100%
    );
  
  /* Premium border */
  border: 1px solid var(--graphite-300);
  border-bottom-width: 3px;
  
  /* Elevated shadow */
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.05),
    0 4px 12px rgba(0, 0, 0, 0.08),
    0 12px 32px rgba(0, 0, 0, 0.06);
  
  border-radius: 16px;
}

/* Fret Lines */
.fret {
  border-right: 2px solid var(--graphite-400);
}

.fret[data-fret="0"] {
  border-right-width: 6px;
  border-right-color: var(--graphite-700);
  background: linear-gradient(
    90deg,
    var(--graphite-300) 0%,
    var(--graphite-200) 50%,
    var(--graphite-300) 100%
  );
}

/* Marker Dots - Premium Gold */
.marker-dot {
  background: radial-gradient(
    circle at 30% 30%,
    var(--gold-300) 0%,
    var(--gold-500) 50%,
    var(--gold-700) 100%
  );
  box-shadow:
    inset 0 1px 2px rgba(255, 255, 255, 0.4),
    0 1px 2px rgba(0, 0, 0, 0.2);
  width: 1.25rem;
  height: 1.25rem;
}

/* Highlight Dot - Gold Glow */
#highlight-dot {
  background: transparent;
  border: 4px solid var(--gold-500);
  box-shadow:
    0 0 0 4px var(--accent-gold-subtle),
    0 0 24px var(--accent-gold-glow),
    inset 0 0 12px var(--accent-gold-subtle);
  animation: pulse-gold 2s ease-in-out infinite;
}

@keyframes pulse-gold {
  0%, 100% {
    box-shadow:
      0 0 0 4px var(--accent-gold-subtle),
      0 0 24px var(--accent-gold-glow),
      inset 0 0 12px var(--accent-gold-subtle);
  }
  50% {
    box-shadow:
      0 0 0 8px var(--accent-gold-subtle),
      0 0 32px var(--accent-gold-glow),
      inset 0 0 16px var(--accent-gold-subtle);
  }
}
```

### 6. Side Panel & Settings

```css
#side-panel {
  background: linear-gradient(
    180deg,
    var(--graphite-50) 0%,
    #FFFFFF 100%
  );
  border-right: 1px solid var(--graphite-200);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.06);
}

/* Settings Groups */
.setting-group {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--graphite-200);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.setting-group h3 {
  color: var(--gold-700);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
```

### 7. Metronome Toggle

```css
.metronome-toggle {
  background: linear-gradient(
    180deg,
    #FFFFFF 0%,
    var(--graphite-100) 100%
  );
  border: 1px solid var(--graphite-300);
  border-bottom-width: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.metronome-toggle:hover {
  border-color: var(--gold-400);
  box-shadow: 0 0 0 3px var(--accent-gold-subtle);
}

.metronome-toggle.is-running {
  background: linear-gradient(
    180deg,
    var(--gold-300) 0%,
    var(--gold-500) 100%
  );
  border-color: var(--gold-600);
  color: var(--graphite-900);
}
```

### 8. Dark Mode Adaptations

```css
html[data-mode="dark"],
html.dark {
  /* Gold stays vibrant in dark */
  --accent-gold: var(--gold-400);
  --accent-gold-light: var(--gold-300);
  --accent-gold-dark: var(--gold-500);
  --accent-gold-glow: rgba(251, 191, 36, 0.3);
  
  /* Graphite backgrounds */
  --bg: var(--graphite-950);
  --surface: var(--graphite-900);
  --panel: var(--graphite-800);
}

html[data-mode="dark"] .control-btn--primary {
  background: linear-gradient(
    180deg,
    #FCD34D 0%,
    #F59E0B 45%,
    #D97706 100%
  );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    0 4px 0 #92400E,
    0 6px 12px rgba(245, 158, 11, 0.4),
    0 0 40px rgba(245, 158, 11, 0.2);
}

html[data-mode="dark"] #fretboard {
  background:
    linear-gradient(
      90deg,
      rgba(251, 191, 36, 0.03) 0%,
      transparent 50%,
      rgba(251, 191, 36, 0.03) 100%
    ),
    linear-gradient(
      180deg,
      var(--graphite-800) 0%,
      var(--graphite-900) 100%
    );
  border-color: var(--graphite-700);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.3),
    0 4px 12px rgba(0, 0, 0, 0.4),
    0 0 60px rgba(245, 158, 11, 0.05);
}
```

---

## Micro-interactions Checklist

- [ ] All buttons: 0.15s-0.2s transition duration
- [ ] Hover: translateY(-2px) lift effect
- [ ] Active: translateY(2-3px) press effect
- [ ] Focus-visible: Gold ring with 2px offset
- [ ] Answer buttons: Subtle gold glow on hover
- [ ] Metronome pulse: Smooth gold glow animation
- [ ] Stats display: Lift effect on hover
- [ ] Segmented controls: Smooth background transition

---

## Mobile Considerations

- Keep touch targets minimum 44px
- Maintain 3D button appearance but reduce shadow intensity for performance
- Ensure gold colors remain visible in sunlight
- Test reduced motion preferences

---

## Files to Modify

1. `styles.css` - Add new CSS custom properties and component styles
2. `css/app.css` - Update existing component classes
3. Optional: `js/app.js` - Add CSS classes for correct/wrong states if needed
