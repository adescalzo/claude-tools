import { readdir, mkdir, rename } from 'node:fs/promises'
import { join, extname, basename } from 'node:path'
import { parseArgs } from 'node:util'
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

async function main() {
  const { values } = parseArgs({
    options: { input: { type: 'string' } }
  })

  if (!values.input) {
    console.error('Error: --input requerido')
    process.exit(1)
  }

  const inputDir = values.input
  const pdfFiles = (await readdir(inputDir))
    .filter(f => extname(f).toLowerCase() === '.pdf')

  const files = []

  for (const filename of pdfFiles) {
    const name = basename(filename, extname(filename))
    const doneFolder = join(inputDir, name)
    await mkdir(doneFolder, { recursive: true })

    const srcPath = join(inputDir, filename)
    const destPath = join(doneFolder, filename)
    try {
      const { text, pages } = await extractTextFromPDF(srcPath)
      await rename(srcPath, destPath)
      files.push({ filename, done_folder: doneFolder, pages, charCount: text.length, text })
    } catch (err) {
      try { await rename(srcPath, destPath) } catch {}
      files.push({ filename, done_folder: doneFolder, pages: 0, charCount: 0, text: '', error: err.message })
    }
  }

  process.stdout.write(JSON.stringify({ input_folder: inputDir, files }, null, 2) + '\n')
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
