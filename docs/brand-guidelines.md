# Forja — Brand Guidelines

> Last updated: 2026-08-17
> Status: v1.0 (Foundation)

## Quick Reference

| Element | Value |
|---------|-------|
| Brand name | **Forja** |
| Tagline (working) | "Forja tu progreso" / "Built by effort" |
| Primary Palette | Cold steel (acero frío) — near-black blues |
| Brand Accent | Ember (brasa) — molten warm core |
| Display Font | Oswald 600 (existing) |
| Body Font | Space Grotesk (existing) |
| Voice | Coach + Premium (motivator, exclusive) |

---

## 1. Brand Concept

**Forja** (noun: forge; verb: to forge) — the place where steel is shaped by
heat, pressure, and repeated effort. It is not about inspiration; it is about
the disciplined act of building, set by set, week by week.

Identity model: **cold steel with a living ember inside.**

- The cold steel = the ecosystem: quiet, dark, technical, precise. Nothing
  shouts; the interface stays calm even under fatigue.
- The ember = the fire of effort: PRs, streaks, milestones, celebration. It is
  used with restraint, only where the user's work is being honored.

The ember never *replaces* the steel; it glows *inside* it.

---

## 2. Color Palette

### Base — Cold Steel (unchanged foundation, from `lib/theme/tokens.ts`)

| Name | Hex | Usage |
|------|-----|-------|
| Background Primary | `#101316` | App background |
| Background Secondary | `#15181C` | Sections |
| Surface / Card | `#1A1E23` | Cards |
| Elevated | `#22272D` | Modals, popovers |
| Text Primary | `#E9EDF0` | Headings, body |
| Text Secondary | `#9AA4AE` | Captions, muted |
| Accent Steel | `#4A6FA5` | Links, info, quiet emphasis |
| Border | `#2A3138` | Hairlines |

### Brand Accent — Ember (new)

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Ember Core | `#C77B45` | PRs, streaks, milestones, celebration moments |
| Ember Deep | `#A05F33` | Ember pressed/active states |
| Ember Halo | `rgba(199, 123, 69, 0.14)` | Ember background washes |

**Ember rules:**
- Use at **5–10%** of any screen. Steel is the stage; ember is the spot light.
- Never tint full screens or large surfaces ember. It marks *achievement*, not layout.
- On dark backgrounds ember is used for text/icon emphasis; never for large filled buttons unless the action is celebratory.

### Semantic Colors (kept cold, harmonized)

| State | Hex | Usage |
|-------|-----|-------|
| Success | `#6E9C8A` | Completed sets (quiet win) |
| Warning | `#C2A05C` | Cold amber cautions |
| Error | `#C96F6F` | Destructive / validation |
| Info / link | `#7A9AB5` | Steel blue info |

---

## 3. Typography

Unchanged — the steel voice lives in the fonts:

| Role | Font | Weight |
|------|------|--------|
| Display (numerals, big numbers) | Oswald | 600 SemiBold |
| Body | Space Grotesk | 400 Regular |
| Body medium | Space Grotesk | 500 Medium |
| Body strong | Space Grotesk | 600 SemiBold |

Minimal, geometric, slightly industrial — matches the forge concept.

---

## 4. Logo Concept (v1 spec)

**Mark:** a minimal geometric monogram — the letter **F** shaped as a stylized
anvil silhouette on a cold-steel field, with **one molten ember core**: a
single warm dot/bisector inside the steel form. The ember is the only warm
element.

**Variants to produce:**

| Variant | Use |
|---------|-----|
| App icon (1024) | Play Store / stores |
| Adaptive foreground (432) | Android adaptive icon |
| Monochrome (432) | Themed icons |
| Splash mark | Splash screen center |
| Wordmark "FORJA" | Login, headers, share cards |

**Rules:**
- Clear space = height of the mark.
- Ember is the only warm pixel; every other element is steel.
- Never place the mark on a busy background; steel fields only.
- Monochrome variant drops the ember to a cut/hole in the form (keeps identity).

---

## 5. Voice & Tone — Coach + Premium

### Personality

| Trait | Description |
|-------|-------------|
| **Coach** | Knows the work, pushes with respect, celebrates real progress |
| **Premium** | Exclusive, calm, zero hype; earns attention with restraint |
| **Direct** | Short lines; high signal, no fluff |
| **Honest** | Numbers over promises; the log is the truth |

### Voice Chart

| Trait | We Are | We Are Not |
|-------|--------|------------|
| Coach | Specific, motivating, realistic | Cheerleader, empty "you can do it" |
| Premium | Restrained, precise, confident | Flashy, loud, discounted-feeling |
| Direct | "3 series. Terminá fuerte." | "¡Vamos a darlo todo juntos!" (screaming) |
| Honest | "PR nuevo: 100 kg x 5" | "¡Resultados increíbles garantizados!" |

### Tone by Context (Spanish product copy)

| Context | Tone | Example |
|---------|------|---------|
| Session | Short, technical | "Press banca — 4 series" |
| Completion | Quiet pride, one line | "Sesión completa. 12 series." |
| PR / milestone | Warm, earned celebration | "PR nuevo — press banca 100 kg x 5" |
| Streak | Recognizes consistency | "3 semanas seguidas. Seguí." |
| Error | Calm, solution-first | "No se pudo guardar. Reintentá." |
| Destructive (delete) | Flat, clear, no guilt | "Se elimina la cuenta y sus datos." |

### Prohibited

- Hype, caps-lock shouting, exclamation overload
- Generic fitness clichés ("no pain no gain", "beast mode")
- Ember overuse (a screen that glows everywhere has no heat)

---

## 6. Imagery & Icon Style

- **Icons:** outlined, 1.5px stroke, consistent with current steel style; only
  achievement icons may carry ember fill.
- **Illustrations:** minimal geometric, steel field + ember details, flat style.
- **Share cards (Phase B):** dark steel frame, light text, one ember
  highlight for the headline number.

---

## 7. Deliverables & Status

| Item | Status |
|------|--------|
| Brand name FORJA | ✅ Decided 2026-08-17 |
| Color tokens (ember) | ⏳ Apply to `lib/theme/tokens.ts` |
| Logo mark spec | 📋 Spec above — assets pending |
| App icon / splash / adaptive | 🔲 Produce assets + wire into app.json |
| Voice applied in copy | 🔲 Sweep current strings |
| Brand guidelines synced | 🟢 This document is the source of truth |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-08-17 | Initial guidelines; name + ember palette + voice + logo spec |