import { expect, test } from '@playwright/test'
import { createUser, login } from './helpers'

// Executa no projeto "mobile" (Pixel 7, 412 px de largura).
test('fluxo mobile: navegação inferior, captura rápida, menu Mais e alvos de toque', async ({ page }) => {
  const user = await createUser('mob')
  await login(page, user)

  // Barra inferior visível; a lateral do desktop não existe no mobile.
  const bottomNav = page.getByRole('navigation', { name: 'Principal' })
  await expect(bottomNav).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sair' })).toHaveCount(0)

  // Captura rápida no Meu dia
  await bottomNav.getByRole('link', { name: 'Meu dia' }).click()
  await page.getByLabel('Nova tarefa para este dia').fill('Ligar para o fornecedor')
  await page.keyboard.press('Enter')
  const box = page.getByRole('checkbox', { name: 'Concluir Ligar para o fornecedor' })
  await expect(box).toBeVisible()
  await box.click()
  await expect(box).toBeChecked()

  // Menu "Mais": destinos secundários e sair
  await bottomNav.getByRole('button', { name: /Mais/ }).click()
  await page.getByRole('navigation', { name: 'Mais opções' }).getByRole('link', { name: 'Configurações' }).click()
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible()

  // Sem rolagem horizontal e com alvos de toque ≥ 44 px
  for (const path of ['/app', '/app/meu-dia', '/app/tarefas', '/app/agenda', '/app/clientes', '/app/configuracoes']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow, `rolagem horizontal em ${path}`).toBe(false)

    const small = await page.evaluate(() => {
      const out: string[] = []
      for (const el of document.querySelectorAll('a, button, select, textarea, input:not([type=hidden])')) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (el.tagName === 'A' && el.getAttribute('href') === '#conteudo') continue
        const label = el.closest('label')
        if (el.tagName === 'INPUT' && label && label.getBoundingClientRect().height >= 44) continue
        if (r.height < 44 || r.width < 44) {
          const name = (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).trim().slice(0, 30)
          out.push(`${el.tagName} "${name}" ${Math.round(r.width)}x${Math.round(r.height)}`)
        }
      }
      return out
    })
    expect(small, `alvos de toque pequenos em ${path}`).toEqual([])
  }

  // Sair pelo menu Mais
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: /Mais/ }).click()
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
})
