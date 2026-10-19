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
    
    // Escuchar cambios de sesión en tiempo real
    _authClient.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user || null;
      _updateAuthUI();
    });

    // Restaurar sesión persistente de localStorage
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
    btn.title = 'Clic para ver tu perfil o cerrar sesión';
  } else {
    btn.textContent = 'Acceso';
    btn.title = 'Iniciar sesión o registrarse';
  }
}

// ─── APERTURA INTELIGENTE DE MODAL (LOGIN / PERFIL) ───────────
function openAuthModal(defaultTab = 'login') {
  if (currentUser) {
    _renderUserProfile();
    openModal('authModal');
    return;
  }

  // Si no está conectado, mostrar pestañas y formulario
  const tabs = document.getElementById('authTabsContainer');
  if (tabs) tabs.style.display = 'flex';
  const profile = document.getElementById('profileView');
  if (profile) profile.style.display = 'none';

  const tabLogin = document.querySelector('.auth-tab[data-tab="login"]');
  const tabReg   = document.querySelector('.auth-tab[data-tab="register"]');

  if (defaultTab === 'register' && tabReg) {
    tabReg.click();
  } else if (tabLogin) {
    tabLogin.click();
  }
  openModal('authModal');
}

function _renderUserProfile() {
  const tabs = document.getElementById('authTabsContainer');
  if (tabs) tabs.style.display = 'none';
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.style.display = 'none';
  const regForm = document.getElementById('registerForm');
  if (regForm) regForm.style.display = 'none';
  const profile = document.getElementById('profileView');
  if (profile) profile.style.display = 'block';

  if (!currentUser) return;
  const meta = currentUser.user_metadata || {};
  const name = meta.name || currentUser.email?.split('@')[0] || 'Usuario SIGTAD';
  const email = currentUser.email || '';

  const nameEl = document.getElementById('profileName');
  if (nameEl) nameEl.textContent = name;
  const emailEl = document.getElementById('profileEmail');
  if (emailEl) emailEl.textContent = email;
  const newsEl = document.getElementById('profileNewsletterStatus');
  if (newsEl) newsEl.textContent = meta.subscribed_newsletter ? 'Habilitado' : 'Estándar';

  const msg = document.getElementById('profileMessage');
  if (msg) _showMsg(msg, '', '');
}

// ─── LOGIN ─────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const emailInput = document.getElementById('loginEmail');
  const passInput  = document.getElementById('loginPassword');
  const email      = emailInput ? emailInput.value.trim() : '';
  const password   = passInput ? passInput.value : '';
  const msg        = document.getElementById('loginMessage');
  const submitBtn  = e.target.querySelector('button[type="submit"]');

  if (!_authClient) {
    _showMsg(msg, 'info', 'ℹ️ Modo demostración: Ingresa tus credenciales de Supabase en js/config.js');
    return;
  }

  // Prevenir envíos múltiples
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset.origText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Verificando credenciales...';
  }
  _showMsg(msg, 'info', '⏳ Verificando credenciales en Supabase...');

  try {
    const { data, error } = await _authClient.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        closeModal('authModal');
        setTimeout(() => openEmailConfirmModal(email), 300);
        return;
      }
      _showMsg(msg, 'error', `❌ ${_translateError(error.message)}`);
    } else {
      currentUser = data.user;
      _updateAuthUI();
      _showMsg(msg, 'success', '✅ ¡Sesión iniciada con éxito! Bienvenido.');
      setTimeout(() => {
        closeModal('authModal');
        if (emailInput) emailInput.value = '';
        if (passInput) passInput.value = '';
        _showMsg(msg, '', '');
      }, 1000);
    }
  } catch(err) {
    _showMsg(msg, 'error', `❌ Error de conexión: ${err.message}`);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.origText || 'Ingresar a mi Cuenta';
    }
  }
}

