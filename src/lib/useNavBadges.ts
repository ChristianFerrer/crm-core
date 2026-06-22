'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export type NavBadges = {
  visitas: number  // personas actualmente dentro
  agenda: number   // actividades agendadas hoy
  panel: number    // oportunidades sin contactar generadas por el sistema
}

export function useNavBadges(): NavBadges {
  const [badges, setBadges] = useState<NavBadges>({ visitas: 0, agenda: 0, panel: 0 })

  useEffect(() => {
    async function load() {
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const [
        { count: visitas },
        { count: agenda },
        { count: fuPending },
        { count: bdPending },
      ] = await Promise.all([
        supabase.from('visits').select('id', { count: 'exact', head: true }).is('checked_out_at', null),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('date', today),
        supabase.from('follow_up_leads').select('id', { count: 'exact', head: true }).eq('status', 'sin_contactar').eq('period', currentPeriod),
        supabase.from('birthday_leads').select('id', { count: 'exact', head: true }).eq('status', 'sin_contactar').eq('year', now.getFullYear()),
      ])

      setBadges({
        visitas: visitas ?? 0,
        agenda:  agenda  ?? 0,
        panel:   (fuPending ?? 0) + (bdPending ?? 0),
      })
    }

    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [])

  return badges
}
