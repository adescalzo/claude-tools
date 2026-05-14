# bank-statement-processor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Cowork skill that extracts structured data from bank statement PDFs and outputs an Excel file with a Cabecera sheet (one row per statement) and one sheet per account/product.

**Architecture:** Mirror of `pdf-invoice-processor`. `extract-text.js` uses pdf2json to emit full text to stdout → Claude analyzes in-session (no API key) → `build-excel.js` reads `extracted.json` and writes the Excel. The skill asks the user at runtime whether to generate one sheet per account or a unified Movimientos sheet.

**Tech Stack:** Node.js >= 18 (ESM), pdf2json 3.1.1, exceljs 4.4.0

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `bank-statement-processor/package.json` | deps + ESM config |
| Create | `bank-statement-processor/scripts/extract-text.js` | PDF → stdout JSON (no char limit) |
| Create | `bank-statement-processor/scripts/build-excel.js` | extracted.json → Excel |
| Create | `bank-statement-processor/scripts/list-info.js` | print usage/version info |
| Create | `bank-statement-processor/config/excel-config.json` | static config |
| Create | `bank-statement-processor/SKILL.md` | Claude Cowork skill instructions |
| Modify | `pdf-invoice-processor/SKILL.md` | add privacy notice |

---

### Task 1: Scaffold package.json

**Files:**
- Create: `bank-statement-processor/package.json`

- [ ] **Step 1: Create directory and package.json**

```bash
mkdir -p bank-statement-processor/scripts bank-statement-processor/config
```

```json
{
  "name": "bank-statement-processor",
  "version": "1.0.0",
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

Save to `bank-statement-processor/package.json`.

- [ ] **Step 2: Install dependencies**

```bash
cd bank-statement-processor
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Commit**

```bash
git add bank-statement-processor/package.json bank-statement-processor/package-lock.json
git commit -m "feat(bank-statement-processor): scaffold package.json"
```

---

### Task 2: extract-text.js

**Files:**
- Create: `bank-statement-processor/scripts/extract-text.js`

Nearly identical to `pdf-invoice-processor/scripts/extract-text.js` but **without character truncation** — emits full text regardless of length.

- [ ] **Step 1: Create the file**

```javascript
import { readdir, mkdir, rename } from 'node:fs/promises'
import { join, extname, dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import PDFParser from 'pdf2json'

function extractTextFromPDF(pdfPath) {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, 1)
    parser.on('pdfParser_dataReady', data => {
      const text = data.Pages
        .flatMap(page => page.Texts)
        .map(t => decodeURIComponent(t.R.map(r => r.T).join('')))
        .join('\n')
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
      files.push({ filename, pages, charCount: text.length, text })
    } catch (err) {
      try { await rename(srcPath, destPath) } catch {}
      files.push({ filename, pages: 0, charCount: 0, text: '', error: err.message })
    }
  }

  process.stdout.write(JSON.stringify({ done_folder: doneFolder, files }, null, 2) + '\n')
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
```

Save to `bank-statement-processor/scripts/extract-text.js`.

- [ ] **Step 2: Smoke test**

```bash
cd bank-statement-processor
node scripts/extract-text.js --input ../data-tools/bank-statement
```

Expected: JSON printed to stdout with `done_folder`, `files[]` each having `filename`, `pages`, `charCount`, `text`. PDFs moved to `done-*` folder. No errors.

- [ ] **Step 3: Commit**

```bash
git add bank-statement-processor/scripts/extract-text.js
git commit -m "feat(bank-statement-processor): add extract-text.js (no char limit)"
```

---

### Task 3: config/excel-config.json

**Files:**
- Create: `bank-statement-processor/config/excel-config.json`

- [ ] **Step 1: Create file**

```json
{ "version": "1.0" }
```

Save to `bank-statement-processor/config/excel-config.json`.

- [ ] **Step 2: Commit**

