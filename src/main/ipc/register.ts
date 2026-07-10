import { registerProjectsIpc } from './projects'
import { registerTagsIpc } from './tags'
import { registerDialogIpc } from './dialog'
import { registerLaunchIpc } from './launch'
import { registerLogsIpc } from './logs'
import { registerWindowIpc } from './window'

export function registerIpcHandlers(): void {
  registerProjectsIpc()
  registerTagsIpc()
  registerDialogIpc()
  registerLaunchIpc()
  registerLogsIpc()
  registerWindowIpc()
}
