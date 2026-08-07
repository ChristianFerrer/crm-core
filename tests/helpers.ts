import { type Page, expect } from '@playwright/test'

/**
 * Credenciales de un usuario de pruebas. No van en el repositorio: se pasan por
 * entorno. Sin ellas, la parte autenticada se salta en vez de fallar, para que
 * `npm test` siga sirviendo a quien no las tenga.
 *
 *   E2E_EMAIL=... E2E_PASSWORD=... npm test
 */
export const CREDENCIALES = {
  email: process.env.E2E_EMAIL,
  password: process.env.E2E_PASSWORD,
}

export const hayCredenciales = !!(CREDENCIALES.email && CREDENCIALES.password)

/** Entra en la aplicación y espera a que el panel esté cargado. */
export async function entrar(page: Page) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(CREDENCIALES.email!)
  await page.locator('input[type="password"]').fill(CREDENCIALES.password!)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 })
}

/**
 * Recoge los errores de consola y las excepciones de la página.
 *
 * Es la red más barata que existe: un `undefined is not a function` en
 * producción no rompe la pantalla entera, solo deja un trozo en blanco, y así
 * es como pasan desapercibidos durante semanas.
 */
export function vigilarErrores(page: Page): string[] {
  const errores: string[] = []
  page.on('console', msg => {
    if (msg.type() !== 'error') return
    const texto = msg.text()
    // Los 401/403 de Supabase sin sesión son esperados en las rutas públicas
    if (/Failed to load resource|401|403/.test(texto)) return
    errores.push(texto)
  })
  page.on('pageerror', err => errores.push(String(err)))
  return errores
}

/**
 * Ninguna pantalla debe desplazarse en horizontal.
 *
 * Ya nos ha pasado dos veces: una barra de navegación por encima de los
 * diálogos y unas tarjetas más anchas que el móvil. Se ve enseguida en un
 * teléfono y no se ve nunca en un portátil.
 */
export async function sinScrollHorizontal(page: Page) {
  const desborda = await page.evaluate(() => {
    const d = document.documentElement
    // 1 px de tolerancia por el redondeo de los navegadores
    return d.scrollWidth > d.clientWidth + 1
  })
  expect(desborda, 'la página se desplaza en horizontal').toBe(false)
}
