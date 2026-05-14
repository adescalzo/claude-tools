import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
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
  const headers = sheet.getRow(1).values
  const nfIdx = headers.indexOf('N° Factura')
  const row = sheet.getRow(2)
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
