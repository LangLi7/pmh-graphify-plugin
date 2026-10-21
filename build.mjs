/**
 * Baut beide Hälften des Plugins.
 *
 * ```powershell
 * bun run build
 * ```
 *
 * * `lib/index.js` — die Host-Hälfte: Routen, Selbstinstallation, Config-Schema.
 * * `lib/client.js` — die Browser-Hälfte im Format des DSH-Modulladers.
 *
 * Die Quellen liegen in `src/`; die gebauten Dateien werden mitgeliefert,
 * damit das Plugin ohne Bau Schritt installiert werden kann.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const DIR = resolve(import.meta.dir, '.')
const LIB = join(DIR, 'lib')
const KENNUNG = 'pmh-graphify-plugin'

mkdirSync(LIB, { recursive: true })

/**
 * Legt den Rumpf in den Modullader des Browsers.
 *
 * @param {string} rumpf - der gebaute Modultext
 * @returns {string} die fertige Datei
 */
function umschliesse(rumpf) {
  const eingerueckt = rumpf
    .split('\n')
    .map((zeile) => (zeile.length > 0 ? `\t\t${zeile}` : zeile))
    .join('\n')
  return `/**
 * Browser-Hälfte. ERZEUGT von \`build.mjs\` — nicht von Hand ändern.
 */
window.__ModuleLoader__.load({
\tid: ${JSON.stringify(KENNUNG)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${eingerueckt}
\t\treturn module.exports;
\t}
});
`
}

/**
 * Prüft das gebaute Browser-Bündel: Kennung, `apply`, `inject`, Panel.
 *
 * @param {string} text - die gebaute Datei
 * @returns {{ fehler: string[], befund: string[] }} Befund
 */
function pruefeClient(text) {
  const fehler = []
  const befund = []
  let erfasst
  const fenster = { __ModuleLoader__: { load: (definition) => (erfasst = definition) } }
  try {
    new Function('window', text)(fenster)
  } catch (f) {
    return { fehler: [`Nicht auswertbar: ${f instanceof Error ? f.message : String(f)}`], befund }
  }
  if (erfasst === undefined) return { fehler: ['Kein __ModuleLoader__.load im Bündel.'], befund }
  if (erfasst.id !== KENNUNG) fehler.push(`Kennung ${JSON.stringify(erfasst.id)} statt ${JSON.stringify(KENNUNG)}.`)
  befund.push(`Kennung: ${String(erfasst.id)}`)
  let plugin
  try {
    plugin = erfasst.factory((name) => {
      if (name === 'react') {
        return {
          jsx: () => null,
          jsxs: () => null,
          Fragment: null,
          useState: () => [undefined, () => undefined],
          useEffect: () => undefined,
          useMemo: (f) => f(),
          useRef: () => ({}),
          useCallback: (f) => f,
          createElement: () => null,
        }
      }
      return {}
    })
  } catch (f) {
    fehler.push(`Fabrik warf: ${f instanceof Error ? f.message : String(f)}`)
    return { fehler, befund }
  }
  if (typeof plugin?.apply !== 'function') fehler.push('apply fehlt.')
  if (!Array.isArray(plugin?.inject)) fehler.push('inject fehlt.')
  else if (!plugin.inject.includes('slots')) fehler.push('inject nennt slots nicht.')
  if (plugin?.PANEL_ID !== 'graphify') fehler.push(`PANEL_ID ist ${JSON.stringify(plugin?.PANEL_ID)}.`)
  befund.push(`inject: ${JSON.stringify(plugin?.inject)}`)
  befund.push(`Panel: ${String(plugin?.PANEL_ID)}`)
  return { fehler, befund }
}

// ── Host-Hälfte ────────────────────────────────────────────────────────────

const host = await Bun.build({
  entrypoints: [join(DIR, 'src', 'host', 'entry.ts')],
  outdir: LIB,
  target: 'node',
  format: 'esm',
  minify: false,
  sourcemap: false,
  external: ['@deepseek-ai/schemastery'],
})
if (!host.success) {
  console.error('Bau der Host-Hälfte gescheitert:')
  for (const log of host.logs) console.error(`  ${String(log)}`)
  process.exit(1)
}
const hostAusgabe = host.outputs[0]
if (hostAusgabe === undefined) {
  console.error('Host-Bau lieferte keine Ausgabe.')
  process.exit(1)
}
const hostZiel = join(LIB, 'index.js')
if (resolve(hostAusgabe.path) !== hostZiel) renameSync(hostAusgabe.path, hostZiel)

const hostText = readFileSync(hostZiel, 'utf8')
if (hostText.includes('@prometheus-harness')) {
  console.error('FEHLER: Die Host-Hälfte enthält noch einen Verweis auf @prometheus-harness — nicht eigenständig.')
  process.exit(1)
}
if (!hostText.includes('@deepseek-ai/schemastery')) {
  console.error('FEHLER: Die Host-Hälfte hat schemastery eingebettet statt es zu importieren.')
  process.exit(1)
}
console.log(`Host:   ${hostZiel} (${String(Buffer.byteLength(hostText))} B)`)

// ── Browser-Hälfte ─────────────────────────────────────────────────────────

const client = await Bun.build({
  entrypoints: [join(DIR, 'src', 'client', 'index.tsx')],
  target: 'browser',
  format: 'cjs',
  jsx: { runtime: 'automatic', importSource: 'react', development: false },
  minify: false,
  sourcemap: false,
  external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client'],
})
if (!client.success) {
  console.error('Bau der Browser-Hälfte gescheitert:')
  for (const log of client.logs) console.error(`  ${String(log)}`)
  process.exit(1)
}
const clientAusgabe = client.outputs[0]
if (clientAusgabe === undefined) {
  console.error('Client-Bau lieferte keine Ausgabe.')
  process.exit(1)
}
const clientText = umschliesse(await clientAusgabe.text())
writeFileSync(join(LIB, 'client.js'), clientText, 'utf8')
console.log(`Client: ${join(LIB, 'client.js')} (${String(Buffer.byteLength(clientText))} B)`)

const { fehler, befund } = pruefeClient(clientText)
console.log('')
console.log('== Befund ==')
for (const zeile of befund) console.log(`  ${zeile}`)
if (fehler.length > 0) {
  console.error('')
  for (const f of fehler) console.error(`FEHLER: ${f}`)
  process.exit(1)
}
console.log('  Form: ok')
