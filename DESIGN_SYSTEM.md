# Sistema de Diseño — Adopta y Deja tu Huella

> Guía de estilo normativa para personas desarrolladoras y asistentes de IA.
> Todo cambio de interfaz en este repositorio **debe** cumplir este documento.
> Si una propuesta de diseño entra en conflicto con esta guía, gana la guía;
> si la guía se queda corta, se amplía aquí antes de escribir el CSS.

---

## 1. Principios de diseño

**Minimalismo cálido.** La referencia es Apple, Kiwoko y Kibusco: superficies
blancas, mucho aire, un único acento cromático (el marrón tierra de la huella)
y tipografía que hace el trabajo pesado de la jerarquía.

| Principio | Qué significa en la práctica |
|---|---|
| **Claridad antes que decoración** | Cada elemento visible responde a una pregunta del usuario. Si no responde ninguna, se elimina. |
| **Una sola voz cromática** | El color sólo se usa para el acento de marca y para los estados semánticos. Nada de degradados decorativos, sombras de color ni fondos ilustrados. |
| **Aire generoso** | El espacio en blanco es el separador por defecto. Las líneas divisorias se usan cuando el espacio no basta, nunca «por si acaso». |
| **Jerarquía por tamaño y peso** | Se distingue por escala tipográfica y peso (400/500/600), no por colores llamativos ni mayúsculas forzadas. |
| **Interfaz silenciosa** | Sin emojis en la UI, sin iconos genéricos recargados, sin animaciones que no expliquen un cambio de estado. |
| **Táctil y accesible** | Objetivo mínimo de 44×44 px, foco visible siempre, contraste AA, `prefers-reduced-motion` respetado. |

### Lo que está prohibido

- Emojis como iconografía (`🐾`, `🏢`, `🐕`…). Se sustituyen por SVG inline.
- Librerías de iconos por CDN (Font Awesome y similares).
- Degradados de marca (`linear-gradient(135deg, #667eea, #764ba2)`) y sombras de color.
- Fondos con patrón, texturas o ilustraciones de relleno.
- Más de un color de acento por pantalla.
- Pesos tipográficos 700/800 (demasiado densos para esta estética).
- Radios de borde superiores a 16 px en superficies grandes.

---

## 2. Paleta de colores oficial

Se declara **una sola vez** en `:root` dentro de `styles.css`. Ningún otro
fichero define literales hexadecimales de marca; todos consumen variables.

```css
:root {
    /* ---- Superficies ---- */
    --bg-main:   #FAF9F5;  /* Fondo general: blanco roto cálido */
    --bg-card:   #FFFFFF;  /* Tarjetas, superficies elevadas y modales */
    --on-accent: #FFFFFF;  /* Texto e iconos sobre --primary o --danger */

    /* ---- Marca ---- */
    --primary:       #7A4E23;  /* Marrón tierra cálido: huella, acentos, CTA */
    --primary-hover: #5F3C1A;  /* Marrón tierra oscuro: hover y pulsado */

    /* ---- Texto ---- */
    --text-main:  #1C1917;  /* Gris carbón: titulares y cuerpo */
    --text-muted: #78716C;  /* Gris piedra: metadatos y descripciones */
    --text-light: #A8A29E;  /* Gris tenue: placeholders y estados vacíos */

    /* ---- Línea ---- */
    --border: #E7E5E4;  /* Borde fino y neutro, único grosor: 1px */

    /* ---- Estados semánticos ---- */
    --badge-success-bg:   #E8F5E9;  /* Etiqueta «Disponible» */
    --badge-success-text: #2E7D32;
    --badge-warning-bg:   #FFF4E5;  /* Etiqueta «Reservado» */
    --badge-warning-text: #9A5B00;
    --badge-neutral-bg:   #F5F5F4;  /* Etiqueta «Adoptado» y roles */
    --badge-neutral-text: #57534E;
    --danger:             #B3261E;  /* Sólo acciones destructivas y errores */
    --danger-soft:        #FDF2F2;
}
```

