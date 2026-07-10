import { ipcMain, dialog, BrowserWindow } from 'electron'

export function registerDialogIpc(): void {
  ipcMain.handle('dialog:selectFolder', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options = { properties: ['openDirectory' as const] }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })
}
