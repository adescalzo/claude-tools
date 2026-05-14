> **Cómo instalar este skill:** Copiá todo el contenido de este archivo y pegalo en el chat de Claude Code.

---

Tengo el skill `bank-statement-processor` en la carpeta `bank-statement-processor/` de este repositorio.

Este skill extrae datos de extractos bancarios en PDF y genera un archivo Excel por cada extracto con:
- **Cabecera**: una fila con banco, cliente, CUIL, período y lista de cuentas
- **Una hoja por cuenta/producto**: movimientos de cada cuenta (Cuenta Corriente, Caja de Ahorros, Tarjeta de Crédito, etc.)

Soporta múltiples bancos (BBVA, Banco Ciudad, Santander, etc.) y extractos con múltiples cuentas en un solo PDF.

No requiere API key — vos (Claude) sos el motor de análisis. Los scripts solo extraen texto y construyen el Excel.

---

## Paso 1 — Verificar el entorno

Antes de hacer cualquier cambio, verificá y reportame:

- ¿Existe la carpeta `bank-statement-processor/`?
- ¿Existe `bank-statement-processor/SKILL.md`? (leelo para entender el skill)
- ¿Existe `bank-statement-processor/node_modules/`?
- ¿Está Node.js >= 18 instalado? (`node --version`)

Si algo falta o falla, informame el error exacto y detené la instalación hasta que lo resolvamos.

---

## Paso 2 — Instalar dependencias (si hace falta)

Si `node_modules/` no existe, ejecutá:

```bash
cd bank-statement-processor && npm install
```

Reportame si hubo errores. Si `npm install` falla, no sigas.

---

## Paso 3 — Actualizar .gitignore (solo si hay un repositorio git)

Si existe un `.gitignore` en el proyecto, verificá que contenga estas entradas. Si no las tiene, agregalas:

```
# bank-statement-processor skill
bank-statement-processor/node_modules/
bank-statement-processor/scripts/package-lock.json
```

Si no existe `.gitignore`, crealo con ese contenido.

Reportame si lo modificaste o si ya estaba correcto.

---

## Paso 4 — Confirmar antes de editar

Antes de tocar cualquier archivo de configuración, mostrme:

1. El snippet exacto que vas a agregar
2. El archivo exacto que vas a editar (ruta completa)
3. Si el archivo ya existe, mostrá el contenido actual relevante

Luego preguntame:
- ¿Querés registrar este skill en el CLAUDE.md **global** (`~/.claude/CLAUDE.md`) o en el **proyecto actual** (`./CLAUDE.md`)?

  - **Global**: disponible en cualquier proyecto de esta máquina
  - **Proyecto**: solo cuando Claude Code abre esta carpeta

Esperá mi confirmación antes de editar.

---

## Paso 5 — Agregar el snippet

Una vez que confirme, agregá esto al CLAUDE.md elegido:

```markdown
## Skill: bank-statement-processor

Skill disponible en `bank-statement-processor/`. Requiere Node.js >= 18 y `npm install` ejecutado en esa carpeta.

Cuando el usuario mencione procesar extractos bancarios, pida analizar PDFs de banco, o dé una ruta con extractos:
→ Seguir las instrucciones en `bank-statement-processor/SKILL.md`
```

---

## Paso 6 — Confirmar instalación y mostrar ayuda

Una vez instalado, reportame:
- Qué archivo editaste (ruta completa)
- Si hubo algún error o advertencia

Luego mostrá al usuario una guía de uso rápida:

**Cómo usar el skill:**

Para procesar extractos bancarios, simplemente decile a Claude:
> "Procesá los extractos de [ruta a la carpeta]"

Ejemplo:
> "Procesá los extractos de C:\Extractos\Mayo"
> "Procesá los extractos de ~/documentos/extractos"

Claude va a extraer el texto de los PDFs, analizar cada extracto, y generar un Excel dentro de una carpeta con el nombre del PDF.

**Estructura de salida:**

Por cada PDF se crea una carpeta con el mismo nombre:
```
extractos/
  Resumen Mayo/
    Resumen Mayo.pdf
    extracted.json
    Resumen Mayo.xlsx   ← Cabecera + una hoja por cuenta
```

**Extractos con múltiples cuentas:**

Si el extracto tiene más de una cuenta (por ejemplo, BBVA con Cuenta Corriente + Caja de Ahorros en dólares), Claude va a preguntar:
> "¿Querés una hoja por cuenta o todos los movimientos en una sola hoja?"
