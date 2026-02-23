/**
 * BrowserFontConverter - Convertidor de fuentes completo del lado del navegador
 * Basado en la lógica principal de lv_font_conv, adaptado para el entorno del navegador
 */

import opentype from 'opentype.js'
import collect_font_data from './CollectFontData.js'
import AppError from './AppError.js'
import write_cbin from './writers/CBinWriter.js'

class BrowserFontConverter {
  constructor() {
    this.initialized = false
    this.supportedFormats = ['ttf', 'woff', 'woff2', 'otf']
    this.charsetCache = new Map() // Caché de juegos de caracteres cargados
  }

  /**
   * Inicializa el convertidor
   */
  async initialize() {
    if (this.initialized) return
    
    try {
      // Comprobar si las dependencias están disponibles
      if (typeof opentype === 'undefined') {
        throw new Error('opentype.js not loaded')
      }
      
      this.initialized = true
      console.log('BrowserFontConverter inicializado correctamente')
    } catch (error) {
      console.error('BrowserFontConverter initialization failed:', error)
      throw error
    }
  }

  /**
   * Valida el archivo de fuente
   */
  validateFont(fontFile) {
    if (!fontFile) return false
    
    if (fontFile instanceof File) {
      const fileName = fontFile.name.toLowerCase()
      const fileType = fontFile.type.toLowerCase()
      
      const validExtension = this.supportedFormats.some(ext => 
        fileName.endsWith(`.${ext}`)
      )
      
      const validMimeType = [
        'font/ttf', 'font/truetype', 'application/x-font-ttf',
        'font/woff', 'font/woff2', 'application/font-woff',
        'font/otf', 'application/x-font-otf'
      ].some(type => fileType.includes(type))
      
      return validExtension || validMimeType
    }
    
    return fontFile instanceof ArrayBuffer && fontFile.byteLength > 0
  }

  /**
   * Obtiene la información de la fuente
   */
  async getFontInfo(fontFile) {
    try {
      let buffer
      
      if (fontFile instanceof File) {
        buffer = await fontFile.arrayBuffer()
      } else if (fontFile instanceof ArrayBuffer) {
        buffer = fontFile
      } else {
        throw new Error('Unsupported font file type')
      }
      
      const font = opentype.parse(buffer)
      
      return {
        familyName: this.getLocalizedName(font.names.fontFamily) || 'Unknown',
        fullName: this.getLocalizedName(font.names.fullName) || 'Unknown',
        postScriptName: this.getLocalizedName(font.names.postScriptName) || 'Unknown',
        version: this.getLocalizedName(font.names.version) || 'Unknown',
        unitsPerEm: font.unitsPerEm,
        ascender: font.ascender,
        descender: font.descender,
        numGlyphs: font.numGlyphs,
        supported: true
      }
    } catch (error) {
      console.error('Failed to get font information:', error)
      return {
        familyName: 'Unknown',
        supported: false,
        error: error.message
      }
    }
  }

  /**
   * Obtiene el nombre localizado
   */
  getLocalizedName(nameObj) {
    if (!nameObj) return null
    
    // Prioridad: chino > inglés > el primero disponible
    return nameObj['zh'] || nameObj['zh-CN'] || nameObj['en'] || 
           nameObj[Object.keys(nameObj)[0]]
  }

  /**
   * Convierte la fuente al formato CBIN
   */
  async convertToCBIN(options) {
    if (!this.initialized) {
      await this.initialize()
    }

    const {
      fontFile,
      fontName,
      fontSize = 20,
      bpp = 4,
      charset = 'deepseek',
      symbols = '',
      range = '',
      compression = false,
      lcd = false,
      lcd_v = false,
      progressCallback = null
    } = options

    if (!this.validateFont(fontFile)) {
      throw new AppError('Formato de archivo de fuente no compatible')
    }

    try {
      if (progressCallback) progressCallback(0, 'Starting font processing...')

      // Preparar los datos de la fuente
      let fontBuffer
      if (fontFile instanceof File) {
        fontBuffer = await fontFile.arrayBuffer()
      } else {
        fontBuffer = fontFile
      }

      if (progressCallback) progressCallback(10, 'Parsing font structure...')

      // Construir el rango de caracteres y los símbolos (usando la versión asíncrona para admitir la carga de juegos de caracteres desde un archivo)
      const { ranges, charSymbols } = await this.parseCharacterInputAsync(charset, symbols, range)

      if (progressCallback) progressCallback(20, 'Preparing conversion parameters...')

      // Construir los parámetros de conversión
      const convertArgs = {
        font: [{
          source_path: fontName || 'custom_font',
          source_bin: fontBuffer,
          ranges: [{ 
            range: ranges, 
            symbols: charSymbols 
          }],
          autohint_off: false,
          autohint_strong: false
        }],
        size: fontSize,
        bpp: bpp,
        lcd: lcd,
        lcd_v: lcd_v,
        no_compress: !compression,
        no_kerning: false,
        use_color_info: false,
        format: 'cbin',
        output: fontName || 'font'
      }

      if (progressCallback) progressCallback(30, 'Collecting font data...')

      // Recopilar datos de la fuente
      const fontData = await collect_font_data(convertArgs)

      if (progressCallback) progressCallback(70, 'Generating CBIN format...')

      // Generar datos CBIN
      const result = write_cbin(convertArgs, fontData)
      const outputName = convertArgs.output
      
      if (progressCallback) progressCallback(100, 'Conversion completed!')

      return result[outputName]

    } catch (error) {
      console.error('Font conversion failed:', error)
      throw new AppError(`Font conversion failed: ${error.message}`)
    }
  }

