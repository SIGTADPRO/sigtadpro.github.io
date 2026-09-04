// ═══════════════════════════════════════════════════════════════
// SIGTAD PRO — CONFIGURACIÓN GLOBAL
// Edita estos valores ANTES de publicar la página
// ═══════════════════════════════════════════════════════════════

// ─── SUPABASE ──────────────────────────────────────────────────
const SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';

// ─── EMAILJS ───────────────────────────────────────────────────
const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';

// ─── ADMIN ─────────────────────────────────────────────────────
const ADMIN_PASSWORD = 'sigtad_admin_2026';

// ─── CONTACTO ──────────────────────────────────────────────────
const WHATSAPP_NUMBER = '584128835935';
const WHATSAPP_MSG    = encodeURIComponent('Hola SIGTAD PRO, me interesa...');
const WHATSAPP_LINK   = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`;
const PHONE_NUMBER    = '+58 412 883 59 35';
const ADMIN_EMAIL     = 'sigtadpro@gmail.com';

// ─── DESCARGAS ─────────────────────────────────────────────────
const WINDOWS_DOWNLOAD_URL = './SIGTAD_PRO_Setup_v4.0.3.exe';
const PLAY_STORE_URL       = '';

// ─── CALIFICACIÓN ──────────────────────────────────────────────
const GOOGLE_REVIEW_URL = 'https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID';

// ─── CONTADOR ARTIFICIAL ────────────────────────────────────────
// Fórmula: BASE + FACTOR * ln(días + 1)
// Día 0→30 | Día 30→99 | Día 90→120 | Día 180→134 | Día 365→148
const COUNTER_LAUNCH_DATE   = new Date('2026-01-15');
const COUNTER_BASE          = 30;
const COUNTER_GROWTH_FACTOR = 20;
