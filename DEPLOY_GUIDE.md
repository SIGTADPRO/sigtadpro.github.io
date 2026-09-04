# 🚀 GUÍA DE DESPLIEGUE Y CONFIGURACIÓN — SIGTAD PRO WEB

Esta guía te explica de forma clara cómo publicar tu página web de forma **gratuita, activa 24/7, segura con HTTPS (sin advertencias de Google)** y cómo administrar los datos.

---

## 1. 🧪 Probar la Página Localmente en tu PC

Puedes abrir el archivo `index.html` directamente haciendo doble clic, o ejecutando un servidor local en PowerShell:

```powershell
cd "c:\bodega_pos\sigtadpro web"
python -m http.server 8080
```
Luego abres en tu navegador: `http://localhost:8080`

---

## 2. 🌐 Publicar GRATIS en GitHub Pages (24/7 con HTTPS)

GitHub Pages es la opción más segura, rápida y 100% gratuita. Tu web tendrá un dominio limpio como:
👉 **`https://tusuario.github.io/sigtadpro-web`** (o si el repositorio se llama `sigtadpro.github.io`, la URL será exactamente `https://sigtadpro.github.io`).

### Pasos:
1. Inicia sesión en tu cuenta de [GitHub](https://github.com).
2. Haz clic en el botón verde **"New"** para crear un nuevo repositorio.
3. Nómbralo: `sigtadpro` (o el nombre que prefieras). Selecciónalo como **Public**.
4. En tu computadora, dentro de la carpeta `c:\bodega_pos\sigtadpro web`, abre PowerShell y ejecuta:
   ```powershell
   git init
   git add .
   git commit -m "Lanzamiento oficial SIGTAD PRO Web"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/sigtadpro.git
   git push -u origin main
   ```
5. En GitHub, ve a **Settings** -> **Pages** (en el menú lateral izquierdo).
6. En **Branch**, selecciona `main` y la carpeta `/ (root)`, luego pulsa **Save**.
7. ¡Listo! En 1 a 2 minutos tu página estará activa con certificado SSL (HTTPS) verificado por Google.

---

## 3. 🗄️ Configuración de Supabase (Para persistencia y usuarios)

Para que el contador sume entre distintos usuarios y se guarden los registros:

1. Entra a [https://supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. Crea un nuevo proyecto (ejemplo: `sigtadpro-db`).
3. En el menú de la izquierda, entra en **SQL Editor**.
4. Abre el archivo `supabase_setup.sql` que creamos en esta carpeta, copia todo su contenido y pégalo en el editor de Supabase. Pulsa **Run**.
5. Ve a **Project Settings** -> **API**.
6. Copia:
   - **Project URL**
   - **anon / public key**
7. Ábrelo en tu archivo `js/config.js` y reemplaza:
   ```javascript
   const SUPABASE_URL = 'https://tu_proyecto.supabase.co';
   const SUPABASE_ANON_KEY = 'tu_clave_anonima_larga';
   ```

---

## 4. 🕵️ Panel de Administración Privado (Ver descargas reales vs artificiales)

Para ver el desglose exacto de tus números:
1. Abre en tu navegador `admin.html` (o `tudominio.com/admin.html`).
2. Ingresa la clave de administrador (por defecto es `sigtad_admin_2026`, cámbiala en `js/config.js`).
3. Podrás auditar:
   - Cuántos clics reales se hicieron en Windows.
   - Cuántos clics reales se hicieron en Android.
   - Cuál es el número artificial añadido por la fórmula logarítmica.
   - Cuántos usuarios y correos se han registrado.

---

## 5. 📧 Envíos Masivos y Correos sin Spam

Para enviar correos masivos a tus usuarios registrados sin caer en carpetas de spam ni requerir servidores caros:
- Utiliza **[Brevo](https://www.brevo.com)** (antiguo Sendinblue). Es gratuito y te permite enviar hasta **300 correos al día**.
- Puedes exportar tu lista de correos desde la tabla `subscribers` de Supabase e importarla con un solo clic a Brevo para enviar promociones de licencias o actualizaciones.
