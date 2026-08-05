# Especificación de diseño

Sistema de diseño de GERD CRM. Documento de referencia para implementarlo en
otra aplicación: define los tokens, las reglas que los gobiernan y los
componentes que se derivan de ellos.

Versión 1.0 · Base técnica: Tailwind CSS v4 (`@theme`) + Next.js App Router.
Nada aquí depende de Next: los tokens son CSS estándar.

---

## 1. Principios

1. **Un solo juego de nombres semánticos.** Los componentes nunca nombran un
   color literal (`#16181d`) ni un tema. Usan `surface`, `fog`, `rose`. El tema
   se resuelve redefiniendo los tokens, no duplicando componentes.
2. **Densidad alta, jerarquía por color.** Es una herramienta de trabajo: se
   ven muchos datos a la vez. La jerarquía la marcan tres niveles de texto y
   dos de fondo, no los tamaños de letra.
3. **El color significa algo.** Cada acento tiene un significado fijo en todo el
   producto (lima = acción/éxito, rose = error/destructivo…). No se usan por
   decoración.
4. **El contraste se resuelve en el sistema, no en el componente.** Reglas
   globales garantizan legibilidad al cambiar de tema (§4.3).
5. **Móvil primero, escritorio aprovechado.** El layout base es de una columna;
   `lg:` añade columnas y densidad, nunca cambia el modelo mental.

---

## 2. Tipografía

### 2.1 Familia

**Plus Jakarta Sans** (SIL Open Font License, disponible en Google Fonts).
Geométrica, «a» de dos pisos, terminales inclinadas. Texto y titulares
comparten familia: se diferencian por peso y tracking, no por tipo.

```ts
// Carga con next/font (auto-hospedada, sin FOUT)
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
})
```

```css
--font-sans:    var(--font-jakarta), ui-sans-serif, system-ui, sans-serif;
--font-display: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif;

.font-display {
  font-family: var(--font-display);
  font-weight: 800;
  letter-spacing: -0.02em;
}

body { -webkit-font-smoothing: antialiased; }
```

### 2.2 Escala

| Rol | Tamaño | Peso | Tracking | Dónde |
|---|---|---|---|---|
| Display | 30 px (`text-3xl`) | 800 | −0.02em | Título de página, escritorio |
| Título 1 | 24 px (`text-2xl`) | 700–800 | −0.02em | Título de página, móvil · cifras KPI |
| Título 2 | 20 px (`text-xl`) | 700 | normal | Títulos de sección, importes |
| Título 3 | 18 px (`text-lg`) | 700 | normal | Cabecera de grupo (día, ficha) |
| Subtítulo | 16 px (`text-base`) | 600 | normal | Título de tarjeta |
| **Cuerpo** | 14 px (`text-sm`) | 400–600 | normal | Texto general, inputs, botones |
| **Meta** | 12 px (`text-xs`) | 400–600 | normal | Metadatos, badges, ayudas |
| Meta S | 11 px | 500–700 | normal | Sub-metadatos, contadores |
| Etiqueta | 10 px | 600–700 | `wide` + `uppercase` | Rótulos de sección, nav inferior |

**Interlineado:** por defecto el de Tailwind. `leading-tight` en títulos y en
bloques de dos líneas cortas (hora + duración).

**Patrón de rótulo de sección**, repetido en toda la app:

```html
<p class="text-[10px] font-semibold uppercase tracking-wide text-fog">PAGOS</p>
```

### 2.3 Reglas

- El cuerpo es 14 px y los metadatos 12 px. **No** mezclar 13 px ni 15 px.
- Los pesos usados son 400, 500, 600, 700 y 800. Nada de 300 ni 900.
- `font-display` solo para títulos de página y de sección grande.
- Números en columnas comparables (horas, importes) → `tabular-nums`.

> **Advertencia para un producto nuevo.** Esta escala es densa: el tamaño
> dominante real es 12 px. Funciona en escritorio con usuarios frecuentes, pero
> queda justo en móvil y para baja visión. Si empiezas de cero, considera subir
> un escalón: cuerpo 16 px y metadatos 13–14 px, manteniendo las proporciones.

---

## 3. Color

### 3.1 Tokens de estructura

| Token | Oscuro | Claro | Rol |
|---|---|---|---|
| `ink` | `#0a0b0d` | — | Negro absoluto; texto sobre acento claro |
| `carbon` | `#0e0f12` | `#f7f8fa` | Fondo de página |
| `surface` | `#16181d` | `#ffffff` | Tarjetas, paneles, modales |
| `surface2` | `#1d2027` | `#f2f3f5` | Inputs, fondos secundarios, hover |
| `line` | `#2a2e36` | `#e3e5ea` | Borde por defecto |
| `line2` | `#3a3f49` | `#cdd1d9` | Borde en hover, separador fuerte |
| `snow` | `#f4f5f2` | `#14161a` | Texto principal |
| `fog` | `#a2a8b2` | `#565c68` | Texto secundario |
| `mist` | `#6c727c` | `#838a96` | Texto terciario, placeholder |