```bash
git add bank-statement-processor/config/excel-config.json
git commit -m "feat(bank-statement-processor): add excel-config.json"
```

---

### Task 4: build-excel.js

**Files:**
- Create: `bank-statement-processor/scripts/build-excel.js`

This is the most different file from the invoice processor. It reads `statements[]` from `extracted.json` and builds:
- 1 `Cabecera` sheet (1 row per statement)
- Per statement: either one sheet per account (if `modo_hojas === "por_cuenta"`) or one unified `Movimientos` sheet (if `modo_hojas === "unificado"`)

Excel sheet name limit is 31 chars. Account IDs get truncated + deduplicated if needed.

- [ ] **Step 1: Create the file**

```javascript
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import ExcelJS from 'exceljs'

function safeSheetName(name, used = new Set()) {
  let base = name.replace(/[:\\/?*\[\]]/g, '-').slice(0, 31)
  let candidate = base
  let i = 2
  while (used.has(candidate)) {
    const suffix = `-${i++}`
    candidate = base.slice(0, 31 - suffix.length) + suffix
  }
  used.add(candidate)
  return candidate
}

function addSheet(workbook, name, columns, usedNames) {
  const sheet = workbook.addWorksheet(safeSheetName(name, usedNames))
  sheet.columns = columns.map(col => ({ header: col.header, key: col.key, width: col.width }))
  sheet.getRow(1).font = { bold: true }
  const lastCol = String.fromCharCode(64 + columns.length)
  sheet.autoFilter = { from: 'A1', to: `${lastCol}1` }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  return sheet
}

const CABECERA_COLS = [
  { key: 'archivo',        header: 'Archivo',         width: 30 },
  { key: 'banco',          header: 'Banco',            width: 16 },
  { key: 'cliente',        header: 'Cliente',          width: 28 },
  { key: 'cuil',           header: 'CUIL',             width: 16 },
  { key: 'periodo_desde',  header: 'Período Desde',    width: 14 },
  { key: 'periodo_hasta',  header: 'Período Hasta',    width: 14 },
  { key: 'cuentas',        header: 'Cuentas',          width: 40 },
]

const MOVIMIENTO_COLS = [
  { key: 'fecha',     header: 'Fecha',     width: 12 },
  { key: 'origen',    header: 'Origen',    width: 10 },
  { key: 'concepto',  header: 'Concepto',  width: 40 },
  { key: 'debito',    header: 'Débito',    width: 14 },
  { key: 'credito',   header: 'Crédito',   width: 14 },
  { key: 'saldo',     header: 'Saldo',     width: 14 },
  { key: 'descripcion', header: 'Descripción', width: 35 },
]

const MOVIMIENTO_COLS_UNIFICADO = [
  { key: 'cuenta',    header: 'Cuenta',    width: 22 },
  ...MOVIMIENTO_COLS,
]

async function main() {
  const { values } = parseArgs({
    options: { data: { type: 'string' } }
  })

  if (!values.data) {
    console.error('Error: --data requerido')
    process.exit(1)
  }

  const extracted = JSON.parse(await readFile(values.data, 'utf8'))
  const workbook = new ExcelJS.Workbook()
  const usedNames = new Set()

  const cabeceraSheet = addSheet(workbook, 'Cabecera', CABECERA_COLS, usedNames)

  for (const stmt of extracted.statements) {
    if (stmt.error) continue

    const cuentasStr = (stmt.cuentas ?? []).map(c => c.id).join(', ')

    cabeceraSheet.addRow({
      archivo:       stmt.archivo ?? '',
      banco:         stmt.banco ?? '',
      cliente:       stmt.cliente?.nombre ?? '',
      cuil:          stmt.cliente?.cuil ?? '',
      periodo_desde: stmt.periodo?.desde ?? '',
      periodo_hasta: stmt.periodo?.hasta ?? '',
      cuentas:       cuentasStr,
    })

    const modoHojas = stmt.modo_hojas ?? 'por_cuenta'

    if (modoHojas === 'unificado') {
      const sheet = addSheet(workbook, `Mov-${stmt.banco ?? 'extracto'}`, MOVIMIENTO_COLS_UNIFICADO, usedNames)
      for (const cuenta of stmt.cuentas ?? []) {
        for (const mov of cuenta.movimientos ?? []) {
          sheet.addRow({
            cuenta:      cuenta.id ?? '',
            fecha:       mov.fecha ?? '',
            origen:      mov.origen ?? '',
            concepto:    mov.concepto ?? '',
            debito:      mov.debito ?? '',
            credito:     mov.credito ?? '',
            saldo:       mov.saldo ?? '',
            descripcion: mov.descripcion ?? '',
          })
        }
      }
    } else {
      for (const cuenta of stmt.cuentas ?? []) {
        const sheet = addSheet(workbook, cuenta.id ?? 'Cuenta', MOVIMIENTO_COLS, usedNames)
        for (const mov of cuenta.movimientos ?? []) {
          sheet.addRow({
            fecha:       mov.fecha ?? '',
            origen:      mov.origen ?? '',
            concepto:    mov.concepto ?? '',
            debito:      mov.debito ?? '',
            credito:     mov.credito ?? '',
            saldo:       mov.saldo ?? '',
            descripcion: mov.descripcion ?? '',
          })
        }
      }
    }
  }

  const outputPath = join(extracted.done_folder, 'extracto.xlsx')
  await workbook.xlsx.writeFile(outputPath)
  console.log(`Excel generado: ${outputPath}`)
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
```

