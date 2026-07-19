import { describe, expect, it } from 'vitest'
import {
  assertImportFileSize,
  MAX_IMPORT_FILE_BYTES,
  validateImportFile
} from '../src/js/importValidation'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

describe('spreadsheet import validation', () => {
  it('rejects the wrong MIME type and oversize files before parsing', () => {
    expect(validateImportFile({ type: 'text/plain', size: 1 }, XLSX_MIME)).toEqual({
      typeValid: false,
      sizeValid: true,
      isValid: false
    })
    expect(validateImportFile({ type: XLSX_MIME, size: MAX_IMPORT_FILE_BYTES + 1 }, XLSX_MIME).isValid).toBe(false)
  })

  it('throws before reading an oversized file', () => {
    expect(() => assertImportFileSize({ size: MAX_IMPORT_FILE_BYTES + 1 })).toThrow(RangeError)
    expect(() => assertImportFileSize({ size: MAX_IMPORT_FILE_BYTES })).not.toThrow()
  })
})
