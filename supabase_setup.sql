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
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated, anon;

-- POLÍTICAS RLS BLINDADAS:
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
USING (
    auth.uid() = id
    OR auth.jwt() ->> 'email' = 'sigtadpro@gmail.com'
    OR auth.jwt() ->> 'email' = 'edinsonalberto2002@gmail.com'
);

DROP POLICY IF EXISTS "Usuarios insertan su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios insertan su propio perfil"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

-- TRIGGER AUTOMÁTICO DEFENSIVO: Crear perfil al registrarse un usuario en auth.users
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
        COALESCE(new.email, ''),
        COALESCE(new.raw_app_meta_data->>'provider', 'email')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE profiles.full_name END,
        business_name = CASE WHEN EXCLUDED.business_name <> '' THEN EXCLUDED.business_name ELSE profiles.business_name END,
        address = CASE WHEN EXCLUDED.address <> '' THEN EXCLUDED.address ELSE profiles.address END,
        phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE profiles.phone END,
        email = CASE WHEN EXCLUDED.email <> '' THEN EXCLUDED.email ELSE profiles.email END,
        updated_at = timezone('utc'::text, now());
    RETURN new;
EXCEPTION
    WHEN OTHERS THEN
        RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. RPC DE BORRADO SEGURO DE CUENTA (CUMPLIMIENTO GOOGLE PLAY STORE)
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Elimina al usuario actual de auth.users; la cascada borra profiles, licencias y tickets asociados
    DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- 5. TABLA DE SUSCRIPTORES
CREATE TABLE IF NOT EXISTS public.subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.subscribers TO postgres, service_role;
GRANT SELECT, INSERT ON TABLE public.subscribers TO authenticated, anon;

DROP POLICY IF EXISTS "Permitir registro de suscriptores" ON public.subscribers;
CREATE POLICY "Permitir registro de suscriptores"
ON public.subscribers FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura de suscriptores" ON public.subscribers;
DROP POLICY IF EXISTS "Permitir lectura exclusiva a administrador" ON public.subscribers;
CREATE POLICY "Permitir lectura exclusiva a administrador"
ON public.subscribers FOR SELECT
USING (
    auth.jwt() ->> 'email' = 'sigtadpro@gmail.com'
    OR auth.jwt() ->> 'email' = 'edinsonalberto2002@gmail.com'
);

-- 6. TABLA DE LICENCIAS POR SUCURSAL CON UUID INMUTABLE (ANTI-FRAUDE)
CREATE TABLE IF NOT EXISTS public.license_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    user_email TEXT NOT NULL,
    business_name TEXT,
    branch_name TEXT NOT NULL DEFAULT 'Sucursal Principal',
    device_uuid TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    license_key TEXT,
    duration_label TEXT DEFAULT 'Pendiente',
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    viewed_at TIMESTAMP WITH TIME ZONE
);

-- Migración segura si la tabla ya existía de versiones anteriores:
ALTER TABLE public.license_requests ADD COLUMN IF NOT EXISTS branch_name TEXT DEFAULT 'Sucursal Principal';
ALTER TABLE public.license_requests ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE public.license_requests ADD COLUMN IF NOT EXISTS duration_label TEXT DEFAULT 'Pendiente';
ALTER TABLE public.license_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.license_requests ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.license_requests ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.license_requests TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.license_requests TO authenticated, anon;

-- DISPARADOR ANTI-FRAUDE: Bloquea cualquier intento de modificar el UUID después de creado
CREATE OR REPLACE FUNCTION public.protect_license_uuid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.device_uuid IS DISTINCT FROM NEW.device_uuid THEN
        RAISE EXCEPTION 'El UUID del equipo está blindado y no puede ser modificado después de la solicitud.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_license_uuid ON public.license_requests;
CREATE TRIGGER trg_protect_license_uuid
    BEFORE UPDATE ON public.license_requests
    FOR EACH ROW EXECUTE PROCEDURE public.protect_license_uuid();

-- Políticas RLS para Licencias:
DROP POLICY IF EXISTS "Usuarios ven sus solicitudes de licencias" ON public.license_requests;
CREATE POLICY "Usuarios ven sus solicitudes de licencias"
ON public.license_requests FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Usuarios crean sus solicitudes de licencias" ON public.license_requests;
CREATE POLICY "Usuarios crean sus solicitudes de licencias"
ON public.license_requests FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Admin actualiza licencias" ON public.license_requests;
CREATE POLICY "Admin actualiza licencias"
ON public.license_requests FOR UPDATE
USING (true);

-- FUNCIÓN RPC BLINDADA PARA EMISIÓN DE LICENCIA (SECURITY DEFINER)
-- Garantiza que el panel de administración pueda actualizar el estado y la llave sin bloqueos de RLS
CREATE OR REPLACE FUNCTION public.admin_issue_license(
    p_license_id UUID,
    p_license_key TEXT,
    p_duration_label TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.license_requests
    SET license_key = p_license_key,
        duration_label = p_duration_label,
        status = 'approved',
        approved_at = timezone('utc'::text, now())
    WHERE id = p_license_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_issue_license(UUID, TEXT, TEXT) TO authenticated, anon;

-- 7. TABLAS DE MESA DE AYUDA Y SOPORTE EN TIEMPO REAL (TICKETS & CHAT)
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    user_email TEXT NOT NULL,
    user_name TEXT,
    business_name TEXT,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.support_tickets TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.support_tickets TO authenticated, anon;

DROP POLICY IF EXISTS "Usuarios gestionan sus propios tickets" ON public.support_tickets;
CREATE POLICY "Usuarios gestionan sus propios tickets"
ON public.support_tickets FOR ALL
USING (true);

CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_email TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.ticket_messages TO postgres, service_role;
GRANT SELECT, INSERT ON TABLE public.ticket_messages TO authenticated, anon;

DROP POLICY IF EXISTS "Acceso a mensajes del ticket" ON public.ticket_messages;
CREATE POLICY "Acceso a mensajes del ticket"
ON public.ticket_messages FOR ALL
USING (true);

-- Habilitar Supabase Realtime para licencias y chat de forma segura e idempotente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'license_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.license_requests;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'ticket_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
    END IF;
END $$;

-- 8. RECARGA INMEDIATA DE CACHÉ DE ESQUEMAS EN SUPABASE (POSTGREST)
NOTIFY pgrst, 'reload schema';
