# Recreate presentation slides as code

Rebuild all 15 slides (currently static JPGs in `public/slides/`) as React components, matching the existing design closely but with crisper typography, consistent spacing, and a more professional finish. Tighten copy where it helps (e.g. fix "superanuation" → "superannuation", remove duplicated slides 9/10/11/12 if they truly are duplicates of slide 8).

## Approach

1. **Extract reusable image assets** from the current JPGs and save as standalone files in `src/assets/slides/`:
   - Travis Seckold headshot
   - Couple-with-tablet photo (slide 1)
   - Hands-signing photo (slide 5 — SMSF)
   - Stefano Duro / IFA Excellence Awards composite (slide 8)
   - Document screenshots (slide 15 — super statement, balance screenshot)
   - Fund/platform logos (AustralianSuper, Aware, CBUS, Rest, HESTA, TWUSUPER, Mercer, CareSuper, AMP, BT, Macquarie, North, HUB24, Netwealth, Colonial)
   - Google reviews badge, "Trusted Adviser" seal

2. **Build a slide component system** at `src/components/slides/`:
   - `SlideFrame.tsx` — 1920×1080 base with the navy/white diagonal chrome, AdvisorLink logo top-left, footer contact strip
   - `Slide01_Intro.tsx` through `Slide15_Documents.tsx` — one component per slide
   - A `slides.ts` index exporting `[{ id, Component }]`

3. **Swap `PresentationSlideshow.tsx`** to render the React slide components inside a scaled 1920×1080 stage (matches the existing image dimensions, so all existing controls — fullscreen, nav, pause-share, the share-report hotspot on slide 6 — keep working). Use the same proportional-scaling pattern as the slides-app skill.

4. **Keep all surrounding behaviour identical**: slide count stays 15, slide indices stay aligned with the screen-share/sync logic, keyboard nav, fullscreen, share-report button overlay on slide 6, etc.

## Slide inventory (content to preserve)

1. **Hi 👋 So let's have a chat..** — couple-with-tablet hero + chat icon, contact details footer
2. **Important Disclaimer + Travis Seckold profile card** — recorded-call disclaimer, professional profile
3. **Why So Many People Choose Us To Help** — Matching Process Guarantee + 100% Free service cards, Trusted Adviser seal, Google reviews badge
4. **Option 1: Industry/Retail Super Funds** — fund logos grid + pros/cons
5. **Option 2: Self Managed Super Fund** — hands-signing photo + pros/cons
6. **Option 3: Actively Managed Super Funds** — platform logos grid + pros/cons (share-report button stays here)
7. **Fees And Costs For Advice** — fee philosophy + one-time setup / ongoing / no out-of-pocket cards
8. **Stefano Duro — IFA Excellence Awards 2025 Official Judge** — full-bleed editorial portrait + "Book A Time" CTA
9–12. **Was Everything Explained To You Clearly?** — 4 clipboard cards (difference between 3 options / next steps / fees in SOA / open to alternatives). Currently slides 9, 10, 11, 12 look identical in the JPG grid — I will **collapse to one slide** unless you want them kept as a deliberate animation/reveal.
13. **(duplicate of above)** — same treatment
14. **Review Completed! Book A Time For Advice** — success envelope graphic + CTA
15. **Setting Up Your Adviser Meeting** — document checklist with super statement + balance screenshot

## Open question

The current deck has slides 9–13 that look like the same "Was everything explained clearly?" layout repeated 5×. They might be a build-up animation in PowerPoint that exported as separate frames. **I will collapse them to a single slide** (so the new deck is ~11 slides instead of 15) unless you tell me to keep all 5 frames.

## Technical details

- Image extraction: ImageMagick crops from existing JPGs into `src/assets/slides/*.{png,jpg}`. Each photo only extracted once and reused.
- Typography: existing site fonts; semantic slide classes (`slide-title`, `slide-body`, `slide-caption`) defined in `index.css` scoped to `.slide-content`.
- Colors: reuse existing navy `--primary` and the bright accent blue from the current slides as design tokens.
- `PresentationSlideshow` change: keep the same `current` index state and keyboard/fullscreen logic; replace the `<img>` with `<SlideRenderer index={current} />` that renders a scaled 1920×1080 frame.
- Old JPGs left in `public/slides/` untouched (no deletes) in case you want to roll back.

## Out of scope

- Animations / transitions between slides (can add later)
- Editable slide content via a CMS (slides remain code)
- Redesigning slide content/messaging beyond minor copy fixes
