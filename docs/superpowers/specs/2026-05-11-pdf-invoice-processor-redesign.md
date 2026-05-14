# Procesador de Facturas PDF — Especificación de Rediseño

**Fecha:** 2026-05-11  
**Estado:** Aprobado

---

## Contexto

El skill existente (`pdf-invoice-processor`) funciona pero tiene problemas arquitecturales:
- Llama a la API de Anthropic directamente desde Node.js (requiere `ANTHROPIC_API_KEY`, agrega capa de costo)
- Script monolítico — difícil de extender o reconfigurar
- Sin sistema de templates para la salida Excel
- Sin modo de ayuda / auto-documentación
- Sin extracción de ítems/líneas de detalle

Esta especificación cubre el rediseño para funcionar correctamente como skill de Claude Cowork.

---

## Arquitectura

Claude Cowork ES el runtime del LLM. Los scripts son herramientas que Claude llama — no llaman a la API por sí mismos.

```
Usuario: "procesar facturas de C:\Facturas\Pendientes"
    │
    ▼
Claude (Cowork)
    ├─ node extract-text.js --input <ruta>
    │       └─ PDF → texto crudo → stdout JSON
    │
    ├─ Claude analiza texto → extrae cabecera + ítems estructurados
    │       └─ escribe done_folder/extracted.json
    │
    └─ node build-excel.js --data <extracted.json> --template <nombre>
            └─ JSON → Excel (2 hojas) en done_folder
```

Sin `@anthropic-ai/sdk`. Sin `ANTHROPIC_API_KEY`.

---

## Estructura de archivos

```
pdf-invoice-processor/
├── SKILL.md
├── scripts/
│   ├── extract-text.js       ← PDF → JSON con texto crudo
│   ├── build-excel.js        ← extracted.json → Excel (2 hojas)
│   ├── list-templates.js     ← lista templates disponibles
│   └── package.json          ← solo pdf2json + exceljs
├── config/
│   ├── excel-config.json     ← template activo (nombre)
│   └── templates/
│       ├── default.json      ← facturas argentinas estándar
│       ├── simple.json       ← solo cabecera, sin detalle
│       └── contabilidad.json ← campos extendidos
└── references/
    └── task-scheduler.md
```

---

## Comportamiento del sistema de archivos

La carpeta de entrada es la única ruta requerida. Todo lo demás se genera dentro de ella.

```
C:\Facturas\Pendientes\
├── factura-001.pdf              ← antes de procesar
├── factura-002.pdf
└── done-2026-05-11-14-30/      ← creada al iniciar
    ├── factura-001.pdf          ← movidos después de extraer
    ├── factura-002.pdf
    ├── extracted.json           ← escrito por Claude
    └── facturas.xlsx            ← escrito por build-excel.js (2 hojas)
```

Nombre de carpeta: `done-YYYY-MM-DD-HH-mm` (timestamp de inicio del procesamiento).

---

## Contratos de scripts

### `extract-text.js`

```
node extract-text.js --input <ruta>
```

- Lee todos los `.pdf` de `<ruta>`
- Extrae texto con `pdf2json` (suprime el warning "fake worker")
- Crea `done-<timestamp>` dentro de `<ruta>`
- Mueve cada PDF a `done_folder`
- Escribe a **stdout**:

```json
{
  "done_folder": "C:\\Facturas\\Pendientes\\done-2026-05-11-14-30",
  "files": [
    {
      "filename": "factura-001.pdf",
      "pages": 2,
      "text": "FACTURA B N° 0001-00012345\nProveedor: ABC S.A.\n..."
    }
  ]
}
```

- Texto truncado a 4000 caracteres por PDF (ajustable en el script)
- Si un PDF falla: incluye `"error": "descripción"` en lugar de `"text"`

### `build-excel.js`

```
node build-excel.js --data <ruta/extracted.json> --template <nombre>
```

- Lee `extracted.json`
- Carga `config/templates/<nombre>.json`
- Escribe `facturas.xlsx` en `done_folder` con dos hojas: `Cabecera` y `Detalle`
- Si `--template` se omite: lee `config/excel-config.json` para el nombre activo

### `list-templates.js`

```
node list-templates.js
```

- Lee `config/templates/`
- Imprime nombre y descripción de cada template (campo `description` del JSON)

---

## Formato de datos: `extracted.json`

Escrito por Claude entre los dos scripts:

```json
{
  "done_folder": "C:\\Facturas\\Pendientes\\done-2026-05-11-14-30",
  "template": "default",
  "records": [
    {
      "numero_factura": "0001-00012345",
      "fecha": "10/05/2026",
      "moneda": "ARS",
      "emisor": {
        "nombre": "ABC S.A.",
        "cuit": "30-12345678-9",
        "direccion": "Av. Corrientes 1234, CABA"
      },
      "receptor": {
        "nombre": "XYZ S.R.L.",
        "cuit": "30-98765432-1"
      },
      "totales": {
        "bruto": "12396.69",
        "impuestos": "2603.31",
        "iva": "2603.31",
        "total": "15000.00"
      },
      "items": [
        {
          "tipo": "item",
          "descripcion": "Servicio de consultoría",
          "cantidad": "10",
          "precio_unitario": "1200.00",
          "subtotal": "12000.00"
        },
        {
          "tipo": "item",
          "descripcion": "Viáticos",
          "cantidad": null,
          "precio_unitario": null,
          "subtotal": "396.69"
        },
        {
          "tipo": "footer",
          "descripcion": "Subtotal",
          "cantidad": null,
          "precio_unitario": null,
          "subtotal": "12396.69"
        },
        {
          "tipo": "footer",
          "descripcion": "IVA 21%",
          "cantidad": null,
          "precio_unitario": null,
          "subtotal": "2603.31"
        },
        {
          "tipo": "footer",
          "descripcion": "Total",
          "cantidad": null,
          "precio_unitario": null,
          "subtotal": "15000.00"
        }
      ],
      "error": null
    }
  ]
}
```