Tres niveles de texto y tres de fondo. Toda la jerarquía visual sale de ahí.

### 3.2 Tokens de acento

| Token | Oscuro | Claro | Significado fijo |
|---|---|---|---|
| `lime` | `#c6f24e` | `#20bf6b` | Acción principal, éxito, marca |
| `lime-deep` | `#a9da2f` | `#189656` | Hover de `lime` |
| `iris` | `#8b8bff` | `#3867d6` | Selección, foco temporal, cumpleaños |
| `amber` | `#f5b945` | `#fa8231` | Aviso, pendiente de acción |
| `mint` | `#34d399` | `#22a6b3` | Confirmado, cobrado |
| `mint-soft` | `#112a23` | `#dff7f5` | Fondo de `mint` |
| `rose` | `#fb7185` | `#eb3b5a` | Error, cancelado, destructivo |
| `rose-soft` | `#2a1419` | `#fde3e8` | Fondo de `rose` |
| `cyan` | `#67e8f9` | `#2d98da` | Categoría secundaria (custodia) |

El tema claro usa una paleta Flat UI, más saturada; el oscuro, acentos
luminosos y menos saturados. Son paletas distintas a propósito: un mismo hex no
contrasta igual sobre `#0e0f12` que sobre `#f7f8fa`.

> **Deuda conocida en la implementación de referencia:** `cyan` nunca se declaró
> en el tema oscuro y hereda el `cyan-300` por defecto de Tailwind. En un
> proyecto nuevo, decláralo explícitamente.

### 3.3 Sombras

```css
/* oscuro */
--shadow-soft: 0 1px 2px rgba(0,0,0,.3), 0 12px 32px -16px rgba(0,0,0,.6);
--shadow-lime: 0 10px 40px -12px rgba(198,242,78,.4);
/* claro */
--shadow-soft: 0 1px 2px rgba(20,22,26,.06), 0 12px 32px -16px rgba(20,22,26,.12);
--shadow-lime: 0 10px 32px -14px rgba(32,191,107,.35);
```

`shadow-lime` es un halo de marca: se reserva para el CTA principal y el logo.

---

## 4. Temas

### 4.1 Mecanismo

El tema oscuro es el valor por defecto en `:root`. El claro **redefine los
mismos tokens** bajo `:root[data-theme="light"]`. Ningún componente consulta el
tema.

```css
@theme { /* tokens oscuros */ }

:root[data-theme="light"] { /* mismos nombres, otros valores */ }
```

### 4.2 Sin destello al cargar

Script síncrono en `<head>`, antes del primer pintado:

```html
<script>
  try {
    if (localStorage.getItem('theme') === 'light')
      document.documentElement.setAttribute('data-theme', 'light');
  } catch (e) {}
</script>
```

### 4.3 Reglas de contraste sobre acento

Los acentos cambian de luminosidad entre temas, así que el texto encima no puede
ser el mismo. Se resuelve una vez, globalmente:

```css
/* CLARO — el botón con fondo tintado pasa a sólido con texto blanco.
   El selector de descendientes es obligatorio: el color suele estar
   en un <span> o en el icono, no en el propio botón. */
:root[data-theme="light"] button[class*="bg-lime/"],
:root[data-theme="light"] a[class*="bg-lime/"],
:root[data-theme="light"] button[class*="bg-lime/"] *,
:root[data-theme="light"] a[class*="bg-lime/"] * { color: #fff !important; }

:root[data-theme="light"] button[class*="bg-lime/"],
:root[data-theme="light"] a[class*="bg-lime/"] {
  background-color: var(--color-lime) !important;
  border-color: var(--color-lime) !important;
}

/* OSCURO — sobre acento sólido y luminoso, texto e iconos oscuros.
   `:not([class*="bg-lime/"])` distingue el sólido del tintado. */
:root:not([data-theme="light"]) [class*="bg-lime"]:not([class*="bg-lime/"]),
:root:not([data-theme="light"]) [class*="bg-lime"]:not([class*="bg-lime/"]) * {
  color: var(--color-carbon) !important;
}
```

Se repite el bloque claro para `iris`, `amber`, `mint`, `rose` y `cyan`.

**Importante:** las reglas del tema claro apuntan solo a `<button>` y `<a>`. Los
badges y puntos decorativos son `<span>`/`<div>` y quedan fuera a propósito.

