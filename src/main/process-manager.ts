import { spawn, type ChildProcess } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { connect } from 'net'
import type { Server } from 'http'
import { startStaticServer } from './static-server'
import { appendLog, clearLogs } from './log-buffer'
import { resolveAppExecutablePath } from './app-bundle'
import type { Project } from '../shared/types'

const PORT_POLL_INTERVAL_MS = 300
const PORT_POLL_TIMEOUT_MS = 15_000

interface RunningProcess {
  child: ChildProcess | null
  staticServer: Server | null
  intentionalStop: boolean
  // web 类型子进程用 detached: true 启动（是独立进程组组长），停止时要对整个
  // 进程组发信号才能连带杀掉 npm fork 出的实际脚本进程；app 类型直接 spawn
  // 目标二进制本身，不是外壳进程，无需进程组语义，对 pid 本身发信号即可
  isProcessGroupLeader: boolean
}

const runningProcesses = new Map<string, RunningProcess>()

export class LaunchCommandError extends Error {}

interface LaunchCommand {
  command: string
  args: string[]
  usesPortEnv: boolean
  useShell?: boolean
}

function readPackageJsonScripts(projectPath: string): Record<string, string> | null {
  const packageJsonPath = join(projectPath, 'package.json')
  if (!existsSync(packageJsonPath)) {
    return null
  }
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    return packageJson.scripts ?? null
  } catch {
    return null
  }
}

// SCOPE-015：启动前用这个判断 node 项目是否需要先跑一遍 npm install
// 如果 package.json 压根没有 dependencies/devDependencies，则不需要 node_modules
export function hasNodeModules(projectPath: string): boolean {
  if (existsSync(join(projectPath, 'node_modules'))) {
    return true
  }
  const packageJsonPath = join(projectPath, 'package.json')
  if (!existsSync(packageJsonPath)) {
    return true
  }
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    const hasDeps =
      (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) ||
      (pkg.devDependencies && Object.keys(pkg.devDependencies).length > 0)
    return !hasDeps
  } catch {
    return true
  }
}

interface InstallResult {
  success: boolean
}

// SCOPE-015：node_modules 缺失时在项目目录跑 npm install，日志实时推流给 renderer
// 复用 pipeChildLogs；不放进 runningProcesses map，因为没有取消/停止安装的交互，
// 调用方（ipc/launch.ts）拿到成功与否后自行决定是继续启动还是转入失败态
export function runNpmInstall(project: Project): Promise<InstallResult> {
  clearLogs(project.id)
  return new Promise((resolve) => {
    const child = spawn('npm', ['install'], { cwd: project.path })
    pipeChildLogs(project.id, child)
    child.on('exit', (code) => resolve({ success: code === 0 }))
    child.on('error', () => resolve({ success: false }))
  })
}

function resolveNodeCommand(projectPath: string): LaunchCommand {
  const scripts = readPackageJsonScripts(projectPath)
  if (scripts?.dev) {
    return { command: 'npm', args: ['run', 'dev'], usesPortEnv: true }
  }
  if (scripts?.start) {
    return { command: 'npm', args: ['run', 'start'], usesPortEnv: true }
  }
  throw new LaunchCommandError('未找到 dev 或 start 脚本')
}

// startCommand 是用户填的一整行文本（如「npm run dev」），不是单一可执行文件路径，
// 必须走 shell 解析空格和参数，不能像其它类型一样直接 spawn(command, args)。
// 这不是典型的 shell 注入风险场景：单用户本地桌面应用，startCommand 是用户为自己电脑上
// 的项目手动填写的本机命令，不接收远程/跨用户输入；能篡改 ~/.vibehub/projects.json
// 的攻击者已具备本地文件写权限，此时 shell 解析不构成额外的权限提升面
function resolveManualCommand(startCommand: string): LaunchCommand {
  return { command: startCommand, args: [], usesPortEnv: true, useShell: true }
}

function resolvePythonCommand(projectPath: string, port: number): LaunchCommand {
  if (existsSync(join(projectPath, 'app.py'))) {
    return { command: 'python3', args: ['app.py'], usesPortEnv: true }
  }
  if (existsSync(join(projectPath, 'main.py'))) {
    return { command: 'python3', args: ['main.py'], usesPortEnv: true }
  }
  if (existsSync(join(projectPath, 'manage.py'))) {
    return {
      command: 'python3',
      args: ['manage.py', 'runserver', `0.0.0.0:${port}`],
      usesPortEnv: false
    }
  }
  throw new LaunchCommandError('未找到 app.py、main.py 或 manage.py')
}

