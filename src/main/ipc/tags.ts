import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { loadProjects, loadTags, saveProjects, saveTags } from '../store'
import type { Tag } from '../../shared/types'

const PRESET_COLORS = ['tag-1', 'tag-2', 'tag-3', 'tag-4', 'tag-5']

function createTag(name: string): Tag {
  const tags = loadTags()
  const color = PRESET_COLORS[tags.length % PRESET_COLORS.length]
  const tag: Tag = { id: randomUUID(), name, color }
  saveTags([...tags, tag])
  return tag
}

function renameTag(tagId: string, name: string): Tag | null {
  const tags = loadTags()
  const index = tags.findIndex((tag) => tag.id === tagId)
  if (index === -1) {
    return null
  }
  const updated = { ...tags[index], name }
  tags[index] = updated
  saveTags(tags)
  return updated
}

// REQ-009 MUST：删除标签时遍历所有项目清除该标签 ID 的引用，避免悬空引用
function deleteTag(tagId: string): void {
  const tags = loadTags().filter((tag) => tag.id !== tagId)
  saveTags(tags)
  const projects = loadProjects().map((project) =>
    project.tags.includes(tagId)
      ? { ...project, tags: project.tags.filter((id) => id !== tagId) }
      : project
  )
  saveProjects(projects)
}

export function registerTagsIpc(): void {
  ipcMain.handle('tags:getAll', () => {
    return loadTags()
  })

  ipcMain.handle('tags:create', (_event, name: string) => {
    return createTag(name)
  })

  ipcMain.handle('tags:rename', (_event, tagId: string, name: string) => {
    return renameTag(tagId, name)
  })

  ipcMain.handle('tags:delete', (_event, tagId: string) => {
    deleteTag(tagId)
  })
}
