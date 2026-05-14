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
