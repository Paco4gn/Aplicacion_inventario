# Aplicacion_inventario

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-8rtrxr4g)

## Puesta en marcha local

1. Instala dependencias:

```bash
npm install
```

2. Crea un archivo `.env` copiando `.env.example` y rellena las credenciales de Supabase:

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_anon_publica
```

3. Arranca la app:

```bash
npm run dev
```

4. Ejecuta las migraciones de la carpeta `supabase/migrations` en tu proyecto de Supabase antes de iniciar sesion.

## Inventario automatico de equipos Windows

El navegador no puede leer directamente CPU, RAM, disco, IP o MAC por seguridad. Para capturar esos datos usa el script incluido:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\collect-windows-inventory.ps1 -OutputPath .\inventario-equipo.csv -Location "Oficina principal" -AssetType "Laptop"
```

Luego entra en **Activos** y pulsa **Importar** para cargar el CSV. Si el numero de serie ya existe, la app actualiza la ficha tecnica del equipo.

### Sincronizacion automatica con Supabase

Para que el equipo se actualice solo, instala una tarea programada en cada PC. Usa un usuario de Supabase con permisos de admin en la app:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\collect-windows-inventory.ps1 `
  -InstallScheduledTask `
  -SyncToSupabase `
  -IntervalMinutes 60 `
  -Location "Oficina principal" `
  -AssetType "Laptop" `
  -SupabaseUrl "https://dwudqkzkwsqwxshumlza.supabase.co" `
  -SupabaseAnonKey "TU_ANON_KEY" `
  -SupabaseEmail "informatica@feval.com" `
  -SupabasePassword "CONTRASEÑA_DEL_USUARIO"
```

La tarea queda instalada como **IT Inventario - Inventario automatico** y ejecuta la sincronizacion cada hora. La configuracion se guarda localmente en `C:\ProgramData\ITInventario\agent.json`.

### Flujo recomendado por numero de serie

El agente trabaja por `serial_number`:

- Si el numero de serie ya existe en **Activos**, actualiza solo los datos tecnicos: Windows, IP, MAC, CPU, RAM, disco, nombre del equipo, marca/modelo y ultimo inventario.
- Si el numero de serie no existe, crea el activo automaticamente.
- Si no indicas numero de serie, el agente consulta la base de datos y crea el siguiente codigo libre siguiendo la numeracion `PC001`, `PC002`, `PC003`...
- No pisa ubicacion, asignacion, estado, notas manuales ni tipo del activo en equipos ya existentes.

Si la BIOS devuelve un numero de serie incorrecto o quieres forzarlo manualmente:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\collect-windows-inventory.ps1 `
  -InstallScheduledTask `
  -SyncToSupabase `
  -SerialNumber "NUMERO-DE-SERIE-DEL-EQUIPO" `
  -IntervalMinutes 60 `
  -SupabaseUrl "https://dwudqkzkwsqwxshumlza.supabase.co" `
  -SupabaseAnonKey "TU_ANON_KEY" `
  -SupabaseEmail "informatica@feval.com" `
  -SupabasePassword "CONTRASEÑA_DEL_USUARIO"
```

### Instalador autonomo para otros equipos

Para instalar el agente en un PC que no tiene la carpeta del proyecto, copia solo este archivo al equipo:

```text
scripts\install-inventory-agent.ps1
```

Despues ejecuta PowerShell como administrador en ese equipo:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-inventory-agent.ps1 `
  -SerialNumber "NUMERO-DE-SERIE-DEL-EQUIPO" `
  -Location "Oficina principal" `
  -AssetType "Laptop" `
  -IntervalDays 15 `
  -RunAtStartup
```

El instalador crea:

```text
C:\ProgramData\ITInventario\collect-windows-inventory.ps1
C:\ProgramData\ITInventario\agent.json
```

Y deja una tarea programada llamada **IT Inventario - Inventario automatico**. Desde ese momento se actualiza solo.

Por defecto el instalador autonomo esta pensado para ejecutarse cada 15 dias. Con `-RunAtStartup` tambien sincroniza cuando el equipo arranca.

Para un equipo nuevo, puedes omitir `-SerialNumber` y el agente creara el siguiente numero disponible:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-inventory-agent.ps1 `
  -Location "Oficina principal" `
  -AssetType "Laptop" `
  -IntervalDays 15 `
  -RunAtStartup
```
