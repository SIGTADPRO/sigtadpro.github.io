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
  } else {
    // Si ya fueron aceptados previamente, lanzamos directamente el modal de demostración
    setTimeout(() => {
      openModal('queHaceModal');
    }, 300);
  }
}

function acceptTerms() {
  localStorage.setItem('sigtadpro_terms_v403', 'true');
  closeModal('termsModal');
  // Justo después de aceptar los términos, lanzamos el modal de demostración
  setTimeout(() => {
    openModal('queHaceModal');
  }, 400);
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
  a.href = (typeof WINDOWS_DOWNLOAD_URL !== 'undefined') ? WINDOWS_DOWNLOAD_URL : './SIGTAD_PRO_Setup_v5.3.6.exe';
  a.download = 'SIGTAD_PRO_Setup_v5.3.6.exe';
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
    const waPlayStoreUrl = (typeof WHATSAPP_PLAYSTORE_LINK !== 'undefined' && WHATSAPP_PLAYSTORE_LINK.trim() !== '')
      ? WHATSAPP_PLAYSTORE_LINK
      : `https://wa.me/${typeof WHATSAPP_NUMBER !== 'undefined' ? WHATSAPP_NUMBER : '584128835935'}?text=${encodeURIComponent('¡Hola Maxi! Vengo de la web sigtad.com y me gustaría solicitar acceso a SIGTAD PRO en Google Play Store para probar la aplicación en mi teléfono Android.')}`;
    window.open(waPlayStoreUrl, '_blank');
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

  // En pantallas móviles o si no soporta observer, visibilidad inmediata
  if (window.innerWidth < 768 || typeof IntersectionObserver === 'undefined') {
    elements.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '40px' });

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
  const rateGoogleBtn = document.getElementById('rateGoogle');
  if (rateGoogleBtn) {
    rateGoogleBtn.href = (typeof GOOGLE_REVIEW_URL !== 'undefined' && GOOGLE_REVIEW_URL) ? GOOGLE_REVIEW_URL : '#';
  }
  document.getElementById('closeQueHaceModal')?.addEventListener('click', () => closeModal('queHaceModal'));
  document.getElementById('btnOpenQueHaceModal')?.addEventListener('click', () => openModal('queHaceModal'));
  document.getElementById('openQueHaceLauncher')?.addEventListener('click', () => openModal('queHaceModal'));
  document.getElementById('btnDownloadWindows')?.addEventListener('click', triggerWindowsDownload);
  document.getElementById('btnDownloadAndroid')?.addEventListener('click', triggerAndroidDownload);

  document.getElementById('closePrizeBtn')?.addEventListener('click', closePrizeAndOpenRating);
  document.getElementById('closeRatingModal')?.addEventListener('click', () => closeModal('ratingModal'));
  document.getElementById('skipRatingBtn')?.addEventListener('click', () => closeModal('ratingModal'));

  document.getElementById('navAuthBtn')?.addEventListener('click', () => {
    if (typeof openAuthModal === 'function') {
      openAuthModal();
    } else {
      openModal('authModal');
    }
  });

  document.getElementById('closeAuthModal')?.addEventListener('click', () => closeModal('authModal'));
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (typeof handleLogout === 'function') handleLogout();
  });

  // Modal confirmación de correo
  document.getElementById('closeEmailConfirmModal')?.addEventListener('click', () => closeModal('emailConfirmModal'));
  document.getElementById('resendEmailBtn')?.addEventListener('click', () => {
    if (typeof handleResendConfirmation === 'function') handleResendConfirmation();
  });
  document.getElementById('gotItEmailBtn')?.addEventListener('click', () => {
    closeModal('emailConfirmModal');
    setTimeout(() => {
      // Abrir modal de auth en la pestaña de login
      const tabLogin = document.querySelector('.auth-tab[data-tab="login"]');
      if (tabLogin) tabLogin.click();
      openModal('authModal');
    }, 300);
  });

  // Inicializar carrusel de barajas
  initAllCarousels();

  // Modales: cerrar al hacer clic en overlay exterior (excepto términos)
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal && modal.id !== 'termsModal') {
        closeModal(modal.id);
      }
    });
  });
});

// ─── CARRUSEL HORIZONTAL DE BARAJAS (MULTI-INSTANCIA) ───────────
function initCardsCarousel(container) {
  if (!container) return;
  const track = container.querySelector('.carousel-track');
  const dots = container.querySelectorAll('.carousel-dot');
  const prevBtn = container.querySelector('.prev-btn');
  const nextBtn = container.querySelector('.next-btn');
  if (!track || !dots.length) return;

  const slides = track.querySelectorAll('.carousel-slide');
  let currentIndex = 0;

  function updateActiveDot(index) {
    currentIndex = index;
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  }

  function goToSlide(index) {
    if (index < 0) index = 0;
    if (index >= slides.length) index = slides.length - 1;
    const targetSlide = slides[index];
    if (targetSlide) {
      track.scrollTo({
        left: targetSlide.offsetLeft - track.offsetLeft,
        behavior: 'smooth'
      });
      updateActiveDot(index);
    }
  }

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.getAttribute('data-index') || '0', 10);
      goToSlide(idx);
    });
  });

  prevBtn?.addEventListener('click', () => goToSlide(currentIndex - 1));
  nextBtn?.addEventListener('click', () => goToSlide(currentIndex + 1));

  let scrollTimeout = null;
  track.addEventListener('scroll', () => {
    if (scrollTimeout) cancelAnimationFrame(scrollTimeout);
    scrollTimeout = requestAnimationFrame(() => {
      const scrollPos = track.scrollLeft;
      let closestIdx = 0;
      let minDiff = Infinity;
      slides.forEach((slide, idx) => {
        const slideOffset = slide.offsetLeft - track.offsetLeft;
        const diff = Math.abs(slideOffset - scrollPos);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });
      updateActiveDot(closestIdx);
    });
  }, { passive: true });
}

function initAllCarousels() {
  document.querySelectorAll('.carousel-container').forEach(initCardsCarousel);
}
