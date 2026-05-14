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
