# Visual Mode Comparison

## Mode Transition Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                      ICON MODE (Minimized)                      │
│                                                                 │
│                            Click −                              │
│                         ┌──────────┐                            │
│                         │          │                            │
│                         │    KF    │ ◄─── Rainbow Glow          │
│                         │          │                            │
│                         └──────────┘                            │
│                         Click Icon ▼                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                   TASKBAR MODE (Default)                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ● KatipOnline  Durum: Bekliyor  [▶ Başlat]              │  │
│  │ ⚡ Hız: [===============] 120ms                ⚙️  −      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                     ▲                    ▲                      │
│                     │                    │                      │
│              Centered (50%)       Compact Width                 │
│                     │                    │                      │
│               Click ⚙️ Settings          │                      │
│                     │                    │                      │
│                     ▼                    ▼                      │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                     FULL MODE (Settings Open)                   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    ⚙️ Ayarlar Panel                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │ ⚡ Yazma Hızı │  │ 🎯 Kelime    │  │ 🤖 İnsan Gibi │   │  │
│  │  │ [=========]  │  │    Limiti    │  │     Yaz      │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │ ❌ Hata Modu │  │ ⏱️ 3 Dakika │  │ ⏱️ 5 Dakika │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ● KatipOnline  [▶ Başlat]                               │  │
│  │ 📈 Ortalama WPM  ⚡ Hedef WPM  📝 Son Kelime  📊 Sayaç  │  │
│  │                                              ⚙️  −       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                     ▲                                           │
│                     │                                           │
│              Full Width (100%)                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Feature Comparison Table

| Feature                  | Icon Mode | Taskbar Mode | Full Mode |
|--------------------------|-----------|--------------|-----------|
| **Width**                | 60px      | Auto (compact) | 100% (edge-to-edge) |
| **Position**             | Center    | Center       | Full width |
| **Padding**              | N/A       | 12px         | 16px      |
| **Controls**             | None      | Basic        | All       |
| **Speed Slider**         | ❌        | ✅ (taskbar) | ✅ (settings) |
| **Statistics**           | ❌        | ❌           | ✅        |
| **Settings Panel**       | ❌        | ❌           | ✅        |
| **Start/Stop Button**    | ❌        | ✅           | ✅        |
| **Rainbow Glow**         | ✅        | ❌           | ❌        |
| **Screen Space Used**    | Minimal   | Small        | Maximum   |
| **Best For**             | Hiding UI | Quick control| Full control |

## Transition Animations

### Icon ⇄ Taskbar
```
Icon Mode:           Taskbar Mode:
   ┌───┐              ┌─────────────────────┐
   │ KF│ ───fade───▶  │ Controls + Slider   │
   └───┘              └─────────────────────┘
     ▲                          │
     │                          │
     └─────────click─────────────┘
```
**Animation:** 0.4s fade in/out

### Taskbar ⇄ Full
```
Taskbar Mode:                        Full Mode:
┌────────────────┐     expand      ┌──────────────────────────────┐
│  Compact View  │ ─────────────▶  │  Settings + Stats + All      │
└────────────────┘                  └──────────────────────────────┘
  (centered)                         (full-width, edge-to-edge)
        ▲                                      │
        │                                      │
        └──────────────contract────────────────┘
```
**Animation:** 0.4s width + position + opacity

## Layout Breakdown

### Taskbar Mode Layout
```
┌────────────────────────────────────────────────┐
│ [Padding: 12px]                                │
│ ┌────────────┬──────────────┬─────────────┐   │
│ │ Left       │ Center       │ Right       │   │
│ │ Controls   │ Speed Slider │ Settings    │   │
│ └────────────┴──────────────┴─────────────┘   │
│                                         [12px] │
└────────────────────────────────────────────────┘
```

**Components (Left to Right):**
1. Status indicator (● + text)
2. Current status text
3. Start/Stop button
4. Speed slider (⚡ Hız: [slider] 120ms)
5. Settings button (⚙️)
6. Minimize button (−)

### Full Mode Layout
```
┌────────────────────────────────────────────────────────────┐
│ [Settings Panel - Slides up from bottom]                  │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Grid: 2 columns                                        │ │
│ │ [Speed][Word Limit][Human-like][Mistakes][Predictions] │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│ [Main Panel - Full width]                                  │
│ ┌──────┬─────────────────────────────────────────┬──────┐ │
│ │ Left │ Center (Statistics)                     │ Right│ │
│ │ Ctrl │ [WPM][Target WPM][Last Word][Counter]   │ Btns │ │
│ └──────┴─────────────────────────────────────────┴──────┘ │
└────────────────────────────────────────────────────────────┘
```

**Components:**
- **Settings Panel:** All configuration options (grid layout)
- **Main Panel:** Controls + Statistics + Buttons (flex layout)

## Color Scheme

### Taskbar Mode
- Background: `rgba(28, 28, 30, 0.95)` - Dark translucent
- Border: `rgba(255, 255, 255, 0.1)` - Subtle white
- Slider BG: `rgba(255, 255, 255, 0.05)` - Very light
- Slider Border: `rgba(255, 255, 255, 0.08)` - Light outline
- Speed Value: `#007aff` - iOS Blue

### Full Mode (Same as Taskbar + Stats)
- WPM Box: `rgba(0, 122, 255, 0.15)` - Blue tint
- Target WPM: `rgba(52, 199, 89, 0.15)` - Green tint
- Word Counter: `rgba(255, 149, 0, 0.1)` - Orange tint
- Settings Panel: `rgba(28, 28, 30, 0.98)` - Slightly darker

### Icon Mode
- Background: `rgba(28, 28, 30, 0.95)` - Matches panel
- Border: Animated rainbow colors
- Text: `#ffffff` with glow
- Shadow: Animated with border color

## Responsive Behavior

### Content Push
```
Before Panel:           With Panel (Taskbar):    With Panel (Full):
┌─────────────┐        ┌─────────────┐           ┌─────────────┐
│             │        │             │           │             │
│   Content   │        │   Content   │           │   Content   │
│             │        │   ▲ Pushed  │           │   ▲ Pushed  │
│             │        │   │ Up      │           │   │ Up More │
└─────────────┘        ├─────────────┤           ├─────────────┤
                       │  Taskbar    │           │  Full Panel │
                       └─────────────┘           └─────────────┘
                        (padding-bottom:          (padding-bottom:
                         panel height)             panel height)
```

### Window Resize
- Taskbar mode: Centers automatically (50% left + translateX)
- Full mode: Stays edge-to-edge (0 left, 100% width)
- Icon mode: Stays centered (50% left + translateX)

---

**Legend:**
- ▶ / ◀ : Transition direction
- ⚙️ : Settings button
- − : Minimize button
- ● : Status indicator
- [===] : Slider/Range input
- ┌─┐ : Box/Container
