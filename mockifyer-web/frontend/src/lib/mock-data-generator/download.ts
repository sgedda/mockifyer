/**
 * Download helpers for the playground.
 *
 * Variant mocks are packaged as a ZIP of Mockifyer scenario folders using the
 * same relative paths the CLI node writer produces (`getMockRelativeFile`).
 * ZIP is used instead of many sequential downloads so one click yields a
 * drop-in `mock-data/` tree without Node APIs.
 */

import { zipSync, strToU8 } from 'fflate'
import type { GeneratedMockData, NamedVariant } from '@sgedda/mockifyer-generator'
import { getMockRelativeFile } from './mock-paths'
import { loadGeneratorEngine } from './engine'

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function downloadJsonText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  triggerBlobDownload(blob, filename)
}

export interface VariantZipEntry {
  /** Path inside the zip, e.g. `generated-empty-lists/example.invalid/…/GET_….json` */
  path: string
  contents: string
}

/**
 * Build zip entries mirroring CLI `writeVariantScenarios` layout under `mock-data/`.
 */
export async function buildVariantZipEntries(
  named: ReadonlyArray<NamedVariant>
): Promise<VariantZipEntry[]> {
  const { serializeMock } = await loadGeneratorEngine()
  const entries: VariantZipEntry[] = []
  for (const item of named) {
    const scenario = item.mock.scenario ?? `generated-${item.name}`
    const mock: GeneratedMockData = { ...item.mock, scenario, generated: true }
    const relative = getMockRelativeFile(mock)
    entries.push({
      path: `${scenario}/${relative}`,
      contents: serializeMock(mock),
    })
  }
  return entries
}

/**
 * Create a ZIP (store + deflate) of variant mock files.
 */
export async function buildVariantZipBytes(
  named: ReadonlyArray<NamedVariant>
): Promise<Uint8Array> {
  const entries = await buildVariantZipEntries(named)
  const files: Record<string, Uint8Array> = {}
  for (const entry of entries) {
    files[entry.path] = strToU8(entry.contents)
  }
  return zipSync(files, { level: 6 })
}

export async function downloadVariantMocksZip(
  named: ReadonlyArray<NamedVariant>,
  filename = 'mockifyer-variants.zip'
): Promise<void> {
  const bytes = await buildVariantZipBytes(named)
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const blob = new Blob([copy], { type: 'application/zip' })
  triggerBlobDownload(blob, filename)
}
