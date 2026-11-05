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
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLicenseModal();
      closeNewTicketModal();
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
      if (_supabaseClient) await _supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    };
  }
}

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

  } catch(err) {
    console.error('[SIGTAD Licencias] Error al cargar portal:', err);
  }
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
    const activeCount = _userLicenses.filter(l => l.status === 'approved').length;
    const statActive = document.getElementById('statActiveLicenses');
    const statBranches = document.getElementById('statBranches');
    if (statActive) statActive.textContent = activeCount;
    if (statBranches) statBranches.textContent = _userLicenses.length;

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

  grid.innerHTML = '';
  licenses.forEach(lic => {
    const card = document.createElement('div');
    card.className = `license-card status-${lic.status}`;

    const isApproved = (lic.status === 'approved');
    const isPending  = (lic.status === 'pending');

    const statusLabel = isApproved ? 'Aprobada & Activa' : (isPending ? 'En Revisión por Maxi' : 'Rechazada');
    const statusClass = isApproved ? 'approved' : (isPending ? 'pending' : 'rejected');

    const requestedDate = lic.requested_at ? new Date(lic.requested_at).toLocaleDateString('es-VE') : '—';
    const durationLabel = lic.duration_label || (isApproved ? 'Activa' : 'Pendiente');

    // Sanitización y render
    card.innerHTML = `
      <div>
        <div class="license-header">
          <div>
            <h4 class="branch-title">🏢 ${escapeHtml(lic.branch_name)}</h4>
            <span class="badge-status ${statusClass}">${statusLabel}</span>
          </div>
        </div>

        <div class="meta-row">
          <span>Periodo de Vigencia:</span>
          <span class="meta-val duration">${escapeHtml(durationLabel)}</span>
        </div>

        <div class="meta-row">
          <span>Solicitada el:</span>
          <span class="meta-val">${requestedDate}</span>
        </div>

        <div class="uuid-box" title="UUID de hardware blindado">
          <span>🔒 ${escapeHtml(lic.device_uuid)}</span>
          <button type="button" style="background:none; border:none; color:#38bdf8; cursor:pointer;" onclick="navigator.clipboard.writeText('${escapeHtml(lic.device_uuid)}'); alert('UUID copiado al portapapeles');">📋</button>
        </div>
      </div>

      <div style="margin-top: 16px;">
        ${isApproved ? `
          <button class="btn-primary btn-full" onclick="openLicenseModal('${lic.id}')" style="padding: 10px; font-size: 0.88rem;">
            🔑 Ver Llave & Descargar
          </button>
        ` : (isPending ? `
          <div style="text-align: center; font-size: 0.82rem; color: #fbbf24; padding: 8px; background: rgba(245, 158, 11, 0.1); border-radius: var(--radius);">
            ⏳ Solicitud enviada a Maxi. La llave estará disponible aquí en cuanto sea emitida.
          </div>
        ` : `
          <div style="text-align: center; font-size: 0.82rem; color: #f87171; padding: 8px;">
            ❌ Solicitud no aprobada. Contacta a soporte para más detalles.
          </div>
        `)}
      </div>
    `;

    grid.appendChild(card);
  });
}

// ─── FORMULARIO: CREAR SOLICITUD DE LICENCIA ──────────────────
async function handleCreateLicenseRequest(e) {
  e.preventDefault();
  if (!_supabaseClient || !_currentUser) return;

  const msgBox = document.getElementById('reqMessage');
  const submitBtn = e.target.querySelector('button[type="submit"]');

  const branchName = document.getElementById('reqBranchName')?.value.trim();
  const deviceUuid = document.getElementById('reqDeviceUuid')?.value.trim();

  if (!branchName || !deviceUuid) {
    showMsg(msgBox, 'error', '❌ Por favor ingresa el nombre de la sucursal y el UUID del equipo.');
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
        duration_label: 'Pendiente'
      })
      .select()
      .single();

    if (error) throw error;

    showMsg(msgBox, 'success', '✅ ¡Solicitud registrada con éxito! El UUID ha quedado blindado.');
    e.target.reset();

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

// ─── MODAL DE LLAVE (TXT, WHATSAPP, QR) ────────────────────────
function openLicenseModal(licenseId) {
  const lic = _userLicenses.find(l => l.id === licenseId);
  if (!lic) return;
  _currentModalLicense = lic;

  const modal = document.getElementById('licenseKeyModal');
  const branchTitle = document.getElementById('modalBranchTitle');
  const durationLabel = document.getElementById('modalDurationLabel');
  const keyDisplay = document.getElementById('modalLicenseKeyDisplay');

  if (branchTitle) branchTitle.textContent = `Licencia — ${lic.branch_name}`;
  if (durationLabel) durationLabel.textContent = `Periodo de Vigencia: ${lic.duration_label || 'Activa'}`;
  if (keyDisplay) keyDisplay.textContent = lic.license_key || 'CLAVE-NO-GENERADA';

  // Renderizar código QR
  const qrBox = document.getElementById('qrcodeBox');
  if (qrBox) {
    qrBox.innerHTML = '';
    if (typeof QRCode !== 'undefined' && lic.license_key) {
      new QRCode(qrBox, {
        text: lic.license_key,
        width: 140,
        height: 140,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('modal-visible');
  }
}

function closeLicenseModal() {
  const modal = document.getElementById('licenseKeyModal');
  if (modal) {
    modal.classList.remove('modal-visible');
    modal.style.display = 'none';
  }
  _currentModalLicense = null;
}

function copyLicenseKey() {
  if (!_currentModalLicense?.license_key) return;
  navigator.clipboard.writeText(_currentModalLicense.license_key)
    .then(() => alert('✅ Llave de licencia copiada al portapapeles.'))
    .catch(() => alert('No se pudo copiar automáticamente.'));
}

function downloadLicenseTxt() {
  if (!_currentModalLicense) return;
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
