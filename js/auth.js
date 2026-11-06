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

      // Si viene recién logueado con Google y la URL tiene tokens o código, abrir inmediatamente el perfil
      if (event === 'SIGNED_IN') {
        const hadOAuth = window.location.hash.includes('access_token') || window.location.search.includes('code=');
        if (hadOAuth) {
          window.history.replaceState(null, document.title, window.location.pathname);
          setTimeout(() => {
            _renderUserProfile();
            openModal('authModal');
          }, 400);
        }
      }
    });

    // Detectar si Google devolvió algún error en el callback
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.substring(1) : '');
    const oauthError = urlParams.get('error_description') || hashParams.get('error_description');
    if (oauthError) {
      const cleanDesc = decodeURIComponent(oauthError).replace(/\+/g, ' ');
      console.warn('[SIGTAD OAuth Error]:', cleanDesc);
      window.history.replaceState(null, document.title, window.location.pathname);
      setTimeout(() => {
        openAuthModal('login');
        const msg = document.getElementById('loginMessage');
        if (msg) _showMsg(msg, 'error', `❌ Aviso de autenticación: ${cleanDesc}`);
      }, 400);
    }

    // Abrir modal de autenticación si se solicita por parámetro en la URL (?openAuth=login o ?openAuth=register)
    const openAuthParam = urlParams.get('openAuth');
    if (openAuthParam) {
      setTimeout(() => {
        openAuthModal(openAuthParam === 'register' ? 'register' : 'login');
      }, 100);
    }

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
    _initProfileInteractions();
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
    const business = currentProfile?.business_name?.trim();
    const fullName = currentProfile?.full_name?.trim() || currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'Mi Cuenta';
    btn.textContent = business ? `🏢 ${business}` : `👤 ${fullName}`;
    btn.title = 'Clic para ver tu perfil, negocio o gestionar licencias';
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

  // Restaurar visibilidad de caja de detalles vs formulario de edición
  const detailsBox = document.getElementById('profileDetailsBox');
  const editForm   = document.getElementById('editProfileForm');
  const btnCancel  = document.getElementById('btnCancelEditProfile');
  const btnToggle  = document.getElementById('btnToggleEditProfile');

  if (!currentUser) return;
  await _fetchUserProfile();

  const meta     = currentUser.user_metadata || {};
  const business = currentProfile?.business_name?.trim() || meta.business_name?.trim() || '';
  const fullName = currentProfile?.full_name?.trim() || meta.full_name?.trim() || meta.name?.trim() || currentUser.email?.split('@')[0] || 'Usuario SIGTAD';
  const email    = currentUser.email || '';
  const address  = currentProfile?.address || meta.address || 'No especificada';
  const phone    = currentProfile?.phone || meta.phone || 'No especificado';

  // Detección de perfil incompleto (común tras registro con Google OAuth)
  const isProfileIncomplete = !business || !phone || phone === 'No especificado';

  if (isProfileIncomplete) {
    if (detailsBox) detailsBox.style.display = 'none';
    if (editForm)   editForm.style.display   = 'flex';
    if (btnCancel)  btnCancel.style.display  = 'none';
    const editMsg = document.getElementById('editProfileMsg');
    if (editMsg) _showMsg(editMsg, 'info', '👋 ¡Bienvenido! Por favor ingresa el nombre de tu negocio y teléfono/WhatsApp para completar tu registro y gestionar tus licencias.');
  } else {
    if (detailsBox) detailsBox.style.display = 'block';
    if (editForm)   editForm.style.display   = 'none';
    if (btnCancel)  btnCancel.style.display  = 'inline-block';
    if (btnToggle)  btnToggle.style.display  = 'inline-flex';
  }

  // Renderizado protegido contra XSS usando textContent
  const nameEl  = document.getElementById('profileName');
  const subEl   = document.getElementById('profileUserSub');
  const emailEl = document.getElementById('profileEmail');
  const busEl   = document.getElementById('profileBusiness');
  const fullEl  = document.getElementById('profileFullName');
  const addrEl  = document.getElementById('profileAddress');
  const phoneEl = document.getElementById('profilePhone');

  // Si hay nombre de negocio, se muestra como título principal y el nombre del usuario abajo
  if (nameEl) nameEl.textContent = business ? business : fullName;
  if (subEl) {
    subEl.textContent = business ? `Responsable: ${fullName}` : 'Responsable';
    subEl.style.display = business ? 'block' : 'none';
  }
  if (emailEl) emailEl.textContent = email;
  if (busEl)   busEl.textContent   = business || 'No asignado';
  if (fullEl)  fullEl.textContent  = fullName;
  if (addrEl)  addrEl.textContent  = address;
  if (phoneEl) phoneEl.textContent = phone;

  // Precargar campos del formulario de edición
  const editBus   = document.getElementById('editBusinessName');
  const editFull  = document.getElementById('editFullName');
  const editAddr  = document.getElementById('editAddress');
  const editPhone = document.getElementById('editPhone');
  if (editBus)   editBus.value   = business;
  if (editFull)  editFull.value  = fullName;
  if (editAddr)  editAddr.value  = address === 'No especificada' ? '' : address;
  if (editPhone) editPhone.value = phone === 'No especificado' ? '' : phone;

  const msg = document.getElementById('profileMessage');
  if (msg) _showMsg(msg, '', '');
}

