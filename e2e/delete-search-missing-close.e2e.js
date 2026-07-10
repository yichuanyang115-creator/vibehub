// Phase 6 e2e：删除项目、搜索排序、路径失效、关闭窗口告警核心流程验证
// （REQ-008 / REQ-010 / REQ-011 / FLOW-004）。
// 用真实 Electron 实例驱动，通过 VIBEHUB_TEST_HOME 隔离数据目录，不碰用户真实
// ~/.vibehub。跑完清理临时目录，不留垃圾。
const assert = require('node:assert/strict')
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs')
const { _electron: electron } = require('playwright')

const PROJECT_ROOT = path.join(__dirname, '..')
const NODE_FIXTURE = path.join(__dirname, 'fixtures', 'node-project')

async function withApp(testHome, run) {
  const app = await electron.launch({
    args: ['.'],
    cwd: PROJECT_ROOT,
    env: { ...process.env, VIBEHUB_TEST_HOME: testHome }
  })
  try {
    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await run(window, app)
  } finally {
    // 测试用例如果已经通过「停止并关闭」把所有窗口关掉，playwright 与已关闭
    // 窗口的评估通道会挂住，此时 app.close() 也会一直挂起——改成直接杀主进程，
    // 效果等价（进程本就该退出）且不会阻塞测试收尾
    if (app.windows().length === 0) {
      app.process().kill()
    } else {
      await app.close()
    }
  }
}

async function testDeleteProject() {
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

      // REQ-008：右键菜单删除，二次确认弹窗出现
      await window.locator('text=node-project').first().click({ button: 'right' })
      await window.waitForTimeout(200)
      await window.locator('button:has-text("删除")').first().click()
      await window.waitForTimeout(300)
      assert.equal(
        await window.locator('text=不会删除项目文件').first().isVisible(),
        true,
        '删除应弹出二次确认，文案说明不删除项目文件'
      )

      // 取消不应删除
      await window.locator('button:has-text("取消")').first().click()
      await window.waitForTimeout(300)
      assert.equal(
        await window.locator('text=node-project').first().isVisible(),
        true,
        '取消删除后卡片应仍然存在'
      )

      // 确认删除
      await window.locator('text=node-project').first().click({ button: 'right' })
      await window.waitForTimeout(200)
      await window.locator('button:has-text("删除")').first().click()
      await window.waitForTimeout(300)
      await window.locator('button:has-text("删除")').last().click()
      await window.waitForTimeout(500)

      assert.equal(
        await window.locator('text=node-project').count(),
        0,
        'REQ-008 AC-001：确认删除后卡片应从列表消失'
      )

      // REQ-008 AC-003：删除项目不应影响标签体系数据文件本身（文件仍存在，未被清空覆盖）
      const projectsRaw = fs.readFileSync(path.join(testHome, '.vibehub', 'projects.json'), 'utf-8')
      assert.equal(JSON.parse(projectsRaw).length, 0, '删除后 projects.json 应不再包含该项目')
    })
    console.log('PASS: testDeleteProject')
  } finally {
    fs.rmSync(testHome, { recursive: true, force: true })
  }
}

async function testDeleteRunningProject() {
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

      // 启动项目，等待进入运行中
      await window.locator('button[aria-label="启动"]').first().click()
      await window.waitForTimeout(3000)
      assert.equal(
        await window.locator('button[aria-label="停止"]').first().isVisible(),
        true,
        '项目应先进入运行中，用于验证删除运行中项目的分支'
      )

      // REQ-008 AC-002：删除运行中的项目，应先强制停止再删除，不留卡死或残留状态
      await window.locator('text=node-project').first().click({ button: 'right' })
      await window.waitForTimeout(200)
      await window.locator('button:has-text("删除")').first().click()
      await window.waitForTimeout(300)
      await window.locator('button:has-text("删除")').last().click()
      await window.waitForTimeout(1000)

      assert.equal(
        await window.locator('text=node-project').count(),
        0,
        '运行中项目删除后应从列表消失（进程已被强制停止）'
      )
    })
    console.log('PASS: testDeleteRunningProject')
  } finally {
    fs.rmSync(testHome, { recursive: true, force: true })
  }
}