### Uso del color

| Token | Se usa para | No se usa para |
|---|---|---|
| `--primary` | Isotipo de huella, botón primario, pestaña activa, foco, enlaces | Fondos amplios, texto de párrafo |
| `--danger` | Eliminar, errores de validación | Avisos informativos |
| `--badge-*` | Estados del animal y roles | Botones |
| `--text-light` | Placeholders, iconos de estado vacío | Texto que deba leerse |

Contraste comprobado: `--text-main` sobre `--bg-main` = 15.8:1; `--text-muted`
sobre `--bg-card` = 4.9:1; blanco sobre `--primary` = 8.1:1. Todo AA o superior.

---

## 3. Tipografía y jerarquía

```css
--font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

Una única familia. `font-display: swap`. Sólo se cargan los pesos 400, 500 y 600.

| Rol | Token | Tamaño | Peso | Interlineado | Tracking |
|---|---|---|---|---|---|
| Display (hero público) | `--text-display` | `clamp(2rem, 1.4rem + 2.6vw, 3rem)` | 600 | 1.1 | −0.03em |
| Título de sección (h2) | `--text-2xl` | 1.5rem | 600 | 1.2 | −0.02em |
| Título de tarjeta / modal (h3) | `--text-xl` | 1.125rem | 600 | 1.3 | −0.01em |
| Subtítulo de bloque | `--text-lg` | 1rem | 500 | 1.4 | 0 |
| Cuerpo | `--text-base` | 0.9375rem | 400 | 1.6 | 0 |
| Secundario / metadatos | `--text-sm` | 0.8125rem | 400 | 1.5 | 0 |
| Etiqueta / badge | `--text-xs` | 0.75rem | 500 | 1.4 | 0.01em |

Reglas:

- **Nunca** se usa un peso superior a 600.
- Las etiquetas de formulario van en `--text-sm` / peso 500, color `--text-main`.
- Los textos de ayuda van en `--text-xs`, color `--text-muted`.
- No se usan mayúsculas forzadas (`text-transform: uppercase`) salvo en las
  cabeceras de tabla, donde se admiten con `letter-spacing: 0.04em`.

### Escala de espaciado

Múltiplos de 4 px expuestos como tokens. No se escriben valores arbitrarios.

```css
--space-1: 0.25rem;  --space-2: 0.5rem;   --space-3: 0.75rem;
--space-4: 1rem;     --space-5: 1.5rem;   --space-6: 2rem;
--space-7: 3rem;     --space-8: 4rem;
```

### Radios, bordes y sombras

```css
--radius-sm: 8px;    /* Inputs, badges, botones pequeños */
--radius:    12px;   /* Tarjetas, modales, botones */
--radius-lg: 16px;   /* Contenedores de página */
--radius-full: 999px;

--shadow-sm: 0 1px 2px rgba(28, 25, 23, 0.05);
--shadow:    0 1px 3px rgba(28, 25, 23, 0.06), 0 8px 24px rgba(28, 25, 23, 0.05);
--shadow-lg: 0 24px 64px rgba(28, 25, 23, 0.14);
```

```css
--shadow-seleccion: 0 0 0 3px rgba(122, 78, 35, 0.16);
```

Sombras siempre **neutras** (derivadas de `--text-main`), nunca de color de marca.
La única excepción es `--shadow-seleccion`: no aporta profundidad, sino que señala
el elemento elegido (la miniatura activa de la galería). Cualquier otro uso de una
sombra teñida de marca sigue estando prohibido.
Un solo grosor de borde: `1px solid var(--border)`.

### Movimiento

```css
--ease: cubic-bezier(0.22, 0.61, 0.36, 1);
--dur-fast: 140ms;  --dur: 220ms;
```

Sólo se animan `opacity`, `transform` y `color`/`background-color`. Toda
animación se desactiva bajo `@media (prefers-reduced-motion: reduce)`.

---

## 4. Iconografía

**Exclusivamente SVG inline, monocromático y vectorial.** Sin librerías externas,
sin emojis, sin PNG.

Contrato de cada icono:

```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
     width="20" height="20" aria-hidden="true">…</svg>
