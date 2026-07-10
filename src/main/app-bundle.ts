import { execFileSync } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'

export class AppExecutableError extends Error {}

// .app 包本身只是个目录，真正可执行的二进制在 Contents/MacOS/ 下，文件名
// 由 Info.plist 的 CFBundleExecutable 声明（不一定等于 .app 目录名）。
// 直接 spawn 这个二进制而非用 `open` 命令，才能拿到可追踪的真实 PID 和
// 退出码（见 Product-Spec.md ASM-003）。
export function resolveAppExecutablePath(appBundlePath: string): string {
  const plistPath = join(appBundlePath, 'Contents', 'Info.plist')
  const macOsDir = join(appBundlePath, 'Contents', 'MacOS')

  if (existsSync(plistPath)) {
    try {
      const executableName = execFileSync(
        '/usr/libexec/PlistBuddy',
        ['-c', 'Print CFBundleExecutable', plistPath],
        { encoding: 'utf-8' }
      ).trim()
      const executablePath = join(macOsDir, executableName)
      if (executableName && existsSync(executablePath)) {
        return executablePath
      }
    } catch {
      // Info.plist 缺少 CFBundleExecutable 或解析失败，落到下面的目录扫描兜底
    }
  }

  if (existsSync(macOsDir)) {
    const entries = readdirSync(macOsDir, { withFileTypes: true }).filter((entry) => entry.isFile())
    if (entries.length === 1) {
      return join(macOsDir, entries[0].name)
    }
  }

  throw new AppExecutableError('无法定位 .app 内部可执行文件')
}
