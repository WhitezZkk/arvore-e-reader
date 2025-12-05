# Design Guidelines: Árvore E-Reader Automation Tool

## Design Approach

**Selected Approach:** Design System-Based (Material Design principles)
**Rationale:** This is a utility-focused automation tool where clarity, efficiency, and real-time status monitoring are paramount. Users need immediate access to controls and clear visibility of progress—function drives the design.

**Core Principles:**
- Dashboard-like organization with clear visual hierarchy
- Immediate access to all controls without scrolling
- Real-time feedback through status indicators and progress visualization
- Professional, tool-like aesthetic that builds trust

---

## Layout System

**Spacing Strategy:**
Primary spacing units: `p-4`, `p-6`, `p-8` for consistent rhythm
Component spacing: `gap-4`, `gap-6` for internal elements
Section separation: `mb-8`, `mb-12` between major areas

**Container Structure:**
Single-page application layout (no scrolling required for core functionality)
Maximum width: `max-w-4xl` centered on page
Vertical sections stack with clear separation

---

## Typography Hierarchy

**Font Families:**
- Primary: Inter or Roboto (modern, highly readable)
- Monospace: JetBrains Mono or Roboto Mono (for logs and technical info)

**Type Scale:**
- Page title: `text-3xl font-bold` 
- Section headers: `text-xl font-semibold`
- Labels: `text-sm font-medium uppercase tracking-wide`
- Body text: `text-base`
- Log entries: `text-sm font-mono`
- Helper text: `text-sm text-opacity-70`

---

## Component Library

### Configuration Panel (Top Section)
**Layout:** Single card container with form grid
- Three input fields in vertical stack (email, password, book slug)
- Each field: Label above, input below with `h-12` height
- Password field with show/hide toggle icon on right
- All inputs: `rounded-lg` with subtle border, `px-4` internal padding
- Helper text below slug input: "Ex: harry-potter-e-a-pedra-filosofal"

### Control Panel (Middle Section)
**Layout:** Horizontal button group, centered
- Primary action button: "Iniciar Automação" - prominent, `h-12`, `px-8`
- Secondary buttons: "Pausar" and "Parar" - same height, `px-6`
- Buttons use `gap-3` spacing between them
- Disabled states when not applicable (pause/stop disabled until started)
- Icon + text pattern for each button

### Progress Visualization (Central Feature)
**Layout:** Prominent card with generous padding (`p-8`)
- Large progress bar: `h-4` height, `rounded-full`, smooth fill animation
- Percentage display: `text-4xl font-bold` centered above bar
- Status text below: "X / Y páginas" in `text-lg`
- Time elapsed/estimated shown below in smaller text
- This section expands visually when automation is active

### Activity Log (Bottom Section)
**Layout:** Console-style container
- Fixed height: `h-64` with `overflow-y-auto`
- Monospace font for all entries
- Each log entry: timestamp + icon + message
- Color coding (not by actual color, but by weight/icons): success, warning, error, info
- Most recent entries at bottom (auto-scroll behavior)
- Subtle border around log container

### Status Indicators
**Elements scattered throughout:**
- Connection status badge in top right: "Conectado" with pulsing dot
- Session info: Shows logged-in user email when active
- Book title display: Shows current book name when loaded

---

## Navigation & Information Architecture

**Single Page Layout** - No navigation needed
Header area: App title "Automação Árvore E-Reader" + status badge
Main content: Configuration → Controls → Progress → Logs (vertical flow)
Optional footer: Simple text with version or credits

---

## Responsive Behavior

**Desktop (default):** All sections visible simultaneously, optimal for monitoring
**Tablet/Mobile:** Stack sections vertically, maintain full functionality
- Configuration panel: Full width inputs
- Control buttons: Stack vertically on small screens
- Progress bar: Maintains visibility
- Log height reduces to `h-48` on mobile

---

## Interaction Patterns

**State Management:**
- Idle state: Only configuration fields and "Iniciar" button enabled
- Running state: Progress updates, all controls enabled, log actively populating
- Paused state: Progress frozen, "Retomar" and "Parar" available
- Completed state: Final stats shown, "Nova Execução" button appears

**Feedback Mechanisms:**
- Button loading states with spinner
- Progress bar smooth animation (transition effects)
- Log entries fade in as they appear
- Success/error toast notifications for critical events

---

## Animations

**Minimal, purposeful only:**
- Progress bar fill: Smooth width transition
- Log entry appearance: Subtle fade-in
- Button state changes: Quick opacity/scale feedback
- Status badge pulse: Gentle, non-distracting
**No page transitions, no decorative animations**

---

## Images

**No images required** - This is a pure utility interface focused on functionality and real-time data. All visual interest comes from typography hierarchy, spacing, and component organization.