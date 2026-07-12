import { ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { loadProjects, updateProject, projectPathExists } from '../store'
import {
  launchAppProject,
  launchWebProject,
  stopProject,
  isProjectRunning,
  hasNodeModules,
  runNpmInstall
} from '../process-manager'
import type { Project } from '../../shared/types'

// get-port 是纯 ESM 包，main 进程打包为 CJS，静态 import 会被 esbuild
// 转成 require() 导致运行时 ERR_REQUIRE_ESM，必须用动态 import()
async function getAvailablePort(): Promise<number> {
  const { default: getPort } = await import('get-port')
  return getPort()
}

function broadcastStatus(event: IpcMainInvokeEvent, project: Project): void {
  event.sender.send('projects:statusChanged', project)
}

async function startWebProject(event: IpcMainInvokeEvent, project: Project): Promise<void> {
  const projectId = project.id
  let hasReachedReady = false
  let launchFailed = false
  const port = await getAvailablePort()
  const launchingProject = updateProject(projectId, { status: 'launching', port })
  if (launchingProject) {
    broadcastStatus(event, launchingProject)
  }

  const launch = launchWebProject(project, port)

  launch.onReady(() => {
    hasReachedReady = true
    shell.openExternal(`http://localhost:${port}`)
    const runningProject = updateProject(projectId, {
      status: 'running',
      port,
      lastOpenedAt: Date.now(),
      openCount: project.openCount + 1
    })
    if (runningProject) {
      broadcastStatus(event, runningProject)
    }
  })

  launch.onError((message) => {
    launchFailed = true
    console.error(`Project ${projectId} launch error: ${message}`)
    // 端口等待超时等错误发生时，子进程可能仍然存活。先终止整个进程组，
    // 避免界面显示错误但后台进程继续占用端口。
    stopProject(projectId)
    const errorProject = updateProject(projectId, { status: 'error', port: null })
    if (errorProject) {
      broadcastStatus(event, errorProject)
    }
  })

  launch.onExit(({ code, wasIntentionalStop }) => {
    // 启动失败触发的清理不能被随后到达的 exit 事件覆盖成 stopped。
    // 用户主动停止、或服务运行后正常自行退出，才进入 stopped；其它情况进入 error。
    const nextStatus = launchFailed
      ? 'error'
      : wasIntentionalStop || (hasReachedReady && code === 0)
        ? 'stopped'
        : 'error'
    const exitedProject = updateProject(projectId, { status: nextStatus, port: null })
    if (exitedProject) {
      broadcastStatus(event, exitedProject)
    }
  })
}

// app 类型无"启动中"中间态：进程存活即视为运行中（Product-Spec.md REQ-004），
// 退出后按退出码区分"正常停止"（0）和"错误"（非 0），与 wasIntentionalStop 无关——
// 用户在 app 窗口内手动关闭也应正常退出码 0，而非被误判为错误
function startAppProject(event: IpcMainInvokeEvent, project: Project): void {
  const projectId = project.id
  const launch = launchAppProject(project)

  launch.onReady(() => {
    const runningProject = updateProject(projectId, {
      status: 'running',
      port: null,
      lastOpenedAt: Date.now(),
      openCount: project.openCount + 1
    })
    if (runningProject) {
      broadcastStatus(event, runningProject)
    }
  })

  launch.onError((message) => {
    console.error(`Project ${projectId} launch error: ${message}`)
    const errorProject = updateProject(projectId, { status: 'error', port: null })
    if (errorProject) {
      broadcastStatus(event, errorProject)
    }
  })

  launch.onExit(({ code, wasIntentionalStop }) => {
    // VibeHub 内点击停止（SIGKILL，退出码为 null）和进程自身以 0 退出码
    // 正常结束都算"已停止"，只有非用户主动触发的非 0 退出码才算"错误"
    const nextStatus = wasIntentionalStop || code === 0 ? 'stopped' : 'error'
    const exitedProject = updateProject(projectId, { status: nextStatus, port: null })
    if (exitedProject) {
      broadcastStatus(event, exitedProject)
    }
  })
}

// SCOPE-015：node_modules 缺失时先跑 npm install，日志面板展示安装过程；
// 安装失败进入 installFailed 态，提供「重试」（走这里重新判断 node_modules）
// 和「跳过」（skipInstallCheck=true，绕过检测直接尝试启动，见 FLOW-002 分支路径）
async function startNodeProjectWithInstallCheck(
  event: IpcMainInvokeEvent,
  project: Project
): Promise<void> {
  const installingProject = updateProject(project.id, { status: 'installing', port: null })
  if (installingProject) {
    broadcastStatus(event, installingProject)
  }

  const { success } = await runNpmInstall(project)
  if (!success) {
    const failedProject = updateProject(project.id, { status: 'installFailed', port: null })
    if (failedProject) {
      broadcastStatus(event, failedProject)
    }
    return
  }

  await startWebProject(event, project)
}

async function startProject(
  event: IpcMainInvokeEvent,
  projectId: string,
  skipInstallCheck = false
): Promise<void> {
  const projects = loadProjects()
  const project = projects.find((p) => p.id === projectId)
  if (!project || isProjectRunning(projectId)) {
    return
  }

  // FLOW-004：启动前检查路径是否仍然存在，不存在则走路径失效态而非尝试启动
  if (!projectPathExists(project)) {
    const missingProject = updateProject(projectId, { status: 'missing', port: null })
    if (missingProject) {
      broadcastStatus(event, missingProject)
    }
    return
  }

  if (project.projectKind === 'app') {
    startAppProject(event, project)
    return
  }

  if (project.projectType === 'node' && !skipInstallCheck && !hasNodeModules(project.path)) {
    await startNodeProjectWithInstallCheck(event, project)
    return
  }

  await startWebProject(event, project)
}

function stopProjectHandler(event: IpcMainInvokeEvent, projectId: string): void {
  stopProject(projectId)
  // static 类型没有子进程、没有 exit 事件，stopProject 内部同步清理并返回，
  // 这里必须自己落盘状态；node/python/app 类型是异步 SIGKILL，清理和广播交给
  // process-manager 的 child.on('exit') → 上面的 onExit 回调去做，这里再广播一次会重复
  if (isProjectRunning(projectId)) {
    return
  }
  const stoppedProject = updateProject(projectId, { status: 'stopped', port: null })
  if (stoppedProject) {
    broadcastStatus(event, stoppedProject)
  }
}

export function registerLaunchIpc(): void {
  ipcMain.handle('projects:start', (event, projectId: string, skipInstallCheck?: boolean) =>
    startProject(event, projectId, skipInstallCheck)
  )
  ipcMain.handle('projects:stop', (event, projectId: string) =>
    stopProjectHandler(event, projectId)
  )
}
