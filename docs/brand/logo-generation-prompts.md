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

---

# ALTERNATIVAS v2 (2026-08-17)

La opción 1 (Prompt 1, "Opc A — Barra olímpica") fue aprobada por el usuario como
la vara de calidad de producto. Esta plantilla de estructura es la que produce el
mejor resultado — TODA alternativa debe seguir el mismo nivel de especificidad
(materiales, texturas, estructura, luces, colores con hex, reglas finales).

ESTADO (2026-08-17): APROBADAS → Opc A, Opc D, Opc G. REESCRITAS con la
ESTRUCTURA EXACTA de 4 etapas de Opc A (formato → sujeto+materiales → Style →
reglas finales) → Opc B, Opc C, Opc E, Opc F (versiones v3 abajo). Las
aprobadas no se tocan. La estructura de 4 etapas es la que produce el mejor
resultado (el Prompt 1 original con 4 párrafos ordenados).

## Opc A — Barra olímpica con discos brasa (APROBADA)
```
Premium product-quality app icon, 1024x1024, square. An olympic barbell seen
slightly from the front: THICK steel bar with proper knurled grip texture, two
large olympic steel plates on the outer ends and two large molten ember plates
in the middle (#C77B45 to #FFB86B) with bright hot centers emitting a subtle
warm glow, like metal being forged. Plates have realistic center holes and rim
edges. Dark charcoal-navy background (#101316) with very subtle depth. Clean,
high-end render, sharp, no text, no watermark, readable at 16px.
```

## Opc B v3 — Mancuerna hexagonal única (ESTRUCTURA 4 ETAPAS)
```
App icon, 1024x1024, square, full-bleed, flat minimalist design, premium fitness
brand named FORJA (Spanish for "forge").
A SINGLE hex dumbbell centered horizontally, floating slightly angled: the left
plate stack is cold steel (#D7DEE4 to #A0B0BC) — brushed-metal finish with sharp
hexagonal edges, visible bevel on each plate rim and a subtle blue-steel tint on
the inner face; the right plate stack is molten ember, glowing warm orange
(#C77B45 to #FFB86B) with a bright hot core and a faint hot inner ring, like one
side already forged and the other still in the fire. The central handle connects
both stacks with subtle knurled grip texture and two thin metal collars.
Background is near-black with a cold blue undertone (#101316), flat with a very
faint warm glow rising from the ember side.
Style: geometric, industrial, clean vector aesthetic, subtle rim lighting, no
text, no gradients outside the ember glow, no 3D render look, sharp edges.
Icon must remain readable at 16px. Centered, asymmetric contrast (steel left,
ember right), no shadows.
```

## Opc C v3 — Monograma F de placas (ESTRUCTURA 4 ETAPAS)
```
App icon, 1024x1024, square, full-bleed, flat minimalist design, premium fitness
brand named FORJA (Spanish for "forge").
A bold geometric letter F constructed from weight plates, centered: the vertical
stem is one tall steel plate seen from the side with a visible center hole and
polished rim edge; the upper horizontal bar is a steel plate with a visible
center hole; the middle horizontal bar is a molten ember plate, glowing warm
orange (#C77B45 to #FFB86B) with a bright hot core and a slightly hotter rim —
the only warm element, like the middle of the mark is being forged. All plates
have subtle brushed-metal texture and thin beveled edges with realistic
highlights. Background is near-black with a cold blue undertone (#101316), flat
with a very faint warm glow behind the middle bar.
Style: geometric, industrial, clean vector aesthetic, subtle rim lighting, no
text, no gradients outside the ember glow, no 3D render look, sharp edges.
Icon must remain readable at 16px. Centered, balanced, no shadows.
```

## Opc D — Kettlebell brasa (APROBADA)
```
Premium product-quality app icon, square. A single KETTLEBELL in cold steel
(#D7DEE4 to #A0B0BC) with subtle brushed-metal finish, but the center of the
kettlebell body glows molten ember (#C77B45 to #FFB86B) with a bright hot core —
as if heated from inside, ready to be forged. Handle is cold steel. Dark
background #101316, studio lighting, no text, no watermark, sharp, readable
at 16px.
```

## Opc E v3 — Placas vistas desde arriba (ESTRUCTURA 4 ETAPAS)
```
App icon, 1024x1024, square, full-bleed, flat minimalist design, premium fitness
brand named FORJA (Spanish for "forge").
A TOP-DOWN view of a loaded barbell centered: four concentric plate rings around
a central bar hole — the two outer rings are cold steel (#D7DEE4 to #A0B0BC)
with thin bevel highlights around each edge; the two inner rings are molten
ember, glowing warm orange (#C77B45 to #FFB86B) with bright hot cores and a
subtle warm radial glow between them; the smallest center is the dark bar hole.
The heat concentrates in the middle like an abstract target while the steel
cools toward the rim. Background is near-black with a cold blue undertone
(#101316), flat with a very faint warm glow at the core.
Style: geometric, industrial, clean vector aesthetic, subtle rim lighting, no
text, no gradients outside the ember glow, no 3D render look, sharp edges.
Icon must remain readable at 16px. Perfectly centered, radially symmetric, no
shadows.
```

## Opc F v3 — Barra + flecha de progreso (ESTRUCTURA 4 ETAPAS)
```
App icon, 1024x1024, square, full-bleed, flat minimalist design, premium fitness
brand named FORJA (Spanish for "forge").
A short bold steel barbell fused with an ascending diagonal arrow, centered: the
bar is tilted upward about 20 degrees like a progress curve; the left plate is
cold steel (#D7DEE4 to #A0B0BC) with a visible center hole and polished rim; the
right plate is molten ember, glowing warm orange (#C77B45 to #FFB86B) with a
bright hot core and soft glow; a subtle steel arrowhead extends from the top end
of the bar pointing up-right, drawn in the same metal finish, so the object
reads as both a barbell and an upward progress marker. Background is near-black
with a cold blue undertone (#101316), flat with a very faint warm glow behind
the ember plate.
Style: geometric, industrial, clean vector aesthetic, subtle rim lighting, no
text, no gradients outside the ember glow, no 3D render look, sharp edges.
Icon must remain readable at 16px. Centered, clear silhouette, no shadows.
```

## Opc G — Yunque + pesa integrada (APROBADA)
```
Premium product-quality app icon, square. A minimal steel anvil silhouette
(#D7DEE4 to #A0B0BC) with a chunky dumbbell resting across its face: the
dumbbell left stack steel, right stack molten ember (#C77B45 to #FFB86B) with
hot core. The forge and the weight are one object. Avoid literal blacksmith
complexity: silhouette clean, geometric, premium. Dark background #101316, no
text, no watermark, sharp, readable at 16px.
```