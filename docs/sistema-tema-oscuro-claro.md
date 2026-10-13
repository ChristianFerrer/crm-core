# Sistema de tema oscuro/claro — especificación técnica

Base para replicar el *look and feel* de Watermelon CRM en otra aplicación.
Extraído de la implementación real (`src/app/globals.css`, `src/lib/theme.tsx`,
`src/app/layout.tsx`), no de memoria.

Supuestos de la app destino: **Next.js App Router + Tailwind CSS v4**. Al final
hay notas para Vite/CRA y para Tailwind v3.

---

## 1. La idea en una frase

Los componentes **nunca** conocen el tema. Escriben `bg-surface`, `text-fog`,
`border-line` — nombres semánticos. El tema es una sola variable CSS que cambia
de valor. Cambiar de tema no re-renderiza nada de React: solo reescribe un
atributo en `<html>`.

Consecuencia práctica: **se puede añadir el tema claro a una app ya construida
en oscuro sin tocar un solo componente**, siempre que los componentes usen
tokens y no colores literales.

---

## 2. Las tres piezas

### 2.1 Tokens (`globals.css`)

Tailwind v4 genera las utilidades desde `@theme`. Lo que se declara ahí es el
tema oscuro (el de partida); el claro **sobrescribe las mismas variables** bajo
un selector de atributo.

```css
@import "tailwindcss";

@theme {
  /* Superficies, de más hundida a más elevada */
  --color-ink:      #0a0b0d;   /* solo para ::selection y sombras */
  --color-carbon:   #0e0f12;   /* fondo de la app */
  --color-surface:  #16181d;   /* tarjeta */
  --color-surface2: #1d2027;   /* control dentro de una tarjeta */

  /* Bordes */
  --color-line:     #2a2e36;   /* borde normal */
  --color-line2:    #3a3f49;   /* borde en hover / separador fuerte */

  /* Texto, de más a menos importante */
  --color-snow:     #f4f5f2;   /* titulares y cifras */
  --color-fog:      #a2a8b2;   /* cuerpo y rótulos */
  --color-mist:     #6c727c;   /* decorativo: NO para texto esencial (§5) */

  /* Acentos */
  --color-lime:      #c6f24e;  /* primario / éxito */
  --color-lime-deep: #a9da2f;  /* hover del primario */
  --color-iris:      #8b8bff;  /* informativo */
  --color-grape:     #e879f9;  /* categoría especial */
  --color-amber:     #f5b945;  /* aviso */
  --color-mint:      #34d399;  /* confirmación */
  --color-mint-soft: #112a23;  /* fondo de bloque de confirmación */
  --color-rose:      #fb7185;  /* error */
  --color-rose-soft: #2a1419;  /* fondo de bloque de error */

  --font-sans:    var(--font-jakarta), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif;

  --shadow-soft: 0 1px 2px rgba(0,0,0,.3), 0 12px 32px -16px rgba(0,0,0,.6);
  --shadow-lime: 0 10px 40px -12px rgba(198,242,78,.4);
}

:root[data-theme="light"] {
  --color-carbon:   #f7f8fa;
  --color-surface:  #ffffff;
  --color-surface2: #f2f3f5;
  --color-line:     #e3e5ea;
  --color-line2:    #cdd1d9;
  --color-snow:     #14161a;
  --color-fog:      #565c68;
  --color-mist:     #838a96;

  --color-lime:      #20bf6b;
  --color-lime-deep: #189656;
  --color-iris:      #3867d6;
  --color-grape:     #c026d3;
  --color-amber:     #fa8231;
  --color-mint:      #22a6b3;
  --color-mint-soft: #dff7f5;
  --color-rose:      #eb3b5a;
  --color-rose-soft: #fde3e8;

  --shadow-soft: 0 1px 2px rgba(20,22,26,.06), 0 12px 32px -16px rgba(20,22,26,.12);
  --shadow-lime: 0 10px 32px -14px rgba(32,191,107,.35);
}

body {
  background: var(--color-carbon);
  color: var(--color-snow);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

.font-display {
  font-family: var(--font-display);
  font-weight: 800;
  letter-spacing: -0.02em;
}

::selection { background: var(--color-lime); color: var(--color-ink); }
```

**La escala invierte el sentido, no los valores.** En oscuro las superficies
*suben* al acercarse al usuario (`#0e0f12 → #16181d → #1d2027`); en claro
*bajan* desde el blanco de la tarjeta (`#f7f8fa` de fondo, `#ffffff` de
tarjeta). La tarjeta siempre contrasta con el fondo, en los dos temas, y por eso
`bg-surface` significa «tarjeta» y no «gris oscuro».

