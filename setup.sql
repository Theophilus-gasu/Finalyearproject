-- 1. Create the events table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    event_type TEXT NOT NULL, -- e.g., 'FIRE', 'HEARTBEAT'
    value NUMERIC DEFAULT 0,
    acknowledged BOOLEAN DEFAULT FALSE NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 3. Create a policy to allow all actions for simplicity (or restrict as needed)
CREATE POLICY "Allow all for anon" ON public.events
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- 4. Enable Realtime for the events table
-- This allows the app to listen for INSERT/UPDATE changes live
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;

-- Optional: Insert a test heartbeat to verify connection
-- INSERT INTO public.events (event_type, value) VALUES ('HEARTBEAT', 1);
