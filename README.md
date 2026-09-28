# IT Inventario

Aplicación de gestión de activos, empleados, incidencias, licencias, componentes y auditoría para FEVAL.

La aplicación usa React y TypeScript en la interfaz, Cloudflare Workers para la API y D1 para los datos. La interfaz, la API y la base se despliegan juntas, sin depender de un proyecto Supabase que pueda pausarse.

## Aplicación publicada

La dirección estable es [paco4gn.github.io/Aplicacion_inventario](https://paco4gn.github.io/Aplicacion_inventario/). La interfaz se compila y publica directamente en GitHub Pages. La API y D1 se ejecutan en el servicio de datos porque GitHub Pages solo admite archivos estáticos.

El panel solicita una clave de acceso y la conserva únicamente durante la sesión del navegador. GitHub no recibe ni almacena esa clave. La API acepta peticiones del origen `https://paco4gn.github.io` y protege los datos administrativos mediante claves individuales con perfiles de administrador, técnico y solo consulta.

La migración inicial conserva los registros del proyecto anterior mediante una importación privada durante el despliegue. Los datos del inventario y sus copias de seguridad no se guardan en este repositorio público.

## Puesta en marcha local

Requisitos: Node.js 22 o superior.

```bash
npm install
npm run db:generate
npx wrangler d1 migrations apply it-inventario-local --local
npm run dev
```

En local se crea una sesión de desarrollo. En el sitio publicado, el acceso queda protegido por la autenticación del alojamiento.

Para probar el panel técnico de los códigos QR, copia `.dev.vars.example` como `.dev.vars` y configura `ASSET_PUBLIC_TECH_PIN`. Las claves de correo y del agente Windows también se guardan en ese archivo local; nunca se incluyen en el código del navegador.

## Comprobaciones

```bash
npm run typecheck
npm run lint
npm run build
```

La definición de las tablas está en `db/schema.ts` y las migraciones generadas están en `drizzle/`.

Desde **Administración** se gestionan los usuarios y las copias diarias. La papelera permite restaurar registros con sus relaciones. El dashboard genera un Excel real con hojas para activos, empleados, asignaciones, incidencias, licencias, componentes, movimientos y auditoría.

La pantalla de activos permite previsualizar una importación CSV antes de aplicarla, cambiar estado o ubicación por lotes, consultar el historial completo, imprimir etiquetas QR y generar actas de entrega PDF con firma. La aplicación también se puede instalar como PWA en ordenadores y móviles.

## Espacio AI4FEVAL

El módulo **AI4FEVAL** convierte la memoria del programa Atraigo Talento en un espacio de ejecución y seguimiento:

- mapa de procesos y cálculo de oportunidades de automatización;
- cartera de casos de uso priorizada por impacto y viabilidad;
- control de riesgos, sensibilidad de datos y revisión ética;
- plan Gantt 2026 con las actividades y fechas oficiales;
- ficha técnica y evaluación de prototipos y agentes IA;
- integraciones con ERP, CRM, correo, documentación y otros sistemas;
- indicadores con línea base, objetivo, resultado y evidencia;
- entregables, guías, prototipos y actividades de transferencia.

El Excel completo añade hojas específicas de procesos, casos de uso, plan, pilotos, integraciones, indicadores y entregables. Las copias diarias y la papelera incluyen también estos datos.

## Inventario automático de equipos Windows

El navegador no puede leer CPU, RAM, disco, IP o MAC. El script `scripts/collect-windows-inventory.ps1` genera un CSV que se puede importar desde **Activos**:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\collect-windows-inventory.ps1 `
  -OutputPath .\inventario-equipo.csv `
  -Location "Oficina principal"
```

Para sincronizar el equipo automáticamente, configura en el sitio el secreto `INVENTORY_AGENT_TOKEN` e instala la tarea con la URL publicada y ese mismo token:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\collect-windows-inventory.ps1 `
  -Install `
  -ApiUrl "https://URL-DEL-INVENTARIO" `
  -AgentToken "TOKEN-DEL-AGENTE" `
  -Location "Oficina principal" `
  -IntervalDays 15 `
  -RunAtStartup
```

El token se cifra con la protección de credenciales de Windows antes de guardarse en `C:\ProgramData\ITInventario\agent.json`. La tarea actualiza los datos técnicos si el número de serie ya existe y crea el activo si todavía no existe. No sobrescribe la ubicación, la asignación, el estado ni las notas manuales de los equipos existentes.

## Avisos de incidencias

Los avisos admiten Resend, SendGrid, Brevo, Google Apps Script y Microsoft Graph. Configura `MAIL_PROVIDER`, `INCIDENT_EMAIL_FROM` y las credenciales del proveedor como variables privadas del alojamiento. Los destinatarios se administran desde **Incidencias > Configurar avisos**.
