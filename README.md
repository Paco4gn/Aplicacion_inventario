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
