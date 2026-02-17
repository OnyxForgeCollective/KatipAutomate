# Taskbar Mode Feature Documentation

## Overview

The UI now features a smart taskbar mode that automatically adapts based on whether the settings panel is open or closed, providing a cleaner, more efficient user interface.

## Modes

### 1. Taskbar Mode (Default - Settings Closed)

**Appearance:**
- Panel is centered horizontally at the bottom of the screen
- Compact width with minimal padding (12px)
- Shows only essential controls

**Visible Elements:**
- Status indicator (green dot + "KatipOnline" text)
- Current status ("Durum: Bekliyor")
- Start/Stop button ("▶ Başlat" / "⏸ Durdur")
- **Speed slider** with real-time value display (⚡ Hız: [slider] 120ms)
- Settings button (⚙️)
- Minimize button (−)

**Hidden Elements:**
- All statistics (WPM, estimated WPM, last word, word counter)
- These are hidden to keep the taskbar compact

**Benefits:**
- ✅ More screen space for content
- ✅ Quick access to speed control without opening settings
- ✅ Cleaner, less cluttered interface
- ✅ Professional appearance

---

### 2. Full Mode (Settings Open)

**Appearance:**
- Panel expands to full-width (edge-to-edge)
- Settings panel slides up from the bottom
- Increased padding (16px)

**Visible Elements:**
- All controls from taskbar mode
- Settings panel with:
  - Speed slider (primary control in settings)
  - Word limit toggle and settings
  - Human-like typing toggle
  - Mistake mode settings
  - Time predictions (3, 5, 10 minutes)
- All statistics:
  - Average WPM (📈 Ortalama yazım hızı)
  - Target WPM (⚡ Hedeflenen yazım hızı)
  - Last word (📝 Son Kelime)
  - Word counter (📊 Kelime)

**Hidden Elements:**
- Taskbar speed slider (replaced by settings panel slider)

**Benefits:**
- ✅ Full access to all settings and controls
- ✅ Detailed statistics visible
- ✅ Complete control over bot behavior
- ✅ Better for initial configuration

---

### 3. Icon Mode (Minimized)

**Appearance:**
- Small circular icon at bottom center
- Displays "KF" text
- Rainbow glow animation around border
- 60x60 pixels

**Features:**
- ✅ Minimal screen footprint
- ✅ Always visible but unobtrusive
- ✅ Click to restore panel
- ✅ Eye-catching animation

---

## Animations & Transitions

### Transition Timing
- **Duration:** 0.4 seconds
- **Easing:** `cubic-bezier(0.4, 0, 0.2, 1)` - Smooth, natural motion
- **Properties:** All properties transition smoothly (width, padding, position)

### Transition Flow

1. **Settings Open:**
   ```
   Taskbar Mode → Full Mode
   - Panel expands from center to full-width
   - Stats fade in
   - Taskbar slider fades out
   - Settings panel slides up from bottom
   ```

2. **Settings Close:**
   ```
   Full Mode → Taskbar Mode
   - Panel contracts from full-width to center
   - Stats fade out
   - Taskbar slider fades in
   - Settings panel slides down
   ```

3. **Minimize:**
   ```
   Panel → Icon
   - Panel fades out
   - Icon fades in with rainbow glow
   ```

4. **Restore:**
   ```
   Icon → Panel
   - Icon fades out
   - Panel fades in (in taskbar mode)
   ```

---

## Speed Slider Synchronization

Both sliders (settings and taskbar) stay perfectly synchronized:

### Synchronization Logic
```javascript
function syncTaskbarSlider(value) {
    const taskbarSlider = document.getElementById('taskbar-slider');
    const taskbarSpeedValue = document.getElementById('taskbar-speed-value');
    if (taskbarSlider) taskbarSlider.value = value;
    if (taskbarSpeedValue) taskbarSpeedValue.textContent = value + 'ms';
}
```

### Features:
- ✅ Changing settings slider updates taskbar slider
- ✅ Changing taskbar slider updates settings slider
- ✅ Real-time value display in taskbar
- ✅ All changes saved to localStorage
- ✅ Estimated WPM recalculated on every change

---

## Content Push Behavior

When the panel is visible, it automatically pushes page content up to prevent overlap:

```css
body.katip-panel-open {
    padding-bottom: var(--katip-panel-height, 0px);
}
```