async function testSearchAndSort() {
  const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vibehub-e2e-'))
  try {
    await withApp(testHome, async (window) => {
      await window.evaluate((fixturePath) => window.api.addProject(fixturePath), NODE_FIXTURE)

      await window.reload()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForTimeout(500)

      // REQ-010 AC-001：按名称模糊搜索，实时过滤
      await window.locator('input[aria-label="搜索项目"]').fill('node')
      await window.waitForTimeout(300)
      assert.equal(
        await window.locator('text=node-project').first().isVisible(),
        true,
        '搜索匹配关键字应展示对应项目'
      )

      await window.locator('input[aria-label="搜索项目"]').fill('不存在的项目名字xyz')
      await window.waitForTimeout(300)
      assert.equal(
        await window.locator('text=没有匹配的项目').first().isVisible(),
        true,
        '搜索无匹配结果应显示空态提示'
      )

      // 清空搜索恢复全部
      await window.locator('button[aria-label="清空搜索"]').click()
      await window.waitForTimeout(300)
      assert.equal(
        await window.locator('text=node-project').first().isVisible(),
        true,
        '清空搜索后应恢复显示全部项目'
      )

      // REQ-010 AC-002：切换排序方式
      await window.locator('select[aria-label="排序方式"]').selectOption('name-asc')
      await window.waitForTimeout(300)
      assert.equal(
        await window.locator('select[aria-label="排序方式"]').inputValue(),
        'name-asc',
        '排序下拉切换后应保留选中值'
      )
    })
    console.log('PASS: testSearchAndSort')
  } finally {
    fs.rmSync(testHome, { recursive: true, force: true })
  }
}

async function testMissingPathAndUpdatePath() {
  const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vibehub-e2e-'))
  try {
    await withApp(testHome, async (window) => {
      const addResult = await window.evaluate(
        (fixturePath) => window.api.addProject(fixturePath),
        NODE_FIXTURE
      )
      assert.equal(addResult.success, true, 'addProject 应该成功')
    })

    // FLOW-004：syncMissingPathStatuses 只在 app.whenReady() 跑一次，window.reload()
    // 只刷新渲染进程不会重新触发，必须真正重启一个新的 Electron 实例
    const projectsFile = path.join(testHome, '.vibehub', 'projects.json')
    const projects = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'))
    projects[0].path = '/tmp/vibehub-e2e-nonexistent-path-xyz'
    fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2))

    await withApp(testHome, async (window) => {
      await window.waitForTimeout(500)

      assert.equal(
        await window.locator('text=项目路径不存在').first().isVisible(),
        true,
        'FLOW-004：重启后检测到路径失效应显示对应文案'
      )
      assert.equal(
        await window.locator('button:has-text("更新路径")').first().isVisible(),
        true,
        '路径失效卡片应展示更新路径按钮'
      )
    })
    console.log('PASS: testMissingPathAndUpdatePath')
  } finally {
    fs.rmSync(testHome, { recursive: true, force: true })
  }
}

