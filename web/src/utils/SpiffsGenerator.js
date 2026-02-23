/**
 * Clase SpiffsGenerator
 * Imita la funcionalidad de spiffs_assets_gen.py para generar el archivo assets.bin en el navegador.
 * 
 * Formato de archivo:
 * {
 *     total_files: int (4 bytes)          // Número total de archivos
 *     checksum: int (4 bytes)            // Suma de comprobación
 *     combined_data_length: int (4 bytes) // Longitud total de los datos
 *     mmap_table: [                    // Tabla de mapeo de archivos
 *         {
 *             name: char[32]           // Nombre del archivo (32 bytes)
 *             size: int (4 bytes)        // Tamaño del archivo
 *             offset: int (4 bytes)      // Desplazamiento del archivo 
 *             width: short (2 bytes)     // Ancho de la imagen
 *             height: short (2 bytes)    // Altura de la imagen
 *         }
 *         ...
 *     ]
 *     file_data: [                     // Datos del archivo
 *         0x5A 0x5A + file1_data      // Cada archivo va precedido de la marca 0x5A5A
 *         0x5A 0x5A + file2_data
 *         ...
 *     ]
 * }
 */

class SpiffsGenerator {
  constructor() {
    this.files = []
    this.textEncoder = new TextEncoder()
  }

  /**
   * Añade un archivo.
   * @param {string} filename - Nombre del archivo
   * @param {ArrayBuffer} data - Datos del archivo
   * @param {Object} options - Parámetros opcionales {width?, height?}
   */
  addFile(filename, data, options = {}) {
    if (filename.length > 32) {
      console.warn(`Filename "${filename}" exceeds 32 bytes and will be truncated`)
    }

    this.files.push({
      filename,
      data,
      size: data.byteLength,
      width: options.width || 0,
      height: options.height || 0
    })
  }

  /**
   * Obtiene la información de las dimensiones de un archivo de imagen.
   * @param {ArrayBuffer} imageData - Datos de la imagen
   * @returns {Promise<Object>} {width, height}
   */
  async getImageDimensions(imageData) {
    return new Promise((resolve) => {
      try {
        const blob = new Blob([imageData])
        const url = URL.createObjectURL(blob)
        const img = new Image()
        
        img.onload = () => {
          URL.revokeObjectURL(url)
          resolve({ width: img.width, height: img.height })
        }
        
        img.onerror = () => {
          URL.revokeObjectURL(url)
          resolve({ width: 0, height: 0 })
        }
        
        img.src = url
      } catch (error) {
        resolve({ width: 0, height: 0 })
      }
    })
  }

  /**
   * Comprueba si se trata de un formato de imagen especial (.sjpg, .spng, .sqoi).
   * @param {string} filename - Nombre del archivo
   * @param {ArrayBuffer} data - Datos del archivo
   * @returns {Object} {width, height}
   */
  parseSpecialImageFormat(filename, data) {
    const ext = filename.toLowerCase().split('.').pop()
    
    if (['.sjpg', '.spng', '.sqoi'].includes('.' + ext)) {
      try {
        // Estructura de la cabecera de formato especial: después de un desplazamiento de 14 bytes están el ancho y el alto (2 bytes cada uno, little-endian)
        const view = new DataView(data)
        const width = view.getUint16(14, true)  // little-endian
        const height = view.getUint16(16, true) // little-endian
        return { width, height }
      } catch (error) {
        console.warn(`Failed to parse special image format: ${filename}`, error)
      }
    }
    
    return { width: 0, height: 0 }
  }

  /**
   * Convierte un entero de 32 bits a un array de bytes little-endian.
   * @param {number} value - Valor entero
   * @returns {Uint8Array} Array de 4 bytes little-endian
   */
  packUint32(value) {
    const bytes = new Uint8Array(4)
    bytes[0] = value & 0xFF
    bytes[1] = (value >> 8) & 0xFF
    bytes[2] = (value >> 16) & 0xFF
    bytes[3] = (value >> 24) & 0xFF
    return bytes
  }

  /**
   * Convierte un entero de 16 bits a un array de bytes little-endian.
   * @param {number} value - Valor entero
   * @returns {Uint8Array} Array de 2 bytes little-endian
   */
  packUint16(value) {
    const bytes = new Uint8Array(2)
    bytes[0] = value & 0xFF
    bytes[1] = (value >> 8) & 0xFF
    return bytes
  }

