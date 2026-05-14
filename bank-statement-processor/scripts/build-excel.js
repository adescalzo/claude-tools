import { readFile } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
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
  { key: 'fecha',       header: 'Fecha',        width: 12 },
  { key: 'origen',      header: 'Origen',       width: 10 },
  { key: 'concepto',    header: 'Concepto',     width: 40 },
  { key: 'debito',      header: 'Débito',       width: 14 },
  { key: 'credito',     header: 'Crédito',      width: 14 },
  { key: 'saldo',       header: 'Saldo',        width: 14 },
  { key: 'descripcion', header: 'Descripción',  width: 35 },
]

const MOVIMIENTO_COLS_UNIFICADO = [
  { key: 'cuenta', header: 'Cuenta', width: 22 },
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

  for (const stmt of extracted.statements) {
    if (stmt.error) continue

    const workbook = new ExcelJS.Workbook()
    const usedNames = new Set()
    const cabeceraSheet = addSheet(workbook, 'Cabecera', CABECERA_COLS, usedNames)

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

    const name = stmt.archivo ? basename(stmt.archivo, extname(stmt.archivo)) : 'extracto'
    const outputPath = join(stmt.done_folder, `${name}.xlsx`)
    await workbook.xlsx.writeFile(outputPath)
    console.log(`Excel generado: ${outputPath}`)
  }
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
