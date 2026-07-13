// Phase 5 e2e：项目编辑 + 标签管理核心流程验证（REQ-007 / REQ-009）。
// 用真实 Electron 实例驱动，通过 VIBEHUB_TEST_HOME 隔离数据目录，不碰用户真实
// ~/.vibehub。跑完清理临时目录，不留垃圾。
const assert = require('node:assert/strict')
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs')
const { _electron: electron } = require('playwright')

const PROJECT_ROOT = path.join(__dirname, '..')
const NODE_FIXTURE = path.join(__dirname, 'fixtures', 'node-project')
const UNKNOWN_FIXTURE = path.join(__dirname, 'fixtures', 'unknown-project')

async function withApp(testHome, run) {
  const app = await electron.launch({
    args: ['.'],
    cwd: PROJECT_ROOT,
    env: { ...process.env, VIBEHUB_TEST_HOME: testHome }
  })
  try {
    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await run(window)
  } finally {
    await app.close()
  }
}

async function testEditAndTagFlow() {
  const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vibehub-e2e-'))
  try {
    await withApp(testHome, async (window) => {
      const addResult = await window.evaluate(
        (fixturePath) => window.api.addProject(fixturePath),
        NODE_FIXTURE
      )
      assert.equal(addResult.success, true, 'addProject 应该成功')

      await window.reload()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForTimeout(500)

      assert.equal(
        await window.locator('text=node-project').first().isVisible(),
        true,
        '卡片应显示项目名'
      )

      // REQ-007：编辑名称并保存
      await window.locator('button[aria-label="编辑"]').first().click()
      await window.waitForTimeout(300)
      await window.locator('#project-name').fill('Renamed Project')
      await window.locator('button:has-text("保存")').click()
      await window.waitForTimeout(500)
      assert.equal(
        await window.locator('text=Renamed Project').first().isVisible(),
        true,
        '保存后卡片名称应即时更新'
      )

      // REQ-007 AC-001：名称清空时保存按钮置灰
      await window.locator('button[aria-label="编辑"]').first().click()
      await window.waitForTimeout(300)
      await window.locator('#project-name').fill('')
      const saveDisabled = await window.locator('button:has-text("保存")').isDisabled()
      assert.equal(saveDisabled, true, '名称为空时保存按钮应置灰')
      await window.keyboard.press('Escape')
      await window.waitForTimeout(300)

      // REQ-009：创建标签
      await window.locator('button:has-text("管理标签")').click()
      await window.waitForTimeout(300)
      await window.locator('input[placeholder="新建标签"]').fill('e2e-tag')
      await window.locator('button[aria-label="新建标签"]').click()
      await window.waitForTimeout(500)
      assert.equal(
        await window.locator('text=e2e-tag').first().isVisible(),
        true,
        '标签管理弹窗应显示新建的标签'
      )
      await window.keyboard.press('Escape')
      await window.waitForTimeout(300)

      // CMP-003：无关联项目的标签自动隐藏
      const sidebarTagCountBefore = await window.locator('aside').locator('text=e2e-tag').count()
      assert.equal(sidebarTagCountBefore, 0, '未关联任何项目的标签应在侧边栏隐藏')

      // 给项目打上标签，验证侧边栏标签重新出现 + 卡片徽章 + 筛选
      await window.locator('button[aria-label="编辑"]').first().click()
      await window.waitForTimeout(300)
      await window.locator('button:has-text("e2e-tag")').click()
      await window.locator('button:has-text("保存")').click()
      await window.waitForTimeout(500)

      assert.equal(
        await window.locator('aside').locator('text=e2e-tag').first().isVisible(),
        true,
        '标签关联项目后应在侧边栏重新出现'
      )

      await window.locator('aside').locator('button:has-text("e2e-tag")').click()
      await window.waitForTimeout(300)
      assert.equal(
        await window.locator('text=Renamed Project').first().isVisible(),
        true,
        '按标签筛选后仍应看到关联的项目'
      )

      // REQ-009 AC-001：删除标签后项目的标签引用被清除
      await window.locator('aside').locator('button:has-text("全部")').click()
      await window.locator('button:has-text("管理标签")').click()
      await window.waitForTimeout(300)
      await window.locator('button[aria-label="删除"]').first().click()
      await window.waitForTimeout(500)
      await window.keyboard.press('Escape')
      await window.waitForTimeout(300)
      const cardTagBadgeAfterDelete = await window.locator('text=e2e-tag').count()
      assert.equal(cardTagBadgeAfterDelete, 0, '删除标签后卡片上不应再显示该标签徽章')
    })
    console.log('PASS: testEditAndTagFlow')
  } finally {
    fs.rmSync(testHome, { recursive: true, force: true })
  }
}

