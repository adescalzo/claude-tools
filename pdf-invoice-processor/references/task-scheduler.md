# Automatización con Windows Task Scheduler

Para ejecutar el proceso automáticamente sin intervención manual:

## Paso 1: Crear ejecutar-facturas.bat

Crear este archivo en la carpeta del script:

```bat
@echo off
set ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
node "C:\ruta\al\script\process-invoices.js" ^
  --input  "C:\Facturas\Pendientes" ^
  --output "C:\Facturas\Procesadas" ^
  --excel  "C:\Facturas\facturas.xlsx" ^
  --append
```

## Paso 2: Programar en Windows

1. `Win + R` → `taskschd.msc` → Enter
2. **Crear tarea básica**
3. Nombre: `Procesar Facturas`
4. Disparador: Diario / Semanal
5. Acción → Iniciar programa → seleccionar el `.bat`
6. Finalizar
