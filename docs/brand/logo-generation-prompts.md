# Forja — Generación de Imagen de Marca (prompts listos para usar)

> Fecha: 2026-08-17 · Estado: pendiente de generación con modelo de imagen externo
> (NO generar los PNG con código — los assets actuales en `assets/` son placeholders provisionales
> hasta que se genere la marca real con un modelo de imagen dedicado).

## Contexto de marca (prefijar a cualquier prompt)

Paleta oficial Forja (acento frío + brasa):
- Fondo principal: `#101316` (casi negro con subtono azul)
- Superficie: `#1A1E23`, elevado: `#22272D`
- Acero claro: `#D7DEE4` → acero oscuro: `#A0B0BC`
- Brasa: `#C77B45` → núcleo caliente: `#FFB86B`
- Acento azul acero (secundario): `#4A6FA5`
- Texto: `#E9EDF0`

Estilo: minimalista, geométrico, industrial, premium, sin sombras exageradas, sin
texturas ruidosas, limpio, tipografía de display fuerte (estilo Oswald/Space Grotesk).

Concepto: "acero frío con alma de brasa" — una barra de pesas de acero con discos
al rojo vivo en el centro (el metal siendo forjado). Fitness + forja en un símbolo.

---

## PROMPT 1 — Icono de app (símbolo completo, cuadrado, sin texto)

```
App icon, 1024x1024, square, full-bleed, flat minimalist design, premium fitness
brand named FORJA (Spanish for "forge").
A heavy barbell centered horizontally: a THICK cold-steel bar spine with two
large solid steel plates on the outer ends and two large molten ember plates in
the middle. The ember plates glow warm orange (#C77B45 to #FFB86B) with a bright
hot center, like metal being forged; the steel is cool gray-blue (#D7DEE4 to
#A0B0BC). Background is near-black with a cold blue undertone (#101316), flat
with a very faint warm glow behind the center plates.
Style: geometric, industrial, clean vector aesthetic, subtle rim lighting, no
text, no gradients outside the ember glow, no 3D render look, sharp edges.
Icon must remain readable at 16px. Centered, symmetrical, no shadows.
```

## PROMPT 2 — Símbolo aislado (adaptive icon / splash, fondo transparente)

```
Minimalist flat vector symbol of a heavy barbell: THICK cold-steel bar spine
(#D7DEE4 to #A0B0BC) with two large steel plates on the outer ends and two large
molten ember plates in the middle (#C77B45 to #FFB86B) with a bright hot core
(#FFB86B), like metal being forged.
Isolated on a TRANSPARENT background, no backdrop, no text, no shadow.
Centered, symmetric, bold silhouette that stays readable at 16 px.
Flat geometric industrial style, premium, crisp edges, no 3D.
```

## PROMPT 3 — Wordmark / logo horizontal con texto FORJA

```
Minimalist premium logo on dark background (#101316). The word "FORJA" in strong
geometric uppercase display type (condensed, industrial, similar to Oswald or
Space Grotesk SemiBold), letter-spaced, in light steel color (#D7DEE4), with ONE
small ember dot (#C77B45 to #FFB86B) placed as a subtle accent — for example
inside the counter of the R or above the A, like a glowing hot spark.
To the left of the wordmark, a minimal geometric barbell glyph (steel bar with
two chunky ember center plates). Clean, flat, no 3D, no glow bleed outside the
ember accent, sharp, professional, fitness + forge identity.
```

## PROMPT 4 — Sello/monograma chico (favicon, notificaciones, marca de agua)

```
Tiny minimalist app mark, 64x64: a bold geometric barbell silhouette — thick
steel bar with two chunky plates; the two middle plates are molten ember orange
(#C77B45) with a hot #FFB86B core. Readable at 16 px. Flat vector, dark
background #101316, no text, no shadow, no detail loss at small size.
```

---

## Especificaciones técnicas para producir los assets finales

| Asset | Tamaño | Formato | Notas |
|-------|--------|---------|-------|
| `assets/icon.png` | 1024×1024 | PNG/RGBA | ícono principal (Prompt 1) |
| `assets/android-icon-foreground.png` | 432×432 | PNG con transparencia | símbolo centrado en el 66% central (Prompt 2) |
| `assets/android-icon-background.png` | 432×432 | PNG sólido | fondo `#101316` plano |
| `assets/android-icon-monochrome.png` | 432×432 | PNG blanco sobre transparencia | versión monocromo del símbolo (Prompt 2, sin brasa, todo blanco) |
| `assets/splash-icon.png` | 512×512 | PNG con transparencia | símbolo centrado, marca menor (Prompt 2) |
| `assets/favicon.png` | 64×64 | PNG | Prompt 4 |
| `docs/brand/forja-icon.svg` | vectorial | SVG | logo vectorial para documentos/web |

Reglas: el símbolo debe quedar legible a 16×16; la brasa es el único elemento cálido;
fondo de la app siempre `#101316`; nada de texto en los íconos.