import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { getLogs, onLogAppended } from '../log-buffer'
import type { LogEntry } from '../../shared/types'

export function registerLogsIpc(): void {
  ipcMain.handle('logs:getForProject', (_event: IpcMainInvokeEvent, projectId: string): LogEntry[] => {
    return getLogs(projectId)
  })

  // 日志由子进程 stdout/stderr 事件异步产生，不是渲染进程主动 invoke 触发，
  // 没有现成的 IpcMainInvokeEvent 可用来 event.sender.send，改为广播给所有窗口
  onLogAppended((projectId, entry) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('logs:appended', projectId, entry)
    }
  })
}
