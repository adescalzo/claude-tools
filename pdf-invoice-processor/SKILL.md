# Procesador de Facturas PDF

Extrae datos de facturas PDF y genera un archivo Excel con dos hojas: **Cabecera** y **Detalle**.

## Requisitos

- Node.js >= 18 instalado en el equipo
- Primera vez: ejecutar `npm install` en la carpeta raíz del skill (`pdf-invoice-processor/`)

## Modo procesamiento

**Cuándo activar:** el usuario menciona procesar facturas o da una ruta de carpeta con PDFs.

### Pasos

1. Si el usuario no dio la ruta, preguntar: *"¿Cuál es la carpeta con las facturas a procesar?"*
2. Ejecutar:
   ```
   node scripts/extract-text.js --input "<ruta>"
   ```
3. Leer el JSON de stdout. Para cada entrada en `files[]`:
   - Si tiene `error`: marcar como fallida, continuar con la siguiente
   - Si tiene `text`: extraer campos con el prompt de extracción (ver abajo)
4. Construir el array `records[]` con los campos extraídos
5. Escribir `<done_folder>/extracted.json` con la estructura definida al final de este archivo
6. Ejecutar:
   ```
   node scripts/build-excel.js --data "<done_folder>/extracted.json"
   ```
7. Reportar al usuario: cuántas facturas se procesaron, cuántas fallaron, ruta del Excel generado

### Prompt de extracción (aplicar a cada `files[].text`)

Analizar el siguiente texto de factura y extraer los campos en JSON con esta estructura exacta:

```json
{
  "numero_factura": "número o código del comprobante",
  "fecha": "DD/MM/YYYY",
  "moneda": "ARS o USD o EUR etc",
  "emisor": {
    "nombre": "razón social del emisor",
    "cuit": "número de CUIT del emisor",
    "direccion": "domicilio fiscal del emisor"
  },
  "receptor": {
    "nombre": "razón social del receptor",
    "cuit": "número de CUIT del receptor"
  },
  "totales": {
    "bruto": "monto neto sin impuestos",
    "impuestos": "total de impuestos y percepciones",
    "iva": "monto del IVA",
    "total": "total a pagar"
  },
  "items": [
    {
      "tipo": "item o footer",
      "descripcion": "texto de la línea",
      "cantidad": "número o null",
      "precio_unitario": "número o null",
      "subtotal": "número"
    }
  ],
  "error": null
}
```

**Reglas de extracción:**
- `tipo: "item"` → línea de producto o servicio
- `tipo: "footer"` → fila de resumen: subtotal, IVA, percepción, retención, total, etc.
- `cantidad` y `precio_unitario` son `null` en filas `footer`
- Si no se puede extraer un campo: `null`
- Si no hay ítems detallados: `"items": []`
- Todos los montos como string numérico sin símbolo de moneda

---

## Modo ayuda

**Cuándo activar:** el usuario pregunta cómo usar el skill, qué templates hay, cómo configurar.

| Pregunta | Acción |
|---|---|
| "¿cómo se usa?" | Explicar: dar ruta → extracción → análisis → Excel en carpeta `done-*` |
| "¿qué templates hay?" | Ejecutar `node scripts/list-templates.js` y mostrar el resultado |
| "¿cómo cambio el template?" | Explicar que se edita `config/excel-config.json`, campo `active_template` |
| "usar template X" | Actualizar `config/excel-config.json` con `{ "active_template": "X" }` y confirmar |

---

## Estructura del extracted.json

Escribir este archivo en `<done_folder>/extracted.json` antes de llamar a `build-excel.js`:

```json
{
  "done_folder": "<ruta absoluta al done_folder devuelto por extract-text.js>",
  "template": "<nombre del template activo según config/excel-config.json>",
  "records": [ ]
}
```

Cada objeto en `records[]` sigue la estructura del prompt de extracción arriba.
