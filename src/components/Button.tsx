'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md'

// Estilo unificado: borde sólido, fondo transparente, texto del color del borde.
const VARIANTS: Record<Variant, string> = {
  primary: 'border border-lime bg-transparent text-lime hover:bg-lime/10',
  secondary: 'border border-line bg-transparent text-fog hover:text-snow hover:bg-surface2',
  danger: 'border border-rose bg-transparent text-rose hover:bg-rose/10',
  ghost: 'text-fog hover:text-snow',
}
const SIZES: Record<Size, string> = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-2.5 text-sm',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  children: ReactNode
}

/** Botón compartido con las variantes del sistema (tokens del tema). */
export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-colors disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </button>
  )
}