### 2.2 Provider (`lib/theme.tsx`)

```tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'app_theme'   // cambiar el prefijo por app

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: 'dark',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  // El valor real se lee tras montar: en el servidor no hay localStorage, y
  // sembrar el estado durante el render rompe la hidratación.
  useEffect(() => {
    let stored: string | null = null
    try { stored = localStorage.getItem(STORAGE_KEY) } catch {}
    if (stored === 'light' || stored === 'dark') setThemeState(stored)
  }, [])

  function setTheme(next: Theme) {
    setThemeState(next)
    // Cada acceso va en su try: en modo privado de Safari localStorage lanza,
    // y si lanzara aquí el atributo no llegaría a escribirse.
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
    try {
      if (next === 'light') document.documentElement.setAttribute('data-theme', 'light')
      else document.documentElement.removeAttribute('data-theme')
    } catch {}
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }
```

**El oscuro es la ausencia del atributo**, no `data-theme="dark"`. Así el tema
por defecto no depende de que ningún script llegue a ejecutarse: si todo falla,
la app sale oscura, que es lo correcto.

### 2.3 Script anti-destello (`layout.tsx`)

Sin esto, quien eligió el tema claro ve un fogonazo oscuro en cada carga: el
HTML llega pintado antes de que React hidrate. El script va **en `<head>`,
síncrono y sin `defer`**, para ejecutarse antes del primer pintado.

```tsx
<html lang="es" className={jakarta.variable}>
  <head>
    <script
      dangerouslySetInnerHTML={{
        __html: `try{if(localStorage.getItem('app_theme')==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}`,
      }}
    />
  </head>
  <body className="min-h-screen bg-carbon text-snow">
    <ThemeProvider>{children}</ThemeProvider>
  </body>
</html>
```

La clave de `localStorage` está escrita dos veces (aquí y en el provider). Es
duplicación a propósito: el script no puede importar módulos. **Si se cambia la
clave, hay que cambiarla en los dos sitios** — conviene una prueba que lo
verifique.

### 2.4 El conmutador

Dos botones, no un *toggle*. El conmutador de un solo clic no dice en qué estado
estás sin aprender el icono; dos botones con el activo resaltado sí.

```tsx
const { theme, setTheme } = useTheme()

<div className="grid grid-cols-2 gap-2">
  {([['dark', Moon, 'Oscuro'], ['light', Sun, 'Claro']] as const).map(([id, Icon, label]) => (
    <button
      key={id}
      onClick={() => setTheme(id)}
      aria-pressed={theme === id}
      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
        theme === id
          ? 'border-lime bg-lime/10 text-lime'
          : 'border-line bg-surface2 text-fog hover:text-snow'
      }`}
    >
      <Icon size={12} /> {label}
    </button>
  ))}
