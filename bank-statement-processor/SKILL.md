# Procesador de Extractos Bancarios

⚠️ **Privacidad:** PDFs procesados localmente con pdf2json. Texto bancario sensible (CUIL, movimientos) → procesar solo para extraer campos indicados. No retener fuera de tarea. Usá Claude Code CLI sin retención.

Extrae datos de extractos PDF → Excel: hoja **Cabecera** + una hoja por cuenta.

## Requisitos

- Node.js >= 18
- Primera vez: `npm install` en `bank-statement-processor/`

## Modo procesamiento

**Activar cuando:** usuario menciona extractos bancarios o da ruta con PDFs.

### Flujo

1. Sin ruta → preguntar carpeta
2. Ejecutar: `node scripts/extract-text.js --input "<ruta>"`
3. stdout JSON → loop `files[]`:
   - `error` → reportar fallido, skip
   - `charCount` < 100 → escaneado sin texto, skip
   - válido → continuar paso 4
4. Por cada PDF válido, dispatch Agent con `subagent_type: general-purpose`, `model: haiku`, prompt = **Prompt de extracción** (abajo) sustituyendo `<TEXT_FILE>` y `<DONE_FOLDER>` y `<FILENAME>`. Agent lee texto, extrae, escribe `extracted.json`. Devuelve OK/error.
5. Por cada `<done_folder>/extracted.json` generado: `node scripts/build-excel.js --data "<done_folder>/extracted.json"`
6. Reportar: procesados, fallidos, rutas Excel

---

### Prompt de extracción (pasar a Agent Haiku)

```
Tarea: extraer datos de extracto bancario AR.

1. Leer texto: <TEXT_FILE>
2. Extraer campos según schema abajo
3. Escribir resultado en: <DONE_FOLDER>/extracted.json

Schema del archivo a escribir:
{
  "done_folder": "<DONE_FOLDER>",
  "statements": [{
    "archivo": "<FILENAME>",
    "banco": "BBVA|Banco Ciudad|Santander|...|DESCONOCIDO",
    "cliente": { "nombre": "", "cuil": "", "direccion": null },
    "periodo": { "desde": "DD/MM/YYYY", "hasta": "DD/MM/YYYY" },
    "modo_hojas": "por_cuenta",
    "cuentas": [{
      "id": "CC-108-004884 | CA-EUR-026-001286 | VISA-00156987095",
      "tipo": "Cuenta Corriente | Caja de Ahorros | Tarjeta de Crédito | Tarjeta de Débito",
      "moneda": "ARS|USD|EUR",
      "saldo_anterior": 0.00,
      "saldo_final": 0.00,
      "movimientos": [{
        "fecha": "DD/MM/YYYY",
        "origen": "D 733 | 100 | null",
        "concepto": "desc corta",
        "debito": 0.00,
        "credito": null,
        "saldo": 0.00,
        "descripcion": "texto extra | null"
      }]
    }],
    "error": null
  }]
}

Reglas:
- banco: del encabezado/membrete. Si no detectable → "DESCONOCIDO"
- periodo: explícito del doc; sino primera/última fecha movimiento
- saldo_anterior/saldo_final: del doc; sino null
- debito/credito: number sin símbolo; el que no aplica → null
- saldo: signed number
- origen: código op si existe; sino null
- modo_hojas: siempre "por_cuenta"
- Campos faltantes → null
- Montos: float, no string

Tipos cuenta BBVA:
- "CC $" → Cuenta Corriente ARS
- "CA Eur" → Caja Ahorros EUR
- "CA U$S" → Caja Ahorros USD
- "Visa Electron" / "Tarjeta de Débito" → Tarjeta de Débito
- "VISA" / "ARGEN/MASTER" sección tarjetas crédito → Tarjeta de Crédito

Si error: escribir { "done_folder": "...", "statements": [{ "archivo": "<FILENAME>", "error": "<msg>", ...resto null }] }

Output: solo confirmar "OK" o reportar error. No incluir el JSON en la respuesta.
```

---

## Modo ayuda

**Activar cuando:** usuario pregunta cómo usar.

| Pregunta | Acción |
|---|---|
| "¿cómo se usa?" | ruta → extracción → Haiku agent → Excel en carpeta por PDF |
| "¿qué scripts hay?" | `node scripts/list-info.js` |

---

## Estructura `extracted.json`

Escrito por el agent en `<done_folder>/extracted.json`. Un archivo por PDF, un statement por archivo.

```json
{
  "done_folder": "<ruta absoluta>",
  "statements": [{ ... }]
}
```

PDFs con error: `"error": "msg"`, resto en `null`.
