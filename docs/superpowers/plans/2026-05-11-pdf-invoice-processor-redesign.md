# PDF Invoice Processor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the pdf-invoice-processor skill so Node.js scripts handle only I/O (PDF extraction and Excel generation) while Claude Cowork performs the LLM analysis — eliminating the Anthropic SDK dependency entirely.

**Architecture:** `extract-text.js` reads PDFs and outputs raw text JSON to stdout. Claude analyzes that text and writes `extracted.json` with structured cabecera + items. `build-excel.js` reads `extracted.json` and writes a two-sheet Excel (Cabecera + Detalle).

**Tech Stack:** Node.js >= 18, pdf2json@3.1.1, exceljs@4.4.0, node:test (built-in test runner), ES modules.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Delete | `scripts/process-invoices.js` | Old monolithic script — replaced entirely |
| Create | `scripts/extract-text.js` | PDF → stdout JSON with raw text per file |
| Create | `scripts/build-excel.js` | extracted.json → two-sheet Excel |
| Create | `scripts/list-templates.js` | List available templates with descriptions |
| Modify | `scripts/package.json` | Remove @anthropic-ai/sdk, add type:module, add test script |
| Create | `config/excel-config.json` | Active template name |
| Create | `config/templates/default.json` | Full AR invoice columns |
| Create | `config/templates/simple.json` | Minimal columns — cabecera only style |
| Create | `config/templates/contabilidad.json` | Extended columns with payment terms |
| Create | `tests/fixtures/extracted.json` | Test fixture for build-excel tests |
| Create | `tests/build-excel.test.js` | Tests for build-excel.js |
| Create | `tests/list-templates.test.js` | Tests for list-templates.js |
| Rewrite | `SKILL.md` | Claude Cowork orchestration + help mode |

---

## Task 1: package.json, config, and templates

**Files:**
- Modify: `pdf-invoice-processor/scripts/package.json`
- Create: `pdf-invoice-processor/config/excel-config.json`
- Create: `pdf-invoice-processor/config/templates/default.json`
- Create: `pdf-invoice-processor/config/templates/simple.json`
- Create: `pdf-invoice-processor/config/templates/contabilidad.json`

- [ ] **Step 1: Update package.json**

Replace the full contents of `pdf-invoice-processor/scripts/package.json`:

```json
{
  "name": "pdf-invoice-processor",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  },
  "dependencies": {
    "pdf2json": "3.1.1",
    "exceljs": "4.4.0"
  }
}
```

- [ ] **Step 2: Create config/excel-config.json**

Create `pdf-invoice-processor/config/excel-config.json`:

```json
{ "active_template": "default" }
```

- [ ] **Step 3: Create config/templates/default.json**

Create `pdf-invoice-processor/config/templates/default.json`:

