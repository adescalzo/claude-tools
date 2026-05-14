# claude-tools

Colección de skills para Claude Code. Cada skill es una carpeta autocontenida con scripts Node.js y un `SKILL.md` que instruye a Claude Cowork sobre cómo usarlos.

## Skills disponibles

| Skill | Descripción |
|---|---|
| [pdf-invoice-processor](pdf-invoice-processor/) | Extrae datos de facturas PDF y genera Excel (Cabecera + Detalle) |

## Estructura del repo

```
claude-tools/
├── pdf-invoice-processor/     ← skill: scripts + config + SKILL.md
├── docs/superpowers/          ← specs y planes de diseño
└── README.md
```

## Instalar un skill

Ver el instructivo de cada skill:

- [Instalar pdf-invoice-processor](pdf-invoice-processor.md)