function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: 'localhost' })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

interface PortWatcher {
  cancel: () => void
}

function waitForPort(port: number, onTimeout: () => void, onReady: () => void): PortWatcher {
  const startedAt = Date.now()
  let cancelled = false

  const poll = async (): Promise<void> => {
    if (cancelled) {
      return
    }
    if (await isPortListening(port)) {
      if (!cancelled) {
        onReady()
      }
      return
    }
    if (Date.now() - startedAt >= PORT_POLL_TIMEOUT_MS) {
      if (!cancelled) {
        onTimeout()
      }
      return
    }
    setTimeout(poll, PORT_POLL_INTERVAL_MS)
  }

  poll()

  return { cancel: () => (cancelled = true) }
}

export interface ExitInfo {
  code: number | null
  wasIntentionalStop: boolean
}

export interface LaunchResult {
  onReady: (callback: () => void) => void
  onError: (callback: (message: string) => void) => void
  onExit: (callback: (info: ExitInfo) => void) => void
}

function pipeChildLogs(projectId: string, child: ChildProcess): void {
  child.stdout?.on('data', (chunk: Buffer) => {
    appendLog(projectId, { stream: 'stdout', text: chunk.toString(), timestamp: Date.now() })
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    appendLog(projectId, { stream: 'stderr', text: chunk.toString(), timestamp: Date.now() })
  })
}

interface LaunchEmitter {
  result: LaunchResult
  emitReady: () => void
  emitError: (message: string) => void
  emitExit: (info: ExitInfo) => void
}

function createLaunchEmitter(): LaunchEmitter {
  const readyCallbacks: Array<() => void> = []
  const errorCallbacks: Array<(message: string) => void> = []
  const exitCallbacks: Array<(info: ExitInfo) => void> = []

  return {
    result: {
      onReady: (cb) => readyCallbacks.push(cb),
      onError: (cb) => errorCallbacks.push(cb),
      onExit: (cb) => exitCallbacks.push(cb)
    },
    emitReady: () => readyCallbacks.forEach((cb) => cb()),
    emitError: (message) => errorCallbacks.forEach((cb) => cb(message)),
    emitExit: (info) => exitCallbacks.forEach((cb) => cb(info))
  }
}