  /**
   * Analiza la entrada de caracteres (juego de caracteres, símbolos, rango) - versión asíncrona
   */
  async parseCharacterInputAsync(charset, symbols, range) {
    let ranges = []
    let charSymbols = symbols || ''

    // Procesar el juego de caracteres completo - usar el rango Unicode 0x0-0xFFFF
    if (charset === 'full') {
      ranges = [0x0, 0xFFFF, 0x0]
      // El juego de caracteres completo no necesita símbolos adicionales
      return { ranges, charSymbols }
    }

    // Procesar el juego de caracteres preestablecido
    if (charset && charset !== 'custom') {
      const presetChars = await this.getCharsetContentAsync(charset)
      charSymbols = presetChars + charSymbols
    }

    // Procesar el rango Unicode
    if (range) {
      ranges = this.parseUnicodeRange(range)
    }

    return { ranges, charSymbols }
  }

  /**
   * Analiza la entrada de caracteres (juego de caracteres, símbolos, rango) - versión síncrona (para compatibilidad con versiones anteriores)
   */
  parseCharacterInput(charset, symbols, range) {
    let ranges = []
    let charSymbols = symbols || ''

    // Procesar el juego de caracteres completo - usar el rango Unicode 0x0-0xFFFF
    if (charset === 'full') {
      ranges = [0x0, 0xFFFF, 0x0]
      // El juego de caracteres completo no necesita símbolos adicionales
      return { ranges, charSymbols }
    }

    // Procesar el juego de caracteres preestablecido
    if (charset && charset !== 'custom') {
      const presetChars = this.getCharsetContent(charset)
      charSymbols = presetChars + charSymbols
    }

    // Procesar el rango Unicode
    if (range) {
      ranges = this.parseUnicodeRange(range)
    }

    return { ranges, charSymbols }
  }


  /**
   * Carga asíncrona del archivo del juego de caracteres
   */
  async loadCharsetFromFile(charset) {
    const charsetFiles = {
      latin: './static/charsets/latin1.txt',
      deepseek: './static/charsets/deepseek.txt',
      gb2312: './static/charsets/gb2312.txt',
      qwen: './static/charsets/qwen18409.txt'
    }
    
    const filePath = charsetFiles[charset]
    if (!filePath) {
      return null
    }
    
    try {
      const response = await fetch(filePath)
      if (!response.ok) {
        throw new Error(`Failed to load charset file: ${response.status}`)
      }
      
      const text = await response.text()
      // Concatenar los caracteres de cada línea en una sola cadena, conservando todos los caracteres (incluidos los espacios en blanco)
      const characters = text.split('\n').join('')
      
      // Almacenar en caché el resultado
      this.charsetCache.set(charset, characters)
      return characters
    } catch (error) {
      console.error(`Failed to load charset ${charset}:`, error)
      return null
    }
  }

  /**
   * Obtiene el contenido del juego de caracteres (método síncrono, para juegos de caracteres en caché)
   */
  getCharsetContent(charset) {
    const charsets = {}
    
    // Si es un juego de caracteres que necesita cargarse desde un archivo, primero verificar la caché
    if ((charset === 'latin' || charset === 'deepseek' || charset === 'gb2312') && this.charsetCache.has(charset)) {
      return this.charsetCache.get(charset)
    }
    
    // Si se solicita 'basic', redirigir a 'latin' (para compatibilidad con versiones anteriores)
    if (charset === 'basic') {
      return this.getCharsetContent('latin')
    }
    
    // Por defecto, devuelve una cadena vacía, es necesario llamar primero al método asíncrono para cargar
    return charsets[charset] || ''
  }