Save to `bank-statement-processor/scripts/build-excel.js`.

- [ ] **Step 2: Create a minimal test extracted.json to verify output**

Create `bank-statement-processor/test-extracted.json` (temporary, not committed):

```json
{
  "done_folder": "/tmp",
  "statements": [
    {
      "archivo": "Resumen.pdf",
      "banco": "BBVA",
      "cliente": { "nombre": "DESCALZO ANDRES", "cuil": "20-24856480-7", "direccion": "" },
      "periodo": { "desde": "01/04/2026", "hasta": "30/04/2026" },
      "modo_hojas": "por_cuenta",
      "cuentas": [
        {
          "id": "CC-108-004884",
          "tipo": "Cuenta Corriente",
          "moneda": "ARS",
          "saldo_anterior": 7.20,
          "saldo_final": 1.17,
          "movimientos": [
            { "fecha": "23/04/2026", "origen": "D 733", "concepto": "PAGO CON VISA DEBITO", "debito": 27138.40, "credito": null, "saldo": -27131.20, "descripcion": null }
          ]
        },
        {
          "id": "CA-EUR-026-001286",
          "tipo": "Caja de Ahorros EUR",
          "moneda": "EUR",
          "saldo_anterior": 0,
          "saldo_final": 0,
          "movimientos": []
        }
      ],
      "error": null
    }
  ]
}
```

- [ ] **Step 3: Run build-excel.js against test file**

```bash
cd bank-statement-processor
node scripts/build-excel.js --data test-extracted.json
```

Expected: `Excel generado: /tmp/extracto.xlsx`. Open file and verify: Cabecera sheet has 1 row (BBVA, DESCALZO ANDRES, etc.), sheet `CC-108-004884` has 1 movement row, sheet `CA-EUR-026-001286` has header only (no movements).

- [ ] **Step 4: Clean up test file**

```bash
rm bank-statement-processor/test-extracted.json
```

- [ ] **Step 5: Commit**

```bash
git add bank-statement-processor/scripts/build-excel.js
git commit -m "feat(bank-statement-processor): add build-excel.js"
```

---

### Task 5: list-info.js

**Files:**
- Create: `bank-statement-processor/scripts/list-info.js`

Prints usage info for the user (analogous to `list-templates.js` in invoice processor).

- [ ] **Step 1: Create file**

```javascript
console.log(`bank-statement-processor v1.0

