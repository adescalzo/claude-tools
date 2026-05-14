# Procesador de Extractos Bancarios

⚠️ **Aviso de privacidad:** Los PDFs se procesan localmente con pdf2json. El texto se analiza en esta sesión de Claude Code y no se almacena en servidores externos. Verificá que estés usando Claude Code CLI o una sesión sin retención de datos activada.

Extrae datos de extractos bancarios en PDF y genera un archivo Excel con hoja **Cabecera** y una hoja por cuenta/producto.

## Requisitos

- Node.js >= 18 instalado en el equipo
- Primera vez: ejecutar `npm install` en la carpeta `bank-statement-processor/`

## Modo procesamiento

**Cuándo activar:** el usuario menciona procesar extractos bancarios o da una ruta de carpeta con PDFs.

### Pasos

1. Si el usuario no dio la ruta, preguntar: *"¿Cuál es la carpeta con los extractos a procesar?"*
2. Ejecutar:
   ```
   node scripts/extract-text.js --input "<ruta>"
   ```
3. Leer el JSON de stdout. Para cada entrada en `files[]`:
   - Si tiene `error`: marcar como fallida, informar al usuario, continuar con la siguiente
   - Si `text` está vacío o tiene menos de 100 chars: marcar como PDF escaneado (sin texto extraíble), informar al usuario, continuar
   - Si `charCount` > 12000: avisar al usuario *"El extracto [archivo] supera el límite de una consulta (~12000 chars). Se procesará en partes."* Dividir el texto en secciones lógicas (por encabezado de cuenta/sección) y analizar en múltiples pasos antes de continuar.
4. Para cada PDF con texto, extraer campos con el prompt de extracción (ver abajo)
5. Si el PDF tiene más de una cuenta o sección: preguntar al usuario:
   *"Este extracto tiene [N] cuentas/secciones: [lista]. ¿Querés una solapa por cuenta o todos los movimientos en una sola hoja?"*
   - Respuesta "por cuenta" o equivalente → `"modo_hojas": "por_cuenta"`
   - Respuesta "todo junto" o equivalente → `"modo_hojas": "unificado"`
   - Si el PDF tiene una sola cuenta: usar `"por_cuenta"` sin preguntar
6. Para cada PDF procesado, escribir `<done_folder>/extracted.json` con la estructura definida al final de este archivo (un archivo por PDF, un solo statement por archivo)
7. Para cada `extracted.json` generado, ejecutar:
   ```
   node scripts/build-excel.js --data "<done_folder>/extracted.json"
   ```
8. Reportar al usuario: cuántos extractos se procesaron, cuántos fallaron, rutas de los Excel generados

---

### Prompt de extracción

⚠️ **PRIVACIDAD:** Este texto contiene información financiera y personal sensible (nombres, CUIL, movimientos bancarios). Procesar exclusivamente para extraer los campos indicados. No retener, resumir ni referenciar estos datos fuera de esta tarea.

Analizar el siguiente texto de extracto bancario y extraer los campos en JSON con esta estructura exacta:

```json
{
  "archivo": "nombre del archivo PDF",
  "banco": "nombre del banco detectado (BBVA, Banco Ciudad, Santander, etc.)",
  "cliente": {
    "nombre": "nombre completo del titular",
    "cuil": "CUIL o CUIT del titular",
    "direccion": "domicilio del titular o null"
  },
  "periodo": {
    "desde": "DD/MM/YYYY — fecha de inicio del período o primera fecha de movimiento",
    "hasta": "DD/MM/YYYY — fecha de cierre del período o última fecha de movimiento"
  },
  "modo_hojas": "por_cuenta o unificado — completar según respuesta del usuario",
  "cuentas": [
    {
      "id": "identificador corto de la cuenta, ej: CC-108-004884 o CA-EUR-026-001286 o VISA-00156987095",
      "tipo": "tipo de cuenta/producto: Cuenta Corriente, Caja de Ahorros, Tarjeta de Crédito, Tarjeta de Débito, etc.",
      "moneda": "ARS, USD, EUR, etc.",
      "saldo_anterior": 0.00,
      "saldo_final": 0.00,
      "movimientos": [
        {
          "fecha": "DD/MM/YYYY",
          "origen": "código de origen si existe (D 733, 100, etc.) o null",
          "concepto": "descripción corta del movimiento",
          "debito": 0.00,
          "credito": null,
          "saldo": 0.00,
          "descripcion": "texto adicional de descripción si existe, o null"
        }
      ]
    }
  ],
  "error": null
}
```

**Reglas de extracción:**
- `banco`: detectar del encabezado/logo/membrete del documento
- `periodo.desde` y `periodo.hasta`: tomar del documento si están explícitos (ej: "SALDO AL 30 DE ABRIL" → `hasta: 30/04/YYYY`). Si no están, usar primera y última fecha de movimientos.
- `saldo_anterior` y `saldo_final`: tomar del documento. Si no están disponibles: `null`
- `debito` y `credito`: números sin símbolo de moneda. El que no aplica va como `null`
- `saldo`: número con signo según corresponda
- `origen`: campo de código de operación si existe (ej: "D 733", "100"). `null` si no existe
- Si el banco no se puede determinar: `"banco": "DESCONOCIDO"`
- Si no se puede extraer un campo: `null`
- Todos los montos como número (float), no como string

**Tipos de cuentas en extractos BBVA:**
- `CC $` → Cuenta Corriente, moneda ARS
- `CA Eur` → Caja de Ahorros, moneda EUR
- `CA U$S` → Caja de Ahorros, moneda USD
- `Visa Electron` / `Tarjeta de Débito` → Tarjeta de Débito
- `VISA` / `ARGEN/MASTER` en sección tarjetas de crédito → Tarjeta de Crédito

**Para extractos con texto > 12000 chars:** procesar por secciones. Primero extraer cabecera del cliente + lista de cuentas/productos. Luego procesar movimientos de cada cuenta por separado. Consolidar en un único objeto JSON antes de escribir el archivo.

---

## Modo ayuda

**Cuándo activar:** el usuario pregunta cómo usar el skill o pide información.

| Pregunta | Acción |
|---|---|
| "¿cómo se usa?" | Explicar: dar ruta → extracción → análisis → Excel en carpeta `done-*` |
| "¿qué scripts hay?" | Ejecutar `node scripts/list-info.js` y mostrar el resultado |

---

## Estructura del extracted.json

Escribir un archivo `extracted.json` por PDF en su `done_folder` correspondiente (tomado de `files[].done_folder` en el output de `extract-text.js`):

```json
{
  "done_folder": "<ruta absoluta del done_folder de este PDF>",
  "statements": [
    { ... }
  ]
}
```

`statements[]` contiene un único objeto con la estructura del prompt de extracción. El campo `done_folder` del statement puede omitirse (ya está en la raíz del JSON). Los PDFs con error llevan `"error": "mensaje"` y el resto de campos en `null`.
