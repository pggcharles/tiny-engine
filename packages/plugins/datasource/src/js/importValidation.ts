export const MAX_IMPORT_FILE_BYTES = 4 * 1024 * 1024
export const MAX_IMPORT_ROWS = 10_000
export const MAX_IMPORT_COLUMNS = 200

export const validateImportFile = (file: { type?: string; size?: number }, mimeType: string) => {
  const typeValid = file?.type === mimeType
  const sizeValid = typeof file?.size === 'number' && file.size <= MAX_IMPORT_FILE_BYTES

  return {
    typeValid,
    sizeValid,
    isValid: typeValid && sizeValid
  }
}

export const assertImportFileSize = (file: { size?: number }) => {
  if (typeof file?.size === 'number' && file.size > MAX_IMPORT_FILE_BYTES) {
    throw new RangeError('Spreadsheet file exceeds the 4MB limit')
  }
}