Scripts:
  node scripts/extract-text.js --input <carpeta>
    Lee todos los PDFs de la carpeta, emite JSON a stdout, mueve PDFs a done-*/

  node scripts/build-excel.js --data <done-folder>/extracted.json
    Lee extracted.json generado por Claude y escribe extracto.xlsx en el mismo done-folder

Flujo completo:
  1. node scripts/extract-text.js --input ./pendientes
  2. Claude analiza el texto y escribe done-*/extracted.json
  3. node scripts/build-excel.js --data ./pendientes/done-*/extracted.json
`)
```

Save to `bank-statement-processor/scripts/list-info.js`.

- [ ] **Step 2: Verify**

```bash
cd bank-statement-processor
node scripts/list-info.js
```

Expected: usage text printed.

- [ ] **Step 3: Commit**

```bash
git add bank-statement-processor/scripts/list-info.js
git commit -m "feat(bank-statement-processor): add list-info.js"
```

---

### Task 6: SKILL.md

**Files:**
- Create: `bank-statement-processor/SKILL.md`

This is the most critical file — it's the runtime instructions loaded by Claude Cowork.

- [ ] **Step 1: Create SKILL.md**

```markdown
# Procesador de Extractos Bancarios

⚠️ **Aviso de privacidad:** Los PDFs se procesan localmente con pdf2json. El texto se analiza en esta sesión de Claude Code y no se almacena en servidores externos. Verificá que estés usando Claude Code CLI o una sesión sin retención de datos activada.

Extrae datos de extractos bancarios en PDF y genera un archivo Excel con hoja **Cabecera** y una hoja por cuenta/producto.

## Requisitos

- Node.js >= 18 instalado en el equipo
- Primera vez: ejecutar `npm install` en la carpeta `bank-statement-processor/`

## Modo procesamiento

**Cuándo activar:** el usuario menciona procesar extractos bancarios o da una ruta de carpeta con PDFs.

### Pasos

1. Si el usuario no dio la ruta, preguntar: *"¿Cuál es la carpeta con los extractos a procesar?"*
2. Ejecutar:
   ```
   node scripts/extract-text.js --input "<ruta>"
   ```
3. Leer el JSON de stdout. Para cada entrada en `files[]`:
   - Si tiene `error`: marcar como fallida, informar al usuario, continuar con la siguiente
   - Si `text` está vacío o tiene menos de 100 chars: marcar como PDF escaneado (sin texto extraíble), informar al usuario, continuar
   - Si `charCount` > 12000: avisar al usuario *"El extracto [archivo] supera el límite de una consulta (~12000 chars). Se procesará en partes."* Dividir el texto en secciones lógicas (por encabezado de cuenta/sección) y analizar en múltiples pasos antes de continuar.
4. Para cada PDF con texto, extraer campos con el prompt de extracción (ver abajo)
5. Si el PDF tiene más de una cuenta o sección: preguntar al usuario:
   *"Este extracto tiene [N] cuentas/secciones: [lista]. ¿Querés una solapa por cuenta o todos los movimientos en una sola hoja?"*
   - Respuesta "por cuenta" o equivalente → `"modo_hojas": "por_cuenta"`
   - Respuesta "todo junto" o equivalente → `"modo_hojas": "unificado"`
   - Si el PDF tiene una sola cuenta: usar `"por_cuenta"` sin preguntar
6. Construir el array `statements[]` con los datos extraídos
7. Escribir `<done_folder>/extracted.json` con la estructura definida al final de este archivo
8. Ejecutar:
   ```
   node scripts/build-excel.js --data "<done_folder>/extracted.json"
   ```
9. Reportar al usuario: cuántos extractos se procesaron, cuántos fallaron, ruta del Excel generado

---

### Prompt de extracción

⚠️ **PRIVACIDAD:** Este texto contiene información financiera y personal sensible (nombres, CUIL, movimientos bancarios). Procesar exclusivamente para extraer los campos indicados. No retener, resumir ni referenciar estos datos fuera de esta tarea.

Analizar el siguiente texto de extracto bancario y extraer los campos en JSON con esta estructura exacta:

```json
{
  "archivo": "nombre del archivo PDF",
  "banco": "nombre del banco detectado (BBVA, Banco Ciudad, Santander, etc.)",
  "cliente": {
    "nombre": "nombre completo del titular",
    "cuil": "CUIL o CUIT del titular",
    "direccion": "domicilio del titular o null"
  },
  "periodo": {
    "desde": "DD/MM/YYYY — fecha de inicio del período o primera fecha de movimiento",
    "hasta": "DD/MM/YYYY — fecha de cierre del período o última fecha de movimiento"
  },
  "modo_hojas": "por_cuenta o unificado — completar según respuesta del usuario",
  "cuentas": [
    {
      "id": "identificador corto de la cuenta, ej: CC-108-004884 o CA-EUR-026-001286 o VISA-00156987095",
      "tipo": "tipo de cuenta/producto: Cuenta Corriente, Caja de Ahorros, Tarjeta de Crédito, Tarjeta de Débito, etc.",
      "moneda": "ARS, USD, EUR, etc.",
      "saldo_anterior": 0.00,
      "saldo_final": 0.00,
      "movimientos": [
        {
          "fecha": "DD/MM/YYYY",
          "origen": "código de origen si existe (D 733, 100, etc.) o null",
          "concepto": "descripción corta del movimiento",
          "debito": 0.00,
          "credito": null,
          "saldo": 0.00,
          "descripcion": "texto adicional de descripción si existe, o null"
        }
      ]
    }
  ],
  "error": null
}
```

**Reglas de extracción:**
- `banco`: detectar del encabezado/logo/membrete del documento
- `periodo.desde` y `periodo.hasta`: tomar del documento si están explícitos (ej: "SALDO AL 30 DE ABRIL" → `hasta: 30/04/YYYY`). Si no están, usar primera y última fecha de movimientos.
- `saldo_anterior` y `saldo_final`: tomar del documento. Si no están disponibles: `null`
- `debito` y `credito`: números sin símbolo de moneda. El que no aplica va como `null`
- `saldo`: número con signo según corresponda
- `origen`: campo de código de operación si existe (ej: "D 733", "100"). `null` si no existe
- Si el banco no se puede determinar: `"banco": "DESCONOCIDO"`
- Si no se puede extraer un campo: `null`
- Todos los montos como número (float), no como string

**Tipos de cuentas en extractos BBVA:**
- `CC $` → Cuenta Corriente, moneda ARS
- `CA Eur` → Caja de Ahorros, moneda EUR
- `CA U$S` → Caja de Ahorros, moneda USD
- `Visa Electron` / `Tarjeta de Débito` → Tarjeta de Débito
- `VISA` / `ARGEN/MASTER` en sección tarjetas de crédito → Tarjeta de Crédito

**Para extractos con texto > 12000 chars:** procesar por secciones. Primero extraer cabecera del cliente + lista de cuentas/productos. Luego procesar movimientos de cada cuenta por separado. Consolidar en un único objeto JSON antes de escribir el archivo.

---

## Modo ayuda

**Cuándo activar:** el usuario pregunta cómo usar el skill o pide información.

| Pregunta | Acción |
|---|---|
| "¿cómo se usa?" | Explicar: dar ruta → extracción → análisis → Excel en carpeta `done-*` |
| "¿qué scripts hay?" | Ejecutar `node scripts/list-info.js` y mostrar el resultado |

---

## Estructura del extracted.json

Escribir este archivo en `<done_folder>/extracted.json` antes de llamar a `build-excel.js`:

```json
{
  "done_folder": "<ruta absoluta al done_folder devuelto por extract-text.js>",
  "statements": []
}
```

Cada objeto en `statements[]` sigue la estructura del prompt de extracción. Los PDFs con error llevan `"error": "mensaje"` y el resto de campos en `null`.
```

