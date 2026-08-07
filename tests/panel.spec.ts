import { test, expect } from '@playwright/test'
import { entrar, hayCredenciales, vigilarErrores, sinScrollHorizontal } from './helpers'

/**
 * Pantallas internas. Necesitan un usuario de pruebas:
 *
 *   E2E_EMAIL=... E2E_PASSWORD=... npm test
 *
 * Sin credenciales se saltan en vez de fallar, pero entonces NO están
 * cubiertas: que la suite pase en verde sin ellas no significa que el panel
 * funcione.
 */
test.skip(!hayCredenciales, 'Sin E2E_EMAIL / E2E_PASSWORD')

test.beforeEach(async ({ page }) => {
  await entrar(page)
})

test.describe('Resumen', () => {
  test('muestra las tres secciones', async ({ page }) => {
    const errores = vigilarErrores(page)
    await page.goto('/panel')

    await expect(page.getByText('Pulso del mes')).toBeVisible()
    await expect(page.getByText('Campañas de esta semana')).toBeVisible()
    await expect(page.getByText('Tus clientes')).toBeVisible()

    await sinScrollHorizontal(page)
    expect(errores).toEqual([])
  })

  test('las siete campañas están siempre, con su cero si no hay nadie', async ({ page }) => {
    await page.goto('/panel')
    const enlaces = page.locator('a[href^="/panel/campanas/"]')
    // Siete campañas; en escritorio la rejilla puede repetir alguna en el pie
    expect(await enlaces.count()).toBeGreaterThanOrEqual(7)
  })

  test('la tarjeta del pulso se voltea y enseña la explicación', async ({ page }) => {
    await page.goto('/panel')
    const tarjeta = page.locator('.flip-card').first()
    const altoAntes = (await tarjeta.boundingBox())?.height ?? 0

    await tarjeta.locator('button').first().click()
    await expect(tarjeta).toHaveAttribute('data-flipped', 'true')

    // El alto no debe cambiar al girar: si cambia, la rejilla salta y las
    // tarjetas de al lado se mueven bajo el cursor.
    const altoDespues = (await tarjeta.boundingBox())?.height ?? 0
    expect(Math.abs(altoDespues - altoAntes)).toBeLessThan(2)
    // Y ninguna cara puede quedar cortada
    expect(altoDespues).toBeGreaterThan(80)
  })

  test('«Tus clientes» mantiene el alto al cambiar de grupo', async ({ page }) => {
    await page.goto('/panel')
    const panelLista = page.locator('section', { hasText: 'Tus clientes' }).locator('.h-\\[24rem\\]').first()
    const alto = (await panelLista.boundingBox())?.height ?? 0

    await page.getByRole('button', { name: /Dormidos/i }).first().click()
    const altoDespues = (await panelLista.boundingBox())?.height ?? 0
    expect(Math.abs(altoDespues - alto)).toBeLessThan(2)
  })
})

test.describe('Campañas', () => {
  const PLANTILLAS = [
    'cumpleanos', 'bono_bajo', 'renovacion_caducada', 'upsell_bono',
    'reactivacion', 'valle', 'segunda_visita',
  ]

  for (const plantilla of PLANTILLAS) {
    test(`${plantilla} abre con su tablero`, async ({ page }) => {
      const errores = vigilarErrores(page)
      await page.goto(`/panel/campanas/${plantilla}`)

      await expect(page.getByText('Campaña', { exact: true })).toBeVisible()
      await expect(page.getByText('Progreso')).toBeVisible()
      await expect(page.getByText('Mensaje', { exact: true })).toBeVisible()

      await sinScrollHorizontal(page)
      expect(errores).toEqual([])
    })
  }

  test('una plantilla inventada da 404', async ({ page }) => {
    const respuesta = await page.goto('/panel/campanas/no-existe')
    expect(respuesta?.status()).toBe(404)
  })

  test('el mensaje no deja variables sin sustituir', async ({ page }) => {
    await page.goto('/panel/campanas/cumpleanos')
    const burbuja = page.locator('.rounded-br-sm').first()
    if (await burbuja.count() === 0) test.skip()
    // Un «{niño}» literal llegando a una familia es de las cosas que no se
    // pueden deshacer: el mensaje ya está enviado.
    await expect(burbuja).not.toContainText('{')
  })
})

test.describe('Pantallas de trabajo diario', () => {
  const RUTAS = [
    '/', '/miembros', '/familias', '/calendario',
    '/panel/tienda', '/panel/servicios', '/panel/tendencias', '/miembros/historico',
  ]

  for (const ruta of RUTAS) {
    test(`${ruta} carga sin errores`, async ({ page }) => {
      const errores = vigilarErrores(page)
      await page.goto(ruta)
      await expect(page.locator('body')).toBeVisible()
      await page.waitForTimeout(800) // margen para las consultas del cliente
      await sinScrollHorizontal(page)
      expect(errores, `errores de consola en ${ruta}`).toEqual([])
    })
  }
})

test.describe('Ancho de pantalla', () => {
  test('el contenido usa todo el ancho disponible', async ({ page }) => {
    // Se probó limitarlo a 1400 px en AppShell por legibilidad y el resultado
    // fue peor: en monitores grandes desaprovechaba media pantalla. Esta
    // prueba está para que no vuelva a colarse un tope por descuido.
    await page.setViewportSize({ width: 1800, height: 950 })
    await page.goto('/panel')
    const ancho = await page.evaluate(() => {
      const h1 = document.querySelector('h1')
      const cont = h1?.closest('div.space-y-6') as HTMLElement | null
      return cont ? cont.getBoundingClientRect().width : 0
    })
    // 1800 menos la barra lateral (224 px) y los márgenes
    expect(ancho).toBeGreaterThan(1400)
  })
})
