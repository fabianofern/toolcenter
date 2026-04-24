# Design System Specification

## 1. Overview & Creative North Star

### The Creative North Star: "The Precision Architect"
This design system moves away from the generic "SaaS dashboard" aesthetic to embrace the soul of high-end architectural drafting. It balances industrial utility with digital elegance. By leveraging intentional white space, high-contrast typography scales, and tonal depth, we create an environment that feels authoritative yet effortless. 

We break the "template" look through **intentional layering** and **asymmetric focal points**. Instead of a rigid grid of identical boxes, we use varying surface elevations and typographic weights to guide the eye, ensuring that "The Precision Architect" feels custom-built for every user interaction.

---

## 2. Colors

The color palette is anchored in a deep, authoritative blue, punctuated by high-energy accents that signify action and growth.

*   **Primary (The Foundation):** `primary` (#0037b0) and `primary_container` (#1d4ed8). Use these for the sidebar and high-level structural branding.
*   **Secondary (The Action):** `secondary` (#006c49). Reserved exclusively for "New Tool" or "Success" actions. This vibrant emerald green creates an immediate psychological trigger for creation.
*   **Surface & Backgrounds:**
    *   `background` (#f7f9fb): Use for the main canvas.
    *   `surface_container_lowest` (#ffffff): Reserved for the most prominent content cards.
    *   `surface_container_low` (#f2f4f6): Used for secondary grouping or background sections.

### The "No-Line" Rule
Standard 1px solid borders are strictly prohibited for defining sections. Boundaries must be established through **background color shifts**. A `surface_container_low` section sitting on a `background` provides a cleaner, more premium separation than a mechanical line.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the surface-container tiers (Lowest to Highest) to create depth. For instance, a floating action panel should use `surface_bright` to appear closer to the user, while a background data-grid sits on `surface_container_low`.

### The "Glass & Gradient" Rule
To avoid a "flat" feel, main CTAs and the Sidebar should utilize a subtle linear gradient transitioning from `primary` to `primary_container`. For floating elements (like dropdowns or modals), apply a **Glassmorphism** effect: use a semi-transparent surface color with a `20px` backdrop-blur to allow the background context to bleed through softly.

---

## 3. Typography

This system employs a dual-font strategy to balance character with readability.

*   **Display & Headlines (Manrope):** Geometric and modern. Use `display-lg` to `headline-sm` for page titles and section headers. The wide apertures of Manrope convey a sense of openness and technical precision.
*   **Body & Labels (Inter):** The industry standard for legibility. Use `body-md` for general content and `label-sm` for metadata and status badges.

**Editorial Hierarchy:** Use high-contrast sizing. A `display-md` title paired with a `label-md` uppercase subtitle creates a sophisticated, magazine-style layout that looks more "designed" than "templated."

---

## 4. Elevation & Depth

We convey hierarchy through **Tonal Layering** rather than traditional structural lines or heavy drop shadows.

### The Layering Principle
Depth is achieved by "stacking." Place a `surface_container_lowest` (Pure White) card on a `surface_container_low` (Very Light Gray) section. This creates a soft, natural lift that mimics fine paper.

### Ambient Shadows
When an element must float (e.g., a modal), use an **Ambient Shadow**:
*   **Blur:** 24px - 40px.
*   **Opacity:** 4% - 8%.
*   **Color:** Use a tinted version of `on_surface` (e.g., a deep navy tint) rather than pure black to maintain color harmony.

### The "Ghost Border" Fallback
If a border is required for accessibility, it must be a **Ghost Border**: use `outline_variant` at **15% opacity**. This provides a whisper of a boundary without cluttering the visual field.

---

## 5. Components

### Buttons
*   **Primary Action (New Tool):** Uses `secondary` (#006c49) with `on_secondary` text. Apply a `md` (0.75rem) corner radius.
*   **Secondary/Sidebar:** High-contrast `primary` with `on_primary` text. The active state in the sidebar should use a subtle glass-tint (10% white overlay) rather than a solid color change.

### Cards & Lists
*   **The Card Primitive:** Use `surface_container_lowest` with a `md` (0.75rem) radius.
*   **Forbid Dividers:** Do not use lines to separate list items. Use **Vertical White Space** (16px - 24px) or a alternating subtle background shift between `surface` and `surface_container_low`.
*   **Icons:** Icons within cards should be housed in a square-rounded container (radius: `sm`) using a `primary_fixed` background color.

### Status Badges
*   **The Signature Badge:** Small, high-contrast pills. Use `secondary_container` for "Active" and `error_container` for "Issues." Text should always be uppercase `label-sm` with increased letter spacing (0.05em).

### Input Fields
*   **Style:** Minimalist. No bottom line. Use a `surface_container_high` background with a `sm` radius. On focus, transition the background to `surface_container_lowest` and apply a `Ghost Border` of the `primary` color.

---

## 6. Do's and Don'ts

### Do
*   **DO** use asymmetric layouts. If you have three cards, try making the first one 60% width and the others 40% to create visual interest.
*   **DO** use `tertiary` (#7f2500) sparingly for "Warning" states or unique accent points to break the blue/green monotony.
*   **DO** prioritize "Breathing Room." If you think a section has enough padding, add 8px more.

### Don't
*   **DON'T** use 100% opaque, high-contrast borders. They "trap" the content and make the UI look dated.
*   **DON'T** use standard drop shadows (e.g., 0px 2px 4px black). It breaks the "Precision Architect" aesthetic.
*   **DON'T** use dividers in lists. Trust the spacing and typography to define the structure.
*   **DON'T** use sharp 0px corners. Even a "square" look requires at least a `sm` (0.25rem) radius to feel premium.
