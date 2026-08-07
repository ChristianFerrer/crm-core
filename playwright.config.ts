import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

/**
 * Pruebas de pantalla.
 *
 * El dominio (métricas, segmentos, campañas) ya está cubierto por
 * `scripts/metrics-check.js`. Lo que faltaba era comprobar que las PANTALLAS
 * siguen funcionando: hasta ahora cada cambio visual se verificaba a ojo, y eso
 * deja de valer con un cliente en producción.
 *
 * No se busca cobertura: se cubren los caminos por los que pasa el dinero y los
 * datos de las familias. Si uno de esos se rompe, el fallo lo ve el cliente
 * delante de una familia esperando en el mostrador.
 *
 * El navegador ya está en la máquina, así que no se descarga nada. Se apunta al
 * ejecutable con `executablePath` porque la versión de Chromium instalada no
 * tiene por qué coincidir con la que espera Playwright, y ese desajuste solo se
 * manifiesta al lanzar la primera prueba.
 */

// El enlace de la imagen; si no existe, Playwright usa el suyo
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const launchOptions = existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : undefined

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3210',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], launchOptions } },
    // La mitad del uso real es desde el móvil detrás del mostrador, así que
    // las pantallas críticas se prueban también a 393 px.
    { name: 'movil', use: { ...devices['Pixel 7'], launchOptions } },
  ],

  // Se prueba contra el build de producción, no contra `next dev`: es lo que
  // usa el cliente, y `dev` esconde errores que solo salen al compilar.
  webServer: {
    command: 'npx next start -p 3210',
    url: 'http://127.0.0.1:3210/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