```

- `stroke="currentColor"`: el icono hereda el color del texto. Nunca se pinta con `fill`
  salvo el isotipo de huella, que es sólido en `--primary`.
- `stroke-width: 1.5` para 20–24 px; `1.75` por debajo de 18 px.
- Tamaños permitidos: 16, 18, 20, 24 px. Nada intermedio.
- Siempre `aria-hidden="true"`: el significado lo aporta el texto o el `aria-label`
  del control que lo contiene.
- Todos los iconos viven en el registro único de `js/icons.js` y se insertan con
  `icono('nombre', tamaño)`. **No se escribe SVG suelto en el HTML de un componente.**

Inventario mínimo: `huella`, `buscar`, `corazon`, `corazon-lleno`, `usuario`,
`usuarios`, `casa`, `editar`, `eliminar`, `cerrar`, `mas`, `guardar`, `salir`,
`camara`, `estrella`, `calendario`, `mapa`, `regla`, `avion`, `escudo`, `info`,
`patas`, `flecha-izq`, `flecha-der`, `check`, `alerta`, `inbox`, `cargando`.

---

## 5. Componentes

### 5.1 Botones

Altura fija 44 px (40 px en variante compacta), `border-radius: var(--radius)`,
peso 500, sin sombra en reposo, sin transformaciones de escala.

| Variante | Fondo | Texto | Borde | Uso |
|---|---|---|---|---|
| `.btn-primario` | `--primary` | `#FFF` | — | Acción principal, una por vista |
| `.btn-secundario` | `--bg-card` | `--text-main` | `1px --border` | Cancelar, acciones alternativas |
| `.btn-texto` | transparente | `--text-main` | — | Navegación de cabecera, enlaces de acción |
| `.btn-peligro` | `--danger-soft` | `--danger` | `1px` transparente | Eliminar |
| `.btn-icono` | transparente | `--text-muted` | — | Acciones cuadradas de 40 px dentro de listas |

Estados obligatorios en las cinco variantes: `:hover`, `:active`, `:focus-visible`
(anillo `2px solid var(--primary)` con `outline-offset: 2px`) y `:disabled`
(`opacity: .5`, `cursor: not-allowed`). El estado de carga sustituye el contenido
por `icono('cargando')` girando y mantiene el ancho del botón.

### 5.2 Tarjeta de catálogo (`.animal-card`)

```
┌────────────────────────────┐
│  [ foto 4:3 · object-fit ] │  ← fondo --bg-main cuando no hay foto
│                      ♡     │  ← botón favorito, 36px, flotante arriba-derecha
├────────────────────────────┤
│  Nombre            600/1.125│
│  Raza · Provincia   sm/muted│
│  [ Disponible ]      badge  │
└────────────────────────────┘
```

- Fondo `--bg-card`, borde `1px solid var(--border)`, radio `--radius`, **sin sombra en reposo**.
- Hover: `box-shadow: var(--shadow)` y `transform: translateY(-2px)`. Nada más.
- La tarjeta entera es activable (`role="button"` + `tabindex="0"`) y abre la ficha.
- El botón de favorito detiene la propagación del clic.
- Rejilla: `repeat(auto-fill, minmax(230px, 1fr))` con `gap: var(--space-5)`.

### 5.3 Ficha detallada del animal

Modal ancho (`max-width: 920px`) con galería a la izquierda y datos a la derecha
en escritorio; apilado en móvil. El contenido se organiza **siempre** en estos
cuatro bloques, en este orden y con estos títulos literales:

1. **Mis datos** — sexo, tamaño, fecha de nacimiento/edad, raza, provincia, si puede viajar.
   Se presenta como rejilla de pares etiqueta/valor (`.ficha-datos`).
