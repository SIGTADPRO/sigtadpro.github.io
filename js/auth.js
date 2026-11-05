// ═══════════════════════════════════════════════════════════════
// SIGTAD PRO — AUTENTICACIÓN BLINDADA (Google OAuth, Anti-Bots & Supabase)
// ═══════════════════════════════════════════════════════════════

let _authClient = null;
let currentUser = null;
let currentProfile = null;
let pendingConfirmEmail = '';
let _captchaToken = null;

function initAuth() {
  if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL.includes('YOUR_PROJECT') || !window.supabase) {
    console.log('[SIGTAD] Supabase Auth no configurado aún.');
    return;
  }
  try {
    _authClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Escuchar cambios de sesión en tiempo real (Login, Logout, Retorno de Google OAuth)
    _authClient.auth.onAuthStateChange(async (event, session) => {
      currentUser = session?.user || null;
      if (currentUser) {
        await _fetchUserProfile();
      } else {
        currentProfile = null;
      }
      _updateAuthUI();

      // Si viene recién logueado con Google y la URL tiene hash tokens, limpiarla limpiamente
      if (event === 'SIGNED_IN' && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, document.title, window.location.pathname);
      }
    });

    // Restaurar sesión persistente de localStorage
    _authClient.auth.getSession().then(async ({ data: { session } }) => {
      currentUser = session?.user || null;
      if (currentUser) {
        await _fetchUserProfile();
      }
      _updateAuthUI();
    });

    _initGoogleAuthButtons();
    _initCaptchaWidget();
  } catch(e) {
    console.error('[SIGTAD] Error en initAuth:', e);
  }
}

async function _fetchUserProfile() {
  if (!_authClient || !currentUser) return;
  try {
    const { data, error } = await _authClient
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (!error && data) {
      currentProfile = data;
    } else {
      // Fallback a metadata si la tabla profiles todavía se está sincronizando
      const meta = currentUser.user_metadata || {};
      currentProfile = {
        full_name: meta.full_name || meta.name || '',
        business_name: meta.business_name || '',
        address: meta.address || '',
        phone: meta.phone || '',
        email: currentUser.email || '',
        auth_provider: currentUser.app_metadata?.provider || 'email'
      };
    }
  } catch(e) {
    console.warn('[SIGTAD] Aviso al obtener perfil:', e.message);
  }
}

function _updateAuthUI() {
  const btn = document.getElementById('navAuthBtn');
  if (!btn) return;
  if (currentUser) {
    const name = currentProfile?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'Mi Cuenta';
    btn.textContent = `👤 ${name}`;
    btn.title = 'Clic para ver tu perfil, negocio o cerrar sesión';
  } else {
    btn.textContent = 'Acceso';
    btn.title = 'Iniciar sesión o registrarse';
  }
}

// ─── LOGIN Y REGISTRO CON GOOGLE (GMAIL OAUTH) ─────────────────
function _initGoogleAuthButtons() {
  document.querySelectorAll('.btnGoogleAuthAction').forEach(btn => {
    btn.addEventListener('click', handleGoogleSignIn);
  });
}

async function handleGoogleSignIn() {
  if (!_authClient) {
    alert('Modo demostración: Configura Supabase en js/config.js');
    return;
  }
  
  const msgLogin = document.getElementById('loginMessage');
  const msgReg   = document.getElementById('registerMessage');
  const targetMsg = msgReg && msgReg.offsetParent !== null ? msgReg : msgLogin;
  
  _showMsg(targetMsg, 'info', '⏳ Conectando con Google de forma segura...');

  try {
    const redirectUrl = window.location.origin + window.location.pathname;
    const { data, error } = await _authClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) {
      _showMsg(targetMsg, 'error', `❌ Error con Google: ${_translateError(error.message)}`);
    }
  } catch(err) {
    _showMsg(targetMsg, 'error', `❌ No se pudo conectar con Google: ${err.message}`);
  }
}

