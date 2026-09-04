-- ═══════════════════════════════════════════════════════════════
-- SIGTAD PRO — ESQUEMA DE BASE DE DATOS (SUPABASE)
-- Copia y pega todo este código en:
-- Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ═══════════════════════════════════════════════════════════════

-- 1. TABLA DE ESTADÍSTICAS DE DESCARGAS REALES
CREATE TABLE IF NOT EXISTS public.download_stats (
    id SERIAL PRIMARY KEY,
    real_windows INTEGER DEFAULT 0,
    real_android INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insertar fila inicial única (id = 1) si no existe
INSERT INTO public.download_stats (id, real_windows, real_android)
VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS (Seguridad a Nivel de Fila)
ALTER TABLE public.download_stats ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública para que la web lea las descargas
CREATE POLICY "Permitir lectura publica de descargas"
ON public.download_stats FOR SELECT
USING (true);

-- 2. FUNCIONES RPC PARA INCREMENTO ATÓMICO (Evita condiciones de carrera)
CREATE OR REPLACE FUNCTION increment_windows_downloads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.download_stats
    SET real_windows = real_windows + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = 1;
END;
$$;

CREATE OR REPLACE FUNCTION increment_android_downloads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.download_stats
    SET real_android = real_android + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = 1;
END;
$$;

-- 3. TABLA DE USUARIOS SUSCRIPTORES (NEWSLETTER / REGISTROS)
CREATE TABLE IF NOT EXISTS public.subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Permitir insertar suscriptores desde la web pública
CREATE POLICY "Permitir registro de suscriptores"
ON public.subscribers FOR INSERT
WITH CHECK (true);

-- Permitir lectura pública o autenticada para el panel admin
CREATE POLICY "Permitir lectura de suscriptores"
ON public.subscribers FOR SELECT
USING (true);
