# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A collection of Claude Cowork skills:

- `pdf-invoice-processor` — extracts structured data from PDF invoices, writes Excel (Cabecera + Detalle sheets)
- `bank-statement-processor` — extracts structured data from bank statement PDFs, writes one Excel per statement (Cabecera + one sheet per account)

## PDF Invoice Processor

### Architecture

```
extract-text.js (pdf2json) → Claude Cowork analyzes text → build-excel.js (exceljs)
```

- `extract-text.js`: Reads PDFs with `pdf2json`, outputs raw text JSON to stdout. Creates `done-YYYY-MM-DD-HH-mm/` inside the input folder and moves PDFs there.
- Claude Cowork (the user's session): Analyzes the raw text, extracts structured fields, writes `extracted.json` to the done folder.
- `build-excel.js`: Reads `extracted.json`, applies a JSON template, writes two-sheet Excel (`Cabecera` + `Detalle`) to the done folder.
- `list-templates.js`: Lists available templates with descriptions.
- No API key required — Claude Cowork IS the LLM runtime.

### Key files

- `pdf-invoice-processor/scripts/extract-text.js` — PDF → stdout JSON with raw text
- `pdf-invoice-processor/scripts/build-excel.js` — extracted.json → two-sheet Excel
- `pdf-invoice-processor/scripts/list-templates.js` — list available templates
- `pdf-invoice-processor/package.json` — deps: `pdf2json@3.1.1`, `exceljs@4.4.0`
- `pdf-invoice-processor/config/templates/` — JSON column definitions per template
- `pdf-invoice-processor/config/excel-config.json` — active template name
- `pdf-invoice-processor/SKILL.md` — instructions loaded by Claude Cowork
- `pdf-invoice-processor/references/task-scheduler.md` — Windows Task Scheduler integration guide

### Setup and run

```bash
cd pdf-invoice-processor
npm install

# List available templates
node scripts/list-templates.js

# Extract text from PDFs (stdout = JSON, done folder created automatically)
node scripts/extract-text.js --input ./pendientes

# Build Excel from extracted.json (Claude writes this file between the two scripts)
node scripts/build-excel.js --data ./pendientes/done-2026-05-11-14-30/extracted.json

# Build Excel with a specific template
node scripts/build-excel.js --data ./done-folder/extracted.json --template simple
```

No external API keys required.

### Data flow

1. `extract-text.js --input <folder>` → creates `done-*/`, moves PDFs, prints JSON to stdout
2. Claude reads stdout, analyzes each PDF's text, writes `done-*/extracted.json`
3. `build-excel.js --data done-*/extracted.json` → writes `done-*/facturas.xlsx`

### Excel output structure

**Cabecera sheet** (one row per invoice): `numero_factura`, `fecha`, `emisor`, `CUIT Emisor`, `Dirección Emisor`, `receptor`, `CUIT Receptor`, `bruto`, `impuestos`, `iva`, `total`, `moneda`

**Detalle sheet** (one row per item/footer): `numero_factura` (relational key), `tipo` (`item` or `footer`), `descripcion`, `cantidad`, `precio_unitario`, `subtotal`

### Known limitations / pending work

- **Scanned PDFs**: `pdf2json` returns empty text for image-only PDFs. Fallback via Claude vision or `tesseract.js` not yet implemented.
- **`--dry-run` flag**: Not yet implemented.
- **Duplicate detection**: No MD5 check to prevent processing the same PDF twice.

## Packaging a skill

To update the `.skill` file after editing:

```bash
# Linux/Mac
cd pdf-invoice-processor
zip -r ../pdf-invoice-processor.skill . --exclude "node_modules/*"

# Windows PowerShell
Compress-Archive -Path pdf-invoice-processor\* -DestinationPath pdf-invoice-processor.skill
```
