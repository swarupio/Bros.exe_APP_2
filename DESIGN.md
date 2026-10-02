# Kayda Sathi UI Design

This document defines the visual source of truth for the mobile-first web app and its later Capacitor shell. Use it with `WORKBOARD.md` and the PRD. `docs/design/screens/` contains one generated visual reference per screen; generated images are mockups, not production UI or verified legal guidance.

## Direction

Use a calm, clear interface for people seeking help with stressful situations. The visual language takes cues from Apple’s Liquid Glass, with soft blue and white light, restrained gradients, generous spacing, rounded geometry, and quiet motion. Preserve the user’s sense of control and make the next useful action obvious.

## Layers and Materials

- **Content layer:** lists, forms, case facts, plans, checklists, and articles use opaque white or near-white surfaces. Content remains readable and stable.
- **Control layer:** navigation bars, tab bars, toolbars, menus, sheet handles, and floating controls may use regular frosted glass. Keep glass sparse and let scrolling content pass behind navigation where appropriate.
- Never put glass on content cards, stack glass on glass, or mix clear and regular glass in one control group. Clear glass is reserved for controls over media with a dimming layer; ordinary app screens do not need it.
- Use blue tint for the primary action or selected navigation state only. Keep one prominent action per screen.

## Tokens

| Token | Light default | Use |
|---|---|---|
| Background | `#EFF7FE` | Cool blue-white canvas sampled from the generated screens |
| Surface | `#FEFEFE` | Opaque content cards, forms, and reading areas |
| Primary text | `#071B43` | Deep navy headings and body copy |
| Secondary text | `#536985` | Muted supporting text with readable contrast |
| Accent | `#1877F5` | Bright blue primary action and selected state |
| Positive / caution / urgent | `#25845A` / `#A76600` / `#B42332` | Pair color with a label or icon |
| Glass fill | `rgba(250,253,255,.76)` | Floating control chrome only |
| Glass blur | `22px` | Use sparingly on supported browsers |
| Glass edge | `rgba(255,255,255,.88)` top; `rgba(100,125,160,.18)` sides | Soft top highlight and visible boundary |
| Content radius | `20–24px` | Opaque cards and grouped content |
| Control shape | Capsule or concentric rounded shape | Buttons and navigation controls |
| Spacing | `4, 8, 12, 16, 20, 24, 32, 48px` | Shared rhythm |

Use the system font stack (`-apple-system`, `BlinkMacSystemFont`, `system-ui`, sans-serif) with Noto Sans Devanagari fallback. Body text should be 16–17px or larger; captions should not fall below 12px. Use a soft top-edge highlight, gentle ambient light, and low-elevation shadows. Avoid saturated neon, harsh shadows, textures, and decorative glass surfaces.

## Screen Patterns

- Keep phone layouts single-column with 16–20px gutters and a clear title, brief explanation, and one primary next action.
- Forms ask one clear question at a time where possible. Explain why a sensitive fact is requested; allow “Not sure” or “I don’t have this” when appropriate.
- Show provenance and status in words, not color alone. Unreviewed legal information is labeled **Unverified**; never imply generated advice is a legal outcome prediction.
- Safety help stays easy to reach from every screen. Do not show a phone number as verified until a person has checked its official source.
- On wider screens, constrain reading width and use a simple navigation rail only when it improves orientation.
- Use short fades or subtle transforms. Honor reduced-motion preferences; never animate blur continuously.

## Accessibility and Fallbacks

All controls have visible labels, keyboard focus, screen-reader names, and at least 48px touch targets. Maintain strong text contrast (aim for WCAG AA), support 200% text scaling, and do not communicate state through color alone. Under reduced transparency, replace blur with an opaque near-white surface. Under increased contrast, strengthen borders and text. Support dark mode with equivalent contrast and semantics. Under reduced motion, remove shimmer, morph, and scaling transitions.

## Screen Reference Set

Each screen is generated individually at portrait phone proportions. Use mockups for composition and material cues; implement all text, icons, controls, and accessibility behavior natively in the app.

| ID | Screen | Asset |
|---|---|---|
| 01 | Sign in / phone verification | `docs/design/screens/01-sign-in.png` |
| 02 | My Cases, populated | `docs/design/screens/02-cases-home.png` |
| 03 | My Cases, empty | `docs/design/screens/03-cases-empty.png` |
| 04 | Describe a problem / new case | `docs/design/screens/04-intake.png` |
| 05 | Confirm facts and answer questions | `docs/design/screens/05-fact-review.png` |
| 06 | Preparation plan and sources | `docs/design/screens/06-plan.png` |
| 07 | Draft editor | `docs/design/screens/07-draft-editor.png` |
| 08 | Report update and confirm changes | `docs/design/screens/08-update.png` |
| 09 | Settings and privacy | `docs/design/screens/09-settings.png` |
| 10 | Urgent help sheet | `docs/design/screens/10-safety-sheet.png` |
