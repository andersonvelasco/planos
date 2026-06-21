# PlanoApp — Diseñador de Planos Arquitectónicos

Herramienta web interactiva para diseñar planos de construcción, calcular materiales y estimar presupuestos en COP. Orientada a propietarios de lotes, maestros de obra y contratistas en Colombia.

**Demo en vivo:** [planos.itnarino.com.co](https://planos.itnarino.com.co)

---

## Funcionalidades

### Herramientas de dibujo
| Herramienta | Atajo | Descripción |
|---|---|---|
| Seleccionar | `V` | Seleccionar y mover elementos |
| Pared | `W` | Dibujar paredes (snap automático a vértices y cuerpos de pared) |
| Puerta | `D` | Colocar puertas sobre paredes — `F` voltea la bisagra |
| Ventana | `N` | Colocar ventanas sobre paredes |
| Habitación | `R` | Etiquetar espacios con nombre y área |
| Cota | `M` | Cotas de dimensión con texto automático |
| Escalera | `S` | Dibujar cajas de escalera |
| Borrar | `E` | Eliminar cualquier elemento |

### Canvas
- Zoom con rueda del mouse · Pan con clic medio o Espacio+arrastrar
- Snap a cuadrícula (0.25m) y snap magnético a vértices y cuerpos de pared
- **Shift + dibujo**: ángulos restringidos a 0°/45°/90°/135°
- Múltiples pisos con visibilidad individual
- Vista 3D del modelo (Three.js)

### Inspector de propiedades
Al seleccionar cualquier elemento aparece un panel con sus propiedades (longitud, grosor, alto, etc.) y botón de eliminación directa.

### Cálculo automático
- **Área de habitaciones por flood-fill**: calcula el área real desde las paredes dibujadas
- **Auto-detección de espacios**: botón "Auto-detectar espacios" encuentra todos los polígonos cerrados del plano
- **Materiales**: bloques, cemento, arena, gravilla, varilla, malla electrosoldada, **dinteles automáticos** por cada vano de puerta/ventana
- **Presupuesto en COP**: materiales + mano de obra + 10% imprevistos (precios editables)
- **Diseño estructural**: columnas detectadas automáticamente, zapatas y vigas de amarre (NSR-10 referencial)

### Proyectos
- Guardar/cargar en `localStorage`
- **Autoguardado** cada 60 segundos
- **Deshacer/Rehacer** (Ctrl+Z / Ctrl+Y) — 50 pasos
- Exportar PDF (plano + materiales + presupuesto)

---

## Atajos de teclado

| Acción | Atajo |
|---|---|
| Seleccionar | `V` |
| Pared | `W` |
| Puerta | `D` |
| Voltear puerta | `F` (con herramienta puerta activa) |
| Ventana | `N` |
| Habitación | `R` |
| Cota | `M` |
| Escalera | `S` |
| Borrar | `E` |
| Cancelar / Seleccionar | `ESC` |
| Guardar | `Ctrl+S` |
| Deshacer | `Ctrl+Z` |
| Rehacer | `Ctrl+Y` |
| Eliminar selección | `Supr` |
| Zoom + / − | `+` / `-` |
| Ángulo libre → 45° | `Shift` mientras dibuja pared |
| Eliminar elemento (menú) | Clic derecho sobre elemento |

---

## Estructura del proyecto

```
Plano/
├── index.html              ← Entrada única SPA
├── css/
│   ├── main.css            ← Layout, variables, header
│   ├── toolbar.css         ← Barra de herramientas
│   ├── panel.css           ← Panel derecho
│   └── canvas.css          ← Canvas SVG y elementos
└── js/
    ├── app.js              ← Namespace PA, estado global, undo/redo
    ├── geometry.js         ← Flood-fill, detección de polígonos
    ├── canvas.js           ← SVG, zoom/pan, inspector de propiedades
    ├── floors.js           ← Render de todos los elementos SVG
    ├── calculator.js       ← Cantidades de materiales
    ├── costs.js            ← Presupuesto COP
    ├── structural.js       ← Cálculo estructural NSR-10
    ├── storage.js          ← localStorage, autoguardado
    ├── export.js           ← Exportar PDF
    ├── view3d.js           ← Vista 3D con Three.js
    └── tools/
        ├── select.js       ← Selección y movimiento por arrastre
        ├── wall.js         ← Dibujo de paredes
        ├── door.js         ← Colocación de puertas
        ├── window.js       ← Colocación de ventanas
        ├── room.js         ← Etiquetas de habitación
        ├── dimension.js    ← Cotas
        └── stairs.js       ← Escaleras
```

---

## Sistema de coordenadas

Todo el plano se trabaja en **metros** como unidad base. La escala de visualización es `1m = 60px` (zoom 1x). Los atributos SVG de tamaño (stroke-width, font-size) se expresan en metros dentro del grupo con `transform: scale(60)`.

---

## Precios de referencia (Colombia 2025)

| Material | Precio base |
|---|---|
| Bloque 15cm | $2.200 c/u |
| Cemento 50kg | $32.000 saco |
| Arena | $85.000 m³ |
| Gravilla | $95.000 m³ |
| Varilla #3 barra 6m | $28.000 |
| Varilla #4 barra 6m | $48.000 |
| Malla electrosoldada | $35.000 m² |
| Maestro de obra | $180.000 m² |
| Oficial | $120.000 m² |
| Ayudante | $80.000 m² |

Precios editables desde el panel → Materiales → "Editar precios".

---

## Tecnologías

- **HTML5 + CSS3 + JavaScript Vanilla** — sin frameworks, sin build tools
- **SVG** — dibujo vectorial, escalable y exportable
- **Three.js r128** — vista 3D
- **jsPDF 2.5.1** — exportación PDF
- **localStorage** — persistencia local de proyectos

---

## Despliegue

El proyecto es HTML estático — no requiere servidor ni backend. Se puede servir directamente desde cualquier hosting de archivos estáticos.

**Hostinger:** Conectar repositorio GitHub → rama `master` → carpeta del subdominio `planos.itnarino.com.co`.
