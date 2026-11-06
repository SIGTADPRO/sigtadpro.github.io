/**
 * SIGTAD PRO® — js/licenses.js
 * Portal de Licencias por Sucursal, Descarga Anti-Fraude & Mesa de Ayuda en Tiempo Real
 * Desarrollado para Abg. Edinson Pereira (MaxiTHN)
 */

let _supabaseClient = null;
let _currentUser = null;
let _currentProfile = null;
let _userLicenses = [];
let _userTickets = [];
let _activeTicketId = null;
let _realtimeChannel = null;
let _currentModalLicense = null;

// Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', async () => {
  await initLicensesPortal();
});

async function initLicensesPortal() {
  if (typeof supabase === 'undefined' || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[SIGTAD Licencias] Supabase SDK no inicializado');
    showUnauthScreen();
    return;
  }

  _supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Escuchar cambios de sesión
  _supabaseClient.auth.onAuthStateChange(async (event, session) => {
    _currentUser = session?.user || null;
    if (_currentUser) {
      await loadPortalData();
    } else {
      showUnauthScreen();
    }
  });

  // Verificar sesión existente
  const { data: { session } } = await _supabaseClient.auth.getSession();
  _currentUser = session?.user || null;

  if (_currentUser) {
    await loadPortalData();
  } else {
    showUnauthScreen();
  }

  initTabListeners();
  initLogoutListener();
  initModalBackdropListeners();
}

function initModalBackdropListeners() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (overlay.id === 'licenseKeyModal') closeLicenseModal();
        if (overlay.id === 'newTicketModal') closeNewTicketModal();
        if (overlay.id === 'portalAuthModal') closePortalAuthModal();
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLicenseModal();
      closeNewTicketModal();
      closePortalAuthModal();
    }
  });
}

function showUnauthScreen() {
  const unauth = document.getElementById('unauthScreen');
  const authBox = document.getElementById('authContent');
  if (unauth) unauth.style.display = 'block';
  if (authBox) authBox.style.display = 'none';
}

function initLogoutListener() {
  const btn = document.getElementById('btnPortalLogout');
  if (btn) {
    btn.onclick = async () => {
      const confirmLogout = confirm('¿Estás seguro de que deseas salir y cerrar tu sesión en SIGTAD PRO?');
      if (!confirmLogout) return;
      if (_supabaseClient) await _supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    };
  }
}

// ─── MODAL DE INICIO DE SESIÓN DIRECTO EN EL PORTAL ───────────────
function openPortalAuthModal() {
  const modal = document.getElementById('portalAuthModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('modal-visible');
  }
}

function closePortalAuthModal() {
  const modal = document.getElementById('portalAuthModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('modal-visible');
  }
}

async function signInWithGooglePortal() {
  if (!_supabaseClient) return;
  const currentUrl = window.location.href.split('?')[0].split('#')[0];
  await _supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: currentUrl
    }
  });
}

async function handlePortalEmailLogin(e) {
  e.preventDefault();
  if (!_supabaseClient) return;

  const email = document.getElementById('portalLoginEmail')?.value.trim();
  const password = document.getElementById('portalLoginPassword')?.value;
  const msg = document.getElementById('portalLoginMsg');
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (!email || !password) return;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Verificando credenciales...';
  }
  showMsg(msg, 'info', '⏳ Iniciando sesión en SIGTAD PRO...');

  try {
    const { data, error } = await _supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    showMsg(msg, 'success', '✅ ¡Sesión iniciada con éxito! Cargando portal...');
    _currentUser = data.user;
    setTimeout(async () => {
      closePortalAuthModal();
      e.target.reset();
      showMsg(msg, '', '');
      await loadPortalData();
    }, 600);

  } catch(err) {
    console.error('[SIGTAD Licencias] Error al iniciar sesión:', err);
    showMsg(msg, 'error', `❌ Error: ${err.message}`);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ingresar al Portal';
    }
  }
}

window.openPortalAuthModal = openPortalAuthModal;
window.closePortalAuthModal = closePortalAuthModal;
window.signInWithGooglePortal = signInWithGooglePortal;
window.handlePortalEmailLogin = handlePortalEmailLogin;

// ─── CARGA DE DATOS DEL PERFIL Y PORTAL ─────────────────────────
async function loadPortalData() {
  const unauth = document.getElementById('unauthScreen');
  const authBox = document.getElementById('authContent');
  if (unauth) unauth.style.display = 'none';
  if (authBox) authBox.style.display = 'block';

  try {
    // 1. Obtener perfil del comercio
    const { data: profile } = await _supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', _currentUser.id)
      .maybeSingle();

    _currentProfile = profile || {};
    const businessName = _currentProfile.business_name?.trim() || _currentUser.user_metadata?.business_name || '';
    const fullName = _currentProfile.full_name?.trim() || _currentUser.user_metadata?.full_name || _currentUser.user_metadata?.name || _currentUser.email?.split('@')[0] || 'Comercio';

    const displayName = businessName || fullName;
    const navChip = document.getElementById('navMerchantName');
    const heroTitle = document.getElementById('heroBusinessTitle');

    if (navChip) navChip.textContent = displayName;
    if (heroTitle) heroTitle.textContent = businessName ? `🏢 ${businessName}` : `👤 ${fullName}`;

    // 2. Cargar Licencias y Tickets concurrentemente
    await Promise.all([
      fetchUserLicenses(),
      fetchUserTickets()
    ]);

    // 3. Suscribirse a cambios en tiempo real para actualizar la licencia al instante
    subscribeUserLicenses();

  } catch(err) {
    console.error('[SIGTAD Licencias] Error al cargar portal:', err);
  }
}

