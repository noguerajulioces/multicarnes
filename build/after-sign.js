// Force ad-hoc re-sign of the entire .app bundle after electron-builder finishes.
// Without this, macOS 15+ on Apple Silicon rejects the launch with a Team ID
// mismatch between the main binary and the bundled Electron Framework.
const { execSync } = require('child_process')
const { existsSync } = require('fs')

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`
  if (!existsSync(appPath)) return
  console.log(`[after-sign] ad-hoc re-signing ${appPath}`)
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' })
}
