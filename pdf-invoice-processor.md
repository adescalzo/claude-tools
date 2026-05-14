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