let _licensesRealtimeChannel = null;

function subscribeUserLicenses() {
  if (!_supabaseClient || !_currentUser) return;
  if (_licensesRealtimeChannel) {
    _supabaseClient.removeChannel(_licensesRealtimeChannel);
    _licensesRealtimeChannel = null;
  }

  _licensesRealtimeChannel = _supabaseClient
    .channel(`user_licenses_${_currentUser.id}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'license_requests', filter: `user_id=eq.${_currentUser.id}` },
      (payload) => {
        console.log('[SIGTAD Realtime Licencias] Cambio de licencia:', payload);
        fetchUserLicenses();
      }
    )
    .subscribe();
}

// ─── NAVEGACIÓN DE PESTAÑAS ────────────────────────────────────
function initTabListeners() {
  const tabButtons = document.querySelectorAll('.portal-tabs .tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchPortalTab(tabId);
    });
  });
}

function switchPortalTab(tabId) {
  document.querySelectorAll('.portal-tabs .tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === tabId);
  });
}

// ─── GESTIÓN DE LICENCIAS ──────────────────────────────────────
async function fetchUserLicenses() {
  if (!_supabaseClient || !_currentUser) return;
  const grid = document.getElementById('licensesGrid');

  try {
    const { data, error } = await _supabaseClient
      .from('license_requests')
      .select('*')
      .eq('user_id', _currentUser.id)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    _userLicenses = data || [];

    // Actualizar métricas
    const uniqueUuids = new Set(_userLicenses.map(l => (l.device_uuid || l.id).trim().toUpperCase()));
    const activeCount = _userLicenses.filter(l => l.status === 'approved').length;
    const statActive = document.getElementById('statActiveLicenses');
    const statBranches = document.getElementById('statBranches');
    if (statActive) statActive.textContent = activeCount;
    if (statBranches) statBranches.textContent = uniqueUuids.size;

    renderLicensesGrid(_userLicenses);
  } catch(err) {
    console.error('[SIGTAD Licencias] Error al obtener licencias:', err);
    if (grid) {
      grid.innerHTML = `<div style="grid-column: 1 / -1; color: #f87171; text-align: center; padding: 20px;">
        ❌ No fue posible sincronizar las licencias: ${err.message}
      </div>`;
    }
  }
}

function calculateExpiration(approvedAt, durationLabel) {
  if (!approvedAt || !durationLabel) return null;
  const label = durationLabel.toLowerCase().trim();
  if (label.includes('vitalicia') || label.includes('indefinida') || label.includes('permanente')) {
    return {
      isLifetime: true,
      label: 'Acceso Vitalicio',
      dateFormatted: 'Vitalicia (De por Vida)',
      isExpired: false,
      daysLeft: 999999
    };
  }

  const start = new Date(approvedAt);
  if (isNaN(start.getTime())) return null;

  const target = new Date(start.getTime());
  if (label.includes('15') && (label.includes('d') || label.includes('prueba'))) {
    target.setDate(target.getDate() + 15);
  } else if (label.includes('1 mes') || label.includes('mensual')) {
    target.setMonth(target.getMonth() + 1);
  } else if (label.includes('3 mes') || label.includes('trimestral')) {
    target.setMonth(target.getMonth() + 3);
  } else if (label.includes('6 mes') || label.includes('semestral')) {
    target.setMonth(target.getMonth() + 6);
  } else if (label.includes('1 a') || label.includes('anual')) {
    target.setFullYear(target.getFullYear() + 1);
  } else {
    target.setFullYear(target.getFullYear() + 1);
  }

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isExpired = daysLeft <= 0;

  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  const dateFormatted = `${dd}/${mm}/${yyyy}`;

  return {
    isLifetime: false,
    label: isExpired ? `Expiró el ${dateFormatted}` : `Vence el ${dateFormatted}`,
    dateFormatted,
    daysLeft,
    isExpired
  };
}

function renderLicensesGrid(licenses) {
  const grid = document.getElementById('licensesGrid');
  if (!grid) return;

  if (!licenses || licenses.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: rgba(255,255,255,0.02); border: 1px dashed var(--border); border-radius: var(--radius-lg);">
        <div style="font-size: 3rem; margin-bottom: 12px;">🏪</div>
        <h3>No tienes licencias registradas aún</h3>
        <p style="color: var(--text-secondary); max-width: 440px; margin: 8px auto 20px; font-size: 0.9rem;">
          Registra tu primera sucursal vinculando el UUID físico de tu máquina para comenzar a operar con SIGTAD PRO.
        </p>
        <button class="btn-primary" onclick="switchPortalTab('tabRequest')" style="padding: 10px 24px;">
          ➕ Solicitar Mi Primera Licencia
        </button>
      </div>
    `;
    return;
  }

  // Agrupar licencias por terminal física (device_uuid)
  const branchesMap = new Map();
  licenses.forEach(lic => {
    const key = (lic.device_uuid || lic.id).trim().toUpperCase();
    if (!branchesMap.has(key)) {
      branchesMap.set(key, []);
    }
    branchesMap.get(key).push(lic);
  });

  grid.innerHTML = '';

  branchesMap.forEach((branchList, branchKey) => {
    // Ordenar de más reciente a más antigua
    branchList.sort((a, b) => new Date(b.requested_at || 0) - new Date(a.requested_at || 0));

    const latestLic = branchList[0];
    const historyList = branchList.slice(1);

    const isApproved = (latestLic.status === 'approved');
    const isPending  = (latestLic.status === 'pending');
    const isRenewal  = (latestLic.request_type === 'renewal');

    const statusLabel = isApproved ? 'Aprobada & Activa' : (isPending ? 'En Revisión por Maxi' : 'Rechazada');
    const statusClass = isApproved ? 'approved' : (isPending ? 'pending' : 'rejected');

    const requestedDate = latestLic.requested_at ? new Date(latestLic.requested_at).toLocaleDateString('es-VE') : '—';
    const durationLabel = latestLic.duration_label || (isApproved ? 'Activa' : 'Pendiente');

    // Calcular fecha de vencimiento
    const calcExp = calculateExpiration(latestLic.approved_at || latestLic.requested_at, durationLabel);
    let expPillHtml = '';
    if (isApproved && calcExp) {
      if (calcExp.isLifetime) {
        expPillHtml = `<span class="exp-pill exp-lifetime">🌟 Licencia Vitalicia</span>`;
      } else if (calcExp.isExpired) {
        expPillHtml = `<span class="exp-pill exp-expired">⚠️ Expiró el ${calcExp.dateFormatted}</span>`;
      } else if (calcExp.daysLeft <= 15) {
        expPillHtml = `<span class="exp-pill exp-warning">⏳ Vence el ${calcExp.dateFormatted} (${calcExp.daysLeft} d)</span>`;
      } else {
        expPillHtml = `<span class="exp-pill exp-valid">✅ Vence el ${calcExp.dateFormatted} (${calcExp.daysLeft} días)</span>`;
      }
    }

    const safeId = branchKey.replace(/[^a-zA-Z0-9]/g, '_');

    const card = document.createElement('div');
    card.className = `license-card status-${latestLic.status}`;

    card.innerHTML = `
      <div>
        <div class="license-header">
          <div>
            <h4 class="branch-title">🏢 ${escapeHtml(latestLic.branch_name)}</h4>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
              <span class="badge-status ${statusClass}">${statusLabel}</span>
              ${isRenewal ? '<span class="badge-status" style="background: rgba(139, 92, 246, 0.18); color: #c4b5fd; border: 1px solid rgba(139, 92, 246, 0.4); font-size: 0.72rem; padding: 2px 6px;">🔄 Renovación</span>' : ''}
            </div>
          </div>
        </div>

        <div class="meta-row">
          <span>Vigencia:</span>
          <span class="meta-val duration">${escapeHtml(durationLabel)}</span>
        </div>

        ${isApproved && calcExp ? `
          <div class="meta-row">
            <span>Vencimiento:</span>
            <span class="meta-val">${expPillHtml}</span>
          </div>
        ` : ''}

        <div class="meta-row">
          <span>Pago Reportado:</span>
          <span class="meta-val">${latestLic.payment_method === 'pago_movil' ? `📱 Pago Móvil (Ref: #${escapeHtml(latestLic.payment_reference || 'S/R')})` : '💵 Efectivo'}</span>
        </div>

        <div class="meta-row">
          <span>Última Solicitud:</span>
          <span class="meta-val">${requestedDate}</span>
        </div>

        <div class="uuid-box" title="UUID de hardware blindado">
          <span>🔒 ${escapeHtml(latestLic.device_uuid)}</span>
          <button type="button" style="background:none; border:none; color:#38bdf8; cursor:pointer;" onclick="navigator.clipboard.writeText('${escapeHtml(latestLic.device_uuid)}'); alert('UUID copiado al portapapeles');" title="Copiar UUID">📋</button>
        </div>
      </div>

      <div style="margin-top: 14px;">
        ${isApproved ? (
          (!latestLic.license_key || latestLic.viewed_at) ? `
            <div style="text-align: center; font-size: 0.8rem; color: #34d399; padding: 8px 10px; background: rgba(16, 185, 129, 0.08); border-radius: var(--radius); border: 1px dashed rgba(52, 211, 153, 0.3); margin-bottom: 8px;">
              🔒 Llave entregada y destruida del servidor por seguridad.
            </div>
          ` : `
            <button class="btn-primary btn-full" onclick="openLicenseModal('${latestLic.id}')" style="padding: 10px; font-size: 0.88rem; margin-bottom: 8px;">
              🔑 Ver y Respaldar Llave
            </button>
          `
        ) : (isPending ? `
          <div style="text-align: center; font-size: 0.82rem; color: #fbbf24; padding: 8px; background: rgba(245, 158, 11, 0.1); border-radius: var(--radius); margin-bottom: 8px;">
            ⏳ Solicitud en revisión (${latestLic.payment_method === 'pago_movil' ? 'Pago Móvil Ref #' + escapeHtml(latestLic.payment_reference || '—') : 'Efectivo'}). Maxi emitirá la llave en breve.
          </div>
        ` : `
          <div style="text-align: center; font-size: 0.82rem; color: #f87171; padding: 8px; margin-bottom: 8px;">
            ❌ Solicitud no aprobada. Contacta a soporte para más detalles.
          </div>
        `)}

        ${isApproved ? `
          <button type="button" class="btn-outline btn-full" onclick="startBranchRenewal('${escapeHtml(latestLic.branch_name)}', '${escapeHtml(latestLic.device_uuid)}')" style="padding: 8px 12px; font-size: 0.84rem; border-color: #3b82f6; color: #60a5fa;">
            🔄 Renovar Licencia de esta Sucursal
          </button>
        ` : ''}

        ${historyList.length > 0 ? `
          <div style="margin-top: 12px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px;">
            <button type="button" class="history-accordion-btn" onclick="toggleBranchHistory('hist_${safeId}')">
              <span>📜 Historial de Licencias (${historyList.length})</span>
              <span id="arrow_hist_${safeId}">▼</span>
            </button>
            <div id="hist_${safeId}" class="history-drawer" style="display: none;">
              <table class="history-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Vigencia</th>
                    <th>Pago</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  ${historyList.map(h => {
                    const hIsPm = (h.payment_method === 'pago_movil');
                    const hDate = h.requested_at ? new Date(h.requested_at).toLocaleDateString('es-VE') : '—';
                    const hType = (h.request_type === 'renewal') ? '🔄 Renov.' : '➕ Nueva';
                    const hStatusBadge = (h.status === 'approved')
                      ? '<span style="color:#34d399; font-weight:600;">Aprobada</span>'
                      : (h.status === 'pending' ? '<span style="color:#fbbf24; font-weight:600;">Pendiente</span>' : '<span style="color:#f87171; font-weight:600;">Rechazada</span>');
                    return `
                      <tr>
                        <td>${hType}</td>
                        <td>${escapeHtml(h.duration_label || '—')}</td>
                        <td>${hIsPm ? '📱 #' + escapeHtml(h.payment_reference || 'S/R') : '💵 Ef.'}</td>
                        <td>${hDate}</td>
                        <td>${hStatusBadge}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    grid.appendChild(card);
  });
}

// ─── GESTIÓN DE REPORTES DE PAGO ─────────────────────────────
let _selectedPaymentMethod = 'pago_movil';
let _proofBase64 = null;

function selectPaymentMethod(method) {
  _selectedPaymentMethod = method;
  const pillPm = document.getElementById('pillPagoMovil');
  const pillEf = document.getElementById('pillEfectivo');
  const boxPm = document.getElementById('boxPagoMovil');
  const boxEf = document.getElementById('boxEfectivo');

  if (method === 'pago_movil') {
    if (pillPm) pillPm.classList.add('active');
    if (pillEf) pillEf.classList.remove('active');
    if (boxPm) boxPm.style.display = 'block';
    if (boxEf) boxEf.style.display = 'none';
  } else {
    if (pillEf) pillEf.classList.add('active');
    if (pillPm) pillPm.classList.remove('active');
    if (boxEf) boxEf.style.display = 'block';
    if (boxPm) boxPm.style.display = 'none';
  }
}

function handleProofImageSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const img = new Image();
    img.onload = function() {
      // Comprimir con canvas para mantener el tamaño muy ligero (< 80KB)
      const maxDim = 800;
      let width = img.width;
      let height = img.height;
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      _proofBase64 = canvas.toDataURL('image/jpeg', 0.72);

      const previewBox = document.getElementById('proofPreviewBox');
      const previewImg = document.getElementById('proofPreviewImg');
      if (previewImg) previewImg.src = _proofBase64;
      if (previewBox) previewBox.style.display = 'block';
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

function clearProofImage() {
  _proofBase64 = null;
  const input = document.getElementById('reqPayProof');
  if (input) input.value = '';
  const previewBox = document.getElementById('proofPreviewBox');
  if (previewBox) previewBox.style.display = 'none';
}

// ─── GESTIÓN DE RENOVACIÓN DE SUCURSALES & HISTORIAL ─────────
function startBranchRenewal(branchName, deviceUuid) {
  switchPortalTab('tabRequest');

  const nameInput = document.getElementById('reqBranchName');
  const uuidInput = document.getElementById('reqDeviceUuid');
  const typeInput = document.getElementById('reqRequestType');
  const banner = document.getElementById('renewalNoticeBanner');
  const bannerLabel = document.getElementById('renewalBranchLabel');

  if (nameInput) {
    nameInput.value = branchName;
    nameInput.readOnly = true;
    nameInput.classList.add('input-locked');
  }
  if (uuidInput) {
    uuidInput.value = deviceUuid;
    uuidInput.readOnly = true;
    uuidInput.classList.add('input-locked');
  }
  if (typeInput) {
    typeInput.value = 'renewal';
  }
  if (banner) banner.style.display = 'flex';
  if (bannerLabel) bannerLabel.textContent = `"${branchName}"`;

  window.scrollTo({ top: 120, behavior: 'smooth' });
}

function cancelBranchRenewal() {
  const nameInput = document.getElementById('reqBranchName');
  const uuidInput = document.getElementById('reqDeviceUuid');
  const typeInput = document.getElementById('reqRequestType');
  const banner = document.getElementById('renewalNoticeBanner');

  if (nameInput) {
    nameInput.value = '';
    nameInput.readOnly = false;
    nameInput.classList.remove('input-locked');
  }
  if (uuidInput) {
    uuidInput.value = '';
    uuidInput.readOnly = false;
    uuidInput.classList.remove('input-locked');
  }
  if (typeInput) {
    typeInput.value = 'new';
  }
  if (banner) banner.style.display = 'none';
}

function toggleBranchHistory(drawerId) {
  const drawer = document.getElementById(drawerId);
  const arrow = document.getElementById(`arrow_${drawerId}`);
  if (!drawer) return;
  const isHidden = (drawer.style.display === 'none' || !drawer.style.display);
  drawer.style.display = isHidden ? 'block' : 'none';
  if (arrow) arrow.textContent = isHidden ? '▲' : '▼';
}

function copyPagoMovilData() {
  const text = `DATOS PAGO MÓVIL SIGTAD PRO:\nBanco: Banco de Venezuela (0102)\nCédula: 28573445\nTeléfono: 04128835935\nTitular: Edinson Pereira`;
  navigator.clipboard.writeText(text).then(() => {
    alert('📋 Datos oficiales de Pago Móvil copiados al portapapeles:\n\nBanco: Banco de Venezuela (0102)\nC.I.: V-28.573.445\nTeléfono: 0412-8835935\nTitular: Edinson Pereira');
  }).catch(() => {
    prompt('Copia los datos oficiales de Pago Móvil:', text);
  });
}

window.selectPaymentMethod = selectPaymentMethod;
window.handleProofImageSelect = handleProofImageSelect;
window.clearProofImage = clearProofImage;
window.startBranchRenewal = startBranchRenewal;
window.cancelBranchRenewal = cancelBranchRenewal;
window.toggleBranchHistory = toggleBranchHistory;
window.copyPagoMovilData = copyPagoMovilData;

// ─── FORMULARIO: CREAR SOLICITUD DE LICENCIA ──────────────────
async function handleCreateLicenseRequest(e) {
  e.preventDefault();
  if (!_supabaseClient || !_currentUser) return;

  const msgBox = document.getElementById('reqMessage');
  const submitBtn = e.target.querySelector('button[type="submit"]');

  const branchName = document.getElementById('reqBranchName')?.value.trim();
  const deviceUuid = document.getElementById('reqDeviceUuid')?.value.trim();
  const payReference = document.getElementById('reqPayReference')?.value.trim() || '';
  const requestType = document.getElementById('reqRequestType')?.value || 'new';

  if (!branchName || !deviceUuid) {
    showMsg(msgBox, 'error', '❌ Por favor ingresa el nombre de la sucursal y el UUID del equipo.');
    return;
  }

  if (_selectedPaymentMethod === 'pago_movil' && !payReference) {
    showMsg(msgBox, 'error', '❌ Por favor ingresa el número de referencia del Pago Móvil para verificar tu pago.');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Registrando y blindando solicitud...';
  }
  showMsg(msgBox, 'info', '⏳ Enviando solicitud a Maxi...');

  try {
    const businessName = _currentProfile?.business_name || _currentUser.user_metadata?.business_name || 'Comercio Registrado';

    const { data, error } = await _supabaseClient
      .from('license_requests')
      .insert({
        user_id: _currentUser.id,
        user_email: _currentUser.email,
        business_name: businessName,
        branch_name: branchName,
        device_uuid: deviceUuid,
        status: 'pending',
        duration_label: 'Pendiente',
        request_type: requestType,
        payment_method: _selectedPaymentMethod,
        payment_reference: _selectedPaymentMethod === 'pago_movil' ? payReference : 'Acuerdo Efectivo',
        payment_receipt_url: _proofBase64 || null
      })
      .select()
      .single();

    if (error) throw error;

    showMsg(msgBox, 'success', requestType === 'renewal'
      ? '✅ ¡Solicitud de renovación enviada con éxito a Maxi!'
      : '✅ ¡Solicitud registrada con éxito! El UUID ha quedado blindado.');
    e.target.reset();
    clearProofImage();
    cancelBranchRenewal();

    // Actualizar lista y cambiar a pestaña de licencias
    setTimeout(async () => {
      await fetchUserLicenses();
      switchPortalTab('tabLicenses');
      showMsg(msgBox, '', '');
    }, 1200);

  } catch(err) {
    console.error('[SIGTAD Licencias] Error al registrar solicitud:', err);
    showMsg(msgBox, 'error', `❌ Error: ${err.message}`);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar Solicitud a Maxi';
    }
  }
}

// ─── MODAL DE LLAVE (ULTRA-COMPACTO & UN SOLO USO / BURN-ON-READ) ───────────
async function openLicenseModal(licenseId) {
  let lic = _userLicenses.find(l => String(l.id) === String(licenseId));
  if (!lic && _supabaseClient) {
    try {
      const { data } = await _supabaseClient.from('license_requests').select('*').eq('id', licenseId).single();
      if (data) lic = data;
    } catch(e) {
      console.warn('[SIGTAD] Fallback al buscar licencia:', e);
    }
  }

  if (!lic) {
    alert('No fue posible cargar los datos de esta licencia. Por favor refresca la página.');
    return;
  }
  _currentModalLicense = lic;

  const modal = document.getElementById('licenseKeyModal');
  const branchTitle = document.getElementById('modalBranchTitle');
  const durationLabel = document.getElementById('modalDurationLabel');
  const feedback = document.getElementById('copySuccessFeedback');

  if (branchTitle) branchTitle.textContent = `Licencia — ${lic.branch_name || 'Sucursal'}`;
  if (durationLabel) durationLabel.textContent = `Periodo de Vigencia: ${lic.duration_label || 'Activa'}`;
  if (feedback) feedback.style.display = 'none';

  // Mostrar el modal inmediatamente
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('modal-visible');
  }
}

async function closeLicenseModal() {
  const modal = document.getElementById('licenseKeyModal');
  if (modal) {
    modal.classList.remove('modal-visible');
    modal.style.display = 'none';
  }

  // Destruir la llave en el servidor (Burn-on-Read) para máxima ciberseguridad
  if (_currentModalLicense?.id && _supabaseClient) {
    const licId = _currentModalLicense.id;
    try {
      // 1. Ejecutar RPC de autodestrucción
      await _supabaseClient.rpc('destroy_license_key', { p_license_id: licId });
      console.log('[SIGTAD Security] Llave autodestruida del servidor con éxito.');
    } catch(e) {
      // Fallback update directo
      try {
        await _supabaseClient
          .from('license_requests')
          .update({ license_key: null, viewed_at: new Date().toISOString() })
          .eq('id', licId);
      } catch(ex) {
        console.warn('[SIGTAD Security] Excepción al autodestruir:', ex);
      }
    }

    // Actualizar estado en memoria local
    const item = _userLicenses.find(l => String(l.id) === String(licId));
    if (item) {
      item.license_key = null;
      item.viewed_at = new Date().toISOString();
    }
    renderLicensesGrid(_userLicenses);
  }

  _currentModalLicense = null;
}

window.openLicenseModal = openLicenseModal;
window.closeLicenseModal = closeLicenseModal;
window.openNewTicketModal = openNewTicketModal;
window.closeNewTicketModal = closeNewTicketModal;

function copyLicenseKey() {
  if (!_currentModalLicense?.license_key) {
    alert('Esta llave ya fue reclamada y destruida del servidor por seguridad.');
    return;
  }
  navigator.clipboard.writeText(_currentModalLicense.license_key)
    .then(() => {
      const feedback = document.getElementById('copySuccessFeedback');
      if (feedback) feedback.style.display = 'block';
    })
    .catch(() => alert('No se pudo copiar automáticamente. Por favor descarga el archivo .txt.'));
}

function downloadLicenseTxt() {
  if (!_currentModalLicense?.license_key) {
    alert('Esta llave ya fue reclamada y destruida del servidor por seguridad.');
    return;
  }
  const lic = _currentModalLicense;
  const cleanBranch = lic.branch_name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `SIGTAD_PRO_Licencia_${cleanBranch}.txt`;

  const content = `================================================================
SIGTAD PRO® — ARCHIVO OFICIAL DE LICENCIA Y ACTIVACIÓN
================================================================
Comercio:         ${lic.business_name || 'Comercio Registrado'}
Sucursal:         ${lic.branch_name}
UUID de Máquina:  ${lic.device_uuid}
Vigencia / Tipo:  ${lic.duration_label || 'Activa'}
Fecha de Emisión: ${lic.approved_at ? new Date(lic.approved_at).toLocaleString('es-VE') : new Date().toLocaleString('es-VE')}

----------------------------------------------------------------
LLAVE DE ACTIVACIÓN SEGURA:
${lic.license_key || 'PENDIENTE'}
----------------------------------------------------------------

INSTRUCCIONES DE ACTIVACIÓN:
1. Abra el sistema SIGTAD PRO en el equipo correspondiente.
2. Vaya al menú superior: 'Ayuda' > 'Licencia' > 'Activar Sistema'.
3. Pegue la llave de activación arriba indicada tal como aparece.
4. Haga clic en 'Verificar y Desbloquear'. El sistema operará 100% offline.

AVISO DE SEGURIDAD:
Esta llave es única e intransferible. Ha sido generada exclusivamente
para el hardware con el UUID indicado y no funcionará en ningún otro equipo.

Soporte Oficial: Abg. Edinson Pereira (MaxiTHN) — SIGTAD PRO®
================================================================`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function shareLicenseWhatsApp() {
  if (!_currentModalLicense) return;
  const lic = _currentModalLicense;
  const text = `🔑 *SIGTAD PRO — Llave de Licencia*\n\n` +
    `🏢 *Sucursal:* ${lic.branch_name}\n` +
    `⏳ *Vigencia:* ${lic.duration_label || 'Activa'}\n` +
    `🖥️ *UUID Vinculado:* \`${lic.device_uuid}\`\n\n` +
    `*Llave de Activación:*\n\`${lic.license_key}\`\n\n` +
    `_Pega esta clave en SIGTAD PRO (Menú Ayuda > Licencia) para activar el sistema offline._`;

  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// ─── MESA DE AYUDA / TICKETS & CHAT EN VIVO ────────────────────
async function fetchUserTickets() {
  if (!_supabaseClient || !_currentUser) return;
  const listEl = document.getElementById('ticketsList');

  try {
    const { data, error } = await _supabaseClient
      .from('support_tickets')
      .select('*')
      .eq('user_id', _currentUser.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    _userTickets = data || [];

    // Actualizar contador
    const openCount = _userTickets.filter(t => t.status !== 'closed').length;
    const statTickets = document.getElementById('statOpenTickets');
    if (statTickets) statTickets.textContent = openCount;

    renderTicketsList(_userTickets);
  } catch(err) {
    console.error('[SIGTAD Licencias] Error al cargar tickets:', err);
    if (listEl) {
      listEl.innerHTML = `<div style="color: #f87171; padding: 16px; font-size: 0.85rem;">
        ❌ Error al cargar tickets: ${err.message}
      </div>`;
    }
  }
}

function renderTicketsList(tickets) {
  const listEl = document.getElementById('ticketsList');
  if (!listEl) return;

  if (!tickets || tickets.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 24px 10px; color: var(--text-muted); font-size: 0.85rem;">
        No tienes tickets abiertos.<br>¿Tienes alguna duda o solicitud? Haz clic en "Nuevo Ticket".
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';
  tickets.forEach(t => {
    const item = document.createElement('div');
    item.className = `ticket-item ${t.id === _activeTicketId ? 'active' : ''}`;
    item.onclick = () => selectTicket(t.id);

    const dateStr = t.updated_at ? new Date(t.updated_at).toLocaleDateString('es-VE') : '';
    item.innerHTML = `
      <div class="ticket-item-subject">${escapeHtml(t.subject)}</div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span class="badge-status ${t.status === 'open' ? 'approved' : 'pending'}" style="font-size: 0.7rem; padding: 2px 8px;">
          ${t.status === 'open' ? 'Abierto' : (t.status === 'in_progress' ? 'En Curso' : 'Cerrado')}
        </span>
        <span class="ticket-item-date">${dateStr}</span>
      </div>
    `;
    listEl.appendChild(item);
  });
}

function openNewTicketModal() {
  const modal = document.getElementById('newTicketModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('modal-visible');
  }
}

function closeNewTicketModal() {
  const modal = document.getElementById('newTicketModal');
  if (modal) {
    modal.classList.remove('modal-visible');
    modal.style.display = 'none';
  }
}

async function handleCreateTicket(e) {
  e.preventDefault();
  if (!_supabaseClient || !_currentUser) return;

  const msgBox = document.getElementById('ticketModalMsg');
  const subject = document.getElementById('ticketSubject')?.value.trim();
  const firstMsg = document.getElementById('ticketFirstMessage')?.value.trim();

  if (!subject || !firstMsg) return;

  showMsg(msgBox, 'info', '⏳ Creando ticket y abriendo canal seguro...');

  try {
    const businessName = _currentProfile?.business_name || _currentUser.user_metadata?.business_name || '';
    const userName = _currentProfile?.full_name || _currentUser.user_metadata?.full_name || _currentUser.email?.split('@')[0] || '';

    // 1. Insertar ticket
    const { data: ticket, error: tErr } = await _supabaseClient
      .from('support_tickets')
      .insert({
        user_id: _currentUser.id,
        user_email: _currentUser.email,
        user_name: userName,
        business_name: businessName,
        subject: subject,
        status: 'open'
      })
      .select()
      .single();

    if (tErr) throw tErr;

    // 2. Insertar primer mensaje
    const { error: mErr } = await _supabaseClient
      .from('ticket_messages')
      .insert({
        ticket_id: ticket.id,
        sender_id: _currentUser.id,
        sender_email: _currentUser.email,
        sender_role: 'user',
        message: firstMsg
      });

    if (mErr) throw mErr;

    closeNewTicketModal();
    e.target.reset();
    showMsg(msgBox, '', '');

    await fetchUserTickets();
    selectTicket(ticket.id);

  } catch(err) {
    console.error('[SIGTAD Licencias] Error al crear ticket:', err);
    showMsg(msgBox, 'error', `❌ Error: ${err.message}`);
  }
}

// ─── CONVERSACIÓN EN TIEMPO REAL CON SUPABASE ──────────────────
async function selectTicket(ticketId) {
  _activeTicketId = ticketId;
  const ticket = _userTickets.find(t => t.id === ticketId);
  if (!ticket) return;

  renderTicketsList(_userTickets);

  // Navegación responsiva Master-Detail en dispositivos móviles (<= 820px)
  const ticketsListCol = document.querySelector('.tickets-list-col');
  const chatViewCol = document.querySelector('.chat-view-col');
  if (window.innerWidth <= 820) {
    if (ticketsListCol) ticketsListCol.classList.add('mobile-hidden');
    if (chatViewCol) chatViewCol.classList.add('mobile-active');
  }

  const placeholder = document.getElementById('emptyChatPlaceholder');
  const chatArea = document.getElementById('activeChatArea');
  const subjEl = document.getElementById('activeChatSubject');
  const statusEl = document.getElementById('activeChatStatus');

  if (placeholder) placeholder.style.display = 'none';
  if (chatArea) chatArea.style.display = 'flex';
  if (subjEl) subjEl.textContent = ticket.subject;
  if (statusEl) {
    statusEl.textContent = (ticket.status === 'open') ? 'Abierto' : ((ticket.status === 'in_progress') ? 'En Curso' : 'Cerrado');
    statusEl.className = `badge-status ${ticket.status === 'open' ? 'approved' : 'pending'}`;
  }

  await loadChatMessages(ticketId);
  subscribeToTicketRealtime(ticketId);
}

function backToMobileTicketsList() {
  const ticketsListCol = document.querySelector('.tickets-list-col');
  const chatViewCol = document.querySelector('.chat-view-col');
  if (ticketsListCol) ticketsListCol.classList.remove('mobile-hidden');
  if (chatViewCol) chatViewCol.classList.remove('mobile-active');
  _activeTicketId = null;
  renderTicketsList(_userTickets);
}

window.backToMobileTicketsList = backToMobileTicketsList;

async function loadChatMessages(ticketId) {
  const box = document.getElementById('chatMessages');
  if (!box) return;

  box.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem;">⏳ Cargando mensajes cifrados...</div>';

  try {
    const { data: messages, error } = await _supabaseClient
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    box.innerHTML = '';
    if (!messages || messages.length === 0) {
      box.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.85rem;">No hay mensajes en esta conversación aún.</div>';
      return;
    }

    messages.forEach(msg => appendChatBubble(msg));
    scrollChatToBottom();
  } catch(err) {
    console.error('[SIGTAD Licencias] Error al cargar mensajes:', err);
    box.innerHTML = `<div style="color: #f87171; text-align: center; font-size: 0.85rem;">❌ Error: ${err.message}</div>`;
  }
}

function appendChatBubble(msg) {
  const box = document.getElementById('chatMessages');
  if (!box) return;

  const isAdmin = (msg.sender_role === 'admin');
  const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${isAdmin ? 'msg-admin' : 'msg-user'}`;

  bubble.innerHTML = `
    <div class="bubble-author ${isAdmin ? 'admin-author' : 'user-author'}">
      ${isAdmin ? '🛡️ Soporte Oficial (MaxiTHN)' : '👤 Tú'}
    </div>
    <div class="bubble-text">${escapeHtml(msg.message)}</div>
    <div class="bubble-time">${timeStr}</div>
  `;

  box.appendChild(bubble);
}

function scrollChatToBottom() {
  const box = document.getElementById('chatMessages');
  if (box) box.scrollTop = box.scrollHeight;
}

function subscribeToTicketRealtime(ticketId) {
  // Desuscribir canal previo
  if (_realtimeChannel) {
    _supabaseClient.removeChannel(_realtimeChannel);
    _realtimeChannel = null;
  }

  _realtimeChannel = _supabaseClient
    .channel(`chat_ticket_${ticketId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_messages',
        filter: `ticket_id=eq.${ticketId}`
      },
      (payload) => {
        const newMsg = payload.new;
        // Solo agregar si no es del usuario actual para evitar duplicados locales
        if (newMsg.sender_id !== _currentUser.id) {
          appendChatBubble(newMsg);
          scrollChatToBottom();
          // Notificación sonora suave si llega mensaje de Maxi
          playNotificationBeep();
        }
      }
    )
    .subscribe();
}

async function handleSendChatMessage(e) {
  e.preventDefault();
  if (!_supabaseClient || !_currentUser || !_activeTicketId) return;

  const input = document.getElementById('chatMessageInput');
  const text = input?.value.trim();
  if (!text) return;

  input.value = '';

  const optimisticMsg = {
    ticket_id: _activeTicketId,
    sender_id: _currentUser.id,
    sender_email: _currentUser.email,
    sender_role: 'user',
    message: text,
    created_at: new Date().toISOString()
  };

  appendChatBubble(optimisticMsg);
  scrollChatToBottom();

  try {
    const { error } = await _supabaseClient
      .from('ticket_messages')
      .insert({
        ticket_id: _activeTicketId,
        sender_id: _currentUser.id,
        sender_email: _currentUser.email,
        sender_role: 'user',
        message: text
      });

    if (error) throw error;

    // Actualizar updated_at del ticket
    await _supabaseClient
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', _activeTicketId);

  } catch(err) {
    console.error('[SIGTAD Licencias] Error al enviar mensaje:', err);
    alert('❌ Error al enviar mensaje: ' + err.message);
  }
}

// ─── UTILIDADES ────────────────────────────────────────────────
function showMsg(el, type, text) {
  if (!el) return;
  el.className = `auth-message ${type}`;
  el.textContent = text;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function playNotificationBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(580, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch(e) {
    // Silencioso si AudioContext está bloqueado por política de navegador
  }
}
