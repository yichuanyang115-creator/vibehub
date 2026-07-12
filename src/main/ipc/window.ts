import { ipcMain, BrowserWindow } from 'electron'
import { getRunningProjectIds, stopProjectAndWait } from '../process-manager'

// REQ-011：确认关闭只对本次要关闭的窗口有效。不能使用跨窗口共享的布尔值，
// 否则 macOS 上关闭后重新创建的窗口会继承旧授权，跳过运行项目确认。
const confirmedWindows = new WeakSet<BrowserWindow>()

export function attachCloseGuard(window: BrowserWindow): void {
  window.on('close', (event) => {
    if (confirmedWindows.has(window)) {
      return
    }
    const runningCount = getRunningProjectIds().length
    if (runningCount === 0) {
      return
    }
    event.preventDefault()
    window.webContents.send('window:closeRequested', runningCount)
  })
}

export function registerWindowIpc(): void {
  ipcMain.handle('window:confirmClose', async () => {
    await Promise.all(getRunningProjectIds().map((projectId) => stopProjectAndWait(projectId)))
    BrowserWindow.getAllWindows().forEach((window) => {
      confirmedWindows.add(window)
      window.close()
    })
  })
}
