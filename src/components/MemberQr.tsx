'use client'

import { QRCodeSVG } from 'qrcode.react'

export function MemberQr({ qrCode }: { qrCode: string }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <QRCodeSVG value={qrCode} size={160} fgColor="#0e0f12" bgColor="#ffffff" />
    </div>
  )
}
