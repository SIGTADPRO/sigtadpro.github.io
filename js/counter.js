// ═══════════════════════════════════════════════════════════════
// SIGTAD PRO — CONTADOR DE DESCARGAS
// Real (Supabase) + Artificial (logarítmico determinístico)
// ═══════════════════════════════════════════════════════════════

let _supabase = null;
let realCount = { windows: 0, android: 0 };
let displayedCount = 0;

// ─── ARTIFICIAL COUNT ──────────────────────────────────────────
// Base sembrada (~320) + crecimiento orgánico de 1 a 3 descargas por día
// Determinístico según fecha/hora para sincronía exacta entre usuarios
function getArtificialCount() {
  const msPerDay = 86400000;
  const baseDate = (typeof COUNTER_BASE_DATE !== 'undefined') ? COUNTER_BASE_DATE : ((typeof COUNTER_LAUNCH_DATE !== 'undefined') ? COUNTER_LAUNCH_DATE : new Date('2026-10-18T00:00:00'));
  const base = (typeof COUNTER_BASE_ARTIFICIAL !== 'undefined') ? COUNTER_BASE_ARTIFICIAL : ((typeof COUNTER_BASE !== 'undefined') ? COUNTER_BASE : 320);

  const diffMs = Date.now() - baseDate.getTime();
  if (diffMs <= 0) return base;

  const diffDays = diffMs / msPerDay;
  const fullDays = Math.floor(diffDays);
  const dayFraction = diffDays - fullDays;

  // Secuencia orgánica determinística de 1 a 3 descargas por día
  const pattern = [2, 1, 3, 2, 3, 1, 2, 2, 3, 1, 3, 2];
  const cycleSum = pattern.reduce((acc, val) => acc + val, 0); // 25 por ciclo de 12 días
  const cycleLen = pattern.length;

  const fullCycles = Math.floor(fullDays / cycleLen);
  let totalGrowth = fullCycles * cycleSum;

  for (let i = fullCycles * cycleLen; i < fullDays; i++) {
    totalGrowth += pattern[i % cycleLen];
  }

  // Crecimiento gradual intra-día según el avance de las horas
  const todayIncrement = pattern[fullDays % cycleLen];
  totalGrowth += Math.floor(todayIncrement * dayFraction);

  return base + totalGrowth;
}


// ─── SUPABASE INIT ─────────────────────────────────────────────
function _initSupabase() {
  if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL.includes('YOUR_PROJECT') || !window.supabase) {
    console.log('[SIGTAD] Supabase no configurado o script no cargado → modo local');
    return null;
  }
  try {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch(e) {
    console.error('[SIGTAD] Error iniciando Supabase:', e);
    return null;
  }
}

// ─── FETCH REAL COUNT ──────────────────────────────────────────
async function fetchRealCount() {
  if (!_supabase) {
    // Si no hay backend, recuperamos de localStorage local para pruebas
    const savedWin = parseInt(localStorage.getItem('sigtad_real_win') || '0', 10);
    const savedAnd = parseInt(localStorage.getItem('sigtad_real_and') || '0', 10);
    return { windows: savedWin, android: savedAnd };
  }
  try {
    const { data, error } = await _supabase
      .from('download_stats')
      .select('real_windows, real_android')
      .eq('id', 1)
      .single();
    if (error) throw error;
    return { windows: data.real_windows || 0, android: data.real_android || 0 };
  } catch(err) {
    console.warn('[SIGTAD] No se pudo leer stats remotas:', err.message);
    const savedWin = parseInt(localStorage.getItem('sigtad_real_win') || '0', 10);
    const savedAnd = parseInt(localStorage.getItem('sigtad_real_and') || '0', 10);
    return { windows: savedWin, android: savedAnd };
  }
}

// ─── INCREMENT ─────────────────────────────────────────────────
async function incrementCounter(platform) {
  if (platform === 'windows') {
    realCount.windows++;
    localStorage.setItem('sigtad_real_win', realCount.windows);
  } else {
    realCount.android++;
    localStorage.setItem('sigtad_real_and', realCount.android);
  }

  if (_supabase) {
    const fn = platform === 'windows' ? 'increment_windows_downloads' : 'increment_android_downloads';
    try {
      await _supabase.rpc(fn);
    } catch(e) {
      console.warn('[SIGTAD] Error enviando incremento:', e);
    }
  }

  displayedCount++;
  const el = document.getElementById('downloadCounter');
  if (el) el.textContent = displayedCount.toLocaleString('es-VE');
}

// ─── ANIMACIÓN INICIAL ─────────────────────────────────────────
function animateCounter(targetValue) {
  const el = document.getElementById('downloadCounter');
  if (!el) return;
  const duration = 2000;
  const startTime = performance.now();

  function tick(now) {
    const p = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = Math.floor(targetValue * eased);
    el.textContent = val.toLocaleString('es-VE');
    if (p < 1) {
      requestAnimationFrame(tick);
    } else {
      displayedCount = targetValue;
      el.textContent = targetValue.toLocaleString('es-VE');
    }
  }
  requestAnimationFrame(tick);
}

// ─── CRECIMIENTO ARTIFICIAL LENTO EN TIEMPO REAL ───────────────
function startSlowVisualGrowth() {
  function scheduleNext() {
    // Entre 8 y 18 minutos de forma pausada
    const delay = (8 + Math.random() * 10) * 60 * 1000;
    setTimeout(() => {
      displayedCount++;
      const el = document.getElementById('downloadCounter');
      if (el) el.textContent = displayedCount.toLocaleString('es-VE');
      scheduleNext();
    }, delay);
  }
  scheduleNext();
}

// ─── INICIALIZAR CONTADOR ──────────────────────────────────────
async function initCounter() {
  _supabase = _initSupabase();
  realCount = await fetchRealCount();
  const total = realCount.windows + realCount.android + getArtificialCount();
  animateCounter(total);
  startSlowVisualGrowth();
}

// ─── HELPER PARA EL PANEL DE ADMINISTRACIÓN ───────────────────
function getCounterBreakdown() {
  return {
    real_windows: realCount.windows,
    real_android: realCount.android,
    real_total:   realCount.windows + realCount.android,
    artificial:   getArtificialCount(),
    displayed:    displayedCount
  };
}
