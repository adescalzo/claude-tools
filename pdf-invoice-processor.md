> **Cómo instalar este skill:** Copiá todo el contenido de este archivo y pegalo en el chat de Claude Code.

---

Tengo el skill `pdf-invoice-processor` en la carpeta `pdf-invoice-processor/` de este repositorio.

Este skill extrae datos de facturas PDF y genera un archivo Excel con dos hojas:
- **Cabecera**: una fila por factura (emisor, receptor, totales)
- **Detalle**: una fila por ítem o impuesto

No requiere API key — vos (Claude) sos el motor de análisis. Los scripts solo extraen texto y construyen el Excel.

---

## Paso 1 — Verificar el entorno

Antes de hacer cualquier cambio, verificá y reportame:

- ¿Existe la carpeta `pdf-invoice-processor/`?
- ¿Existe `pdf-invoice-processor/SKILL.md`? (leelo para entender el skill)
- ¿Existe `pdf-invoice-processor/node_modules/`?
- ¿Está Node.js >= 18 instalado? (`node --version`)

Si algo falta o falla, informame el error exacto y detené la instalación hasta que lo resolvamos.

---

## Paso 2 — Instalar dependencias (si hace falta)

Si `node_modules/` no existe, ejecutá:

```bash
cd pdf-invoice-processor && npm install
```

Reportame si hubo errores. Si `npm install` falla, no sigas.

---

## Paso 3 — Actualizar .gitignore (solo si hay un repositorio git)

Si existe un `.gitignore` en el proyecto, verificá que contenga estas entradas. Si no las tiene, agregalas:

```
# pdf-invoice-processor skill
pdf-invoice-processor/node_modules/
pdf-invoice-processor/scripts/package-lock.json
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
## Skill: pdf-invoice-processor

Skill disponible en `pdf-invoice-processor/`. Requiere Node.js >= 18 y `npm install` ejecutado en esa carpeta.

Cuando el usuario mencione procesar facturas, pida analizar PDFs, o dé una ruta con facturas:
→ Seguir las instrucciones en `pdf-invoice-processor/SKILL.md`
```

---

## Paso 6 — Confirmar instalación y mostrar ayuda

Una vez instalado, reportame:
- Qué archivo editaste (ruta completa)
- Si hubo algún error o advertencia

Luego mostrá al usuario una guía de uso rápida:

**Cómo usar el skill:**

Para procesar facturas, simplemente decile a Claude:
> "Procesá las facturas de [ruta a la carpeta]"

Ejemplo:
> "Procesá las facturas de C:\Facturas\Pendientes"
> "Procesá las facturas de ~/documentos/facturas"

Claude va a extraer el texto de los PDFs, analizar cada factura, y generar `facturas.xlsx` dentro de una carpeta `done-YYYY-MM-DD-HH-mm/`.

**Cambiar el template de salida (columnas del Excel):**

Hay tres templates disponibles. Para ver cuáles hay:
> "¿Qué templates hay?"

Para cambiar el template activo:
> "Usá el template simple"
> "Usá el template contabilidad"

Los templates definen qué columnas aparecen en el Excel. Para agregar o modificar un template, pedile a Claude:
> "Quiero un template que incluya [descripción de las columnas que necesitás]"

Claude va a crear o editar el archivo JSON correspondiente en `pdf-invoice-processor/config/templates/`.

---

## Cómo actualizar el skill

Cuando salga una versión nueva del skill (cambios en scripts, SKILL.md, templates, o dependencias):

1. **Traer los archivos nuevos** sobre la carpeta `pdf-invoice-processor/` existente (sobrescribir).
   - Si lo clonaste con git: `cd pdf-invoice-processor && git pull` (o desde la raíz del repo).
   - Si lo copiaste a mano: reemplazar la carpeta `pdf-invoice-processor/` por la nueva, **manteniendo** `node_modules/` si no querés reinstalar todo, y **respetando** los templates personalizados que hayas agregado en `config/templates/`.

2. **Revisar si cambió `package.json`**:
   - Compará `dependencies` y `version` con la versión anterior.
   - Si cambió algo, ejecutá:
     ```bash
     cd pdf-invoice-processor && npm install
     ```
   - Si no cambió nada, `node_modules/` sigue válido.

3. **Verificar `config/excel-config.json`**:
   - El campo `active_template` puede haberse pisado si copiaste sobre tu instalación. Confirmá que apunta al template que querés.

4. **Verificar SKILL.md**:
   - No hace falta hacer nada manual. Claude lee `SKILL.md` cuando activás el skill, así que la versión nueva aplica automáticamente.

5. **Probar con un PDF de muestra** antes de procesar lotes grandes, por si cambió el formato de output o el schema de `extracted.json`.

6. **Si algo falla después de actualizar**, revisá:
   - `node --version` (sigue siendo >= 18)
   - Que `node_modules/` exista y tenga `pdf2json` y `exceljs`
   - Que el comando `node scripts/list-templates.js` corra sin error
