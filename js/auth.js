// ═══════════════════════════════════════════════════════════════
// SIGTAD PRO — AUTENTICACIÓN (Supabase & Notificaciones)
// ═══════════════════════════════════════════════════════════════

let _authClient = null;
let currentUser = null;
let pendingConfirmEmail = '';

function initAuth() {
  if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL.includes('YOUR_PROJECT') || !window.supabase) {
    console.log('[SIGTAD] Supabase Auth no configurado aún.');
    return;
  }
  try {
    _authClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    _authClient.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user || null;
      _updateAuthUI();
    });
    _authClient.auth.getSession().then(({ data: { session } }) => {
      currentUser = session?.user || null;
      _updateAuthUI();
    });
  } catch(e) {
    console.error('[SIGTAD] Error en initAuth:', e);
  }
}

function _updateAuthUI() {
  const btn = document.getElementById('navAuthBtn');
  if (!btn) return;
  if (currentUser) {
    const meta = currentUser.user_metadata || {};
    const name = meta.name || currentUser.email?.split('@')[0] || 'Mi Cuenta';
    btn.textContent = `👤 ${name}`;
    btn.title = 'Clic para gestionar o cerrar sesión';
  } else {
    btn.textContent = 'Acceso';
  }
}

// ─── LOGIN ─────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const msg      = document.getElementById('loginMessage');

  if (!_authClient) {
    _showMsg(msg, 'info', 'ℹ️ Modo demostración: Ingresa tus credenciales de Supabase en js/config.js');
    return;
  }

  _showMsg(msg, 'info', '⏳ Verificando credenciales...');
  const { data, error } = await _authClient.auth.signInWithPassword({ email, password });

  if (error) {
    // Si el error es por falta de confirmación de correo
    if (error.message.toLowerCase().includes('email not confirmed')) {
      closeModal('authModal');
      setTimeout(() => openEmailConfirmModal(email), 300);
      return;
    }
    _showMsg(msg, 'error', `❌ ${_translateError(error.message)}`);
  } else {
    _showMsg(msg, 'success', '✅ ¡Sesión iniciada con éxito!');
    setTimeout(() => closeModal('authModal'), 1200);
  }
}

// ─── REGISTRO ──────────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  const name      = document.getElementById('registerName').value.trim();
  const email     = document.getElementById('registerEmail').value.trim();
  const password  = document.getElementById('registerPassword').value;
  const subscribe = document.getElementById('subscribeNewsletter').checked;
  const msg       = document.getElementById('registerMessage');

  if (!_authClient) {
    _showMsg(msg, 'info', 'ℹ️ Modo demostración: Configura Supabase en js/config.js para guardar cuentas reales');
    return;
  }

  _showMsg(msg, 'info', '⏳ Creando tu cuenta segura...');
  const { data, error } = await _authClient.auth.signUp({
    email,
    password,
    options: {
      data: { name, subscribed_newsletter: subscribe }
    }
  });

  if (error) {
    _showMsg(msg, 'error', `❌ ${_translateError(error.message)}`);
    return;
  }

  if (subscribe) {
    try {
      await _authClient.from('subscribers').upsert({ email, name, created_at: new Date().toISOString() }, { onConflict: 'email' });
    } catch(e) {}
  }

  _notifyAdmin(name, email);

  // Si Supabase no devolvió sesión automática, requiere verificación de correo
  if (!data?.session) {
    closeModal('authModal');
    setTimeout(() => openEmailConfirmModal(email), 300);
  } else {
    _showMsg(msg, 'success', '✅ ¡Registro exitoso! Sesión iniciada.');
    setTimeout(() => closeModal('authModal'), 1400);
  }
}

// ─── MODAL DE CONFIRMACIÓN DE EMAIL ───────────────────────────
function openEmailConfirmModal(email) {
  pendingConfirmEmail = email || '';
  const badge = document.getElementById('confirmTargetEmail');
  if (badge) badge.textContent = pendingConfirmEmail || 'tu correo registrado';
  
  const resendMsg = document.getElementById('resendMessage');
  if (resendMsg) {
    resendMsg.textContent = '';
    resendMsg.className = 'auth-message';
  }
  openModal('emailConfirmModal');
}

async function handleResendConfirmation() {
  const msg = document.getElementById('resendMessage');
  if (!_authClient || !pendingConfirmEmail) {
    _showMsg(msg, 'error', '❌ No se pudo identificar el correo para el reenvío.');
    return;
  }
  _showMsg(msg, 'info', '⏳ Enviando nuevo enlace de activación...');
  try {
    const { error } = await _authClient.auth.resend({
      type: 'signup',
      email: pendingConfirmEmail
    });
    if (error) {
      _showMsg(msg, 'error', `❌ ${_translateError(error.message)}`);
    } else {
      _showMsg(msg, 'success', '📨 ¡Nuevo enlace enviado! Revisa tu bandeja y carpeta SPAM.');
    }
  } catch(e) {
    _showMsg(msg, 'error', '❌ Error al solicitar el reenvío.');
  }
}

// ─── LOGOUT / MENÚ DE USUARIO ─────────────────────────────────
function showUserMenu() {
  if (!currentUser) return;
  const name = currentUser.user_metadata?.name || currentUser.email;
  if (confirm(`Usuario conectado: ${name}\n\n¿Deseas cerrar sesión?`)) {
    if (_authClient) {
      _authClient.auth.signOut().then(() => {
        currentUser = null;
        _updateAuthUI();
      });
    } else {
      currentUser = null;
      _updateAuthUI();
    }
  }
}

// ─── EMAILJS / AVISO ADMIN ────────────────────────────────────
function _notifyAdmin(userName, userEmail) {
  if (typeof emailjs === 'undefined') return;
  if (!EMAILJS_PUBLIC_KEY || EMAILJS_PUBLIC_KEY.includes('YOUR')) return;
  try {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email:   ADMIN_EMAIL,
      user_name:  userName,
      user_email: userEmail,
      timestamp:  new Date().toLocaleString('es-VE'),
      subject:    '🔔 Nuevo registro en SIGTAD PRO'
    });
  } catch(e) {
    console.warn('[SIGTAD] EmailJS no configurado:', e);
  }
}

// ─── TABS EN MODAL DE ACCESO ──────────────────────────────────
function setupAuthTabs() {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.getElementById('loginForm').style.display    = target === 'login'    ? 'flex' : 'none';
      document.getElementById('registerForm').style.display = target === 'register' ? 'flex' : 'none';
    });
  });
}

function _showMsg(el, type, text) {
  if (!el) return;
  el.textContent = text;
  el.className   = `auth-message ${type}`;
}

function _translateError(msg) {
  if (!msg) return 'Error desconocido';
  if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (msg.includes('Email not confirmed')) return 'Por favor confirma tu correo electrónico.';
  if (msg.includes('User already registered')) return 'Este correo ya tiene una cuenta registrada.';
  if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (msg.includes('rate limit')) return 'Demasiadas solicitudes. Espera unos minutos antes de reintentar.';
  return msg;
}
