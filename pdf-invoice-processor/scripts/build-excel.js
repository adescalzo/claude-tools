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
    const cabeceraRow = {}
    for (const col of template.cabecera) {
      cabeceraRow[col.key] = getNestedValue(record, col.key) ?? ''
    }
    cabeceraSheet.addRow(cabeceraRow)

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