// ─── PROTECCIÓN ANTI-BOTS (CAPTCHA) ───────────────────────────
function _initCaptchaWidget() {
  const container = document.getElementById('registerCaptchaContainer');
  if (!container) return;

  if (typeof CAPTCHA_ENABLED !== 'undefined' && CAPTCHA_ENABLED && CAPTCHA_SITE_KEY) {
    container.style.display = 'flex';
    // Soporte para Cloudflare Turnstile o Google reCAPTCHA
    if (typeof turnstile !== 'undefined') {
      try {
        turnstile.render(container, {
          sitekey: CAPTCHA_SITE_KEY,
          theme: 'dark',
          callback: function(token) {
            _captchaToken = token;
          }
        });
      } catch(e) {
        console.warn('[SIGTAD] Turnstile render:', e);
      }
    } else if (typeof grecaptcha !== 'undefined') {
      try {
        grecaptcha.render(container, {
          sitekey: CAPTCHA_SITE_KEY,
          theme: 'dark',
          callback: function(token) {
            _captchaToken = token;
          }
        });
      } catch(e) {
        console.warn('[SIGTAD] reCAPTCHA render:', e);
      }
    }
  } else {
    container.style.display = 'none';
  }
}

// ─── APERTURA INTELIGENTE DE MODAL (LOGIN / PERFIL) ───────────
function openAuthModal(defaultTab = 'login') {
  if (currentUser) {
    _renderUserProfile();
    openModal('authModal');
    return;
  }

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

async function _renderUserProfile() {
  const tabs = document.getElementById('authTabsContainer');
  if (tabs) tabs.style.display = 'none';
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.style.display = 'none';
  const regForm = document.getElementById('registerForm');
  if (regForm) regForm.style.display = 'none';
  const profile = document.getElementById('profileView');
  if (profile) profile.style.display = 'block';

  if (!currentUser) return;
  await _fetchUserProfile();

  const meta = currentUser.user_metadata || {};
  const fullName = currentProfile?.full_name || meta.full_name || meta.name || currentUser.email?.split('@')[0] || 'Usuario SIGTAD';
  const email    = currentUser.email || '';
  const business = currentProfile?.business_name || meta.business_name || 'Comercio Registrado';
  const address  = currentProfile?.address || meta.address || 'No especificada';
  const phone    = currentProfile?.phone || meta.phone || 'No especificado';
  const provider = (currentUser.app_metadata?.provider === 'google') ? 'Google Account (Gmail)' : 'Email y Clave Segura';

  // Renderizado protegido contra XSS usando textContent
  const nameEl     = document.getElementById('profileName');
  const emailEl    = document.getElementById('profileEmail');
  const busEl      = document.getElementById('profileBusiness');
  const addrEl     = document.getElementById('profileAddress');
  const phoneEl    = document.getElementById('profilePhone');
  const provEl     = document.getElementById('profileProvider');

  if (nameEl)  nameEl.textContent  = fullName;
  if (emailEl) emailEl.textContent = email;
  if (busEl)   busEl.textContent   = business;
  if (addrEl)  addrEl.textContent  = address;
  if (phoneEl) phoneEl.textContent = phone;
  if (provEl)  provEl.textContent  = provider;

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
      await _fetchUserProfile();
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

// ─── REGISTRO BLINDADO MANUAL CON FORMULARIO ──────────────────
async function handleRegister(e) {
  e.preventDefault();
  const nameInput     = document.getElementById('registerName');
  const businessInput = document.getElementById('registerBusinessName');
  const addressInput  = document.getElementById('registerAddress');
  const phoneInput    = document.getElementById('registerPhone');
  const emailInput    = document.getElementById('registerEmail');
  const passInput     = document.getElementById('registerPassword');

  const fullName     = nameInput ? nameInput.value.trim() : '';
  const businessName = businessInput ? businessInput.value.trim() : '';
  const address      = addressInput ? addressInput.value.trim() : '';
  const phone        = phoneInput ? phoneInput.value.trim() : '';
  const email        = emailInput ? emailInput.value.trim() : '';
  const password     = passInput ? passInput.value : '';
  const subscribe    = document.getElementById('subscribeNewsletter')?.checked ?? true;
  const msg          = document.getElementById('registerMessage');
  const submitBtn    = e.target.querySelector('button[type="submit"]');

  if (!_authClient) {
    _showMsg(msg, 'info', 'ℹ️ Modo demostración: Configura Supabase en js/config.js');
    return;
  }

  // Validación de Captcha si está habilitado en configuración
  if (typeof CAPTCHA_ENABLED !== 'undefined' && CAPTCHA_ENABLED && !_captchaToken) {
    _showMsg(msg, 'error', '❌ Por favor completa la verificación de seguridad anti-robots antes de continuar.');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset.origText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Creando cuenta segura...';
  }
  _showMsg(msg, 'info', '⏳ Creando tu cuenta segura y cifrando datos...');

  try {
    const signUpOptions = {
      data: {
        full_name: fullName,
        name: fullName,
        business_name: businessName,
        address: address,
        phone: phone,
        subscribed_newsletter: subscribe
      }
    };

    if (_captchaToken) {
      signUpOptions.captchaToken = _captchaToken;
    }

    const { data, error } = await _authClient.auth.signUp({
      email,
      password,
      options: signUpOptions
    });

    if (error) {
      _showMsg(msg, 'error', `❌ ${_translateError(error.message)}`);
      return;
    }

    // Insertar/actualizar en public.profiles para blindaje de base de datos
    if (data?.user?.id) {
      try {
        await _authClient.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName,
          business_name: businessName,
          address: address,
          phone: phone,
          email: email,
          auth_provider: 'email',
          updated_at: new Date().toISOString()
        });
      } catch(profErr) {
        console.warn('[SIGTAD] Aviso en tabla profiles:', profErr.message);
      }
    }

    // Registrar en subscribers para compatibilidad del panel de control
    try {
      await _authClient.from('subscribers').upsert({
        email,
        name: `${fullName} (${businessName})`,
        created_at: new Date().toISOString()
      }, { onConflict: 'email' });
    } catch(subErr) {
      console.warn('[SIGTAD] Aviso en subscribers:', subErr.message);
    }

    _notifyAdmin(fullName, email, businessName, phone);

    if (data?.session) {
      currentUser = data.user;
      await _fetchUserProfile();
      _updateAuthUI();
      _showMsg(msg, 'success', '✅ ¡Cuenta creada exitosamente! Sesión protegida iniciada.');
      setTimeout(() => {
        closeModal('authModal');
        if (nameInput) nameInput.value = '';
        if (businessInput) businessInput.value = '';
        if (addressInput) addressInput.value = '';
        if (phoneInput) phoneInput.value = '';
        if (emailInput) emailInput.value = '';
        if (passInput) passInput.value = '';
        _showMsg(msg, '', '');
      }, 1200);
    } else {
      closeModal('authModal');
      setTimeout(() => openEmailConfirmModal(email), 300);
    }
  } catch(err) {
    _showMsg(msg, 'error', `❌ Error inesperado: ${err.message}`);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.origText || 'Crear Cuenta y Proteger mi Negocio';
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
    currentProfile = null;
    _updateAuthUI();
    _showMsg(msg, 'success', '👋 Sesión cerrada correctamente.');
    setTimeout(() => {
      closeModal('authModal');
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
function _notifyAdmin(userName, userEmail, business = '', phone = '') {
  if (typeof emailjs === 'undefined') return;
  if (!EMAILJS_PUBLIC_KEY || EMAILJS_PUBLIC_KEY.includes('YOUR')) return;
  try {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email:      ADMIN_EMAIL,
      user_name:     userName,
      user_email:    userEmail,
      business_name: business,
      user_phone:    phone,
      timestamp:     new Date().toLocaleString('es-VE'),
      subject:       '🔔 Nuevo registro en SIGTAD PRO'
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
    return 'Límite de seguridad temporal alcanzado. Si ya creaste tu cuenta, puedes iniciar sesión o esperar unos minutos.';
  }
  return msg;
}
