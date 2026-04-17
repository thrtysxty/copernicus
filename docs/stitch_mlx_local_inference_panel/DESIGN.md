```markdown
# Design System Specification

## 1. Overview & Creative North Star

### The Creative North Star: "The Obsidian Command"
This design system is built for the high-performance developer who demands technical density without the clutter. It moves beyond standard "dark mode" into an ultra-dark, high-contrast editorial experience. We are not building a generic web app; we are building a precision instrument. 

The aesthetic is **Cyberpunk Brutalism**: a collision of pure obsidian depths, sharp technical typography, and neon "phosphor" accents that mimic vintage terminal displays reimagined for a luxury digital era. We intentionally break the "template" look by using exaggerated typographic scales, asymmetric content weighting, and a reliance on tonal layering rather than structural lines to define space.

---

## 2. Colors

The color palette is designed to maintain extreme legibility in low-light environments while creating a sense of infinite depth.

### Palette Tokens
*   **Background:** `#000000` (The void)
*   **Primary (Phosphor):** `#a3ff12` (High-energy lime for critical actions and active states)
*   **Surface (Obsidian):** `#0e0e0e` (Base for cards and containers)
*   **Neutral Secondary:** `#71717a` (Zinc-500 for non-essential technical metadata)
*   **Stroke (Steel):** `#1a1a1a` (The only allowed value for "Ghost Borders")

### The "No-Line" Rule
Standard 1px borders are largely prohibited for sectioning. Layout boundaries must be defined through:
1.  **Tonal Shifts:** Transitioning from `surface` (`#0e0e0e`) to `surface-container-low` (`#131313`).
2.  **Negative Space:** Using the Spacing Scale to let the void separate concerns.

### The "Glass & Glow" Principle
Floating elements (modals, tooltips, popovers) must use **Glassmorphism**. Apply a semi-transparent `surface` color with a `20px` backdrop-blur. To provide "soul," primary CTAs should utilize a subtle radial gradient transitioning from `primary` (`#d2ff9a`) to `primary-container` (`#9ffb06`), giving the button a pressurized, luminous feel.

---

## 3. Typography

The typography strategy leverages the contrast between the human-readable (Inter) and the machine-executable (Space Grotesk/JetBrains Mono).

*   **Display & Headlines (Space Grotesk):** Large-scale, high-impact titles. These should feel like technical headers on a blueprint. Use `tracking-tighter` for `display-lg` to create a compact, premium editorial look.
*   **Technical Labels (JetBrains Mono / Fira Code):** All uppercase. Used for status, code, and "machine" data. These are the soul of the terminal aesthetic.
*   **Body (Inter):** High-legibility sans-serif for descriptions and documentation.

### Type Scale Highlights
*   **Display-LG:** `3.5rem` / Space Grotesk / Bold (For hero branding)
*   **Headline-SM:** `1.5rem` / Space Grotesk / Medium (For section titles)
*   **Label-MD:** `0.75rem` / Monospace / Medium / Uppercase (For all UI labels)

---

## 4. Elevation & Depth

We reject drop shadows in favor of **Tonal Layering**. Depth is a result of light emission from the background, not a physical sun.

*   **The Layering Principle:** Stacking follows a strict hierarchy:
    *   **Level 0 (Base):** `surface-dim` (`#0e0e0e`)
    *   **Level 1 (Section):** `surface-container-low` (`#131313`)
    *   **Level 2 (Card):** `surface-container` (`#191919`)
*   **Ambient Shadows:** For floating modals, use an extra-diffused shadow: `0 20px 50px -12px rgba(163, 255, 18, 0.08)`. This uses a tinted version of our "Phosphor" green to mimic a radioactive glow rather than a grey shadow.
*   **The Ghost Border:** If a container requires a perimeter, use the `outline-variant` token (`#484848`) at **15% opacity**. High-contrast, 100% opaque borders are strictly forbidden.

---

## 5. Components

### Buttons
*   **Primary:** Background `primary`, text `on-primary`. No border. On hover, add a `0px 0px 15px` outer glow using the `primary` color.
*   **Secondary/Ghost:** Border `outline-variant` at 20% opacity. Text `on-surface`.
*   **Rounding:** All buttons must use `rounded-md` (0.75rem) to balance the `rounded-xl` (1.5rem) cards.

### Cards & Modules
*   **Constraint:** Use `rounded-xl` (1.5rem) for main dashboard cards.
*   **Dividers:** Forbid the use of horizontal rules (`<hr>`). Use a `16px` or `24px` vertical gap or a background shift to `surface-container-highest` to separate groups.

### Status Badges
*   **The "Lume" Effect:** Badges must feature a 2px solid circle of the status color (e.g., `primary` or `error`) with a matching `blur(4px)` glow behind it to simulate a physical LED.

### Input Fields
*   **Style:** Minimalist. Only a bottom border of `outline-variant` (20% opacity). When focused, the bottom border transitions to `primary` with a subtle `2px` glow. Typography must be `body-md` (Inter).

---

## 6. Do’s and Don’ts

### Do
*   **Do** lean into technical density. It is okay for the UI to look "complex" as long as the hierarchy is clear.
*   **Do** use `phosphor` green sparingly. It is a laser, not a paint brush. Use it only for active states and primary calls to action.
*   **Do** use Monospace for all numbers. Values, line counts, and timestamps must always be JetBrains Mono.

### Don’t
*   **Don’t** use pure white (`#ffffff`) for body text. Use `on-surface-variant` (`#ababab`) to prevent eye strain against the black background.
*   **Don’t** use standard shadows. If a component feels "flat," increase the background contrast between the container and its parent.
*   **Don’t** use standard "Success/Warning" colors. Reinterpret them through the neon lens (e.g., use `error_dim` for a muted, sophisticated red).

---

## 7. Signature Layout Patterns

**The Asymmetric Technical Sidebar:** 
Navigation should not be a simple list. Group items under monospace headers with `0.5` opacity. Use active state "tabs" that utilize a full-height `primary` vertical bar (2px wide) on the left of the active item to create a high-contrast focal point.

**The Dense Data Grid:**
When displaying logs or telemetry, remove all cell borders. Use alternating row backgrounds (`surface-container-low` vs `surface-dim`) to create "striping" that feels like a continuous stream of data.```