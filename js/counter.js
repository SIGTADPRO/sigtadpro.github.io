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
  if (_supabase) return _supabase;
  if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL.includes('YOUR_PROJECT') || !window.supabase) {
    return null;
  }
  try {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return _supabase;
  } catch(e) {
    console.error('[SIGTAD] Error iniciando Supabase:', e);
    return null;
  }
}

// ─── FETCH REAL COUNT ──────────────────────────────────────────
async function fetchRealCount() {
  if (!_supabase && typeof _initSupabase === 'function') {
    _supabase = _initSupabase();
  }

  // 1. Intento vía SDK Supabase
  if (_supabase) {
    try {
      const { data, error } = await _supabase
        .from('download_stats')
        .select('real_windows, real_android')
        .eq('id', 1)
        .single();
      if (!error && data) {
        const win = Number(data.real_windows) || 0;
        const and = Number(data.real_android) || 0;
        localStorage.setItem('sigtad_real_win', win);
        localStorage.setItem('sigtad_real_and', and);
        return { windows: win, android: and };
      }
    } catch(err) {
      console.warn('[SIGTAD] Lectura vía SDK falló, probando REST directo:', err.message);
    }
  }

  // 2. Fallback de alta resiliencia: Consulta REST directa vía fetch()
  if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/download_stats?id=eq.1&select=real_windows,real_android`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) {
          const win = Number(rows[0].real_windows) || 0;
          const and = Number(rows[0].real_android) || 0;
          localStorage.setItem('sigtad_real_win', win);
          localStorage.setItem('sigtad_real_and', and);
          return { windows: win, android: and };
        }
      }
    } catch(fetchErr) {
      console.warn('[SIGTAD] Lectura REST directa falló:', fetchErr.message);
    }
  }

  // 3. Fallback local de caché
  const savedWin = parseInt(localStorage.getItem('sigtad_real_win') || '0', 10);
  const savedAnd = parseInt(localStorage.getItem('sigtad_real_and') || '0', 10);
  return { windows: savedWin, android: savedAnd };
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
