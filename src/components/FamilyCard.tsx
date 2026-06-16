import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Family, Membership } from '@/lib/types'
import { Phone, Calendar } from 'lucide-react'

interface FamilyCardProps {
  family: Family
  membership?: Membership & { membership_types?: { name: string; sessions: number | null } }
  lastVisit?: string
  clickable?: boolean
}

export default function FamilyCard({ family, membership, lastVisit, clickable = true }: FamilyCardProps) {
  const card = (
    <Card className={`mb-3 ${clickable ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{family.name}</h3>
            {family.phone && (
              <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                <Phone className="w-3 h-3" />
                {family.phone}
              </div>
            )}
            {lastVisit && (
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                <Calendar className="w-3 h-3" />
                Última visita: {new Date(lastVisit).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </div>
            )}
          </div>
          <div className="ml-3 flex flex-col items-end gap-1">
            {membership ? (
              <>
                <Badge variant="secondary" className="bg-violet-100 text-violet-700 text-xs whitespace-nowrap">
                  {membership.membership_types?.name ?? 'Activo'}
                </Badge>
                {membership.sessions_remaining !== null && (
                  <span className={`text-xs font-medium ${
                    membership.sessions_remaining <= 2 ? 'text-red-500' :
                    membership.sessions_remaining <= 5 ? 'text-amber-500' : 'text-gray-500'
                  }`}>
                    {membership.sessions_remaining} ses. restantes
                  </span>
                )}
              </>
            ) : (
              <Badge variant="outline" className="text-gray-400 text-xs">Sin bono</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (clickable) {
    return <Link href={`/familias/${family.id}`}>{card}</Link>
  }
  return card
}
