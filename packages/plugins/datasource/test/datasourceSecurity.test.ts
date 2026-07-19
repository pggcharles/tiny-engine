import { describe, expect, it, vi } from 'vitest'
import { utils, write } from 'xlsx'
import { getDataFromFile, handleImportedData } from '../src/js/datasource'

vi.mock('@opentiny/tiny-engine-common/js/environments', () => ({ isMock: false }))

const asFile = (content: Uint8Array) => ({
  size: content.byteLength,
  arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength)
})

const createWorkbook = (rows: Record<string, unknown>[]) => {
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, utils.json_to_sheet(rows), 'Data')
  return write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

describe('spreadsheet import security limits', () => {
  it('rejects data rows beyond the import limit', async () => {
    const content = createWorkbook(Array.from({ length: 10_001 }, (_, index) => ({ value: index })))

    await expect(getDataFromFile(asFile(content))).rejects.toThrow(/more than 10000 rows/)
  })

  it('rejects rows beyond the import column limit', async () => {
    const row = Object.fromEntries(Array.from({ length: 201 }, (_, index) => [`column${index}`, index]))
    const content = createWorkbook([row])

    await expect(getDataFromFile(asFile(content))).rejects.toThrow(/more than 200 columns/)
  })

  it('does not copy prototype-related keys into imported records', () => {
    const row = Object.create(null)
    row.safe = 'value'
    row.__proto__ = 'polluted'

    const imported = handleImportedData(
      [
        { title: 'safe', name: 'safe' },
        { title: '__proto__', name: 'polluted' },
        { title: 'safeTarget', name: '__proto__' }
      ],
      [row]
    )

    expect(imported).toHaveLength(1)
    expect(imported[0].safe).toBe('value')
    expect(Object.hasOwn(imported[0], '__proto__')).toBe(false)
    expect(Object.prototype.polluted).toBeUndefined()
  })
})
