export default function TitleBar() {
  return (
    <div
      className="h-7 bg-brand shrink-0 select-none border-b border-white/10"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      aria-hidden="true"
    />
  )
}