---

## 5. Forma y espaciado

### 5.1 Radios

| Radio | Valor | Uso |
|---|---|---|
| `rounded-lg` | 8 px | Botones de icono, chips, celdas pequeñas |
| `rounded-xl` | 12 px | Botones, inputs, tarjetas |
| `rounded-2xl` | 16 px | Paneles, modales, contenedores de sección |
| `rounded-3xl` | 24 px | Bottom sheet |
| `rounded-full` | — | Avatares, badges, FAB, puntos de estado |

### 5.2 Espaciado

Escala de 4 px. Valores dominantes medidos en la implementación:

- **Separación entre elementos:** `gap-2` (8 px) y `gap-3` (12 px).
- **Relleno de control:** `px-3 py-2.5` o `px-4 py-3`.
- **Relleno de panel:** `p-4` (16 px), `px-5` en modales.
- **Separación entre bloques:** `space-y-4` / `space-y-6`.

### 5.3 Iconografía

**lucide-react.** Tamaños por jerarquía: 10–11 px en línea con texto pequeño,
13–16 px en botones, 20–26 px en navegación y estados vacíos.
`strokeWidth` 1.8 en reposo, 2.4 en activo.

---

## 6. Componentes

### 6.1 Superficie

```
Tarjeta          rounded-xl border border-line bg-surface
Panel            rounded-2xl border border-line bg-surface
Sección interna  rounded-xl border border-line bg-surface2/40
Modal            rounded-2xl border border-line bg-surface shadow-2xl
```

### 6.2 Botones

| Variante | Clases |
|---|---|
| Primario | `border border-lime bg-lime/10 text-lime` + `shadow-lime` |
| Acento | `border border-{token} bg-{token}/10 text-{token}` |
| Secundario | `border border-line bg-surface2 text-fog hover:text-snow` |
| Destructivo | `border border-rose/40 text-rose hover:bg-rose/10` |
| Icono | `w-9 h-9 rounded-lg border border-line text-fog hover:text-snow` |
| FAB | `fixed w-14 h-14 rounded-full bg-{token} shadow-2xl active:scale-95` |

Base común: `rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors`.
Realimentación táctil: `active:scale-95` (o `active:scale-[0.99]` en botones de
ancho completo).

En el tema claro, las variantes «tintadas» se vuelven sólidas automáticamente
por §4.3. No hay que declarar dos versiones.

### 6.3 Formulario

```
Input   w-full bg-surface2 border border-line rounded-xl px-4 py-2
        text-sm text-snow placeholder:text-mist
        outline-none focus:border-line2 transition-colors

Label   block text-xs font-semibold text-fog mb-1.5
        (o el rótulo de 10 px en mayúsculas para agrupaciones)

Ayuda   text-[10px] text-mist mt-1
Error   text-xs text-rose
```

Checkbox y radio se dibujan a mano: cuadro de 20 px `rounded-md border-2`, que
al marcarse pasa a `bg-{acento} border-{acento}` con un check de 11 px dentro.

### 6.4 Badge

Píldora numérica sobre un icono:

```
min-w-[20px] h-5 px-1 rounded-full bg-{acento}
text-[11px] font-bold leading-none
border-2 border-{color del fondo sobre el que se apoya}
```

El borde del color del fondo (no transparente) es lo que recorta limpiamente el
badge sobre el icono. Posición típica: `absolute -top-2 -right-2.5`.

Badge de texto (estado): sin fondo, solo `text-xs font-semibold text-{acento}`.
Los estados neutros no llevan badge: **solo se etiqueta lo que requiere acción**.

### 6.5 Navegación

- **Móvil:** barra inferior fija, 5 destinos máximo, icono 20 px + rótulo de
  10 px, `z-45` (por encima del contenido y de los FAB, por debajo de los
  modales), `padding-bottom: max(.625rem, env(safe-area-inset-bottom))` y 2 px
  de relleno superior para que los badges no toquen el borde.
- **Escritorio:** barra lateral plegable; plegada muestra solo iconos y el badge
  numérico sobre ellos.
- **Secundarias:** bottom sheet «Más» con tiles de 88 px.

### 6.6 Estados

| Estado | Tratamiento |
|---|---|
| Cargando | Esqueletos con `bg-surface2` y `animate-pulse` |
| Vacío | Icono 28 px `text-mist` + frase corta centrada |
| Deshabilitado | `opacity-50 cursor-not-allowed`, sin cambio de color |
| Pasado / inactivo | `opacity-50` |
| Cancelado | `line-through text-mist` + etiqueta `rose` |
| Conflicto / error | Borde `rose/50` + fondo `rose/5` + icono de aviso |

