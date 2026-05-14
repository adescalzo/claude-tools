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