</div>
```

---

## 3. Tipografía

Una sola familia para todo: **Plus Jakarta Sans**. Geométrica, «a» de dos pisos,
terminales inclinadas.

```tsx
import { Plus_Jakarta_Sans } from 'next/font/google'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
})
```

`--font-display` apunta a la misma familia: el contraste de titulares no lo da
otro tipo de letra, lo dan **peso 800 y `letter-spacing: -0.02em`** (clase
`.font-display`). Es lo que produce el aire compacto de los números grandes.

Escala en uso, con su papel:

| Tamaño | Clase | Para qué |
|---|---|---|
| 10 px | `text-[10px] uppercase tracking-wide font-semibold` | rótulo de sección |
| 11 px | `text-[11px]` | pie de tarjeta, nota secundaria |
| 12–13 px | `text-xs` / `text-[13px]` | cuerpo y botones |
| 14 px | `text-sm` | nombres, cuerpo destacado |
| 24–30 px | `font-display text-2xl` / `text-3xl` | cifra de tarjeta, título de página |

Toda cifra lleva `tabular-nums`: sin eso las columnas de números bailan al
cambiar de valor.

---

## 4. Radios, bordes y sombras

| Elemento | Clases |
|---|---|
| Tarjeta / panel | `rounded-2xl border border-line bg-surface p-4` |
| Control dentro de tarjeta | `rounded-xl border border-line bg-surface2` |
| Botón | `rounded-lg` o `rounded-xl` |
| Caja pequeña, badge | `rounded-md` |
| Avatar, contador | `rounded-full` |

Reglas: **el borde siempre es `border-line`**, nunca un gris literal. El relieve
lo da el escalón `carbon → surface → surface2`, no la sombra; `--shadow-soft` se
reserva para lo que flota de verdad (modales, menús), y `--shadow-lime` para el
botón principal.

---

## 5. Accesibilidad: lo que hay que corregir al replicar

Contrastes calculados sobre la implementación actual (WCAG 2.1, AA pide 4.5:1
para texto normal y 3:1 para texto grande y componentes):

**Texto sobre su fondo — correcto en los dos temas:**

| Token | Oscuro sobre `carbon` | Claro sobre `surface` |
|---|---|---|
| `snow` | 17,5:1 ✅ | 18,1:1 ✅ |
| `fog` | 8,0:1 ✅ | 6,7:1 ✅ |
| `mist` | 3,96:1 ⚠️ | 3,48:1 ⚠️ |

→ **`mist` no llega a AA en ninguno de los dos temas.** Es válido para
separadores, iconos decorativos y texto de apoyo repetido en otro sitio; **no
para un dato que solo exista ahí**. En el original se usa en rótulos de 10 px,
que es justo donde más se nota. En la app nueva: `mist` decorativo, `fog` para
todo lo que haya que leer.

**Fondo sólido de acento con texto blanco (tema claro) — aquí está el fallo:**

| Acento | Color claro | Blanco encima | |
|---|---|---|---|
| `iris` | `#3867d6` | 5,15:1 | ✅ |
| `grape` | `#c026d3` | 4,71:1 | ✅ |
| `rose` | `#eb3b5a` | 3,96:1 | ❌ |
| `cyan` | `#2d98da` | 3,17:1 | ❌ |
| `mint` | `#22a6b3` | 2,93:1 | ❌ |
| `amber` | `#fa8231` | 2,53:1 | ❌ |
| `lime` | `#20bf6b` | **2,41:1** | ❌ |

El original fuerza texto blanco sobre el acento sólido en el tema claro, y en
cinco de siete acentos eso **no se puede leer**. El botón primario —el más
usado— es el peor de todos.

**Solución para la app nueva: un token aparte para el fondo sólido.** El tono
vivo se queda para bordes, iconos y fondos con opacidad; el sólido usa el tono
profundo, elegido para superar 4,5:1 con blanco:

```css
:root[data-theme="light"] {
  --color-lime-solid:  #15803d;  /* 5,02:1 */
  --color-iris-solid:  #3867d6;  /* 5,15:1 */
  --color-amber-solid: #b45309;  /* 5,02:1 */
  --color-mint-solid:  #0f766e;  /* 5,47:1 */
  --color-rose-solid:  #be123c;  /* 6,29:1 */
  --color-grape-solid: #c026d3;  /* 4,71:1 */
  --color-cyan-solid:  #0369a1;  /* 5,93:1 */
}

/* En oscuro el sólido es el propio acento vivo, con texto del color del fondo */
@theme {
  --color-lime-solid:  var(--color-lime);
  /* … el resto igual */
}
```

Y en los componentes, una clase explícita en vez de parches CSS:

```tsx
// Botón primario, igual en los dos temas
<button className="rounded-xl bg-lime-solid px-4 py-2 text-sm font-semibold
                   text-white dark-text-carbon">
```

En oscuro el texto sobre lima vivo debe ser **`carbon`**, no blanco: el blanco
sobre `#c6f24e` da 1,2:1. El original lo resuelve con una regla global; en la
app nueva es mejor una variable:

```css
@theme             { --color-on-accent: var(--color-carbon); }
:root[data-theme="light"] { --color-on-accent: #ffffff; }
```

…y usar `text-on-accent` en todo botón de fondo sólido. Una línea por tema en
lugar de 120 líneas de `!important`.

---

## 6. Lo que NO hay que copiar del original

El tema claro de Watermelon se añadió sobre una app ya construida, y eso dejó
dos atajos que **no deben replicarse en una app nueva**:

1. **~120 líneas de selectores `[class*="bg-lime/"]` con `!important`.** Parchean
   el contraste de los botones a posteriori, apuntando al *nombre de la clase de
   Tailwind*. Se rompen si alguien escribe el color de otra forma, no cubren
   `<div role="button">`, y obligan a repetir el bloque por cada acento. En una
   app nueva se evitan con `--color-*-solid` y `--color-on-accent` (§5).

2. **`--color-cyan-300` solo existe en el tema claro.** En oscuro, `text-cyan-300`
   cae en el cian por defecto de Tailwind (`#67e8f9`), así que ese color es el
   único de la paleta que no está bajo control. **Declarar todo acento en
   `@theme`** y no depender de la paleta de Tailwind para nada que luego haya que
   invertir.

