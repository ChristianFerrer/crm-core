import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cliente de navegador con sesión en cookies (compartible con el servidor).
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