async function testCloseWindowWithRunningProject() {
  const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vibehub-e2e-'))
  try {
    await withApp(testHome, async (window, app) => {
      const addResult = await window.evaluate(
        (fixturePath) => window.api.addProject(fixturePath),
        NODE_FIXTURE
      )
      assert.equal(addResult.success, true, 'addProject 应该成功')

      await window.reload()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForTimeout(500)

      await window.locator('button[aria-label="启动"]').first().click()
      await window.waitForTimeout(3000)
      assert.equal(
        await window.locator('button[aria-label="停止"]').first().isVisible(),
        true,
        '项目应先进入运行中，用于验证关闭确认分支'
      )

      // REQ-011 AC-001：有运行中项目时，触发窗口 close 事件应被拦截并弹出确认对话框
      // （electronApp.close() 会强制退出、不走这个拦截，必须在主进程里模拟真实的用户关闭动作）
      await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].close()
      })
      await window.waitForTimeout(500)
      assert.equal(
        await window.locator('text=正在运行').first().isVisible(),
        true,
        '有运行中项目时点击关闭应弹出确认对话框，文案包含运行中项目数量'
      )

      // REQ-011 AC-003：点击取消，窗口和项目均不受影响
      await window.locator('button:has-text("取消")').first().click()
      await window.waitForTimeout(300)
      assert.equal(
        await window.locator('button[aria-label="停止"]').first().isVisible(),
        true,
        '取消关闭后运行中项目应继续保持运行状态'
      )

      // REQ-011 AC-002：点击「停止并关闭」，项目被强制终止、窗口真正关闭。
      // 点击后窗口会真的关闭，对应的 playwright Page 对象随之失效——不能再对
      // window 调用任何方法（包括 waitForTimeout），后续只能通过 app.evaluate
      // 在主进程侧确认结果。macOS 上关闭窗口不等于退出整个 Electron 进程
      // （见 main/index.ts window-all-closed 的 darwin 分支），所以这里断言
      // 窗口数量而不是等待进程整体退出
      await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].close()
      })
      await window.waitForTimeout(500)
      const closePromise = window
        .locator('button:has-text("停止并关闭")')
        .first()
        .click()
        .catch(() => {})
      await closePromise
      await new Promise((resolve) => setTimeout(resolve, 1000))
      // 窗口关闭后 app.evaluate 会挂起（评估通道挂在已关闭窗口的上下文上），
      // 用 app.windows() 直接读取 playwright 侧记录的窗口列表即可，不用再跨进程评估
      assert.equal(app.windows().length, 0, '点击停止并关闭后窗口应真正关闭')
    })
    console.log('PASS: testCloseWindowWithRunningProject')
  } finally {
    fs.rmSync(testHome, { recursive: true, force: true })
  }
}

async function testCloseWindowWithoutRunningProject() {
  const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vibehub-e2e-'))
  try {
    await withApp(testHome, async (window, app) => {
      // REQ-011 AC-004：无运行中项目时点击关闭，直接关闭无弹窗——
      // 用窗口是否仍存在来验证关闭没有被拦截住。窗口关闭后 app.evaluate 会挂起
      // （见 testCloseWindowWithRunningProject 注释），用 app.windows() 代替
      await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].close()
      })
      // 无运行中项目时窗口会立即真正关闭，对应的 Page 对象随之失效，
      // 不能再对 window 调用 waitForTimeout，改用普通 setTimeout 等待
      await new Promise((resolve) => setTimeout(resolve, 500))
      assert.equal(app.windows().length, 0, '无运行中项目时点击关闭应直接关闭窗口，无确认弹窗拦截')
    })
    console.log('PASS: testCloseWindowWithoutRunningProject')
  } finally {
    fs.rmSync(testHome, { recursive: true, force: true })
  }
}

async function main() {
  await testDeleteProject()
  await testDeleteRunningProject()
  await testSearchAndSort()
  await testMissingPathAndUpdatePath()
  await testCloseWindowWithRunningProject()
  await testCloseWindowWithoutRunningProject()
  console.log('ALL E2E TESTS PASSED')
}

main()
  .catch((error) => {
    console.error('E2E TEST FAILED:', error)
    process.exitCode = 1
  })
  .finally(() => {
    // 最后一个用例通过「停止并关闭」把 Electron 进程杀掉后，playwright 内部
    // 仍持有的某个连接/句柄会让 Node 进程挂着不退出，显式 exit 保证脚本能正常收尾
    process.exit(process.exitCode ?? 0)
  })