  /**
   * Empaqueta una cadena en datos binarios de longitud fija.
   * @param {string} string - Cadena de entrada
   * @param {number} maxLen - Longitud máxima
   * @returns {Uint8Array} Datos binarios empaquetados
   */
  packString(string, maxLen) {
    const bytes = new Uint8Array(maxLen)
    const encoded = this.textEncoder.encode(string)
    
    // Copiar los datos de la cadena, asegurándose de no exceder la longitud máxima
    const copyLen = Math.min(encoded.length, maxLen)
    bytes.set(encoded.slice(0, copyLen), 0)
    
    // Rellenar los bytes restantes con 0
    return bytes
  }

  /**
   * Calcula la suma de comprobación.
   * @param {Uint8Array} data - Datos
   * @returns {number} Suma de comprobación de 16 bits
   */
  computeChecksum(data) {
    let checksum = 0
    for (let i = 0; i < data.length; i++) {
      checksum += data[i]
    }
    return checksum & 0xFFFF
  }

  /**
   * Ordena los archivos.
   * @param {Array} files - Lista de archivos
   * @returns {Array} Lista de archivos ordenada
   */
  sortFiles(files) {
    return files.slice().sort((a, b) => {
      const extA = a.filename.split('.').pop() || ''
      const extB = b.filename.split('.').pop() || ''
      
      if (extA !== extB) {
        return extA.localeCompare(extB)
      }
      
      const nameA = a.filename.replace(/\.[^/.]+$/, '')
      const nameB = b.filename.replace(/\.[^/.]+$/, '')
      return nameA.localeCompare(nameB)
    })
  }

  /**
   * Genera el archivo assets.bin.
   * @param {Function} progressCallback - Función de devolución de llamada de progreso
   * @returns {Promise<ArrayBuffer>} Datos generados de assets.bin
   */
  async generate(progressCallback = null) {
    if (this.files.length === 0) {
      throw new Error('No files to package')
    }

    if (progressCallback) progressCallback(0, 'Starting to package files...')

    // Ordenar archivos
    const sortedFiles = this.sortFiles(this.files)
    const totalFiles = sortedFiles.length

    // Procesar la información de los archivos y obtener las dimensiones de las imágenes
    const fileInfoList = []
    let mergedDataSize = 0

    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i]
      let width = file.width
      let height = file.height

      if (progressCallback) {
        progressCallback(10 + (i / totalFiles) * 30, `Processing file: ${file.filename}`)
      }

