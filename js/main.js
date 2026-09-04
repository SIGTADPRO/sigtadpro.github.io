// ═══════════════════════════════════════════════════════════════
// SIGTAD PRO — LÓGICA PRINCIPAL (UI, Modales, Eventos)
// ═══════════════════════════════════════════════════════════════

// ─── SPLASH SCREEN ────────────────────────────────────────────
function initSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;

  setTimeout(() => {
    splash.classList.add('hidden');
    setTimeout(() => {
      splash.style.display = 'none';
      checkTermsAccepted();
    }, 600);
  }, 2200);
}

// ─── TÉRMINOS Y CONDICIONES (CONTRATO LEGAL) ──────────────────
function checkTermsAccepted() {
  const accepted = localStorage.getItem('sigtadpro_terms_v403');
  if (!accepted) {
    openModal('termsModal');
  }
}

function acceptTerms() {
  localStorage.setItem('sigtadpro_terms_v403', 'true');
  closeModal('termsModal');
}

// ─── GESTIÓN DE MODALES ───────────────────────────────────────
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => modal.classList.add('modal-visible'), 20);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('modal-visible');
  setTimeout(() => {
    modal.style.display = 'none';
    const openModals = document.querySelectorAll('.modal-overlay.modal-visible');
    if (openModals.length === 0) {
      document.body.style.overflow = '';
    }
  }, 300);
}

// ─── DESCARGAS ────────────────────────────────────────────────
function triggerWindowsDownload() {
  const a = document.createElement('a');
  a.href = (typeof WINDOWS_DOWNLOAD_URL !== 'undefined') ? WINDOWS_DOWNLOAD_URL : './SIGTAD_PRO_Setup_v4.0.3.exe';
  a.download = 'SIGTAD_PRO_Setup_v4.0.3.exe';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (typeof incrementCounter === 'function') {
    incrementCounter('windows');
  }
  openModal('prizeModal');
}

function triggerAndroidDownload() {
  const targetUrl = (typeof PLAY_STORE_URL !== 'undefined' && PLAY_STORE_URL.trim() !== '') ? PLAY_STORE_URL : '';

  if (targetUrl) {
    window.open(targetUrl, '_blank');
  } else {
    alert('¡La versión en Google Play Store estará disponible muy pronto! Mientras tanto, puedes solicitar el APK por WhatsApp.');
  }

  if (typeof incrementCounter === 'function') {
    incrementCounter('android');
  }
  openModal('prizeModal');
}

// Secuencia: Premio 15 días → Calificar app
function closePrizeAndOpenRating() {
  closeModal('prizeModal');
  setTimeout(() => openModal('ratingModal'), 350);
}

// ─── MENÚ HAMBURGUESA MÓVIL ───────────────────────────────────
function initHamburger() {
  const btn = document.getElementById('hamburger');
  const links = document.getElementById('navLinks');
  if (!btn || !links) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    btn.classList.toggle('active');
    links.classList.toggle('open');
  });

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      btn.classList.remove('active');
      links.classList.remove('open');
    });
  });

  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !links.contains(e.target)) {
      btn.classList.remove('active');
      links.classList.remove('open');
    }
  });
}

// ─── SCROLL NAVBAR ────────────────────────────────────────────
function initNavbarScroll() {
  const header = document.getElementById('mainHeader');
  if (!header) return;

  const onScroll = () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ─── ANIMACIONES DE APARICIÓN AL DESLIZAR (FADE-IN) ───────────
function initScrollAnimations() {
  const elements = document.querySelectorAll('.info-card, .download-card, .contact-item, .referidos-info, .referidos-video');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  elements.forEach(el => observer.observe(el));
}

// ─── GENERAR CÓDIGO QR PARA WHATSAPP ──────────────────────────
function initQRCode() {
  const qrContainer = document.getElementById('whatsappQr');
  if (!qrContainer) return;

  const link = (typeof WHATSAPP_LINK !== 'undefined') ? WHATSAPP_LINK : 'https://wa.me/584128835935';

  if (typeof QRCode !== 'undefined') {
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
      text: link,
      width: 190,
      height: 190,
      colorDark: '#080818',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    // Fallback a API de QR en caso de que la librería externa esté offline
    qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(link)}" alt="Código QR WhatsApp SIGTAD PRO" />`;
  }
}

// ─── DOM READY ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSplash();
  initHamburger();
  initNavbarScroll();
  initScrollAnimations();
  initQRCode();

  if (typeof initCounter === 'function') initCounter();
  if (typeof initAuth === 'function') initAuth();
  if (typeof setupAuthTabs === 'function') setupAuthTabs();

  // Eventos de botones
  document.getElementById('acceptTermsBtn')?.addEventListener('click', acceptTerms);
  document.getElementById('btnDownloadWindows')?.addEventListener('click', triggerWindowsDownload);
  document.getElementById('btnDownloadAndroid')?.addEventListener('click', triggerAndroidDownload);

  document.getElementById('closePrizeBtn')?.addEventListener('click', closePrizeAndOpenRating);
  document.getElementById('closeRatingModal')?.addEventListener('click', () => closeModal('ratingModal'));
  document.getElementById('skipRatingBtn')?.addEventListener('click', () => closeModal('ratingModal'));

  document.getElementById('navAuthBtn')?.addEventListener('click', () => {
    if (typeof currentUser !== 'undefined' && currentUser) {
      showUserMenu();
    } else {
      openModal('authModal');
    }
  });

  document.getElementById('closeAuthModal')?.addEventListener('click', () => closeModal('authModal'));
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('registerForm')?.addEventListener('submit', handleRegister);

  // Modales: cerrar al hacer clic en overlay exterior (excepto términos)
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal && modal.id !== 'termsModal') {
        closeModal(modal.id);
      }
    });
  });
});