  /**
   * Obtiene asíncronamente el contenido del juego de caracteres
   */
  async getCharsetContentAsync(charset) {
    // Si se solicita 'basic', redirigir a 'latin' (para compatibilidad con versiones anteriores)
    if (charset === 'basic') {
      charset = 'latin'
    }
    
    // Si el juego de caracteres ya está en caché, devolverlo directamente
    if (this.charsetCache.has(charset)) {
      return this.charsetCache.get(charset)
    }
    
    // Para juegos de caracteres que necesitan cargarse desde un archivo
    if (charset === 'latin' || charset === 'deepseek' || charset === 'gb2312' || charset === 'qwen') {
      const loadedCharset = await this.loadCharsetFromFile(charset)
      if (loadedCharset) {
        return loadedCharset
      }
    }
    
    // Volver al método síncrono
    return this.getCharsetContent(charset)
  }

  /**
   * Analiza la cadena del rango Unicode
   */
  parseUnicodeRange(rangeStr) {
    const ranges = []
    const parts = rangeStr.split(',')
    
    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed) continue
      
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-')
        const startCode = this.parseHexOrDec(start)
        const endCode = this.parseHexOrDec(end)
        
        if (startCode !== null && endCode !== null) {
          ranges.push(startCode, endCode, startCode)
        }
      } else {
        const code = this.parseHexOrDec(trimmed)
        if (code !== null) {
          ranges.push(code, code, code)
        }
      }
    }
    
    return ranges
  }

  /**
   * Analiza números hexadecimales o decimales
   */
  parseHexOrDec(str) {
    const trimmed = str.trim()
    
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      const parsed = parseInt(trimmed, 16)
      return isNaN(parsed) ? null : parsed
    }
    
    const parsed = parseInt(trimmed, 10)
    return isNaN(parsed) ? null : parsed
  }

  /**
   * Estima el tamaño de salida - versión asíncrona
   */
  async estimateSizeAsync(options) {
    const { fontSize = 20, bpp = 4, charset = 'latin', symbols = '', range = '' } = options
    
    // Calcular el número de caracteres
    let charCount = symbols.length
    
    // Procesar el juego de caracteres completo - incluye 0x0-0xFFFF (65536 caracteres)
    if (charset === 'full') {
      charCount = 65536
    } else if (charset && charset !== 'custom') {
      const charsetContent = await this.getCharsetContentAsync(charset)
      charCount += charsetContent.length
    }
    
    if (range) {
      const ranges = this.parseUnicodeRange(range)
      for (let i = 0; i < ranges.length; i += 3) {
        charCount += ranges[i + 1] - ranges[i] + 1
      }
    }
    
    // Número de caracteres únicos (estimación aproximada), pero no para el juego de caracteres completo
    if (charset !== 'full') {
      charCount = Math.min(charCount, charCount * 0.8)
    }
    
    // Estimar el número de bytes por carácter
    const avgBytesPerChar = Math.ceil((fontSize * fontSize * bpp) / 8) + 40
    
    const estimatedSize = charCount * avgBytesPerChar + 2048 // Añadir cabecera e índice
    
    return {
      characterCount: Math.floor(charCount),
      avgBytesPerChar,
      estimatedSize,
      formattedSize: this.formatBytes(estimatedSize)
    }
  }

  /**
   * Estima el tamaño de salida - versión síncrona (para compatibilidad con versiones anteriores)
   */
  estimateSize(options) {
    const { fontSize = 20, bpp = 4, charset = 'latin', symbols = '', range = '' } = options
    
    // Calcular el número de caracteres
    let charCount = symbols.length
    
    // Procesar el juego de caracteres completo - incluye 0x0-0xFFFF (65536 caracteres)
    if (charset === 'full') {
      charCount = 65536
    } else if (charset && charset !== 'custom') {
      const charsetContent = this.getCharsetContent(charset)
      charCount += charsetContent.length
    }
    
    if (range) {
      const ranges = this.parseUnicodeRange(range)
      for (let i = 0; i < ranges.length; i += 3) {
        charCount += ranges[i + 1] - ranges[i] + 1
      }
    }
    
    // Número de caracteres únicos (estimación aproximada), pero no para el juego de caracteres completo
    if (charset !== 'full') {
      charCount = Math.min(charCount, charCount * 0.8)
    }
    
    // Estimar el número de bytes por carácter
    const avgBytesPerChar = Math.ceil((fontSize * fontSize * bpp) / 8) + 40
    
    const estimatedSize = charCount * avgBytesPerChar + 2048 // Añadir cabecera e índice
    
    return {
      characterCount: Math.floor(charCount),
      avgBytesPerChar,
      estimatedSize,
      formattedSize: this.formatBytes(estimatedSize)
    }
  }

  /**
   * Formatea el tamaño de los bytes
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Limpia los recursos
   */
  cleanup() {
    // Limpiar posibles referencias a recursos
    this.initialized = false
  }
}

// Crear una instancia singleton
const browserFontConverter = new BrowserFontConverter()

export default browserFontConverter
export { BrowserFontConverter }
