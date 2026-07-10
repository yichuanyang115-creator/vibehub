export function SkeletonGrid(): React.JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-lg">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-md bg-surface-hover" />
      ))}
    </div>
  )
}
