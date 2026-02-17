# UI Modes Quick Reference

## 🎯 Three Display Modes

### 1️⃣ Taskbar Mode (Default)
```
┌──────────────────────────────────────────────────┐
│ ● KatipOnline | Durum | [▶ Başlat] | ⚡ Hız: [═] 120ms | ⚙️ − │
└──────────────────────────────────────────────────┘
```
- **When:** Settings closed (default state)
- **Position:** Centered at bottom
- **Size:** Compact, auto width
- **Shows:** Controls + Speed slider
- **Hides:** Statistics

### 2️⃣ Full Mode
```
┌────────────────────────────────────────────────────────────────┐
│                      ⚙️ Ayarlar Panel                           │
│  [Settings Controls & Options]                                 │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│ ● KatipOnline | [▶] | 📈 Stats | ⚡ Stats | 📝 Word | 📊 Count | ⚙️ − │
└────────────────────────────────────────────────────────────────┘
```
- **When:** Settings open (click ⚙️)
- **Position:** Full-width (edge-to-edge)
- **Size:** Expanded
- **Shows:** Controls + Settings + Statistics
- **Hides:** Taskbar slider

### 3️⃣ Icon Mode
```
        ┌──────┐
        │      │
        │  KF  │  🌈 (rainbow glow)
        │      │
        └──────┘
```
- **When:** Minimized (click −)
- **Position:** Centered at bottom
- **Size:** 60x60px circle
- **Shows:** Just the icon
- **Hides:** Everything else

---

## ⌨️ Quick Actions

| Action | Button | Result |
|--------|--------|--------|
| Open Settings | ⚙️ | Taskbar → Full Mode |
| Close Settings | × or ⚙️ | Full → Taskbar Mode |
| Minimize | − | Any Mode → Icon |
| Restore | Click KF | Icon → Taskbar Mode |
| Adjust Speed | Drag slider | Updates in real-time |

---

## 🎨 Visual Differences

### Taskbar Mode
- ✅ Centered position
- ✅ Compact width
- ✅ Padding: 12px
- ✅ Speed slider visible
- ❌ Stats hidden

### Full Mode
- ✅ Full width (100%)
- ✅ Expanded height
- ✅ Padding: 16px
- ✅ All stats visible
- ❌ Taskbar slider hidden

---

## 🔄 Transition Speed

All transitions: **0.4 seconds**
Animation type: **cubic-bezier(0.4, 0, 0.2, 1)**

---

## 💡 Tips

1. **For quick speed adjustments:** Stay in Taskbar Mode
2. **For detailed configuration:** Switch to Full Mode
3. **For maximum screen space:** Use Icon Mode
4. **For monitoring stats:** Keep in Full Mode

---

## 📊 What's Visible in Each Mode

| Element | Icon | Taskbar | Full |
|---------|------|---------|------|
| KF Icon | ✅ | ❌ | ❌ |
| Status Indicator | ❌ | ✅ | ✅ |
| Start/Stop Button | ❌ | ✅ | ✅ |
| Speed Slider (Taskbar) | ❌ | ✅ | ❌ |
| Speed Slider (Settings) | ❌ | ❌ | ✅ |
| WPM Stats | ❌ | ❌ | ✅ |
| Last Word | ❌ | ❌ | ✅ |
| Word Counter | ❌ | ❌ | ✅ |
| Settings Panel | ❌ | ❌ | ✅ |
| Settings Button | ❌ | ✅ | ✅ |
| Minimize Button | ❌ | ✅ | ✅ |

---

## 🚀 Performance

- **No lag:** GPU-accelerated animations
- **Smooth:** 60fps transitions
- **Light:** No extra resources loaded
- **Fast:** Instant slider updates

---

**Quick Start:** Default mode is Taskbar. Click ⚙️ to expand, − to minimize!