export function launchWebProject(project: Project, port: number): LaunchResult {
  const { result, emitReady, emitError, emitExit } = createLaunchEmitter()

  clearLogs(project.id)

  if (project.projectType === 'static') {
    const server = startStaticServer(project.path, port)
    runningProcesses.set(project.id, {
      child: null,
      staticServer: server,
      intentionalStop: false,
      isProcessGroupLeader: false
    })
    setTimeout(emitReady, 0)
    return result
  }

  let launchCommand: LaunchCommand
  try {
    if (project.projectType === 'node') {
      launchCommand = resolveNodeCommand(project.path)
    } else if (project.projectType === 'python') {
      launchCommand = resolvePythonCommand(project.path, port)
    } else if (project.startCommand) {
      // REQ-007：unknown 类型项目填入启动命令后走该手动命令，不再依赖自动检测
      launchCommand = resolveManualCommand(project.startCommand)
    } else {
      throw new LaunchCommandError('未识别项目类型，且未填写启动命令')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知启动错误'
    appendLog(project.id, { stream: 'stderr', text: message, timestamp: Date.now() })
    setTimeout(() => emitError(message), 0)
    return result
  }

  // detached: true 让子进程成为独立进程组的组长，停止时对整个进程组发信号
  // （见 stopProject），否则杀掉 npm 这类外壳进程后，它 fork 出的实际
  // 脚本进程（如 npm run dev 拉起的 node 服务）会变成孤儿进程继续占用端口
  const child = spawn(launchCommand.command, launchCommand.args, {
    cwd: project.path,
    env: launchCommand.usesPortEnv ? { ...process.env, PORT: String(port) } : process.env,
    detached: true,
    shell: launchCommand.useShell ?? false
  })

  runningProcesses.set(project.id, {
    child,
    staticServer: null,
    intentionalStop: false,
    isProcessGroupLeader: true
  })
  pipeChildLogs(project.id, child)

  const watcher = waitForPort(
    port,
    () => emitError('启动超时，端口未被监听'),
    () => emitReady()
  )

  // exit/error 始终上报原始事件，由调用方（ipc/launch.ts 的状态机）判断
  // 退出发生在启动阶段（视为启动失败）、用户主动停止（视为已停止）还是运行阶段意外退出（视为错误）
  child.on('exit', (code) => {
    const wasIntentionalStop = runningProcesses.get(project.id)?.intentionalStop ?? false
    runningProcesses.delete(project.id)
    watcher.cancel()
    emitExit({ code, wasIntentionalStop })
  })

  child.on('error', (error) => {
    runningProcesses.delete(project.id)
    watcher.cancel()
    emitError(error.message)
  })

  return result
}

export function launchAppProject(project: Project): LaunchResult {
  const { result, emitReady, emitError, emitExit } = createLaunchEmitter()

  clearLogs(project.id)

  if (!project.appBundlePath) {
    const message = '未找到 .app 包路径'
    appendLog(project.id, { stream: 'stderr', text: message, timestamp: Date.now() })
    setTimeout(() => emitError(message), 0)
    return result
  }

  let executablePath: string
  try {
    executablePath = resolveAppExecutablePath(project.appBundlePath)
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知启动错误'
    appendLog(project.id, { stream: 'stderr', text: message, timestamp: Date.now() })
    setTimeout(() => emitError(message), 0)
    return result
  }

  const child = spawn(executablePath, [], { cwd: project.path })

  runningProcesses.set(project.id, {
    child,
    staticServer: null,
    intentionalStop: false,
    isProcessGroupLeader: false
  })
  pipeChildLogs(project.id, child)

  // app 类型进程存活即视为运行中，无端口轮询这道中间判定（Product-Spec.md REQ-004）
  setTimeout(emitReady, 0)

  child.on('exit', (code) => {
    const wasIntentionalStop = runningProcesses.get(project.id)?.intentionalStop ?? false
    runningProcesses.delete(project.id)
    emitExit({ code, wasIntentionalStop })
  })

  child.on('error', (error) => {
    runningProcesses.delete(project.id)
    emitError(error.message)
  })

  return result
}

export function stopProject(projectId: string): void {
  const running = runningProcesses.get(projectId)
  if (!running) {
    return
  }
  if (running.staticServer) {
    // static server 没有 exit 事件，直接在这里清理
    running.staticServer.close()
    runningProcesses.delete(projectId)
    return
  }
  // 标记为主动停止，交给 child 的 exit 回调统一清理 map 并上报状态
  running.intentionalStop = true
  if (running.child?.pid) {
    // 对负的 pid 发信号 = 杀死整个进程组，仅适用于 detached: true 启动的
    // web 类型外壳进程；app 类型直接 spawn 目标二进制，对 pid 本身发信号即可
    const signalTarget = running.isProcessGroupLeader ? -running.child.pid : running.child.pid
    process.kill(signalTarget, 'SIGKILL')
  }
}

// REQ-008 AC-002：删除运行中项目前用这个等真正退出，不能用上面的 stopProject 就同步
// 删 store 记录——SIGKILL 是异步的，进程实际退出前 store 记录已经没了，会导致
// launchXxxProject 里注册的 child.on('exit') 回调对着一个已删除的 projectId 做无效更新
export function stopProjectAndWait(projectId: string): Promise<void> {
  const running = runningProcesses.get(projectId)
  if (!running) {
    return Promise.resolve()
  }
  if (running.staticServer) {
    running.staticServer.close()
    runningProcesses.delete(projectId)
    return Promise.resolve()
  }
  running.intentionalStop = true
  const child = running.child
  if (!child?.pid) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    child.once('exit', () => resolve())
    const signalTarget = running.isProcessGroupLeader ? -child.pid! : child.pid!
    process.kill(signalTarget, 'SIGKILL')
  })
}

export function isProjectRunning(projectId: string): boolean {
  return runningProcesses.has(projectId)
}

export function detachProject(projectId: string): void {
  const running = runningProcesses.get(projectId)
  if (!running) {
    return
  }
  if (running.child) {
    running.child.unref()
    running.child.stdout?.destroy()
    running.child.stderr?.destroy()
  }
  if (running.staticServer) {
    running.staticServer.unref()
  }
  runningProcesses.delete(projectId)
}

// REQ-011：关闭窗口前需要知道当前有多少个项目在运行，用于确认对话框文案和批量停止
export function getRunningProjectIds(): string[] {
  return Array.from(runningProcesses.keys())
}
