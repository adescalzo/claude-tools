# bank-statement-processor — Diseño

**Fecha:** 2026-05-12
**Estado:** Aprobado

## Contexto

Nuevo skill para procesar extractos bancarios en PDF y generar Excel estructurado. Sigue el mismo patrón de arquitectura y uso que `pdf-invoice-processor`. No requiere API key externa — Claude Code actúa como runtime de análisis.

Bancos de referencia analizados: BBVA (extracto consolidado multi-cuenta, 5 páginas) y Banco Ciudad (extracto cuenta sueldo, 1 página).

## Nombre y ubicación

```
bank-statement-processor/
  scripts/
    extract-text.js
    build-excel.js
    list-info.js
  config/
    excel-config.json
  SKILL.md
  package.json
```

Instalación y modo de uso idénticos a `pdf-invoice-processor`.

## Arquitectura

```
extract-text.js (pdf2json) → Claude analiza texto → build-excel.js (exceljs)
```

1. `extract-text.js --input <ruta>` — lee PDFs con pdf2json, emite JSON a stdout con texto completo (sin truncar), mueve PDFs a `done-YYYY-MM-DD-HH-mm/`
2. Claude analiza cada PDF: detecta banco, extrae cliente, identifica secciones/cuentas, pregunta al usuario si quiere solapas separadas o unificadas
3. Claude escribe `done-*/extracted.json`
4. `build-excel.js --data done-*/extracted.json` → Excel en `done-*/`

### Diferencias respecto a invoice processor

| Aspecto | invoice-processor | bank-statement-processor |
|---|---|---|
| Límite texto | 4000 chars (trunca) | Sin límite — múltiples consultas si es necesario |
| Hojas Excel | Cabecera + Detalle (fijas) | Cabecera + 1 hoja por cuenta |
| Templates | JSON configurables | 1 template fijo |
| JSON intermedio | `records[]` | `statements[]` |

## Manejo de texto largo

Si el texto de un PDF supera ~12000 chars, Claude:
1. Avisa: *"El extracto supera el límite de una consulta. Se procesará en N partes."*
2. Analiza en partes (cabecera + cuentas por tramos)
3. Consolida en un único `extracted.json` antes de llamar a `build-excel.js`

No se trunca nunca.

## Estructura extracted.json

```json
{
  "done_folder": "/ruta/done-2026-05-12-14-30",
  "statements": [
    {
      "archivo": "Resumen.pdf",
      "banco": "BBVA",
      "cliente": {
        "nombre": "DESCALZO ANDRES",
        "cuil": "20-24856480-7",
        "direccion": "AV SANTA FE 5046 PISO 9 DTO C"
      },
      "periodo": {
        "desde": "01/04/2026",
        "hasta": "30/04/2026"
      },
      "modo_hojas": "por_cuenta",
      "cuentas": [
        {
          "id": "CC-108-004884",
          "tipo": "Cuenta Corriente",
          "moneda": "ARS",
          "saldo_anterior": 7.20,
          "saldo_final": 1.17,
          "movimientos": [
            {
              "fecha": "23/04/2026",
              "origen": "D 733",
              "concepto": "PAGO CON VISA DEBITO 91256291 OP2615",
              "debito": 27138.40,
              "credito": null,
              "saldo": -27131.20,
              "descripcion": null
            }
          ]
        }
      ],
      "error": null
    }
  ]
}
```

## Excel output

### Hoja `Cabecera`
1 fila por extracto procesado.

| Columna | Fuente |
|---|---|
| Banco | detectado del PDF |
| Cliente | nombre del titular |
| CUIL | del encabezado del PDF |
| Período Desde | del PDF o primera fecha de movimiento |
| Período Hasta | del PDF o última fecha de movimiento |
| Cuentas | lista separada por coma de IDs de cuenta |

### Hoja por cuenta (ej: `CC-108-004884`)
Nombre de hoja = tipo abreviado + número de cuenta.

| Columna | Tipo |
|---|---|
| Fecha | string DD/MM/YYYY |
| Origen | código de origen (D 733, 100, etc.) |
| Concepto | descripción corta del movimiento |
| Débito | número o vacío |
| Crédito | número o vacío |
| Saldo | número |
| Descripción | texto adicional si existe |

Si el usuario elige modo unificado, se genera una sola hoja `Movimientos` con columna adicional `Cuenta` al inicio.

## Pregunta al usuario (multi-cuenta)

Cuando un PDF tiene más de una cuenta/sección, el SKILL.md instruye a Claude a preguntar:

> *"Este extracto tiene N cuentas: [lista]. ¿Querés una solapa por cuenta o todos los movimientos en una sola hoja?"*

## Casos edge

| Caso | Comportamiento |
|---|---|
| Banco no reconocido | `"banco": "DESCONOCIDO"`, avisa al usuario, continúa |
| PDF escaneado (sin texto) | Reporta como fallido, no bloquea el resto |
| Período no explícito | Infiere desde primera/última fecha de movimiento |
| Cuenta sin movimientos | Incluida en JSON con `"movimientos": []`, hoja vacía con header |
| Texto > 12000 chars | Avisa, procesa en múltiples partes, consolida |

## Privacidad

El SKILL.md incluye dos avisos:

**Al inicio del procesamiento (visible al usuario):**
> ⚠️ Aviso de privacidad: los PDFs se procesan localmente con pdf2json. El texto se analiza en esta sesión de Claude Code y no se almacena en servidores externos. Verificá que estés usando Claude Code CLI o una sesión sin retención de datos activada.

**En el prompt de extracción (instrucción a Claude):**
> ⚠️ PRIVACIDAD: Este texto contiene información financiera y personal sensible (nombres, CUIL, movimientos bancarios). Procesar exclusivamente para extraer los campos indicados. No retener, resumir ni referenciar estos datos fuera de esta tarea.

### Tarea relacionada
Agregar el mismo aviso de privacidad al SKILL.md de `pdf-invoice-processor`.

## Dependencias

- `pdf2json` — ya en invoice processor, misma versión
- `exceljs` — ya en invoice processor, misma versión
- Node.js >= 18

## Fuera de alcance

- OCR para PDFs escaneados
- Agrupación de múltiples PDFs del mismo cliente en un Excel
- Templates configurables por banco
- API key / llamadas externas
