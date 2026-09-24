import { test, expect } from '@playwright/test'

// See here how to get started:
// https://playwright.dev/docs/intro
test('visits the app root url', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('Pointcloud Generate')
  await expect(page.getByRole('button', { name: 'EXPORT' })).toBeEnabled()
})

test('keeps view controls synchronized and accepts exact camera values', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'EXPORT' })).toBeEnabled()

  const brightness = page.getByRole('slider', { name: 'Brightness' })
  const azimuth = page.getByRole('spinbutton', { name: 'Camera azimuth in degrees' })
  const elevation = page.getByRole('spinbutton', { name: 'Camera elevation in degrees' })
  const distance = page.getByRole('spinbutton', { name: 'Camera distance' })

  await expect(brightness).toHaveValue('125')
  await expect(azimuth).not.toHaveValue('')
  await expect(elevation).not.toHaveValue('')
  await expect(distance).not.toHaveValue('')

  const initialAzimuth = await azimuth.inputValue()
  const canvas = page.locator('canvas')
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('Point cloud canvas is not visible.')
  await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.5, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => azimuth.inputValue()).not.toBe(initialAzimuth)

  await azimuth.fill('-32.5')
  await azimuth.press('Tab')
  await expect(azimuth).toHaveValue('-32.5')

  await elevation.fill('18')
  await elevation.press('Tab')
  await expect(elevation).toHaveValue('18')

  await page.getByRole('button', { name: 'RESET' }).click()
  await expect(azimuth).not.toHaveValue('-32.5')
  await expect(elevation).not.toHaveValue('18')
})