2. **Me entregan** — condiciones sanitarias y de adopción. Lista con marca de verificación.
3. **Tienes que saber que** — carácter, necesidades especiales o historia. Párrafo libre.
4. **Compatible** — convivencia con perros, gatos y niños. Chips de estado.

Un bloque sin datos **no se renderiza**: no se muestran secciones vacías ni «—».

**Galería de la ficha.** Columna flex (`flex-direction: column; gap: 0.75rem`) con la
foto principal en 4:3 arriba y la tira de miniaturas debajo, como hermanos del mismo
contenedor: nunca se solapan. Las miniaturas van en fila
(`display: flex; gap: 0.5rem; justify-content: flex-start`), cada una cuadrada
(`aspect-ratio: 1 / 1`, 60 px, `border-radius: 6px`, `object-fit: cover`). La activa
lleva `border: 2px solid var(--primary)` y `--shadow-seleccion`; las inactivas llevan
ese mismo borde en transparente, para que seleccionar no desplace la fila. Pulsar una
miniatura cambia la foto principal al instante.

### 5.4 Modales

```css
.modal {
    margin: auto;
    inset: 0;
    border: none;
    border-radius: 12px;
    background: var(--bg-card);
    box-shadow: var(--shadow-lg);
    padding: 0;
    max-width: min(560px, calc(100vw - 2rem));
    max-height: min(90vh, 90dvh);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.modal::backdrop { background: rgba(28, 25, 23, 0.4); }
```

- Centrado real mediante `margin: auto; inset: 0` sobre `<dialog>` nativo.
- Estructura fija: `.modal-head` (título + cerrar) · `.modal-body` (desplazable)
  · `.modal-foot` (acciones alineadas a la derecha, secundaria primero).
- Cabecera y pie quedan fijos; sólo el cuerpo hace scroll.

#### Contrato de scroll en modales

El contenedor es la caja que limita la altura y **nunca** scrollea; el cuerpo es la
única zona desplazable. Sin este reparto, el contenido largo se recorta o desborda:

| Capa | Reglas obligatorias |
|---|---|
| Contenedor (`.modal`) | `max-height: min(90vh, 90dvh); display: flex; flex-direction: column; overflow: hidden;` |
| Cuerpo (`.modal-body`, `.acceso-cuerpo`) | `overflow-y: auto; flex: 1 1 auto; min-height: 0; padding: 1.25rem;` |
| Cabecera, pestañas y pie | `flex: none` y padding lateral igual al del cuerpo (`1.25rem`) |

`min-height: 0` es imprescindible: sin él, un hijo flex no baja de su altura de
contenido y el modal crece hasta recortar el pie.

En el modal de acceso (`#modalAcceso`), cada `<form class="acceso-cuerpo">` es la zona
desplazable, de forma que «Entrar» y «Crear mi cuenta» se ven enteros, con su margen
vertical propio, y la nota de `.acceso-pie` conserva su padding superior.
- Se cierra con `Esc`, con el botón de cerrar y con clic en el backdrop.
- El foco entra en el primer campo y queda atrapado mientras está abierto.

### 5.5 Formularios

- Etiqueta visible encima del campo. Nunca se usa el placeholder como etiqueta.
- Campo: alto 44 px, `1px solid var(--border)`, radio `--radius-sm`, fondo `--bg-card`.
- Foco: borde `--primary` + `box-shadow: 0 0 0 3px rgba(122, 78, 35, .12)`.
- Error: borde `--danger` y mensaje en `--text-xs` bajo el campo, con `role="alert"`.
- Ayuda contextual en `--text-xs` / `--text-muted`, siempre bajo el campo.
- Los campos agrupados usan `.campo-fila` (dos columnas que colapsan a una en móvil).

### 5.6 Badges

