import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/roles'

// Cambia directamente la contraseña del administrador de un tenant.
// Requiere SUPABASE_SERVICE_ROLE_KEY (solo servidor) y que quien llama sea superadmin.
export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { tenantId, newPassword } = await req.json().catch(() => ({}))
  if (!tenantId || typeof newPassword !== 'string' || newPassword.length < 6) {
    return NextResponse.json({ error: 'Datos inválidos (mínimo 6 caracteres)' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !url) {
    return NextResponse.json({
      error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor',
    }, { status: 500 })
  }

  const { data: tenant } = await supabase.from('tenants').select('admin_email').eq('id', tenantId).maybeSingle()
  if (!tenant?.admin_email) {
    return NextResponse.json({ error: 'El establecimiento no tiene admin_email configurado' }, { status: 400 })
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // Resuelve el user_id: primero por tenant_users, si no existe se busca por email y se guarda para la próxima vez
  let userId: string | null = null
  const { data: tu } = await supabase.from('tenant_users').select('user_id').eq('tenant_id', tenantId).maybeSingle()
  userId = tu?.user_id ?? null

  if (!userId) {
    const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })
    const match = usersPage.users.find(u => u.email?.toLowerCase() === tenant.admin_email!.toLowerCase())
    if (!match) return NextResponse.json({ error: 'No existe ningún usuario con ese admin_email' }, { status: 404 })
    userId = match.id
    await admin.from('tenant_users').upsert({ user_id: userId, tenant_id: tenantId, role: 'owner' })
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
