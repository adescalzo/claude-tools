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
