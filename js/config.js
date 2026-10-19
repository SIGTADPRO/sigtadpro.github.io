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
const ADMIN_PASSWORD = 'sigtad_admin_2026';

// ─── CONTACTO ──────────────────────────────────────────────────
const WHATSAPP_NUMBER = '584128835935';
const WHATSAPP_MSG    = encodeURIComponent('Hola SIGTAD PRO, me interesa...');
const WHATSAPP_LINK   = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`;
const PHONE_NUMBER    = '+58 412 883 59 35';
const ADMIN_EMAIL     = 'sigtadpro@gmail.com';

// ─── DESCARGAS ─────────────────────────────────────────────────
const WINDOWS_DOWNLOAD_URL = './SIGTAD_PRO_Setup_v5.3.5.exe';
const PLAY_STORE_URL       = '';

// ─── CALIFICACIÓN ──────────────────────────────────────────────
const GOOGLE_REVIEW_URL = 'https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID';

// ─── CONTADOR ARTIFICIAL ────────────────────────────────────────
// Base sembrada (~320) + crecimiento progresivo determinístico de 1 a 3 descargas por día
const COUNTER_BASE_DATE        = new Date('2026-10-18T00:00:00');
const COUNTER_BASE_ARTIFICIAL = 320; // Alrededor de 300 y un poco más

// Compatibilidad hacia atrás
const COUNTER_LAUNCH_DATE   = COUNTER_BASE_DATE;
const COUNTER_BASE          = COUNTER_BASE_ARTIFICIAL;

