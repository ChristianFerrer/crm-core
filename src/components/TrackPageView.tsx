'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/trackEvent'

export function TrackPageView({ event = 'page_view' as const, metadata }: { event?: 'page_view' | 'alta_start' | 'alta_complete'; metadata?: Record<string, unknown> }) {
  useEffect(() => {
    trackEvent(event, metadata)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
