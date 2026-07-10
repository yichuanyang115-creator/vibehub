import { EventEmitter } from 'events'
import type { LogEntry } from '../shared/types'

const MAX_ENTRIES_PER_PROJECT = 500

const buffers = new Map<string, LogEntry[]>()
const emitter = new EventEmitter()

export function appendLog(projectId: string, entry: LogEntry): void {
  const buffer = buffers.get(projectId) ?? []
  buffer.push(entry)
  if (buffer.length > MAX_ENTRIES_PER_PROJECT) {
    buffer.splice(0, buffer.length - MAX_ENTRIES_PER_PROJECT)
  }
  buffers.set(projectId, buffer)
  emitter.emit('append', projectId, entry)
}

export function getLogs(projectId: string): LogEntry[] {
  return buffers.get(projectId) ?? []
}

export function clearLogs(projectId: string): void {
  buffers.delete(projectId)
}

export function onLogAppended(callback: (projectId: string, entry: LogEntry) => void): () => void {
  emitter.on('append', callback)
  return () => emitter.off('append', callback)
}