Save to `bank-statement-processor/SKILL.md`.

- [ ] **Step 2: Commit**

```bash
git add bank-statement-processor/SKILL.md
git commit -m "feat(bank-statement-processor): add SKILL.md with extraction prompt and privacy notices"
```

---

### Task 7: Add privacy notice to pdf-invoice-processor/SKILL.md

**Files:**
- Modify: `pdf-invoice-processor/SKILL.md`

- [ ] **Step 1: Read current SKILL.md**

Read `pdf-invoice-processor/SKILL.md` (already known — 105 lines).

- [ ] **Step 2: Add privacy notice at top, after the title line**

Insert after line 1 (`# Procesador de Facturas PDF`):

```markdown

⚠️ **Aviso de privacidad:** Los PDFs se procesan localmente con pdf2json. El texto se analiza en esta sesión de Claude Code y no se almacena en servidores externos. Verificá que estés usando Claude Code CLI o una sesión sin retención de datos activada.
```

Also add the extraction-time privacy instruction before the extraction prompt (after `### Prompt de extracción`):

```markdown

⚠️ **PRIVACIDAD:** Este texto contiene información de facturas que puede incluir datos fiscales y comerciales sensibles. Procesar exclusivamente para extraer los campos indicados. No retener, resumir ni referenciar estos datos fuera de esta tarea.
```