**Reglas de `items`:**
- `tipo: "item"` — línea de producto o servicio de la factura
- `tipo: "footer"` — fila de resumen: subtotal, impuesto, percepción, retención, total, etc.
- `cantidad` y `precio_unitario` son `null` en filas `footer`
- Si la factura no tiene ítems detallados: `items: []`
- Si un PDF falló: `"error": "descripción"`, resto de campos `null`

**`descripcion`:**
- Para `item`: nombre del producto/servicio tal como figura en la factura
- Para `footer`: etiqueta del concepto ("IVA 21%", "Percepción IIBB", "Retención", "Total", etc.)

---

## Estructura del Excel — 2 hojas

### Hoja `Cabecera`

Una fila por factura:

| N° Factura | Fecha | Emisor | CUIT Emisor | Dirección Emisor | Receptor | CUIT Receptor | Bruto | Impuestos | IVA | Total | Moneda |
|---|---|---|---|---|---|---|---|---|---|---|---|

### Hoja `Detalle`

Una fila por ítem (tanto `item` como `footer`):

| N° Factura | Tipo | Descripción | Cantidad | Precio Unit. | Subtotal |
|---|---|---|---|---|---|

`numero_factura` es la clave que relaciona ambas hojas.

---

## Formato de templates

`config/templates/default.json`:

```json
{
  "description": "Facturas argentinas — cabecera completa + detalle de ítems",
  "cabecera": [
    { "key": "numero_factura",      "header": "N° Factura",       "width": 20 },
    { "key": "fecha",               "header": "Fecha",            "width": 12 },
    { "key": "emisor.nombre",       "header": "Emisor",           "width": 25 },
    { "key": "emisor.cuit",         "header": "CUIT Emisor",      "width": 16 },
    { "key": "emisor.direccion",    "header": "Dirección Emisor", "width": 30 },
    { "key": "receptor.nombre",     "header": "Receptor",         "width": 25 },
    { "key": "receptor.cuit",       "header": "CUIT Receptor",    "width": 16 },
    { "key": "totales.bruto",       "header": "Bruto",            "width": 12 },
    { "key": "totales.impuestos",   "header": "Impuestos",        "width": 12 },
    { "key": "totales.iva",         "header": "IVA",              "width": 12 },
    { "key": "totales.total",       "header": "Total",            "width": 12 },
    { "key": "moneda",              "header": "Moneda",           "width": 8  }
  ],
  "detalle": [
    { "key": "numero_factura",  "header": "N° Factura",   "width": 20 },
    { "key": "tipo",            "header": "Tipo",         "width": 8  },
    { "key": "descripcion",     "header": "Descripción",  "width": 35 },
    { "key": "cantidad",        "header": "Cantidad",     "width": 10 },
    { "key": "precio_unitario", "header": "Precio Unit.", "width": 14 },
    { "key": "subtotal",        "header": "Subtotal",     "width": 12 }
  ]
}
```

`config/excel-config.json` (template activo):

```json
{ "active_template": "default" }
```

---

## Comportamiento del SKILL.md

### Modo procesamiento

Disparador: el usuario menciona procesar facturas o una ruta de carpeta.

1. Si no hay ruta: Claude pide la ruta
2. `node extract-text.js --input <ruta>`
3. Claude analiza cada `files[].text` → extrae cabecera + ítems → construye `records[]`
4. Claude escribe `extracted.json` en `done_folder`
5. `node build-excel.js --data <done_folder>/extracted.json`
6. Claude reporta: N procesadas, N con errores, ruta del Excel generado

### Modo ayuda

Disparador: preguntas sobre uso, configuración o templates.

| Pregunta del usuario | Acción de Claude |
|---|---|
| "¿cómo se usa?" | Explica el flujo, muestra ejemplo de invocación |
| "¿qué templates hay?" | `node list-templates.js` → lista con descripción |
| "¿cómo cambio el template?" | Explica `excel-config.json` o pregunta qué template quiere |
| "usar template X" | Actualiza `excel-config.json`, confirma el cambio |

---

## Dependencias

```json
{
  "dependencies": {
    "pdf2json": "3.1.1",
    "exceljs": "4.4.0"
  }
}
```

Node.js >= 18. Sin SDK de Anthropic.

---

## Fuera de alcance (próxima iteración)

- PDFs escaneados (solo imagen) — fallback con Claude vision o tesseract.js
- Flag `--dry-run`
- Subcarpetas por fecha dentro de `done/`
- Detección de duplicados por hash MD5
- Refinamiento de templates de salida con el usuario