```json
{
  "description": "Facturas argentinas — cabecera completa + detalle de ítems",
  "cabecera": [
    { "key": "numero_factura",    "header": "N° Factura",       "width": 20 },
    { "key": "fecha",             "header": "Fecha",            "width": 12 },
    { "key": "emisor.nombre",     "header": "Emisor",           "width": 25 },
    { "key": "emisor.cuit",       "header": "CUIT Emisor",      "width": 16 },
    { "key": "emisor.direccion",  "header": "Dirección Emisor", "width": 30 },
    { "key": "receptor.nombre",   "header": "Receptor",         "width": 25 },
    { "key": "receptor.cuit",     "header": "CUIT Receptor",    "width": 16 },
    { "key": "totales.bruto",     "header": "Bruto",            "width": 12 },
    { "key": "totales.impuestos", "header": "Impuestos",        "width": 12 },
    { "key": "totales.iva",       "header": "IVA",              "width": 12 },
    { "key": "totales.total",     "header": "Total",            "width": 12 },
    { "key": "moneda",            "header": "Moneda",           "width": 8  }
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

- [ ] **Step 4: Create config/templates/simple.json**

Create `pdf-invoice-processor/config/templates/simple.json`:

```json
{
  "description": "Solo datos esenciales — fecha, emisor y total",
  "cabecera": [
    { "key": "numero_factura",  "header": "N° Factura", "width": 20 },
    { "key": "fecha",           "header": "Fecha",      "width": 12 },
    { "key": "emisor.nombre",   "header": "Emisor",     "width": 25 },
    { "key": "totales.total",   "header": "Total",      "width": 12 },
    { "key": "moneda",          "header": "Moneda",     "width": 8  }
  ],
  "detalle": [
    { "key": "numero_factura", "header": "N° Factura",  "width": 20 },
    { "key": "tipo",           "header": "Tipo",        "width": 8  },
    { "key": "descripcion",    "header": "Descripción", "width": 35 },
    { "key": "subtotal",       "header": "Subtotal",    "width": 12 }
  ]
}
```

- [ ] **Step 5: Create config/templates/contabilidad.json**

Create `pdf-invoice-processor/config/templates/contabilidad.json`:

```json
{
  "description": "Campos extendidos para libro diario — incluye condición de pago",
  "cabecera": [
    { "key": "numero_factura",    "header": "N° Factura",       "width": 20 },
    { "key": "fecha",             "header": "Fecha",            "width": 12 },
    { "key": "emisor.nombre",     "header": "Emisor",           "width": 25 },
    { "key": "emisor.cuit",       "header": "CUIT Emisor",      "width": 16 },
    { "key": "emisor.direccion",  "header": "Dirección Emisor", "width": 30 },
    { "key": "receptor.nombre",   "header": "Receptor",         "width": 25 },
    { "key": "receptor.cuit",     "header": "CUIT Receptor",    "width": 16 },
    { "key": "totales.bruto",     "header": "Neto",             "width": 12 },
    { "key": "totales.iva",       "header": "IVA",              "width": 12 },
    { "key": "totales.impuestos", "header": "Otros Impuestos",  "width": 14 },
    { "key": "totales.total",     "header": "Total",            "width": 12 },
    { "key": "moneda",            "header": "Moneda",           "width": 8  }
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

- [ ] **Step 6: Install dependencies**

```bash
cd pdf-invoice-processor/scripts
npm install
```

Expected: `node_modules/` created with pdf2json and exceljs only.

- [ ] **Step 7: Commit**

```bash
git add pdf-invoice-processor/scripts/package.json \
        pdf-invoice-processor/config/ 
git commit -m "feat(pdf-invoice-processor): add config, templates, update package.json"
```

---

## Task 2: list-templates.js

**Files:**
- Create: `pdf-invoice-processor/scripts/list-templates.js`
- Create: `pdf-invoice-processor/tests/list-templates.test.js`

- [ ] **Step 1: Write the failing test**

Create `pdf-invoice-processor/tests/list-templates.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const scriptsDir = join(__dirname, '..', 'scripts')

test('list-templates imprime nombre y descripcion de cada template', () => {
  const output = execSync('node list-templates.js', { cwd: scriptsDir }).toString()
  assert.match(output, /default:/)
  assert.match(output, /simple:/)
  assert.match(output, /contabilidad:/)
})

test('cada linea tiene formato nombre: descripcion', () => {
  const output = execSync('node list-templates.js', { cwd: scriptsDir }).toString()
  const lines = output.trim().split('\n')
  for (const line of lines) {
    assert.match(line, /^\w+: .+/, `Línea mal formateada: ${line}`)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd pdf-invoice-processor/scripts
node --test tests/list-templates.test.js
```

Expected: FAIL — `Cannot find module './list-templates.js'` or similar.

- [ ] **Step 3: Implement list-templates.js**

Create `pdf-invoice-processor/scripts/list-templates.js`:

```js
import { readdir, readFile } from 'node:fs/promises'
import { join, basename, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const templatesDir = join(__dirname, '..', 'config', 'templates')
  const files = (await readdir(templatesDir)).filter(f => extname(f) === '.json')

  for (const file of files) {
    const name = basename(file, '.json')
    const content = JSON.parse(await readFile(join(templatesDir, file), 'utf8'))
    console.log(`${name}: ${content.description}`)
  }
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd pdf-invoice-processor/scripts
node --test tests/list-templates.test.js
```

Expected: `✔ list-templates imprime nombre y descripcion de cada template` and `✔ cada linea tiene formato nombre: descripcion`.

- [ ] **Step 5: Commit**

```bash
git add pdf-invoice-processor/scripts/list-templates.js \
        pdf-invoice-processor/tests/list-templates.test.js
git commit -m "feat(pdf-invoice-processor): add list-templates.js"
```

---

## Task 3: build-excel.js

**Files:**
- Create: `pdf-invoice-processor/scripts/build-excel.js`
- Create: `pdf-invoice-processor/tests/fixtures/extracted.json`
- Create: `pdf-invoice-processor/tests/build-excel.test.js`

- [ ] **Step 1: Create test fixture**

Create `pdf-invoice-processor/tests/fixtures/extracted.json`:

```json
{
  "done_folder": "__PLACEHOLDER__",
  "template": "default",
  "records": [
    {
      "numero_factura": "0001-00000001",
      "fecha": "10/05/2026",
      "moneda": "ARS",
      "emisor": {
        "nombre": "Proveedor Test S.A.",
        "cuit": "30-11111111-1",
        "direccion": "Calle Falsa 123"
      },
      "receptor": {
        "nombre": "Cliente Test S.R.L.",
        "cuit": "30-22222222-2"
      },
      "totales": {
        "bruto": "1000.00",
        "impuestos": "0.00",
        "iva": "210.00",
        "total": "1210.00"
      },
      "items": [
        {
          "tipo": "item",
          "descripcion": "Servicio de prueba",
          "cantidad": "1",
          "precio_unitario": "1000.00",
          "subtotal": "1000.00"
        },
        {
          "tipo": "footer",
          "descripcion": "IVA 21%",
          "cantidad": null,
          "precio_unitario": null,
          "subtotal": "210.00"
        },
        {
          "tipo": "footer",
          "descripcion": "Total",
          "cantidad": null,
          "precio_unitario": null,
          "subtotal": "1210.00"
        }
      ],
      "error": null
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

Create `pdf-invoice-processor/tests/build-excel.test.js`:

```js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const scriptsDir = join(__dirname, '..', 'scripts')
const fixturesDir = join(__dirname, 'fixtures')

let tmpDir
let dataPath

before(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'pdf-invoice-test-'))

  const fixture = JSON.parse(await readFile(join(fixturesDir, 'extracted.json'), 'utf8'))
  fixture.done_folder = tmpDir
  dataPath = join(tmpDir, 'extracted.json')
  await writeFile(dataPath, JSON.stringify(fixture))
})