async function testUnknownTypeStartCommand() {
  const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vibehub-e2e-'))
  try {
    await withApp(testHome, async (window) => {
      const addResult = await window.evaluate(
        (fixturePath) => window.api.addProject(fixturePath),
        UNKNOWN_FIXTURE
      )
      assert.equal(addResult.success, true, 'addProject 应该成功')
      assert.equal(addResult.project.status, 'error', 'unknown 类型项目应落入错误态')

      await window.reload()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForTimeout(500)

      assert.equal(
        await window.locator('text=无法识别项目类型').first().isVisible(),
        true,
        '应显示无法识别项目类型的错误提示'
      )

      await window.locator('button[aria-label="编辑"]').first().click()
      await window.waitForTimeout(300)
      assert.equal(
        await window.locator('#start-command').isVisible(),
        true,
        'unknown 类型应展示启动命令输入框'
      )

      await window.locator('#start-command').fill('node run.js')
      await window.locator('button:has-text("保存")').click()
      await window.waitForTimeout(500)

      // REQ-007 AC-002：填入启动命令后项目转为可启动状态
      assert.equal(
        await window.locator('button[aria-label="启动"]').first().isVisible(),
        true,
        '填入启动命令保存后应可正常启动'
      )

      await window.locator('button[aria-label="启动"]').first().click()
      await window.waitForTimeout(3000)

      assert.equal(
        await window.locator('button[aria-label="停止"]').first().isVisible(),
        true,
        '手动启动命令应能真正拉起进程并进入运行中状态'
      )

      await window.locator('button[aria-label="停止"]').first().click()
      await window.waitForTimeout(1000)
    })
    console.log('PASS: testUnknownTypeStartCommand')
  } finally {
    fs.rmSync(testHome, { recursive: true, force: true })
  }
}

async function testFavoriteProjectsStayPinnedAndPersist() {
  const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vibehub-e2e-'))
  try {
    await withApp(testHome, async (window) => {
      const firstResult = await window.evaluate(
        (fixturePath) => window.api.addProject(fixturePath),
        NODE_FIXTURE
      )
      const secondResult = await window.evaluate(
        (fixturePath) => window.api.addProject(fixturePath),
        UNKNOWN_FIXTURE
      )
      assert.equal(firstResult.success, true, '第一个项目应该添加成功')
      assert.equal(secondResult.success, true, '第二个项目应该添加成功')

      await window.reload()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForTimeout(500)

      const secondCard = window.locator(`[data-project-id="${secondResult.project.id}"]`)
      await secondCard.locator('button[aria-label="收藏"]').click()
      await window.waitForTimeout(300)

      let orderedProjectIds = await window
        .locator('[data-project-id]')
        .evaluateAll((cards) => cards.map((card) => card.getAttribute('data-project-id')))
      assert.equal(orderedProjectIds[0], secondResult.project.id, '收藏项目应该立即置顶')
      assert.equal(
        await secondCard.locator('button[aria-label="取消收藏"]').isVisible(),
        true,
        '收藏后星标按钮应该切换为取消收藏'
      )

      const projectsFile = path.join(testHome, '.vibehub', 'projects.json')
      const persistedProjects = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'))
      assert.equal(
        persistedProjects.find((project) => project.id === secondResult.project.id).isFavorite,
        true,
        '收藏状态应该写入 projects.json'
      )

      await window.reload()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForTimeout(500)
      orderedProjectIds = await window
        .locator('[data-project-id]')
        .evaluateAll((cards) => cards.map((card) => card.getAttribute('data-project-id')))
      assert.equal(orderedProjectIds[0], secondResult.project.id, '重启界面后收藏项目仍应置顶')

      await window
        .locator(`[data-project-id="${secondResult.project.id}"]`)
        .locator('button[aria-label="取消收藏"]')
        .click()
      await window.waitForTimeout(300)
      orderedProjectIds = await window
        .locator('[data-project-id]')
        .evaluateAll((cards) => cards.map((card) => card.getAttribute('data-project-id')))
      assert.equal(orderedProjectIds[0], firstResult.project.id, '取消收藏后应恢复原有排序')
    })
    console.log('PASS: testFavoriteProjectsStayPinnedAndPersist')
  } finally {
    fs.rmSync(testHome, { recursive: true, force: true })
  }
}

async function main() {
  await testEditAndTagFlow()
  await testUnknownTypeStartCommand()
  await testFavoriteProjectsStayPinnedAndPersist()
  console.log('ALL E2E TESTS PASSED')
}

main().catch((error) => {
  console.error('E2E TEST FAILED:', error)
  process.exitCode = 1
})
