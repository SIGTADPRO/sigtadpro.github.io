// ═══════════════════════════════════════════════════════════════
// SIGTAD PRO — CONFIGURACIÓN GLOBAL
// Edita estos valores ANTES de publicar la página
// ═══════════════════════════════════════════════════════════════

// ─── SUPABASE ──────────────────────────────────────────────────
const SUPABASE_URL      = 'https://yuodkddszfkfccnmuugf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1b2RrZGRzemZrZmNjbm11dWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4Mjk5MTAsImV4cCI6MjEwNTQwNTkxMH0.cE8UiGn8eU5eYBbiG25R_LwPSLevNLBc4i-B412erz0';

// ─── EMAILJS ───────────────────────────────────────────────────
const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';

// ─── ADMIN ─────────────────────────────────────────────────────
// La autenticación de administrador se gestiona de forma criptográfica y segura
// mediante Supabase Auth y RLS en PostgreSQL (restringido a sigtadpro@gmail.com).
// Ya no se almacenan contraseñas en texto plano en el frontend.

// ─── SEGURIDAD & BOT PROTECTION (CAPTCHA) ─────────────────────
// Compatible con Cloudflare Turnstile (recomendado) o Google reCAPTCHA v2
const CAPTCHA_ENABLED  = false; // Cambiar a true tras ingresar tu clave de sitio
const CAPTCHA_PROVIDER = 'turnstile'; // 'turnstile' o 'recaptcha'
const CAPTCHA_SITE_KEY = ''; // Clave de sitio pública de Cloudflare o Google


// ─── CONTACTO ──────────────────────────────────────────────────
const WHATSAPP_NUMBER = '584128835935';
const WHATSAPP_MSG    = encodeURIComponent('Hola SIGTAD PRO, me interesa...');
const WHATSAPP_LINK   = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`;
const WHATSAPP_PLAYSTORE_MSG  = encodeURIComponent('¡Hola Maxi! Vengo de la web sigtad.com y me gustaría solicitar acceso a SIGTAD PRO en Google Play Store para probar la aplicación en mi teléfono Android.');
const WHATSAPP_PLAYSTORE_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_PLAYSTORE_MSG}`;
const PHONE_NUMBER    = '+58 412 883 59 35';
const ADMIN_EMAIL     = 'sigtadpro@gmail.com';

// ─── DESCARGAS ─────────────────────────────────────────────────
const WINDOWS_DOWNLOAD_URL     = './SIGTAD_PRO_Setup_v6.0.6.exe';
const WINDOWS_ZIP_DOWNLOAD_URL = './SIGTAD_PRO_Setup_v6.0.6.zip';
const PLAY_STORE_URL           = 'https://play.google.com/store/apps/details?id=com.sigtad.pos';

// ─── CALIFICACIÓN ──────────────────────────────────────────────
const GOOGLE_REVIEW_URL = '#';

// ─── CONTADOR ARTIFICIAL ────────────────────────────────────────
// Base sembrada (~320) + crecimiento progresivo determinístico de 1 a 3 descargas por día
const COUNTER_BASE_DATE        = new Date('2026-10-18T00:00:00');
const COUNTER_BASE_ARTIFICIAL = 320; // Alrededor de 300 y un poco más

// Compatibilidad hacia atrás
const COUNTER_LAUNCH_DATE   = COUNTER_BASE_DATE;
const COUNTER_BASE          = COUNTER_BASE_ARTIFICIAL;

