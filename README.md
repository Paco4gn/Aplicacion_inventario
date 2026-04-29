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
