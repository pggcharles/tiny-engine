import fs from 'node:fs'
import path from 'node:path'
import fg from 'fast-glob'

const VIRTUAL_MODULE_ID = 'virtual:svg-icons-register'
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`
const UNSAFE_SVG_PATTERN = /<\s*(?:script|foreignObject|iframe|object|embed)\b|\son[a-z]+\s*=|(?:href|xlink:href)\s*=\s*["']\s*(?:javascript:|data:text\/html)/i

const escapeAttribute = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const getAttribute = (attributes, name) => {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))
  return match?.[2]
}

const toSymbol = (filePath, symbolId) => {
  const source = fs.readFileSync(filePath, 'utf8')
  if (UNSAFE_SVG_PATTERN.test(source)) {
    throw new Error(`Unsafe SVG content found in ${filePath}`)
  }

  const root = source.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i)
  if (!root) {
    throw new Error(`Invalid SVG content found in ${filePath}`)
  }

  const viewBox = getAttribute(root[1], 'viewBox')
  const viewBoxAttribute = viewBox ? ` viewBox="${escapeAttribute(viewBox)}"` : ''
  const name = path.basename(filePath, path.extname(filePath))
  const id = symbolId.replace('[name]', name)

  return `<symbol id="${escapeAttribute(id)}"${viewBoxAttribute}>${root[2]}</symbol>`
}

const collectSymbols = (iconDirs, symbolId, addWatchFile, warn) => {
  const symbols = []

  for (const iconDir of iconDirs) {
    const files = fg.sync('**/*.svg', {
      cwd: iconDir,
      absolute: true,
      onlyFiles: true,
      followSymbolicLinks: false
    })

    files.forEach((filePath) => {
      addWatchFile(filePath)
      try {
        symbols.push(toSymbol(filePath, symbolId))
      } catch (error) {
        warn?.(error.message)
      }
    })
  }

  return symbols.join('')
}

const createRegistrationModule = (symbols) => `
const spriteMarkup = ${JSON.stringify(symbols)}
const mountSprite = () => {
  if (!document.body || document.getElementById('tiny-engine-svg-sprite')) return
  const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  sprite.id = 'tiny-engine-svg-sprite'
  sprite.setAttribute('aria-hidden', 'true')
  sprite.style.position = 'absolute'
  sprite.style.width = '0'
  sprite.style.height = '0'
  sprite.style.overflow = 'hidden'
  sprite.innerHTML = spriteMarkup
  document.body.appendChild(sprite)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountSprite, { once: true })
} else {
  mountSprite()
}

export default spriteMarkup
`

export const createSvgIconsPlugin = ({ iconDirs = [], symbolId = 'icon-[name]' } = {}) => {
  let symbols = ''

  return {
    name: 'tiny-engine-svg-icons',
    enforce: 'pre',
    buildStart() {
      symbols = collectSymbols(
        iconDirs,
        symbolId,
        (filePath) => this.addWatchFile(filePath),
        (message) => this.warn(`${message}; skipping from the SVG sprite`)
      )
    },
    resolveId(id) {
      return id === VIRTUAL_MODULE_ID ? RESOLVED_VIRTUAL_MODULE_ID : undefined
    },
    load(id) {
      return id === RESOLVED_VIRTUAL_MODULE_ID ? createRegistrationModule(symbols) : undefined
    },
    handleHotUpdate({ file, server }) {
      if (iconDirs.some((iconDir) => file.startsWith(path.resolve(iconDir)))) {
        symbols = collectSymbols(iconDirs, symbolId, () => undefined)
        const module = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
        if (module) server.moduleGraph.invalidateModule(module)
        return module ? [module] : undefined
      }
      return undefined
    }
  }
}