### How it works:
1. Panel height is measured dynamically
2. CSS variable `--katip-panel-height` is set
3. Body padding-bottom adjusts automatically
4. Content smoothly moves up
5. No content is hidden behind the panel

### Benefits:
- ✅ No content obscured by panel
- ✅ Smooth transitions as panel size changes
- ✅ Works with any page layout
- ✅ Responsive to panel height changes

---

## Technical Implementation

### Panel Positioning

**Taskbar Mode:**
```javascript
panel.style.left = '50%';
panel.style.right = 'auto';
panel.style.transform = 'translateX(-50%)';
panel.style.width = 'auto';
panel.style.maxWidth = '95%';
```

**Full Mode:**
```javascript
panel.style.left = '0';
panel.style.right = '0';
panel.style.transform = 'none';
panel.style.width = '100%';
panel.style.maxWidth = '100%';
```

### State Management

The mode is controlled by the `toggleTaskbarMode(isSettingsOpen)` function:
- Called when settings button is clicked
- Called when close settings button is clicked
- Manages visibility of taskbar slider vs stats
- Adjusts padding and width
- Handles positioning

---

## Usage Guide

### Switching Between Modes

1. **To open settings (switch to Full Mode):**
   - Click the ⚙️ Settings button
   - Panel will smoothly expand to full-width
   - Settings panel will slide up
   - All stats will become visible

2. **To close settings (switch to Taskbar Mode):**
   - Click the × close button in settings panel
   - OR click the ⚙️ Settings button again
   - Panel will smoothly contract to center
   - Taskbar slider will appear
   - Stats will be hidden

3. **To minimize (switch to Icon Mode):**
   - Click the − Minimize button
   - Panel will fade out
   - Icon will appear at bottom center

4. **To restore from icon:**
   - Click the KF icon
   - Panel will fade in (in taskbar mode)

### Adjusting Speed

**From Taskbar Mode:**
- Simply drag the speed slider in the taskbar
- Value updates in real-time
- Changes are automatically saved

**From Settings Panel:**
- Open settings (⚙️ button)
- Adjust the slider in settings
- Or type a value in the number input
- Changes sync with taskbar slider

---

## Browser Compatibility

The taskbar mode uses modern CSS and JavaScript features:
- ✅ Chrome/Edge: Full support
- ✅ Firefox: Full support
- ✅ Safari: Full support (with webkit prefixes)
- ✅ Mobile browsers: Not applicable (userscript for desktop only)

CSS Features Used:
- `transform: translateX(-50%)` - Center positioning
- `transition` with cubic-bezier
- `backdrop-filter` with fallbacks
- Flexbox layout
- CSS custom properties (variables)

---

## Performance Notes

### Optimizations
- Transitions use GPU-accelerated properties (transform, opacity)
- DOM updates are batched where possible
- Event handlers debounced where appropriate
- Minimal reflows/repaints

### Resource Usage
- No additional JavaScript libraries required
- Minimal CSS (embedded in userscript)
- No external resources loaded
- No performance impact on typing functionality

---

## Future Enhancements

Possible improvements for future versions:
- [ ] Keyboard shortcuts to toggle modes
- [ ] Remember last mode (taskbar vs full)
- [ ] Customizable taskbar controls
- [ ] Draggable panel positioning
- [ ] Multiple color themes
- [ ] Animation speed preferences

---

## Troubleshooting

### Panel doesn't center properly
- Check browser zoom level (should be 100%)
- Verify no custom CSS is interfering
- Try refreshing the page

### Animations are jumpy
- Reduce browser extensions that might interfere
- Check system performance/resources
- Try disabling hardware acceleration if issues persist

### Speed slider not syncing
- Open browser console (F12)
- Check for JavaScript errors
- Verify localStorage is enabled
- Try clearing localStorage and refreshing

---

## Changelog

### v2.3 (Current)
- ✅ Added taskbar mode with centered layout
- ✅ Added taskbar speed slider
- ✅ Implemented smooth transitions
- ✅ Stats hide in taskbar mode
- ✅ Slider synchronization
- ✅ Improved code structure

### v2.0-2.2 (Previous)
- Full-width panel only
- No taskbar mode
- Stats always visible
- No quick speed access

---

**End of Documentation**