// ─── EDICIÓN DE PERFIL EN VIVO ────────────────────────────────
function _initProfileInteractions() {
  const btnToggle = document.getElementById('btnToggleEditProfile');
  const btnCancel = document.getElementById('btnCancelEditProfile');
  const detailsBox = document.getElementById('profileDetailsBox');
  const editForm   = document.getElementById('editProfileForm');
  const btnDelete  = document.getElementById('btnDeleteAccount');

  if (btnToggle) {
    btnToggle.onclick = () => {
      if (detailsBox) detailsBox.style.display = 'none';
      if (editForm) editForm.style.display = 'flex';
    };
  }

  if (btnCancel) {
    btnCancel.onclick = () => {
      if (detailsBox) detailsBox.style.display = 'flex';
      if (editForm) editForm.style.display = 'none';
      if (btnToggle) btnToggle.style.display = 'inline-flex';
    };
  }

  if (editForm) {
    editForm.onsubmit = handleUpdateProfile;
  }

  if (btnDelete) {
    btnDelete.onclick = handleDeleteAccount;
  }
}

async function handleUpdateProfile(e) {
  e.preventDefault();
  if (!_authClient || !currentUser) return;

  const msg = document.getElementById('profileMessage');
  const submitBtn = e.target.querySelector('button[type="submit"]');

  const businessName = document.getElementById('editBusinessName')?.value.trim() || '';
  const fullName     = document.getElementById('editFullName')?.value.trim() || '';
  const address      = document.getElementById('editAddress')?.value.trim() || '';
  const phone        = document.getElementById('editPhone')?.value.trim() || '';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset.origText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Guardando...';
  }
  _showMsg(msg, 'info', '⏳ Actualizando datos del negocio en Supabase...');

  try {
    const { error } = await _authClient.from('profiles').upsert({
      id: currentUser.id,
      business_name: businessName,
      full_name: fullName,
      address: address,
      phone: phone,
      email: currentUser.email,
      updated_at: new Date().toISOString()
    });

    if (error) {
      _showMsg(msg, 'error', `❌ Error al actualizar: ${error.message}`);
    } else {
      await _authClient.auth.updateUser({
        data: { business_name: businessName, full_name: fullName, address, phone }
      });

      await _fetchUserProfile();
      _updateAuthUI();
      _showMsg(msg, 'success', '✅ ¡Información actualizada exitosamente!');

      setTimeout(() => {
        const detailsBox = document.getElementById('profileDetailsBox');
        const editForm   = document.getElementById('editProfileForm');
        const btnToggle  = document.getElementById('btnToggleEditProfile');
        if (detailsBox) detailsBox.style.display = 'flex';
        if (editForm)   editForm.style.display   = 'none';
        if (btnToggle)  btnToggle.style.display  = 'inline-flex';
        _renderUserProfile();
      }, 700);
    }
  } catch(err) {
    _showMsg(msg, 'error', `❌ Error inesperado: ${err.message}`);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.origText || '💾 Guardar';
    }
  }
}

// ─── ELIMINAR CUENTA (CUMPLIMIENTO POLÍTICAS GOOGLE PLAY) ─────
async function handleDeleteAccount() {
  if (!_authClient || !currentUser) return;

  const confirmed = confirm('⚠️ ¿Estás COMPLETAMENTE SEGURO de que deseas eliminar tu cuenta?\n\nEsta acción es irreversible y borrará permanentemente tu usuario, perfil, licencias registradas y solicitudes asociadas.');
  if (!confirmed) return;

  const msg = document.getElementById('profileMessage');
  _showMsg(msg, 'info', '⏳ Eliminando tu cuenta y datos de forma permanente...');

  try {
    const { error } = await _authClient.rpc('delete_user_account');
    if (error) {
      console.warn('[SIGTAD] Fallo al invocar delete_user_account RPC:', error.message);
      await _authClient.auth.signOut();
      alert('Tu sesión ha sido cerrada. Recuerda ejecutar el script SQL actualizado en Supabase para el borrado en cascada.');
    } else {
      alert('✅ Tu cuenta y todos tus datos han sido eliminados permanentemente.');
    }
  } catch(err) {
    console.error('[SIGTAD] Error al eliminar cuenta:', err);
  } finally {
    currentUser = null;
    currentProfile = null;
    _updateAuthUI();
    closeModal('authModal');
    window.location.reload();
  }
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
        if (emailInput) emailInput.value = '';
        if (passInput) passInput.value = '';
        _showMsg(msg, '', '');
        _renderUserProfile();
      }, 700);
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
        if (nameInput) nameInput.value = '';
        if (businessInput) businessInput.value = '';
        if (addressInput) addressInput.value = '';
        if (phoneInput) phoneInput.value = '';
        if (emailInput) emailInput.value = '';
        if (passInput) passInput.value = '';
        _showMsg(msg, '', '');
        _renderUserProfile();
      }, 900);
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
  const confirmLogout = confirm('¿Estás seguro de que deseas salir y cerrar tu sesión en SIGTAD PRO?');
  if (!confirmLogout) return;

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
