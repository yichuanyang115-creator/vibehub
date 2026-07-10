interface StartCommandInputProps {
  value: string
  onChange: (value: string) => void
}

export function StartCommandInput({ value, onChange }: StartCommandInputProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor="start-command" className="text-xs font-medium text-text-primary">
        启动命令
      </label>
      <input
        id="start-command"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="例如：npm run dev"
        className="rounded-md border border-border bg-surface px-sm py-sm text-sm text-text-primary focus:border-border-focus focus:outline-none"
      />
      <p className="text-xs text-text-tertiary">未能自动识别项目类型，填入启动命令后可正常启动</p>
    </div>
  )
}