after(async () => {
  await rm(tmpDir, { recursive: true })
})

test('genera facturas.xlsx en done_folder', () => {
  execSync(`node build-excel.js --data "${dataPath}"`, { cwd: scriptsDir })
  const { existsSync } = await import('node:fs')
  assert.ok(existsSync(join(tmpDir, 'facturas.xlsx')))
})

test('hoja Cabecera tiene una fila de datos', async () => {
  execSync(`node build-excel.js --data "${dataPath}"`, { cwd: scriptsDir })
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(join(tmpDir, 'facturas.xlsx'))
  const sheet = wb.getWorksheet('Cabecera')
  assert.ok(sheet, 'Hoja Cabecera no existe')
  assert.equal(sheet.rowCount, 2) // 1 header + 1 data row
})

test('hoja Detalle tiene tres filas de datos (1 item + 2 footer)', async () => {
  execSync(`node build-excel.js --data "${dataPath}"`, { cwd: scriptsDir })
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(join(tmpDir, 'facturas.xlsx'))
  const sheet = wb.getWorksheet('Detalle')
  assert.ok(sheet, 'Hoja Detalle no existe')
  assert.equal(sheet.rowCount, 4) // 1 header + 3 item rows
})

test('cabecera contiene numero_factura correcto', async () => {
  execSync(`node build-excel.js --data "${dataPath}"`, { cwd: scriptsDir })
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(join(tmpDir, 'facturas.xlsx'))
  const sheet = wb.getWorksheet('Cabecera')
  const row = sheet.getRow(2)
  const headers = sheet.getRow(1).values
  const nfIdx = headers.indexOf('N° Factura')
  assert.equal(row.getCell(nfIdx).value, '0001-00000001')
})

