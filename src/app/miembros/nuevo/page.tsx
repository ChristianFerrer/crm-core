'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { MemberForm } from '@/components/MemberForm'

export default function NuevoMiembroPage() {
  const router = useRouter()

  return (
    <div className="space-y-5 lg:max-w-lg">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/miembros" className="w-9 h-9 rounded-xl border border-line bg-surface flex items-center justify-center hover:border-line2 transition-colors">
          <ArrowLeft size={15} className="text-fog" />
        </Link>
        <h1 className="font-display text-xl font-semibold text-snow">Nuevo miembro</h1>
      </div>

      <MemberForm onCreated={member => router.push(`/miembros/${member.id}`)} />
    </div>
  )
}