---

## 7. Siete cosas que rompen el tema (y cómo evitarlas)

1. **Clases compuestas en tiempo de ejecución.** Tailwind escanea el código
   fuente: `` className={`text-${color}`} `` nunca se genera. Las variantes
   (`group-hover:text-lime`, `divide-rose/15`) tienen que aparecer **literales**.
   Patrón obligatorio: una tabla de clases literales.

   ```tsx
   const ACCENT = {
     lime: { text: 'text-lime', bg: 'bg-lime/10', border: 'border-lime/40',
             hover: 'group-hover:text-lime' },
     // …
   } as const
   ```

2. **Controles nativos del navegador.** `<input type="date">`, los selectores de
   color y las barras de desplazamiento los pinta el sistema, no el CSS. Hay que
   declarar el esquema:

   ```css
   :root                     { color-scheme: dark; }
   :root[data-theme="light"] { color-scheme: light; }
   ```

   (El original lo hace input por input con `style={{ colorScheme: … }}`;
   declararlo en `:root` lo arregla de una vez.)

3. **Transiciones al cambiar de tema.** Un `transition: background .3s` global
   hace que cientos de elementos animen a la vez y el cambio se ve como un
   barrido sucio. El cambio de tema debe ser **instantáneo**; las transiciones
   se dejan para `hover`, acotadas (`transition-colors`).

4. **Sombras heredadas.** Una sombra calibrada en negro al 60 % sobre fondo
   oscuro se ve como una mancha gris sobre blanco. `--shadow-*` **tiene que
   redefinirse** en el tema claro (ya está en §2.1).

5. **Imágenes y SVG con relleno fijo.** Logos e ilustraciones con `fill="#fff"`
   desaparecen en claro. Usar `fill="currentColor"` y heredar el color.

6. **Capas semitransparentes.** `bg-black/40` para un velo de modal funciona en
   los dos temas; `bg-white/10` para «elevar» una tarjeta, no. Elevar siempre con
   el escalón `surface → surface2`.

7. **Colores literales en los componentes.** Un solo `#fff` o `bg-gray-800`
   perdido no se ve hasta que alguien cambia de tema. Conviene una regla de lint
   que prohíba literales hexadecimales y las paletas por defecto de Tailwind
   (`gray-*`, `zinc-*`, `slate-*`) fuera de `globals.css`.

---

## 8. Checklist de implementación

- [ ] `@theme` con los tokens oscuros; **ningún** acento tomado de la paleta por
      defecto de Tailwind
- [ ] Bloque `:root[data-theme="light"]` sobrescribiendo color **y sombras**
- [ ] `--color-*-solid` y `--color-on-accent` por tema (§5)
- [ ] `color-scheme` en `:root` para los dos temas
- [ ] `ThemeProvider` con `localStorage` envuelto en `try`
- [ ] Script síncrono en `<head>`, misma clave que el provider
- [ ] Conmutador de dos botones con `aria-pressed`
- [ ] Fuente variable con los pesos 400–800 y `.font-display` a 800 / −0.02em
- [ ] Tabla `ACCENT` de clases literales, sin composición en ejecución
- [ ] Revisión visual de: controles nativos, modales, tablas con cabecera
      pegajosa, gráficos, barras de desplazamiento y estados `hover`
- [ ] Contraste comprobado con el script de §5 cada vez que se añada un acento

---

## 9. Fuera de Next.js

- **Vite / CRA:** el script anti-destello va como `<script>` en línea en
  `index.html`, antes del `<div id="root">`. El resto es idéntico.
- **Tailwind v3:** no hay `@theme`. Se declaran las variables en `:root` dentro
  de `@layer base` y se referencian en `tailwind.config.js`:
  ```js
  theme: { extend: { colors: { surface: 'var(--color-surface)', /* … */ } } }
  ```
  Con v3 hay que usar `<alpha-value>` para que funcionen las opacidades
  (`bg-lime/10`): `lime: 'rgb(var(--color-lime-rgb) / <alpha-value>)'`, lo que
  obliga a guardar los colores como tripletes RGB en vez de hexadecimales.
- **Sin Tailwind:** el sistema de tokens funciona igual; se pierden las
  utilidades, no la arquitectura.

---

## 10. Script de verificación de contraste

```python
def lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

def luminancia(hexcolor):
    h = hexcolor.lstrip('#')
    r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

def contraste(a, b):
    la, lb = luminancia(a), luminancia(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

# AA: 4.5 texto normal · 3.0 texto grande y componentes
print(contraste('#ffffff', '#15803d'))   # 5.02
```