      // Si no se proporciona información de tamaño, intentar obtenerla automáticamente
      if (width === 0 && height === 0) {
        // Primero, comprobar los formatos de imagen especiales
        const specialDimensions = this.parseSpecialImageFormat(file.filename, file.data)
        if (specialDimensions.width > 0 || specialDimensions.height > 0) {
          width = specialDimensions.width
          height = specialDimensions.height
        } else {
          // Intentar analizar como una imagen normal
          const ext = file.filename.toLowerCase().split('.').pop()
          if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext)) {
            const dimensions = await this.getImageDimensions(file.data)
            width = dimensions.width
            height = dimensions.height
          }
        }
      }

      fileInfoList.push({
        filename: file.filename,
        data: file.data,
        size: file.size,
        offset: mergedDataSize,
        width,
        height
      })

      mergedDataSize += 2 + file.size // Prefijo de 2 bytes + datos del archivo
    }

    if (progressCallback) progressCallback(40, 'Building file mapping table...')

    // Construir la tabla de mapeo
    const mmapTableSize = totalFiles * (32 + 4 + 4 + 2 + 2) // nombre + tamaño + desplazamiento + ancho + alto
    const mmapTable = new Uint8Array(mmapTableSize)
    let mmapOffset = 0

    for (const fileInfo of fileInfoList) {
      // Nombre del archivo (32 bytes)
      mmapTable.set(this.packString(fileInfo.filename, 32), mmapOffset)
      mmapOffset += 32

      // Tamaño del archivo (4 bytes)
      mmapTable.set(this.packUint32(fileInfo.size), mmapOffset)
      mmapOffset += 4

      // Desplazamiento del archivo (4 bytes)
      mmapTable.set(this.packUint32(fileInfo.offset), mmapOffset)
      mmapOffset += 4

      // Ancho de la imagen (2 bytes)
      mmapTable.set(this.packUint16(fileInfo.width), mmapOffset)
      mmapOffset += 2

      // Altura de la imagen (2 bytes)  
      mmapTable.set(this.packUint16(fileInfo.height), mmapOffset)
      mmapOffset += 2
    }

    if (progressCallback) progressCallback(60, 'Merging file data...')

    // Combinar los datos de los archivos
    const mergedData = new Uint8Array(mergedDataSize)
    let mergedOffset = 0

    for (let i = 0; i < fileInfoList.length; i++) {
      const fileInfo = fileInfoList[i]
      
      if (progressCallback) {
        progressCallback(60 + (i / totalFiles) * 20, `Merging file: ${fileInfo.filename}`)
      }

      // Añadir prefijo 0x5A5A
      mergedData[mergedOffset] = 0x5A
      mergedData[mergedOffset + 1] = 0x5A
      mergedOffset += 2

      // Añadir datos del archivo
      mergedData.set(new Uint8Array(fileInfo.data), mergedOffset)
      mergedOffset += fileInfo.size
    }

    if (progressCallback) progressCallback(80, 'Computing checksum...')

    // Calcular la suma de comprobación de los datos combinados
    const combinedData = new Uint8Array(mmapTableSize + mergedDataSize)
    combinedData.set(mmapTable, 0)
    combinedData.set(mergedData, mmapTableSize)
    
    const checksum = this.computeChecksum(combinedData)
    const combinedDataLength = combinedData.length

    if (progressCallback) progressCallback(90, 'Building final file...')

    // Construir la salida final
    const headerSize = 4 + 4 + 4 // total_files + checksum + combined_data_length
    const totalSize = headerSize + combinedDataLength
    const finalData = new Uint8Array(totalSize)
    
    let offset = 0

    // Escribir el número total de archivos
    finalData.set(this.packUint32(totalFiles), offset)
    offset += 4

    // Escribir la suma de comprobación
    finalData.set(this.packUint32(checksum), offset)
    offset += 4

    // Escribir la longitud de los datos combinados
    finalData.set(this.packUint32(combinedDataLength), offset)
    offset += 4

    // Escribir los datos combinados
    finalData.set(combinedData, offset)

    if (progressCallback) progressCallback(100, 'Packaging completed')

    return finalData.buffer
  }

  /**
   * Obtiene las estadísticas de los archivos.
   * @returns {Object} Información de estadísticas
   */
  getStats() {
    let totalSize = 0
    const fileTypes = new Map()

    for (const file of this.files) {
      totalSize += file.size
      
      const ext = file.filename.split('.').pop()?.toLowerCase() || 'unknown'
      fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1)
    }

    return {
      fileCount: this.files.length,
      totalSize,
      fileTypes: Object.fromEntries(fileTypes),
      averageFileSize: this.files.length > 0 ? Math.round(totalSize / this.files.length) : 0
    }
  }

  /**
   * Imprime la lista de archivos empaquetados.
   */
  printFileList() {
    console.log('=== Packaged File List ===')
    console.log(`Total files: ${this.files.length}`)

    if (this.files.length === 0) {
      console.log('No files available')
      return
    }

    // Imprimir después de ordenar por extensión y nombre de archivo
    const sortedFiles = this.sortFiles(this.files)

    sortedFiles.forEach((file, index) => {
      const ext = file.filename.split('.').pop()?.toLowerCase() || 'unknown'
      const sizeKB = (file.size / 1024).toFixed(2)
      const dimensions = (file.width && file.height) ? `${file.width}x${file.height}` : 'N/A'

      console.log(`${String(index + 1).padStart(3, ' ')}. ${file.filename}`)
      console.log(`    Type: ${ext.toUpperCase()}`)
      console.log(`    Size: ${sizeKB} KB (${file.size} bytes)`)
      console.log(`    Dimensions: ${dimensions}`)
      console.log('')
    })

    // Imprimir estadísticas
    const stats = this.getStats()
    console.log('=== File Statistics ===')
    console.log(`Total size: ${(stats.totalSize / 1024).toFixed(2)} KB`)
    console.log(`Average size: ${(stats.averageFileSize / 1024).toFixed(2)} KB`)
    console.log('File type distribution:')
    Object.entries(stats.fileTypes).forEach(([ext, count]) => {
      console.log(`  ${ext.toUpperCase()}: ${count} files`)
    })
  }

  /**
   * Limpia la lista de archivos.
   */
  clear() {
    this.files = []
  }
}

export default SpiffsGenerator
