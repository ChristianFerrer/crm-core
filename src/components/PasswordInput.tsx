'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

type PasswordInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  required?: boolean
  minLength?: number
  id?: string
}

const BASE_CLASS =
  'w-full bg-surface2 border border-line rounded-xl pl-4 pr-11 py-3 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'

/** Campo de contraseña con botón para mostrar/ocultar el texto. */
export function PasswordInput({
  value, onChange, placeholder, className, autoFocus, required, minLength, id,
}: PasswordInputProps) {
  const { t } = useLanguage()
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required={required}
        minLength={minLength}
        className={className ?? BASE_CLASS}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        tabIndex={-1}
        aria-label={visible ? t('shared_ocultar_contrasena') : t('shared_mostrar_contrasena')}
        className="absolute right-0 top-0 h-full px-3 flex items-center text-mist hover:text-snow transition-colors"
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}
