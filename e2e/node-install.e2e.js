// Phase 7 e2e：Node 依赖自动检测与安装（SCOPE-015 / FLOW-002 分支路径）。
// 用真实 Electron 实例驱动，通过 VIBEHUB_TEST_HOME 隔离数据目录，不碰用户真实
// ~/.vibehub。用到真实 npm registry（fixture 依赖真实存在的极小包 `ms`），
// 跑完清理 fixture 里 npm install 产生的 node_modules/package-lock.json，不留垃圾。
const assert = require('node:assert/strict')
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs')
const { _electron: electron } = require('playwright')

const PROJECT_ROOT = path.join(__dirname, '..')
const NEEDS_INSTALL_FIXTURE = path.join(__dirname, 'fixtures', 'node-project-needs-install')
const INSTALL_FAILS_FIXTURE = path.join(__dirname, 'fixtures', 'node-project-install-fails')

function cleanFixtureInstallArtifacts(fixturePath) {
  fs.rmSync(path.join(fixturePath, 'node_modules'), { recursive: true, force: true })
  fs.rmSync(path.join(fixturePath, 'package-lock.json'), { force: true })
}

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
    // 测试用例如果在 run(window) 里途中断言失败，项目可能停在运行中/安装中态，
    // app.close() 会被 attachCloseGuard 拦截等一个不会出现的确认对话框而挂死——
    // 直接杀主进程收尾，效果等价且不阻塞测试收尾（见 delete-search-missing-close.e2e.js 同类注释）
    app.process().kill()
  }
}

async function testNodeModulesMissingTriggersAutoInstall() {
  const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vibehub-e2e-'))
  cleanFixtureInstallArtifacts(NEEDS_INSTALL_FIXTURE)
  try {
    await withApp(testHome, async (window) => {
      const addResult = await window.evaluate(
        (fixturePath) => window.api.addProject(fixturePath),
        NEEDS_INSTALL_FIXTURE
      )
      assert.equal(addResult.success, true, 'addProject 应该成功')

      await window.reload()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForTimeout(500)

      await window.locator('button[aria-label="启动"]').first().click()

      // SCOPE-015：node_modules 缺失时先进入"正在安装依赖..."态，而非直接报错或直接启动。
      // 用 waitFor 轮询而非固定 sleep，因为 IPC 状态广播耗时会随系统负载浮动
      await window.locator('text=正在安装依赖').first().waitFor({ state: 'visible', timeout: 10_000 })

      // 安装是真实走 npm registry，安装完成后应自动继续走正常启动流程进入运行中
      await window
        .locator('button[aria-label="停止"]')
        .first()
        .waitFor({ state: 'visible', timeout: 30_000 })
      assert.equal(
        fs.existsSync(path.join(NEEDS_INSTALL_FIXTURE, 'node_modules', 'ms')),
        true,
        'npm install 应该真的把依赖装进 fixture 的 node_modules'
      )

      await window.locator('button[aria-label="停止"]').first().click()
      await window.waitForTimeout(1000)
    })
    console.log('PASS: testNodeModulesMissingTriggersAutoInstall')
  } finally {
    cleanFixtureInstallArtifacts(NEEDS_INSTALL_FIXTURE)
    fs.rmSync(testHome, { recursive: true, force: true })
  }
}

async function testInstallFailureShowsRetryAndSkip() {
  const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vibehub-e2e-'))
  cleanFixtureInstallArtifacts(INSTALL_FAILS_FIXTURE)
  try {
    await withApp(testHome, async (window) => {
      const addResult = await window.evaluate(
        (fixturePath) => window.api.addProject(fixturePath),
        INSTALL_FAILS_FIXTURE
      )
      assert.equal(addResult.success, true, 'addProject 应该成功')

      await window.reload()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForTimeout(500)

      await window.locator('button[aria-label="启动"]').first().click()

      // fixture 依赖一个不存在的包，npm install 必然以非 0 退出码失败
      await window
        .locator('text=依赖安装失败')
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 })
      assert.equal(
        await window.locator('button:has-text("跳过")').first().isVisible(),
        true,
        '安装失败应提供跳过按钮'
      )
      assert.equal(
        await window.locator('button[aria-label="重试"]').first().isVisible(),
        true,
        '安装失败应提供重试按钮'
      )

      // 日志面板应展示 npm stderr
      await window.locator('button[aria-label="日志"]').first().click()
      await window.waitForTimeout(300)
      assert.equal(
        await window.locator('text=stderr').first().isVisible(),
        true,
        '安装失败的 npm stderr 应在日志面板可见'
      )

      // 点击跳过：绕过依赖检测直接尝试启动（fixture 本身逻辑简单，不依赖 ms 包，仍能正常拉起）
      await window.locator('button:has-text("跳过")').first().click()
      await window
        .locator('button[aria-label="停止"]')
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 })

      await window.locator('button[aria-label="停止"]').first().click()
      await window.waitForTimeout(1000)
    })
    console.log('PASS: testInstallFailureShowsRetryAndSkip')
  } finally {
    cleanFixtureInstallArtifacts(INSTALL_FAILS_FIXTURE)
    fs.rmSync(testHome, { recursive: true, force: true })
  }
}

async function main() {
  await testNodeModulesMissingTriggersAutoInstall()
  await testInstallFailureShowsRetryAndSkip()
  console.log('ALL E2E TESTS PASSED')
}

main()
  .catch((error) => {
    console.error('E2E TEST FAILED:', error)
    process.exitCode = 1
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0)
  })
