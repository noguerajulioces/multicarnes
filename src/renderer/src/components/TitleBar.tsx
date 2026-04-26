import logo from '../assets/logo.png'

const isMac = navigator.userAgent.includes('Mac')

export default function TitleBar() {
  return (
    <div
      className="h-9 bg-brand text-white flex items-center select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div
        className="flex items-center gap-2 h-full"
        style={{ paddingLeft: isMac ? 80 : 12 }}
      >
        <img src={logo} alt="" className="h-5 w-5 object-contain" />
        <span className="text-xs font-semibold tracking-wide">Multicarnes POS</span>
      </div>
    </div>
  )
}
