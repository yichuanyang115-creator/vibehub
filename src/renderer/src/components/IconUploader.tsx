import { useRef, useState, type ChangeEvent } from 'react'
import { Folder } from 'lucide-react'

interface IconUploaderProps {
  iconPath: string | null
  onUpload: (mimeType: string, base64Data: string) => Promise<void>
}

const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif'])
const CROP_SIZE_PX = 256

function cropImageToSquare(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      canvas.width = CROP_SIZE_PX
      canvas.height = CROP_SIZE_PX
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建画布上下文'))
        return
      }
      const side = Math.min(image.width, image.height)
      const sx = (image.width - side) / 2
      const sy = (image.height - side) / 2
      ctx.drawImage(image, sx, sy, side, side, 0, 0, CROP_SIZE_PX, CROP_SIZE_PX)
      resolve(canvas.toDataURL(file.type).split(',')[1])
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('图片加载失败'))
    }
    image.src = objectUrl
  })
}

export function IconUploader({ iconPath, onUpload }: IconUploaderProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    if (!SUPPORTED_MIME_TYPES.has(file.type)) {
      setError('仅支持 JPG、PNG、GIF 格式')
      return
    }
    try {
      const base64Data = await cropImageToSquare(file)
      await onUpload(file.type, base64Data)
      setError(null)
    } catch {
      setError('图标上传失败，请重试')
    }
  }

  return (
    <div className="flex items-center gap-md">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="替换图标"
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-hover"
      >
        {iconPath ? (
          <img src={`file://${iconPath}`} alt="项目图标" className="h-full w-full object-cover" />
        ) : (
          <Folder className="h-7 w-7 text-text-secondary" aria-hidden="true" />
        )}
      </button>
      <div className="flex flex-col gap-xs">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-left text-xs font-medium text-primary"
        >
          点击替换图标
        </button>
        <p className="text-xs text-text-tertiary">仅支持 JPG、PNG、GIF 格式</p>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