// ─── REGISTRO ──────────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  const nameInput  = document.getElementById('registerName');
  const emailInput = document.getElementById('registerEmail');
  const passInput  = document.getElementById('registerPassword');
  const name       = nameInput ? nameInput.value.trim() : '';
  const email      = emailInput ? emailInput.value.trim() : '';
  const password   = passInput ? passInput.value : '';
  const subscribe  = document.getElementById('subscribeNewsletter')?.checked ?? true;
  const msg        = document.getElementById('registerMessage');
  const submitBtn  = e.target.querySelector('button[type="submit"]');

  if (!_authClient) {
    _showMsg(msg, 'info', 'ℹ️ Modo demostración: Configura Supabase en js/config.js');
    return;
  }

  // Prevenir doble clic
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset.origText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Creando cuenta segura...';
  }
  _showMsg(msg, 'info', '⏳ Creando tu cuenta segura...');

  try {
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

    // Registrar siempre en la tabla subscribers para que aparezca en el panel admin.html
    try {
      await _authClient.from('subscribers').upsert({
        email,
        name,
        created_at: new Date().toISOString()
      }, { onConflict: 'email' });
    } catch(subErr) {
      console.warn('[SIGTAD] Aviso en subscribers:', subErr.message);
    }

    _notifyAdmin(name, email);

    // Opción A: Si confirmación de email está desactivada en Supabase, data.session viene listo
    if (data?.session) {
      currentUser = data.user;
      _updateAuthUI();
      _showMsg(msg, 'success', '✅ ¡Cuenta creada exitosamente! Sesión iniciada.');
      setTimeout(() => {
        closeModal('authModal');
        if (nameInput) nameInput.value = '';
        if (emailInput) emailInput.value = '';
        if (passInput) passInput.value = '';
        _showMsg(msg, '', '');
      }, 1200);
    } else {
      // Si todavía requiere confirmación por email en Supabase
      closeModal('authModal');
      setTimeout(() => openEmailConfirmModal(email), 300);
    }
  } catch(err) {
    _showMsg(msg, 'error', `❌ Error inesperado: ${err.message}`);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.origText || 'Crear Cuenta Gratuita';
    }
  }
}

// ─── CERRAR SESIÓN ────────────────────────────────────────────
async function handleLogout() {
  const msg = document.getElementById('profileMessage');
  _showMsg(msg, 'info', '⏳ Cerrando sesión...');
  try {
    if (_authClient) {
      await _authClient.auth.signOut();
    }
  } catch(e) {
    console.warn('[SIGTAD] Error al cerrar sesión:', e);
  } finally {
    currentUser = null;
    _updateAuthUI();
    _showMsg(msg, 'success', '👋 Sesión cerrada correctamente.');
    setTimeout(() => {
      closeModal('authModal');
      // Restaurar modal a estado de login por defecto
      const tabs = document.getElementById('authTabsContainer');
      if (tabs) tabs.style.display = 'flex';
      const profile = document.getElementById('profileView');
      if (profile) profile.style.display = 'none';
      const tabLogin = document.querySelector('.auth-tab[data-tab="login"]');
      if (tabLogin) tabLogin.click();
      if (msg) _showMsg(msg, '', '');
    }, 800);
  }
}

// Compatibilidad hacia atrás
function showUserMenu() {
  openAuthModal();
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
      const loginForm = document.getElementById('loginForm');
      const regForm = document.getElementById('registerForm');
      const profile = document.getElementById('profileView');
      if (profile) profile.style.display = 'none';
      if (loginForm) loginForm.style.display = target === 'login' ? 'flex' : 'none';
      if (regForm) regForm.style.display    = target === 'register' ? 'flex' : 'none';
    });
  });
}

function _showMsg(el, type, text) {
  if (!el) return;
  el.textContent = text;
  el.className   = `auth-message ${type}`;
}

function _translateError(msg) {
  if (!msg) return 'Error desconocido al procesar la solicitud.';
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Este correo aún no ha sido confirmado. Revisa tu bandeja o solicita un nuevo enlace.';
  if (m.includes('user already registered')) return 'Ya existe una cuenta con este correo electrónico. Inicia sesión directamente.';
  if (m.includes('password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('rate limit') || m.includes('over_email_send_rate_limit')) {
    return 'Límite de envíos alcanzado por seguridad temporal. Si ya creaste tu cuenta, puedes iniciar sesión o esperar unos minutos.';
  }
  return msg;
}
