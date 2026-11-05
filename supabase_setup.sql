-- ═══════════════════════════════════════════════════════════════
-- SIGTAD PRO — ESQUEMA DE BASE DE DATOS BLINDADO (SUPABASE)
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

-- Habilitar RLS
ALTER TABLE public.download_stats ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública de contadores
DROP POLICY IF EXISTS "Permitir lectura publica de descargas" ON public.download_stats;
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

-- 3. TABLA BLINDADA DE PERFILES DE USUARIOS (DATOS PROTEGIDOS)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    business_name TEXT,
    address TEXT,
    phone TEXT,
    email TEXT UNIQUE NOT NULL,
    auth_provider TEXT DEFAULT 'email',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS BLINDADAS (Cero fugas de datos):
-- Un usuario solo puede ver su propio perfil; el Administrador oficial puede auditar todos
DROP POLICY IF EXISTS "Usuarios consultan solo su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios consultan solo su propio perfil"
ON public.profiles FOR SELECT
USING (
    auth.uid() = id 
    OR auth.jwt() ->> 'email' = 'sigtadpro@gmail.com'
    OR auth.jwt() ->> 'email' = 'edinsonalberto2002@gmail.com'
);

DROP POLICY IF EXISTS "Usuarios actualizan solo su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios actualizan solo su propio perfil"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuarios insertan su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios insertan su propio perfil"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- TRIGGER AUTOMÁTICO: Crear perfil al registrarse un usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        full_name, 
        business_name, 
        address, 
        phone, 
        email, 
        auth_provider
    )
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
        COALESCE(new.raw_user_meta_data->>'business_name', ''),
        COALESCE(new.raw_user_meta_data->>'address', ''),
        COALESCE(new.raw_user_meta_data->>'phone', ''),
        new.email,
        COALESCE(new.app_metadata->>'provider', 'email')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        business_name = CASE WHEN EXCLUDED.business_name <> '' THEN EXCLUDED.business_name ELSE profiles.business_name END,
        address = CASE WHEN EXCLUDED.address <> '' THEN EXCLUDED.address ELSE profiles.address END,
        phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE profiles.phone END,
        updated_at = timezone('utc'::text, now());
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. TABLA DE SUSCRIPTORES (Corrección de vulnerabilidad de lectura abierta)
CREATE TABLE IF NOT EXISTS public.subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Permitir insertar suscriptores desde la web pública
DROP POLICY IF EXISTS "Permitir registro de suscriptores" ON public.subscribers;
CREATE POLICY "Permitir registro de suscriptores"
ON public.subscribers FOR INSERT
WITH CHECK (true);

-- CIERRE DE BRECHA: Solo el Administrador puede listar la tabla subscribers
DROP POLICY IF EXISTS "Permitir lectura de suscriptores" ON public.subscribers;
CREATE POLICY "Permitir lectura exclusiva a administrador"
ON public.subscribers FOR SELECT
USING (
    auth.jwt() ->> 'email' = 'sigtadpro@gmail.com'
    OR auth.jwt() ->> 'email' = 'edinsonalberto2002@gmail.com'
);

-- 5. TABLA PARA SOLICITUDES DE LICENCIAS AUTODESTRUCTIVAS (FASE SIGUIENTE)
CREATE TABLE IF NOT EXISTS public.license_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    user_email TEXT NOT NULL,
    business_name TEXT,
    device_fingerprint TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'delivered', 'rejected', 'expired')),
    license_hash TEXT, -- Almacenada solo con hash irreversible SHA-256
    one_time_token TEXT, -- Token efímero que se autodestruye al usarse
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.license_requests ENABLE ROW LEVEL SECURITY;

-- El usuario solo ve sus propias solicitudes
CREATE POLICY "Usuarios ven sus solicitudes de licencias"
ON public.license_requests FOR SELECT
USING (auth.uid() = user_id OR auth.jwt() ->> 'email' = 'sigtadpro@gmail.com');

CREATE POLICY "Usuarios crean sus solicitudes de licencias"
ON public.license_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);
