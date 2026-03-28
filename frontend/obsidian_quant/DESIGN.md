# Design System Strategy: High-Performance Luminescence

This design system is engineered for a high-end, modern finance tracking application. It moves beyond the clinical nature of traditional banking into an "Editorial Tech" aesthetic—combining the high-contrast precision of a Bloomberg terminal with the fluid, layered sophistication of a luxury digital timepiece.

---

### 1. Overview & Creative North Star: "The Kinetic Ledger"
The Creative North Star for this system is **The Kinetic Ledger**. We are not building static tables; we are building a living data environment. 

To break the "template" look, we move away from rigid, equal-width grids. Instead, we utilize **Intentional Asymmetry**: large-scale financial figures (Display-LG) should be offset against compact, high-density data modules. By overlapping semi-transparent glass layers and using "breathing room" (Scale 12-24) as a structural element, we create a UI that feels premium, bespoke, and authoritative.

---

### 2. Colors & Surface Logic

The palette is anchored in a "Deep Space" black, utilizing the neon green primary only for high-signal moments—growth, action, and liquidity.

- **The "No-Line" Rule:** 1px solid borders are strictly prohibited for sectioning. Boundaries must be defined solely through background color shifts. A `surface-container-low` (#1C1B1B) section sitting on a `surface` (#131313) background provides all the separation a premium user needs.
- **Surface Hierarchy & Nesting:** Treat the UI as stacked sheets of obsidian. 
    - **Base:** `surface` (#131313).
    - **Secondary Content:** `surface-container-low` (#1C1B1B).
    - **Active Cards/Modals:** `surface-container-high` (#2A2A2A).
- **The "Glass & Gradient" Rule:** Use `surface-variant` (#353534) at 40% opacity with a `20px` backdrop-blur for floating navigation or hovering "Quick Action" panels.
- **Signature Textures:** Main CTAs should not be flat green. Use a linear gradient from `primary` (#EFFFE3) to `primary-container` (#39FF14) at a 135-degree angle to give financial buttons a "tactile glow."

---

### 3. Typography: The Authority Scale

We pair **Manrope** (Display/Headlines) for its geometric, high-tech character with **Inter** (Body/Labels) for its mathematical legibility.

| Level | Token | Font | Size | Weight / Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | `display-lg` | Manrope | 3.5rem | Bold. Used for primary account balances. |
| **Headline** | `headline-md` | Manrope | 1.75rem | Medium. Used for section titles (e.g., "Monthly Spend"). |
| **Title** | `title-md` | Inter | 1.125rem | Semi-Bold. Used for card headers. |
| **Body** | `body-md` | Inter | 0.875rem | Regular. The workhorse for transaction details. |
| **Label** | `label-sm` | Inter | 0.6875rem | Medium + All Caps. Metadata and micro-labels. |

---

### 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are too "web 2.0." In this system, depth is environmental.

- **The Layering Principle:** Achieve lift by placing a `surface-container-lowest` (#0E0E0E) card on a `surface-container-low` (#1C1B1B) section. This creates a "recessed" look, perfect for data input fields.
- **Ambient Shadows:** For high-level modals, use an extra-diffused shadow: `0px 24px 48px rgba(0, 0, 0, 0.8)`. The shadow must feel like a natural absence of light, not a fuzzy grey line.
- **The "Ghost Border":** If a border is required for accessibility in input fields, use `outline-variant` (#3C4B35) at **15% opacity**. It should be felt, not seen.
- **Glassmorphism:** Apply to any element that "floats" over data (e.g., a filter bar). Use `surface-container-highest` at 50% opacity with a `blur(12px)` to maintain the high-tech, interactive feel.

---

### 5. Components & Interaction Patterns

- **Buttons:** 
    - *Primary:* Gradient fill (`primary` to `primary-container`), black text (`on-primary`), `rounded-md`.
    - *Secondary:* `surface-container-high` fill with `primary` (#EFFFE3) text. No border.
- **Data Visualization (Charts):** 
    - Line charts must use a 2px stroke of `primary-fixed` (#79FF5B) with a subtle vertical gradient "fill" underneath that fades to 0% opacity at the X-axis.
- **Cards & Lists:** **Strictly no dividers.** Use `spacing-6` (1.5rem) to separate transaction items. On hover, a list item should shift background color to `surface-container-highest` (#353534).
- **Checkboxes/Radios:** Use `primary-container` (#39FF14) for checked states. The "glow" effect should be replicated here with a subtle `0px 0px 8px` outer glow in the same color.
- **Input Fields:** Use `surface-container-lowest` (#0E0E0E) as the background. On focus, the "Ghost Border" should transition to 100% opacity of `primary_fixed_dim`.

**Context-Specific Component: The "Liquidity Slider"**
A custom input component for moving funds. Use a thick track of `surface-container-highest` and a `rounded-full` thumb in `primary` with a 10% `primary` outer glow to simulate a high-end physical fader.

---

### 6. Do's and Don'ts

#### Do:
- **Do** use `rounded-xl` (1.5rem) for main dashboard containers to soften the "tech" look.
- **Do** lean into high-contrast typography—make currency symbols smaller and lighter than the numerical figure.
- **Do** use `primary` (#EFFFE3) for text that sits on dark backgrounds when high legibility is needed over "neon" aesthetics.

#### Don't:
- **Don't** use 100% white (#FFFFFF). It creates "vibration" against the deep black. Use `on-surface` (#E5E2E1).
- **Don't** use traditional "Success Green" or "Warning Orange" if they clash. Map "Success" to `secondary` (#72DE58) and "Error" to `error` (#FFB4AB).
- **Don't** use standard grid-gap dividers. If content needs to be separated, use a background tone shift or 24px of white space.