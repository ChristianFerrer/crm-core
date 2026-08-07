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

  test('cada sección lleva su icono, sin texto explicativo', async ({ page }) => {
    await page.goto('/panel')
    // Con el icono y el color de cada sección, la explicación sobraba y solo
    // añadía ruido a una pantalla ya densa.
    await expect(page.getByText('Lo cobrado este mes', { exact: false })).toHaveCount(0)
    await expect(page.getByText('Seis grupos según cómo visitan', { exact: false })).toHaveCount(0)
    // Los iconos sí: son los que distinguen las tres secciones de un vistazo
    const iconos = page.locator('section > div:first-child svg').first()
    await expect(iconos).toBeVisible()
  })

  test('el título arranca cerca del borde superior', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/panel')
    const y = await page.locator('h1').first().evaluate(el => el.getBoundingClientRect().top)
    // Había dos `lg:pt-*` en la misma clase y ganaba el mayor sin querer
    expect(y).toBeLessThan(40)
  })

  test('el resumen no enseña ninguna cifra en euros', async ({ page }) => {
    await page.goto('/panel')
    const texto = await page.locator('main').innerText()
    // Los ingresos salen de sumar lo registrado en la app: un cobro por fuera
    // los deja bajos, y una cifra de caja equivocada en la pantalla de cada
    // mañana arrastra la credibilidad del resto. Viven en Tendencias.
    const importes = texto.match(/\d[\d.,]*\s?€/g) ?? []
    expect(importes, `euros en el resumen: ${importes.join(', ')}`).toEqual([])
  })

  test('Tendencias sí enseña los ingresos, con su aviso', async ({ page }) => {
    await page.goto('/panel/tendencias')
    await expect(page.getByText('Ingresos del mes')).toBeVisible()
    await expect(page.getByText('no aparece', { exact: false })).toBeVisible()
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

test.describe('Cabeceras de pantalla', () => {
  test('Inicio lleva una línea de contexto bajo el título', async ({ page }) => {
    await page.goto('/')
    const h1 = page.locator('h1').first()
    await expect(h1).toBeVisible()
    // Debajo del nombre del centro: qué día se mira y quién hay dentro
    const sub = h1.locator('xpath=following-sibling::p[1]')
    await expect(sub).toBeVisible()
    expect((await sub.innerText()).length).toBeGreaterThan(8)
  })

  test('Agenda lleva una línea de contexto bajo el título', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/calendario')
    const h1 = page.getByRole('heading', { level: 1 }).first()
    await expect(h1).toBeVisible()
    const sub = h1.locator('xpath=following-sibling::p[1]')
    await expect(sub).toBeVisible()
    // Mes, año y el estado de las reservas de hoy
    expect(await sub.innerText()).toMatch(/20\d\d/)
  })
})

test.describe('Ficha de miembro', () => {
  test('el comportamiento son cuatro tarjetas que se giran', async ({ page }) => {
    await page.goto('/miembros')
    const primera = page.locator('a[href^="/miembros/"]').first()
    if (await primera.count() === 0) test.skip()
    await primera.click()
    await page.waitForURL(/\/miembros\/[^/]+$/)

    await expect(page.getByText('Comportamiento')).toBeVisible()
    const tarjetas = page.locator('.flip-card')
    expect(await tarjetas.count()).toBe(4)

    // Girar una enseña qué mide, que es lo que un número suelto no dice
    const ritmo = tarjetas.nth(1)
    await ritmo.locator('button').first().click()
    await expect(ritmo).toHaveAttribute('data-flipped', 'true')
  })

  test('las pestañas llevan su cifra y su detalle', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/miembros')
    // El rótulo ya está en el menú: el tile tiene que aportar algo más
    await expect(page.getByText('sin bono', { exact: false })).toBeVisible()
    await expect(page.getByText('miembros agrupados', { exact: false })).toBeVisible()
    await expect(page.getByText('visitas este mes', { exact: false })).toBeVisible()
  })

  test('los agrupados nunca superan el total de miembros', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/miembros')
    const texto = await page.getByText('miembros agrupados', { exact: false }).first().innerText()
    const [agrupados, total] = (texto.match(/(\d+) de (\d+)/) ?? []).slice(1).map(Number)
    // Mezclar universos —contar unas cosas sobre otras— fue lo que produjo el
    // «14,6 adultos por familia». Un subconjunto no puede ser mayor que el todo.
    expect(agrupados).toBeLessThanOrEqual(total)
  })

  test('el listado ya no lleva leyenda ni puntos de color', async ({ page }) => {
    await page.goto('/miembros')
    await expect(page.getByText('Estados de bono')).toHaveCount(0)
    // El color del texto distingue el estado; el punto obligaba a una leyenda
    expect(await page.locator('td span.rounded-full.w-2').count()).toBe(0)
  })
})