- [ ] **Step 3: Verify the file looks correct**

Read the file back and confirm both notices appear in the right places.

- [ ] **Step 4: Commit**

```bash
git add pdf-invoice-processor/SKILL.md
git commit -m "feat(pdf-invoice-processor): add privacy notices to SKILL.md"
```

---

### Task 8: End-to-end smoke test with real PDFs

**Files:** None created — verification only.

- [ ] **Step 1: Run extract-text.js on the sample bank statements**

```bash
cd bank-statement-processor
node scripts/extract-text.js --input ../data-tools/bank-statement 2>/dev/null | head -50
```

Expected: JSON output with `done_folder` path and 2 entries in `files[]`, each with `charCount` > 0 and `text` containing recognizable bank statement content. No `error` field on either entry.

- [ ] **Step 2: Confirm charCount for BBVA**

Check the `charCount` value for `Resumen.pdf`. Expected: > 4000 (previously truncated). This confirms the no-limit extraction works.

- [ ] **Step 3: Create minimal extracted.json and build Excel**

Manually create a `done-*/extracted.json` matching the spec structure with at least 2 cuentas for the BBVA statement, then run:

```bash
node scripts/build-excel.js --data <done_folder>/extracted.json
```

Expected: `extracto.xlsx` created. Open and verify: Cabecera row present, separate sheets for each account.

- [ ] **Step 4: Test unificado mode**

Edit the `extracted.json` to set `"modo_hojas": "unificado"` and run `build-excel.js` again. Expected: single `Mov-BBVA` sheet with all movements and a `cuenta` column.

- [ ] **Step 5: Commit any cleanup**

```bash
git add -A
git commit -m "chore(bank-statement-processor): smoke test cleanup"
```

---

### Task 9: Package the skill

- [ ] **Step 1: Create .skill zip (excluding node_modules)**

```bash
cd bank-statement-processor
zip -r ../bank-statement-processor.skill . --exclude "node_modules/*" --exclude "*.zip"
```

Expected: `bank-statement-processor.skill` created in `claude-tools/`.

- [ ] **Step 2: Verify zip contents**

```bash
unzip -l ../bank-statement-processor.skill
```

Expected: `SKILL.md`, `package.json`, `scripts/extract-text.js`, `scripts/build-excel.js`, `scripts/list-info.js`, `config/excel-config.json`. No `node_modules`.

- [ ] **Step 3: Commit**

```bash
git add ../bank-statement-processor.skill
git commit -m "feat(bank-statement-processor): package skill zip"
```
