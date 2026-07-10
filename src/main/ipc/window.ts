import { ipcMain, BrowserWindow } from 'electron'
import { getRunningProjectIds, stopProjectAndWait } from '../process-manager'

// REQ-011：确认关闭后不能再被这里的 close 拦截器二次拦截，否则永远关不掉窗口
let isClosingConfirmed = false

export function attachCloseGuard(window: BrowserWindow): void {
  window.on('close', (event) => {
    if (isClosingConfirmed) {
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
    isClosingConfirmed = true
    BrowserWindow.getAllWindows().forEach((window) => window.close())
  })
}