---

## 7. Layout

- **Contenedor:** una columna en móvil; en `lg:` la pantalla puede partirse en
  contenido principal (`flex-1`) más panel lateral de 320–340 px (`sticky`).
- **Scroll:** en móvil desplaza la ventana; en escritorio, el panel de contenido
  (`lg:h-screen lg:overflow-y-auto`). Cualquier lógica de scroll debe localizar
  el contenedor real, no asumir `window`.
- **`overflow-x: clip`, nunca `hidden`,** en `html`/`body`: `hidden` convierte
  el elemento en contenedor de scroll y **rompe `position: sticky`**.
- **Cabeceras fijas:** `sticky top-0 z-20` con fondo opaco; los saltos de scroll
  deben restar su altura real (`offsetHeight`), no un valor fijo.
- **Áreas seguras:** utilidades que suman `env(safe-area-inset-bottom)` para el
  contenido y para los flotantes, anuladas en `lg:`. Requiere
  `viewport-fit=cover`.
- **Escala de `z-index`:** contenido `0` · FAB `30` · bottom sheet `44` ·
  navegación `45` · modales `60`+ · diálogos anidados `70`/`80`.

---

## 8. Movimiento

- Transiciones de color e interacción: 150–200 ms, `ease-out`.
- Entrada de bottom sheet: `slideUp` 180 ms.
- Realimentación de pulsación: `scale(.95)` mientras se mantiene.
- **Sin animación en desplazamientos de navegación.** Usa `behavior: 'instant'`;
  `'auto'` hereda el `scroll-behavior: smooth` del CSS y anima igualmente.
- Respetar `prefers-reduced-motion` desactivando las animaciones no esenciales.

---

## 9. Accesibilidad

- Contraste mínimo AA (4.5:1) en texto; las reglas de §4.3 existen justamente
  para no incumplirlo al cambiar de tema.
- Zoom permitido: `maximumScale: 5`, `userScalable: true`.
- Todo botón de solo icono lleva `aria-label` **y** `title`.
- Foco visible: `focus:border-line2` en campos; no eliminar el anillo del
  navegador sin sustituto.
- Objetivo táctil recomendado 44 px; el mínimo aceptado en filas densas es
  36 px.
- El color nunca es el único portador de significado: siempre lo acompaña un
  icono o un texto.

---

## 10. Implementación mínima

```css
@import "tailwindcss";

@theme {
  --color-ink: #0a0b0d;
  --color-carbon: #0e0f12;
  --color-surface: #16181d;
  --color-surface2: #1d2027;
  --color-line: #2a2e36;
  --color-line2: #3a3f49;
  --color-snow: #f4f5f2;
  --color-fog: #a2a8b2;
  --color-mist: #6c727c;
  --color-lime: #c6f24e;
  --color-lime-deep: #a9da2f;
  --color-iris: #8b8bff;
  --color-amber: #f5b945;
  --color-mint: #34d399;
  --color-mint-soft: #112a23;
  --color-rose: #fb7185;
  --color-rose-soft: #2a1419;
  --color-cyan: #67e8f9;
  --font-sans: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif;
  --shadow-soft: 0 1px 2px rgba(0,0,0,.3), 0 12px 32px -16px rgba(0,0,0,.6);
  --shadow-lime: 0 10px 40px -12px rgba(198,242,78,.4);
}

:root[data-theme="light"] {
  --color-carbon: #f7f8fa;
  --color-surface: #ffffff;
  --color-surface2: #f2f3f5;
  --color-line: #e3e5ea;
  --color-line2: #cdd1d9;
  --color-snow: #14161a;
  --color-fog: #565c68;
  --color-mist: #838a96;
  --color-lime: #20bf6b;
  --color-lime-deep: #189656;
  --color-iris: #3867d6;
  --color-amber: #fa8231;
  --color-mint: #22a6b3;
  --color-mint-soft: #dff7f5;
  --color-rose: #eb3b5a;
  --color-rose-soft: #fde3e8;
  --color-cyan: #2d98da;
  --shadow-soft: 0 1px 2px rgba(20,22,26,.06), 0 12px 32px -16px rgba(20,22,26,.12);
  --shadow-lime: 0 10px 32px -14px rgba(32,191,107,.35);
}

html { overflow-x: clip; }           /* nunca hidden: rompe position:sticky */
body { background: var(--color-carbon); color: var(--color-snow);
       font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }

.font-display { font-family: var(--font-display); font-weight: 800; letter-spacing: -.02em; }
```

Con esto y las reglas de §4.3 tienes el sistema operativo. El resto de la
especificación son convenciones de uso, no código.