Píldora de `--text-xs`, peso 500, `padding: 2px 10px`, `border-radius: --radius-full`.
Mapa fijo: `Disponible` → success · `Reservado` → warning · `Adoptado` → neutral.

### 5.7 Galería de fotos (alta y edición)

- Hasta **6** imágenes por animal, en rejilla responsive (`minmax(96px, 1fr)`).
- Cada miniatura muestra, al enfocar o pasar el cursor, el control de eliminar y
  el de «marcar como principal».
- La foto principal lleva un distintivo con el icono `estrella` sobre `--primary`.
- Zona de arrastre con borde discontinuo de 1 px y texto en `--text-muted`.

---

## 6. Diseño responsive

| Punto de ruptura | Comportamiento |
|---|---|
| ≥ 1200 px | Contenedor máximo 1180 px centrado. Ficha a dos columnas. |
| 768–1199 px | Rejilla de catálogo fluida. Ficha a dos columnas estrechas. |
| ≥ 769 px | Barra de accesos visible entera; el botón de menú (`#btnMenu`) queda oculto. |
| < 768 px | Ficha apilada, cabecera con buscador a ancho completo, modales a 100 % menos 1 rem de margen. Los accesos se pliegan tras el botón de menú. |
| < 480 px | Rejilla de catálogo a una columna; pies de modal a ancho completo. |

### Navegación en móvil

El botón de menú es **exclusivo de móvil**. Por defecto `.nav-hamburguesa` está en
`display: none` y sólo pasa a `inline-flex` por debajo de 768 px; en escritorio se
refuerza con una regla propia para que ninguna utilidad posterior lo reintroduzca:

```css
.nav-hamburguesa { display: none; }

@media (min-width: 769px) {
    #btnMenu { display: none !important; }
}

@media (max-width: 768px) {
    .nav-hamburguesa { display: inline-flex; margin-left: auto; }
}
```

Por debajo de 768 px los accesos de la cabecera se repliegan tras ese botón
(icono `menu` del registro, nunca un emoji ni tres `<span>`). El desplegable:

- se ancla a la fila de cabecera (`position: absolute; top: 100%`) y ocupa el ancho
  disponible menos el canal lateral;
- se anima sólo con `opacity` y `transform`, y alterna `visibility` para quedar fuera
  del orden de tabulación mientras está plegado;
- mantiene `aria-expanded` en el botón y `aria-controls` apuntando al `<nav>`;
- se cierra al elegir una opción, al pulsar fuera, con `Esc` y al volver a escritorio.

### Seguridad de área en iOS

Los modales usan `max-height: min(90vh, 90dvh)` (y `min(85vh, 85dvh)` por debajo de
480 px): en iPhone, `vh` ignora la barra flotante de Safari y `dvh` la descuenta, de
modo que el menor de los dos impide que el pie del modal quede recortado. El pie añade además
`padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom, 0px))` para no
quedar bajo el indicador de inicio.

Objetivo táctil mínimo de 44×44 px en todos los breakpoints.

---

## 7. Lista de verificación antes de cerrar un cambio de UI

- [ ] No se ha introducido ningún hexadecimal fuera de `:root`.
- [ ] No hay emojis ni iconos de librería externa; todo SVG sale de `js/icons.js`.
- [ ] Ningún peso tipográfico supera 600.
- [ ] Todos los espaciados usan tokens `--space-*`.
- [ ] Hover, focus-visible, active y disabled definidos en cada control.
- [ ] Los modales están centrados con `margin: auto; inset: 0` y radio 12 px.
- [ ] El contenedor del modal recorta (`overflow: hidden`) y sólo el cuerpo scrollea
      (`overflow-y: auto; flex: 1 1 auto; min-height: 0`).
- [ ] El botón de menú no aparece en escritorio (≥ 769 px).
- [ ] Contraste de texto AA comprobado.
- [ ] Probado a 360, 768, 1024 y 1440 px sin desbordes horizontales.
- [ ] `prefers-reduced-motion` desactiva las animaciones.
