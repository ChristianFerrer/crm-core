import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { ArrowLeft, Phone, Mail, FileText, Baby, CreditCard, Clock } from 'lucide-react'
import { notFound } from 'next/navigation'

export const revalidate = 0

function calcAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

export default async function FamiliaDetailPage({ params }: { params: { id: string } }) {
  const [
    { data: family },
    { data: children },
    { data: memberships },
    { data: visits },
  ] = await Promise.all([
    supabase.from('families').select('*').eq('id', params.id).single(),
    supabase.from('children').select('*').eq('family_id', params.id).order('birth_date'),
    supabase.from('memberships').select('*, membership_types(*)').eq('family_id', params.id).order('created_at', { ascending: false }).limit(1),
    supabase.from('visits').select('*').eq('family_id', params.id).order('checked_in_at', { ascending: false }).limit(10),
  ])

  if (!family) notFound()

  const membership = memberships?.[0]

  const sessionsColor = membership?.sessions_remaining !== null && membership?.sessions_remaining !== undefined
    ? membership.sessions_remaining <= 2 ? 'text-red-600 font-bold'
    : membership.sessions_remaining <= 5 ? 'text-amber-600 font-semibold'
    : 'text-green-600 font-semibold'
    : 'text-gray-600'

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 pt-4 mb-4">
        <Link href="/familias">
          <Button variant="ghost" size="sm" className="p-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{family.name}</h1>
      </div>

      {/* Contact info */}
      <Card className="mb-4">
        <CardContent className="pt-4 space-y-2">
          {family.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-gray-400" />
              <span>{family.phone}</span>
            </div>
          )}
          {family.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{family.email}</span>
            </div>
          )}
          {family.notes && (
            <div className="flex items-start gap-2 text-sm">
              <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
              <span className="text-gray-600">{family.notes}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Children */}
      {children && children.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
              <Baby className="w-4 h-4 text-violet-500" />
              Niños
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {children.map((child: any) => (
              <div key={child.id} className="flex justify-between text-sm">
                <span className="text-gray-800">{child.name}</span>
                {child.birth_date && (
                  <span className="text-gray-400">{calcAge(child.birth_date)} años</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Membership */}
      <Card className="mb-4">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
            <CreditCard className="w-4 h-4 text-violet-500" />
            Bono actual
          </CardTitle>
        </CardHeader>
        <CardContent>
          {membership ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tipo</span>
                <Badge variant="secondary" className="bg-violet-100 text-violet-700">
                  {(membership as any).membership_types?.name}
                </Badge>
              </div>
              {membership.sessions_remaining !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Sesiones restantes</span>
                  <span className={`text-sm ${sessionsColor}`}>{membership.sessions_remaining}</span>
                </div>
              )}
              {membership.sessions_remaining === null && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Sesiones</span>
                  <span className="text-sm text-green-600 font-semibold">Ilimitadas</span>
                </div>
              )}
              {membership.expires_at && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Vence el</span>
                  <span className="text-sm text-gray-700">
                    {new Date(membership.expires_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}
              {membership.sessions_remaining !== null && membership.sessions_remaining <= 2 && (
                <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600 font-medium">
                  Quedan pocas sesiones. Considera renovar el bono.
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin bono activo</p>
          )}
        </CardContent>
      </Card>

      {/* Visit history */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
            <Clock className="w-4 h-4 text-violet-500" />
            Últimas visitas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {visits && visits.length > 0 ? (
            <div className="space-y-2">
              {visits.map((visit: any, i: number) => (
                <div key={visit.id}>
                  {i > 0 && <Separator className="my-2" />}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {new Date(visit.checked_in_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-gray-400">
                      {new Date(visit.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin visitas registradas</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
