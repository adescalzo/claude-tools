# Personalización de Campos — PDF Invoice Processor

## Cómo agregar o modificar campos extraídos

Editar la sección `FIELD_PATTERNS` en `process-invoices.js`.
Cada campo acepta un array de expresiones regulares que se prueban en orden.

### Formato

```js
const FIELD_PATTERNS = {
  nombre_campo: [
    /patrón_1_más_específico/i,
    /patrón_2_más_general/i,
  ],
};
```

El primer match gana. El grupo de captura `(...)` es el valor extraído.

---

## Ejemplos de campos personalizados

### Orden de Compra
```js
orden_compra: [
  /(?:OC|Orden de Compra|Purchase Order|PO)[:\s#]*(\d{4,10})/i,
  /\bOC[- ](\d{5,})\b/,
],
```

### Período de servicio
```js
periodo: [
  /(?:período|periodo|mes)[:\s]*(\w+\s+\d{4})/i,
  /(?:from|desde)[:\s]*(\d{1,2}[\/\-]\d{4})/i,
],
```

### Centro de costo
```js
centro_costo: [
  /(?:CC|Centro de Costo|Cost Center)[:\s]*(\w{3,10})/i,
],
```

### Número de remito
```js
remito: [
  /(?:remito|rem\.|R-)[:\s#]*([A-Z0-9]{1,4}-?\d{4,10})/i,
],
```

---

## Agregar la columna al Excel

Después de agregar el patrón, también actualizar el array `HEADERS` en
la función `writeExcel()`:

```js
const HEADERS = [
  // ... columnas existentes ...
  { key: 'orden_compra', header: 'Orden de Compra', width: 18 },
];
```

Y asegurarse que el objeto `base` en `processPdf()` incluya el campo:

```js
const base = {
  // ... campos existentes ...
  orden_compra: '',
};

// Y luego en la sección de extracción:
base.orden_compra = extractField(text, FIELD_PATTERNS.orden_compra);
```

---

## Testing de patrones

Para testear un patrón nuevo sin correr todo el pipeline:

```js
// test-pattern.js (crear en la misma carpeta)
const text = `
  Factura N° 0001-00012345
  Orden de Compra: OC-98765
  Total: $12.500,00
`;

const pattern = /(?:OC|Orden de Compra)[:\s#-]*(\d{4,10})/i;
console.log(text.match(pattern)?.[1]); // → "98765"
```

```bat
node test-pattern.js
```

---

## Facturas con múltiples proveedores o formatos

Si los PDFs provienen de distintos proveedores con formatos muy diferentes,
se puede implementar detección de proveedor primero y luego aplicar patrones
específicos:

```js
function detectProvider(text) {
  if (/Telecom Argentina/i.test(text))  return 'telecom';
  if (/Edenor|Edesur/i.test(text))      return 'electricidad';
  if (/YPF/i.test(text))                return 'combustible';
  return 'generico';
}

const PROVIDER_PATTERNS = {
  telecom:      { numero_factura: /FC[- ](\d{12})/i },
  electricidad: { numero_factura: /N[°º] (\d{10})/i },
  generico:     FIELD_PATTERNS,
};
```