test('detalle contiene numero_factura como clave relacional', async () => {
  execSync(`node build-excel.js --data "${dataPath}"`, { cwd: scriptsDir })
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(join(tmpDir, 'facturas.xlsx'))
  const sheet = wb.getWorksheet('Detalle')
  const headers = sheet.getRow(1).values
  const nfIdx = headers.indexOf('N° Factura')
  const dataRow = sheet.getRow(2)
  assert.equal(dataRow.getCell(nfIdx).value, '0001-00000001')
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd pdf-invoice-processor/scripts
node --test tests/build-excel.test.js
```

Expected: FAIL — `Cannot find module './build-excel.js'` or similar.

- [ ] **Step 4: Implement build-excel.js**

Create `pdf-invoice-processor/scripts/build-excel.js`:

```js
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function getNestedValue(obj, key) {
  return key.split('.').reduce((o, k) => o?.[k] ?? null, obj)
}

async function loadTemplate(name) {
  const path = join(__dirname, '..', 'config', 'templates', `${name}.json`)
  return JSON.parse(await readFile(path, 'utf8'))
}

async function getActiveTemplate() {
  const path = join(__dirname, '..', 'config', 'excel-config.json')
  return JSON.parse(await readFile(path, 'utf8')).active_template
}

function addSheet(workbook, name, columns) {
  const sheet = workbook.addWorksheet(name)
  sheet.columns = columns.map(col => ({ header: col.header, key: col.key, width: col.width }))
  sheet.getRow(1).font = { bold: true }
  const lastCol = String.fromCharCode(64 + columns.length)
  sheet.autoFilter = { from: 'A1', to: `${lastCol}1` }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  return sheet
}

async function main() {
  const { values } = parseArgs({
    options: {
      data:     { type: 'string' },
      template: { type: 'string' }
    }
  })

  if (!values.data) {
    console.error('Error: --data requerido')
    process.exit(1)
  }

  const extracted = JSON.parse(await readFile(values.data, 'utf8'))
  const templateName = values.template ?? extracted.template ?? await getActiveTemplate()
  const template = await loadTemplate(templateName)

  const workbook = new ExcelJS.Workbook()
  const cabeceraSheet = addSheet(workbook, 'Cabecera', template.cabecera)
  const detalleSheet  = addSheet(workbook, 'Detalle',  template.detalle)

  for (const record of extracted.records) {
    // Cabecera row
    const cabeceraRow = {}
    for (const col of template.cabecera) {
      cabeceraRow[col.key] = getNestedValue(record, col.key) ?? ''
    }
    cabeceraSheet.addRow(cabeceraRow)

    // Detalle rows
    for (const item of record.items ?? []) {
      const detalleRow = {}
      for (const col of template.detalle) {
        if (col.key === 'numero_factura') {
          detalleRow[col.key] = record.numero_factura ?? ''
        } else {
          detalleRow[col.key] = item[col.key] ?? ''
        }
      }
      detalleSheet.addRow(detalleRow)
    }
  }

  const outputPath = join(extracted.done_folder, 'facturas.xlsx')
  await workbook.xlsx.writeFile(outputPath)
  console.log(`Excel generado: ${outputPath}`)
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd pdf-invoice-processor/scripts
node --test tests/build-excel.test.js
```

Expected: all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add pdf-invoice-processor/scripts/build-excel.js \
        pdf-invoice-processor/tests/
git commit -m "feat(pdf-invoice-processor): add build-excel.js with two-sheet Excel output"
```

---

## Task 4: extract-text.js

**Files:**
- Create: `pdf-invoice-processor/scripts/extract-text.js`

> No automated tests — requires real PDF files on disk. Manual verification step included.

- [ ] **Step 1: Implement extract-text.js**

Create `pdf-invoice-processor/scripts/extract-text.js`:

```js
import { readdir, mkdir, rename } from 'node:fs/promises'
import { join, extname, dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import PDFParser from 'pdf2json'

const MAX_TEXT_CHARS = 4000

function extractTextFromPDF(pdfPath) {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, 1) // 1 = suppress fake worker warning
    parser.on('pdfParser_dataReady', data => {
      const text = data.Pages
        .flatMap(page => page.Texts)
        .map(t => decodeURIComponent(t.R.map(r => r.T).join('')))
        .join('\n')
        .slice(0, MAX_TEXT_CHARS)
      resolve({ text, pages: data.Pages.length })
    })
    parser.on('pdfParser_dataError', err => reject(new Error(err.parserError ?? String(err))))
    parser.loadPDF(pdfPath)
  })
}

function buildTimestamp(date) {
  const pad = n => String(n).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join('-')
}

async function main() {
  const { values } = parseArgs({
    options: { input: { type: 'string' } }
  })

  if (!values.input) {
    console.error('Error: --input requerido')
    process.exit(1)
  }

  const inputDir = values.input
  const doneFolder = join(inputDir, `done-${buildTimestamp(new Date())}`)
  await mkdir(doneFolder, { recursive: true })

  const pdfFiles = (await readdir(inputDir))
    .filter(f => extname(f).toLowerCase() === '.pdf')

  const files = []

  for (const filename of pdfFiles) {
    const srcPath = join(inputDir, filename)
    const destPath = join(doneFolder, filename)
    try {
      const { text, pages } = await extractTextFromPDF(srcPath)
      await rename(srcPath, destPath)
      files.push({ filename, pages, text })
    } catch (err) {
      try { await rename(srcPath, destPath) } catch {}
      files.push({ filename, pages: 0, text: '', error: err.message })
    }
  }

  process.stdout.write(JSON.stringify({ done_folder: doneFolder, files }, null, 2) + '\n')
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
```

- [ ] **Step 2: Manual smoke test**

Put one real PDF in a temp folder (e.g., `C:\test\factura.pdf` on Windows or `/tmp/test/factura.pdf` on Linux) and run:

```bash
cd pdf-invoice-processor/scripts
node extract-text.js --input /tmp/test
```

Expected output:
```json
{
  "done_folder": "/tmp/test/done-2026-05-11-14-30",
  "files": [
    {
      "filename": "factura.pdf",
      "pages": 2,
      "text": "..."
    }
  ]
}
```

Verify:
- PDF was moved to `done-*` folder
- `text` field contains readable invoice content
- No `error` field on success

- [ ] **Step 3: Commit**

```bash
git add pdf-invoice-processor/scripts/extract-text.js
git commit -m "feat(pdf-invoice-processor): add extract-text.js"
```

---

## Task 5: SKILL.md

**Files:**
- Rewrite: `pdf-invoice-processor/SKILL.md`

- [ ] **Step 1: Rewrite SKILL.md**

Replace the full contents of `pdf-invoice-processor/SKILL.md`:

```markdown
# Procesador de Facturas PDF

Extrae datos de facturas PDF y genera un archivo Excel con dos hojas: **Cabecera** y **Detalle**.

## Requisitos

- Node.js >= 18 instalado en el equipo
- Primera vez: ejecutar `npm install` en la carpeta `scripts/` del skill

## Modo procesamiento

**Cuándo activar:** el usuario menciona procesar facturas o da una ruta de carpeta con PDFs.

### Pasos

1. Si el usuario no dio la ruta, preguntar: *"¿Cuál es la carpeta con las facturas a procesar?"*
2. Ejecutar:
   ```
   node extract-text.js --input "<ruta>"
   ```
3. Leer el JSON de stdout. Para cada entrada en `files[]`:
   - Si tiene `error`: marcar como fallida, continuar con la siguiente
   - Si tiene `text`: extraer campos con el prompt de extracción (ver abajo)
4. Construir el array `records[]` con los campos extraídos
5. Escribir `<done_folder>/extracted.json` con la estructura definida al final de este archivo
6. Ejecutar:
   ```
   node build-excel.js --data "<done_folder>/extracted.json"
   ```
7. Reportar al usuario: cuántas facturas se procesaron, cuántas fallaron, ruta del Excel generado

### Prompt de extracción (aplicar a cada `files[].text`)

Analizar el siguiente texto de factura y extraer los campos en JSON con esta estructura exacta:

```json
{
  "numero_factura": "número o código del comprobante",
  "fecha": "DD/MM/YYYY",
  "moneda": "ARS o USD o EUR etc",
  "emisor": {
    "nombre": "razón social del emisor",
    "cuit": "número de CUIT del emisor",
    "direccion": "domicilio fiscal del emisor"
  },
  "receptor": {
    "nombre": "razón social del receptor",
    "cuit": "número de CUIT del receptor"
  },
  "totales": {
    "bruto": "monto neto sin impuestos",
    "impuestos": "total de impuestos y percepciones",
    "iva": "monto del IVA",
    "total": "total a pagar"
  },
  "items": [
    {
      "tipo": "item o footer",
      "descripcion": "texto de la línea",
      "cantidad": "número o null",
      "precio_unitario": "número o null",
      "subtotal": "número"
    }
  ],
  "error": null
}
```

**Reglas de extracción:**
- `tipo: "item"` → línea de producto o servicio
- `tipo: "footer"` → fila de resumen: subtotal, IVA, percepción, retención, total, etc.
- `cantidad` y `precio_unitario` son `null` en filas `footer`
- Si no se puede extraer un campo: `null`
- Si no hay ítems detallados: `"items": []`
- Todos los montos como string numérico sin símbolo de moneda

---

## Modo ayuda

**Cuándo activar:** el usuario pregunta cómo usar el skill, qué templates hay, cómo configurar.

| Pregunta | Acción |
|---|---|
| "¿cómo se usa?" | Explicar: dar ruta → extracción → análisis → Excel en carpeta `done-*` |
| "¿qué templates hay?" | Ejecutar `node list-templates.js` y mostrar el resultado |
| "¿cómo cambio el template?" | Explicar que se edita `config/excel-config.json`, campo `active_template` |
| "usar template X" | Actualizar `config/excel-config.json` con `{ "active_template": "X" }` y confirmar |

---

## Estructura del extracted.json

Escribir este archivo en `<done_folder>/extracted.json` antes de llamar a `build-excel.js`:

```json
{
  "done_folder": "<ruta absoluta al done_folder devuelto por extract-text.js>",
  "template": "<nombre del template activo según config/excel-config.json>",
  "records": [ /* array de objetos con la estructura del prompt de extracción */ ]
}
```
```

- [ ] **Step 2: Commit**

```bash
git add pdf-invoice-processor/SKILL.md
git commit -m "feat(pdf-invoice-processor): rewrite SKILL.md for Cowork orchestration"
```

---

## Task 6: Cleanup

**Files:**
- Delete: `pdf-invoice-processor/scripts/process-invoices.js`
- Modify: `CLAUDE.md` (update packaging command and architecture description)

- [ ] **Step 1: Delete old script**

```bash
git rm pdf-invoice-processor/scripts/process-invoices.js
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```bash
cd pdf-invoice-processor/scripts
node --test tests/
```

Expected: all tests pass.

- [ ] **Step 3: Update CLAUDE.md packaging command**

In `CLAUDE.md`, update the packaging section to reflect that `process-invoices.js` no longer exists and the new scripts are `extract-text.js`, `build-excel.js`, and `list-templates.js`. The packaging command stays the same (zip the directory).

- [ ] **Step 4: Final commit**

```bash
git add CLAUDE.md
git commit -m "chore(pdf-invoice-processor): remove legacy process-invoices.js, update CLAUDE.md"
```
