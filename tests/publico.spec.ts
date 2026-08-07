import { test, expect } from '@playwright/test'
import { vigilarErrores, sinScrollHorizontal } from './helpers'

/**
 * Pantallas públicas y puerta de entrada.
 *
 * Esta parte corre sin credenciales, así que es la que se ejecuta siempre.
 */

test.describe('Acceso', () => {
  test('el login se muestra y pide correo y contraseña', async ({ page }) => {
    const errores = vigilarErrores(page)
    await page.goto('/login')

    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()

    await sinScrollHorizontal(page)
    expect(errores).toEqual([])
  })

  // Es la prueba más importante del archivo: si esto se rompe, los datos de
  // familias con menores quedan accesibles sin sesión.
  for (const ruta of ['/panel', '/miembros', '/calendario', '/panel/tienda', '/familias']) {
    test(`${ruta} echa a quien no ha entrado`, async ({ page }) => {
      await page.goto(ruta)
      await page.waitForURL('**/login', { timeout: 15_000 })
      await expect(page.locator('input[type="password"]')).toBeVisible()
    })
  }
})

test.describe('Páginas abiertas', () => {
  for (const ruta of ['/privacidad', '/landing', '/alta/registro']) {
    test(`${ruta} carga sin errores`, async ({ page }) => {
      const errores = vigilarErrores(page)
      const respuesta = await page.goto(ruta)

      expect(respuesta?.status()).toBeLessThan(400)
      await expect(page.locator('body')).toBeVisible()
      await sinScrollHorizontal(page)
      expect(errores, `errores de consola en ${ruta}`).toEqual([])
    })
  }

  test('la política de privacidad tiene contenido de verdad', async ({ page }) => {
    await page.goto('/privacidad')
    // Un texto legal vacío es peor que no tenerlo: da apariencia de cumplimiento
    const texto = await page.locator('body').innerText()
    expect(texto.length).toBeGreaterThan(500)
  })
})

test.describe('Alta de familia', () => {
  test('no deja registrar sin aceptar el consentimiento', async ({ page }) => {
    await page.goto('/alta/registro')

    const casilla = page.locator('input[type="checkbox"]').first()
    await expect(casilla).toBeVisible()
    await expect(casilla).not.toBeChecked()

    // El botón de enviar debe estar bloqueado hasta que se acepte: el
    // consentimiento de datos de menores no puede ser un paso opcional.
    const enviar = page.locator('button[type="submit"]').last()
    await expect(enviar).toBeDisabled()
  })
})
