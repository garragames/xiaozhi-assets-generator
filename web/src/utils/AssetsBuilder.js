/**
 * Clase AssetsBuilder
 * Se utiliza para procesar la generación del paquete assets.bin para temas personalizados de IA de Xiaozhi.
 * 
 * Funciones principales:
 * - Validación y procesamiento de la configuración
 * - Generación del contenido de index.json
 * - Gestión de archivos de recursos
 * - Interacción con la API de back-end para generar assets.bin
 * - Integración de la función de conversión de fuentes del lado del navegador
 */

import browserFontConverter from './font_conv/BrowserFontConverter.js'
import WakenetModelPacker from './WakenetModelPacker.js'
import SpiffsGenerator from './SpiffsGenerator.js'
import WasmGifScaler from './WasmGifScaler.js'
import configStorage from './ConfigStorage.js'

class AssetsBuilder {
  constructor() {
    this.config = null
    this.resources = new Map() // Almacenar archivos de recursos
    this.tempFiles = [] // Lista de archivos temporales
    this.fontConverterBrowser = browserFontConverter // Convertidor de fuentes del lado del navegador
    this.convertedFonts = new Map() // Caché de fuentes convertidas
    this.wakenetPacker = new WakenetModelPacker() // Empaquetador de modelos de palabras de activación
    this.spiffsGenerator = new SpiffsGenerator() // Generador de SPIFFS
    this.gifScaler = new WasmGifScaler({ 
      quality: 30, 
      debug: true,
      scalingMode: 'auto',  // Seleccionar automáticamente el mejor modo de escalado
      optimize: true,       // Habilitar la optimización de GIF
      optimizationLevel: 2  // Nivel de optimización (1-3)
    }) // Escalador de GIF WASM
    this.configStorage = configStorage // Gestor de almacenamiento de configuración
    this.autoSaveEnabled = true // Si el guardado automático está habilitado
  }

  /**
   * Establece el objeto de configuración.
   * @param {Object} config - El objeto de configuración completo
   */
  setConfig(config, options = {}) {
    const strict = options?.strict ?? true
    if (strict && !this.validateConfig(config)) {
      throw new Error('Configuration object validation failed')
    }
    this.config = { ...config }
    return this
  }

  /**
   * Valida el objeto de configuración.
   * @param {Object} config - El objeto de configuración a validar
   * @returns {boolean} El resultado de la validación
   */
  validateConfig(config) {
    if (!config) return false
    
    // Validar la configuración del chip
    if (!config.chip?.model) {
      console.error('Missing chip model configuration')
      return false
    }

    // Validar la configuración de la pantalla
    const display = config.chip.display
    if (!display?.width || !display?.height) {
      console.error('Missing display resolution configuration')
      return false
    }

    // Validar la configuración de la fuente
    const font = config.theme?.font
    if (font?.type === 'preset' && !font.preset) {
      console.error('Preset font configuration is incomplete')
      return false
    }
    if (font?.type === 'custom' && !font.custom?.file) {
      console.error('Custom font file not provided')
      return false
    }

    return true
  }

  /**
   * Añade un archivo de recurso.
   * @param {string} key - Clave del recurso
   * @param {File|Blob} file - Objeto de archivo
   * @param {string} filename - Nombre del archivo
   * @param {string} resourceType - Tipo de recurso (font, emoji, background)
   */
  addResource(key, file, filename, resourceType = 'other') {
    this.resources.set(key, {
      file,
      filename,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified || Date.now(),
      resourceType
    })

    // Guardar automáticamente el archivo en el almacenamiento
    if (this.autoSaveEnabled && file instanceof File) {
      this.saveFileToStorage(key, file, resourceType).catch(error => {
        console.warn(`Auto-saving file ${filename} failed:`, error)
      })
    }

    return this
  }

  /**
   * Guarda un archivo en el almacenamiento.
   * @param {string} key - Clave del recurso
   * @param {File} file - Objeto de archivo
   * @param {string} resourceType - Tipo de recurso
   * @returns {Promise<void>}
   */
  async saveFileToStorage(key, file, resourceType) {
    try {
      await this.configStorage.saveFile(key, file, resourceType)
      console.log(`File ${file.name} auto-saved to storage`)
    } catch (error) {
      console.error(`Failed to save file to storage: ${file.name}`, error)
      throw error
    }
  }

  /**
   * Restaura un archivo de recurso desde el almacenamiento.
   * @param {string} key - Clave del recurso
   * @returns {Promise<boolean>} Si se restauró correctamente
   */
  async restoreResourceFromStorage(key) {
    try {
      const file = await this.configStorage.loadFile(key)
      if (file) {
        this.resources.set(key, {
          file,
          filename: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          resourceType: file.storedType,
          fromStorage: true
        })
        console.log(`Resource ${key} restored from storage successfully: ${file.name}`)
        return true
      }
      return false
    } catch (error) {
      console.error(`Failed to restore resource from storage: ${key}`, error)
      return false
    }
  }

  /**
   * Restaura todos los archivos de recursos relevantes.
   * @param {Object} config - Objeto de configuración
   * @returns {Promise<void>}
   */
  async restoreAllResourcesFromStorage(config) {
    if (!config) return

    const restoredFiles = []

    // Restaurar el archivo de fuente personalizado (independientemente del tipo de fuente actual, intentar restaurar)
    if (config.theme?.font?.custom && config.theme.font.custom?.file === null) {
      const fontKey = 'custom_font'
      if (await this.restoreResourceFromStorage(fontKey)) {
        const resource = this.resources.get(fontKey)
        if (resource) {
          config.theme.font.custom.file = resource.file
          restoredFiles.push(`Custom font: ${resource.filename}`)
          console.log(`Custom font restored even when type is '${config.theme.font.type}'`)
        }
      }
    }

    // Restaurar imágenes de emojis personalizadas (compatible con la nueva estructura de deduplicación de hash)
    if (config.theme?.emoji?.type === 'custom' && config.theme.emoji.custom) {
      const emojiCustom = config.theme.emoji.custom
      const emotionMap = emojiCustom.emotionMap || {}
      const fileMap = emojiCustom.fileMap || {}
      const images = emojiCustom.images || {}
      
      // Si existe una nueva estructura (emotionMap y fileMap), usar la nueva estructura para restaurar
      if (Object.keys(emotionMap).length > 0 || Object.keys(fileMap).length > 0) {
        // Recopilar todos los hashes que necesitan ser restaurados
        const hashesToRestore = new Set()
        
        // Recopilar todos los hashes de fileMap
        for (const hash of Object.keys(fileMap)) {
          if (fileMap[hash] === null) {
            hashesToRestore.add(hash)
          }
        }
        
        // Restaurar cada archivo único (por hash)
        for (const hash of hashesToRestore) {
          let fileKey = `hash_${hash}`
          let restored = await this.restoreResourceFromStorage(fileKey)
          
          // Si la restauración del nuevo formato falla, intentar el formato antiguo (manejo de compatibilidad)
          if (!restored) {
            const oldKey = `emoji_hash_${hash}`
            restored = await this.restoreResourceFromStorage(oldKey)
            if (restored) {
              fileKey = oldKey
            }
          }
          
          if (restored) {
            const resource = this.resources.get(fileKey)
            if (resource) {
              // Actualizar fileMap
              fileMap[hash] = resource.file
              
              // Encontrar todos los emojis que usan este hash
              const emotionsUsingHash = Object.entries(emotionMap)
                .filter(([_, h]) => h === hash)
                .map(([emotion, _]) => emotion)
              
              // Actualizar las imágenes de todos los emojis que usan este archivo
              emotionsUsingHash.forEach(emotion => {
                images[emotion] = resource.file
              })
              
              restoredFiles.push(`Emoji file ${hash.substring(0, 8)}... (used for: ${emotionsUsingHash.join(', ')})`)
            }
          }
        }
        
        // Modificar directamente el objeto original (mantener la reactividad)
        // Actualizar fileMap uno por uno
        Object.keys(fileMap).forEach(hash => {
          config.theme.emoji.custom.fileMap[hash] = fileMap[hash]
        })
        
        // Actualizar imágenes una por una
        Object.keys(images).forEach(emotion => {
          config.theme.emoji.custom.images[emotion] = images[emotion]
        })
      } else {
        // Compatibilidad con la estructura antigua: restaurar los archivos de emojis uno por uno
        for (const [emojiName, file] of Object.entries(images)) {
          if (file === null) {
            const emojiKey = `emoji_${emojiName}`
            if (await this.restoreResourceFromStorage(emojiKey)) {
              const resource = this.resources.get(emojiKey)
              if (resource) {
                images[emojiName] = resource.file
                restoredFiles.push(`Emoji ${emojiName}: ${resource.filename}`)
              }
            }
          }
        }
        config.theme.emoji.custom.images = images
      }
    }

    // Restaurar imágenes de estados personalizadas (estructura similar a emojis)
    if (config.theme?.state?.type === 'custom' && config.theme.state.custom) {
      const stateCustom = config.theme.state.custom
      const stateMap = stateCustom.stateMap || {}
      const fileMap = stateCustom.fileMap || {}
      const images = stateCustom.images || {}

      if (Object.keys(stateMap).length > 0 || Object.keys(fileMap).length > 0) {
        const hashesToRestore = new Set()
        for (const hash of Object.keys(fileMap)) {
          if (fileMap[hash] === null) {
            hashesToRestore.add(hash)
          }
        }

        for (const hash of hashesToRestore) {
          let fileKey = `state_hash_${hash}`
          let restored = await this.restoreResourceFromStorage(fileKey)
          if (!restored) {
            const oldKey = `state_${hash}`
            restored = await this.restoreResourceFromStorage(oldKey)
            if (restored) {
              fileKey = oldKey
            }
          }

          if (restored) {
            const resource = this.resources.get(fileKey)
            if (resource) {
              fileMap[hash] = resource.file
              const statesUsingHash = Object.entries(stateMap)
                .filter(([_, h]) => h === hash)
                .map(([state, _]) => state)
              statesUsingHash.forEach(state => {
                images[state] = resource.file
              })
              restoredFiles.push(`State file ${hash.substring(0, 8)}... (used for: ${statesUsingHash.join(', ')})`)
            }
          }
        }

        Object.keys(fileMap).forEach(hash => {
          config.theme.state.custom.fileMap[hash] = fileMap[hash]
        })
        Object.keys(images).forEach(state => {
          config.theme.state.custom.images[state] = images[state]
        })
      } else {
        // Estructura antigua: restaurar uno por uno si existiera
        for (const [stateName, file] of Object.entries(images)) {
          if (file === null) {
            const stateKey = `state_${stateName}`
            if (await this.restoreResourceFromStorage(stateKey)) {
              const resource = this.resources.get(stateKey)
              if (resource) {
                images[stateName] = resource.file
                restoredFiles.push(`State ${stateName}: ${resource.filename}`)
              }
            }
          }
        }
        config.theme.state.custom.images = images
      }
    }

    // Restaurar imágenes de fondo
    if (config.theme?.skin?.light?.backgroundType === 'image' && config.theme.skin.light.backgroundImage === null) {
      const bgKey = 'background_light'
      if (await this.restoreResourceFromStorage(bgKey)) {
        const resource = this.resources.get(bgKey)
        if (resource) {
          config.theme.skin.light.backgroundImage = resource.file
          restoredFiles.push(`Light background: ${resource.filename}`)
        }
      }
    }
    
    if (config.theme?.skin?.dark?.backgroundType === 'image' && config.theme.skin.dark.backgroundImage === null) {
      const bgKey = 'background_dark'
      if (await this.restoreResourceFromStorage(bgKey)) {
        const resource = this.resources.get(bgKey)
        if (resource) {
          config.theme.skin.dark.backgroundImage = resource.file
          restoredFiles.push(`Dark background: ${resource.filename}`)
        }
      }
    }

    // Restaurar los datos de la fuente convertida
    try {
      const fontInfo = this.getFontInfo()
      if (fontInfo && fontInfo.type === 'custom') {
        const tempKey = `converted_font_${fontInfo.filename}`
        const tempData = await this.configStorage.loadTempData(tempKey)
        if (tempData) {
          this.convertedFonts.set(fontInfo.filename, tempData.data)
          console.log(`Converted font data restored: ${fontInfo.filename}`)
        }
      }
    } catch (error) {
      console.warn('Error restoring converted font data:', error)
    }

    if (restoredFiles.length > 0) {
      console.log('Files restored from storage:', restoredFiles)
    }
  }

  /**
   * Obtiene la información del modelo de palabra de activación.
   * @returns {Object|null} Información del modelo de palabra de activación
   */
  getWakewordModelInfo() {
    if (!this.config || !this.config.chip || !this.config.theme) {
      return null
    }
    
    const chipModel = this.config.chip.model
    const wakeword = this.config.theme.wakeword
    
    if (!wakeword || wakeword.type === 'none') return null

    if (wakeword.type === 'preset') {
      // Determinar el tipo de modelo de palabra de activación según el modelo de chip
      const isC3OrC6 = chipModel === 'esp32c3' || chipModel === 'esp32c6'
      const modelType = isC3OrC6 ? 'WakeNet9s' : 'WakeNet9'
      
      return {
        type: modelType,
        name: wakeword.preset,
        filename: 'srmodels.bin'
      }
    } else if (wakeword.type === 'custom') {
      return {
        type: 'MultiNet',
        name: wakeword.custom.model,
        filename: 'srmodels.bin',
        custom: wakeword.custom
      }
    }
    
    return null
  }

  /**
   * Obtiene la información de la fuente.
   * @returns {Object|null} Información de la fuente
   */
  getFontInfo() {
    if (!this.config || !this.config.theme || !this.config.theme.font) {
      return null
    }
    
    const font = this.config.theme.font
    
    if (font.type === 'preset') {
      return {
        type: 'preset',
        filename: `${font.preset}.bin`,
        source: font.preset
      }
    }
    
    if (font.type === 'custom' && font.custom.file) {
      const custom = font.custom
      const filename = `font_custom_${custom.size}_${custom.bpp}.bin`
      
      return {
        type: 'custom',
        filename,
        source: font.custom.file,
        config: {
          size: custom.size,
          bpp: custom.bpp,
          charset: custom.charset
        }
      }
    }
    
    return null
  }

  /**
   * Obtiene la información de la colección de emojis.
   * @returns {Array} Array de información de la colección de emojis
   */
  getEmojiCollectionInfo() {
    if (!this.config || !this.config.theme || !this.config.theme.emoji) {
      return []
    }
    
    const emoji = this.config.theme.emoji
    const collection = []
    const defaultPresetEmotions = [
      'neutral', 'happy', 'laughing', 'funny', 'sad', 'angry', 'crying',
      'loving', 'embarrassed', 'surprised', 'shocked', 'thinking', 'winking',
      'cool', 'relaxed', 'delicious', 'kissy', 'confident', 'sleepy', 'silly', 'confused'
    ]
    const presetMeta = {
      twemoji32: { size: 32, ext: 'png', emojis: defaultPresetEmotions },
      twemoji64: { size: 64, ext: 'png', emojis: defaultPresetEmotions },
      notoemoji64: { size: 64, ext: 'gif', emojis: defaultPresetEmotions },
      notoemoji128: { size: 128, ext: 'gif', emojis: defaultPresetEmotions },
      kotty64: { size: 64, ext: 'gif', emojis: ['silly', 'sleepy', 'surprised', 'thinking', 'winking'] },
      kotty128: { size: 128, ext: 'gif', emojis: ['neutral', 'happy', 'laughing', 'funny'] },
      kotty240: { size: 240, ext: 'gif', emojis: ['eyes', 'neutral', 'happy', 'funny'] }
    }
    
    if (emoji.type === 'preset') {
      // Paquete de emojis preestablecido
      const { size = 64, ext = 'png', emojis = defaultPresetEmotions } = presetMeta[emoji.preset] || {}
      emojis.forEach(name => {
        collection.push({
          name,
          file: `${name}.${ext}`,
          source: `preset:${emoji.preset}`,
          size: { width: parseInt(size), height: parseInt(size) }
        })
      })
    } else if (emoji.type === 'custom') {
      // Paquete de emojis personalizado (admite deduplicación de archivos)
      const images = emoji.custom.images || {}
      const emotionMap = emoji.custom.emotionMap || {}
      const fileMap = emoji.custom.fileMap || {}
      const size = emoji.custom.size || { width: 64, height: 64 }
      
      // Debe usar la nueva estructura de mapeo de hash
      if (Object.keys(emotionMap).length === 0 || Object.keys(fileMap).length === 0) {
        console.error('❌ Error: Se detectó una versión antigua de la estructura de datos de emoji')
        console.error('Por favor, borre la caché del navegador o restablezca la configuración, luego vuelva a cargar las imágenes de los emojis.')
        throw new Error('Incompatible emoji data structure: Missing fileMap or emotionMap. Please reconfigure emojis.')
      }
      
      // Crear un mapeo de hash a nombre de archivo (para la deduplicación)
      const hashToFilename = new Map()
      
      Object.entries(emotionMap).forEach(([emotionName, fileHash]) => {
        const file = fileMap[fileHash]
        if (file) {
          // Generar un nombre de archivo compartido para cada hash de archivo único
          if (!hashToFilename.has(fileHash)) {
            const fileExtension = file.name ? file.name.split('.').pop().toLowerCase() : 'png'
            // Usar los primeros 8 caracteres del hash como nombre de archivo para garantizar la unicidad
            const sharedFilename = `emoji_${fileHash.substring(0, 8)}.${fileExtension}`
            hashToFilename.set(fileHash, sharedFilename)
          }
          
          const sharedFilename = hashToFilename.get(fileHash)
          
          collection.push({
            name: emotionName,
            file: sharedFilename,  // Varios emojis pueden apuntar al mismo archivo
            source: file,
            fileHash,  // Conservar la información del hash para el procesamiento de deduplicación
            size: { ...size }
          })
        }
      })
      
      console.log(`Deduplicación de emojis: ${Object.keys(emotionMap).length} emojis usan ${hashToFilename.size} archivos de imagen diferentes`)
      
      // Asegurarse de que al menos haya un emoji neutral
      if (!collection.find(item => item.name === 'neutral')) {
        console.warn('Advertencia: no se proporcionó el emoji neutral, se usará la imagen predeterminada')
      }
    }
    
    return collection
  }

  /**
   * Obtiene la información de la colección de estados.
   * @returns {Array} Array de información de estados
   */
  getStateCollectionInfo() {
    if (!this.config || !this.config.theme || !this.config.theme.state) {
      return []
    }

    const state = this.config.theme.state
    const collection = []
    const defaultStates = ['standby','starting','wifi_config','connecting','listening','thinking','speaking','activating','upgrading','audio_testing','fatal_error']
    const presetMeta = {
      state_kotty: { size: { width: 240, height: 240 }, ext: 'png', states: [
        'standby','starting','wifi_config','connecting','listening','thinking','speaking','activating','upgrading','audio_testing','fatal_error'
      ]},
      state_echoear: { size: { width: 160, height: 120 }, ext: 'png', states: [
        'standby','starting','wifi_config','connecting','listening','thinking','speaking','activating','upgrading','audio_testing','fatal_error'
      ]}
    }

    if (state.type === 'preset') {
      const meta = presetMeta[state.preset]
      if (!meta) return []
      meta.states.forEach(name => {
        collection.push({
          name,
          file: `${name}.${meta.ext}`,
          source: `preset:${state.preset}`,
          size: { ...meta.size }
        })
      })
    } else if (state.type === 'custom') {
      const images = state.custom.images || {}
      const stateMap = state.custom.stateMap || {}
      const fileMap = state.custom.fileMap || {}
      const size = state.custom.size || { width: 160, height: 120 }
      const order = state.custom.order || Object.keys(stateMap)

      if (Object.keys(stateMap).length === 0 || Object.keys(fileMap).length === 0) {
        // Permitir paquete vacío
        if (Object.keys(stateMap).length === 0 && Object.keys(fileMap).length === 0) {
          return []
        }
        console.error('❌ Error: Estructura de datos de estados incompatible (falta fileMap o stateMap).')
        throw new Error('Incompatible state data structure: Missing fileMap or stateMap. Please reconfigure states.')
      }

      const hashToFilename = new Map()

      order.forEach((stateName) => {
        const fileHash = stateMap[stateName]
        const file = fileMap[fileHash]
        if (file) {
          if (!hashToFilename.has(fileHash)) {
            const fileExtension = file.name ? file.name.split('.').pop().toLowerCase() : 'png'
            const sharedFilename = `state_${fileHash.substring(0, 8)}.${fileExtension}`
            hashToFilename.set(fileHash, sharedFilename)
          }

          const sharedFilename = hashToFilename.get(fileHash)
          collection.push({
            name: stateName,
            file: sharedFilename,
            source: file,
            fileHash,
            size: { ...size }
          })
        }
      })

      console.log(`Deduplicación de estados: ${Object.keys(stateMap).length} estados usan ${hashToFilename.size} archivos de imagen diferentes`)

      // Asegurar estado standby
      if (!collection.find(item => item.name === 'standby') && images.standby) {
        const hash = stateMap.standby
        const file = fileMap[hash]
        const ext = file?.name ? file.name.split('.').pop().toLowerCase() : 'png'
        collection.push({
          name: 'standby',
          file: `state_${hash.substring(0, 8)}.${ext}`,
          source: file,
          fileHash: hash,
          size: { ...size }
        })
      }
    } else {
      return []
    }

    return collection
  }

  /**
   * Obtiene la información de configuración de la piel.
   * @returns {Object} Información de configuración de la piel
   */
  getSkinInfo() {
    if (!this.config || !this.config.theme || !this.config.theme.skin) {
      return {}
    }
    
    const skin = this.config.theme.skin
    const result = {}
    
    // Procesar el modo claro
    if (skin.light) {
      result.light = {
        text_color: skin.light.textColor || '#000000',
        background_color: skin.light.backgroundColor || '#ffffff'
      }
      
      if (skin.light.backgroundType === 'image' && skin.light.backgroundImage) {
        result.light.background_image = 'background_light.raw'
      }
    }
    
    // Procesar el modo oscuro  
    if (skin.dark) {
      result.dark = {
        text_color: skin.dark.textColor || '#ffffff',
        background_color: skin.dark.backgroundColor || '#121212'
      }
      
      if (skin.dark.backgroundType === 'image' && skin.dark.backgroundImage) {
        result.dark.background_image = 'background_dark.raw'
      }
    }
    
    return result
  }

  /**
   * Genera el contenido de index.json.
   * @returns {Object} Objeto index.json
   */
  generateIndexJson() {
    if (!this.config) {
      throw new Error('Configuration object not set')
    }

    const indexData = {
      version: 1,
      chip_model: this.config.chip.model,
      hide_subtitle: this.config.theme.font.hide_subtitle || false,
      display_config: {
        width: this.config.chip.display.width,
        height: this.config.chip.display.height,
        monochrome: false,
        color: this.config.chip.display.color || 'RGB565'
      }
    }

    // Añadir modelo de palabra de activación
    const wakewordInfo = this.getWakewordModelInfo()
    if (wakewordInfo) {
      indexData.srmodels = wakewordInfo.filename
      
      // Si es una palabra de activación personalizada, añadir la configuración de multinet_model
      if (wakewordInfo.type === 'MultiNet' && wakewordInfo.custom) {
        const custom = wakewordInfo.custom
        indexData.multinet_model = {
          language: custom.model.includes('_en') ? 'en' : 'cn',
          duration: custom.duration || 3000,
          threshold: custom.threshold / 100.0,
          commands: [
            {
              command: custom.command,
              text: custom.name,
              action: "wake"
            }
          ]
        }
      }
    }

    // Añadir información de la fuente
    const fontInfo = this.getFontInfo()
    if (fontInfo) {
      indexData.text_font = fontInfo.filename
    }

    // Añadir configuración de la piel
    const skinInfo = this.getSkinInfo()
    if (Object.keys(skinInfo).length > 0) {
      indexData.skin = skinInfo
    }

    // Añadir colección de emojis
    const emojiCollection = this.getEmojiCollectionInfo()
    if (emojiCollection.length > 0) {
      indexData.emoji_collection = emojiCollection.map(emoji => ({
        name: emoji.name,
        file: emoji.file
      }))
    }

    // Añadir colección de estados
    const stateCollection = this.getStateCollectionInfo()
    if (stateCollection.length > 0) {
      indexData.state_collection = stateCollection.map(state => ({
        name: state.name,
        file: state.file
      }))
    }

    console.log('Generated index.json data:', JSON.stringify(indexData, null, 2))

    return indexData
  }

  /**
   * Prepara los recursos para empaquetar.
   * @returns {Object} Manifiesto de recursos para empaquetar
   */
  preparePackageResources() {
    const resources = {
      files: [],
      indexJson: this.generateIndexJson(),
      config: { ...this.config }
    }

    // Añadir modelo de palabra de activación
    const wakewordInfo = this.getWakewordModelInfo()
    if (wakewordInfo && wakewordInfo.name) {
      resources.files.push({
        type: 'wakeword',
        name: wakewordInfo.name,
        filename: wakewordInfo.filename,
        modelType: wakewordInfo.type,
        isCustom: wakewordInfo.type === 'MultiNet'
      })
    }

    // Añadir archivo de fuente
    const fontInfo = this.getFontInfo()
    if (fontInfo) {
      resources.files.push({
        type: 'font',
        filename: fontInfo.filename,
        source: fontInfo.source,
        config: fontInfo.config || null
      })
    }

    // Añadir archivos de emoji (procesamiento de deduplicación)
    const emojiCollection = this.getEmojiCollectionInfo()
    const addedFileHashes = new Set()  // Rastrear los hashes de los archivos ya añadidos
    
    emojiCollection.forEach(emoji => {
      // Si tiene fileHash (emoji personalizado y usa la nueva estructura), comprobar si ya se ha añadido
      if (emoji.fileHash) {
        if (addedFileHashes.has(emoji.fileHash)) {
          // Archivo ya añadido, omitir (pero mantener en emoji_collection de index.json)
          console.log(`Skipping duplicate file: ${emoji.name} -> ${emoji.file} (hash: ${emoji.fileHash.substring(0, 8)})`)
          return
        }
        addedFileHashes.add(emoji.fileHash)
      }
      
      // Añadir el archivo único
      resources.files.push({
        type: 'emoji',
        name: emoji.name,
        filename: emoji.file,
        source: emoji.source,
        size: emoji.size,
        fileHash: emoji.fileHash  // Pasar la información del hash
      })
    })

    // Añadir archivos de estados (deduplicación similar a emojis)
    const stateCollection = this.getStateCollectionInfo()
    const addedStateHashes = new Set()
    stateCollection.forEach(state => {
      if (state.fileHash) {
        if (addedStateHashes.has(state.fileHash)) {
          console.log(`Skipping duplicate state file: ${state.name} -> ${state.file} (hash: ${state.fileHash.substring(0, 8)})`)
          return
        }
        addedStateHashes.add(state.fileHash)
      }

      resources.files.push({
        type: 'state',
        name: state.name,
        filename: state.file,
        source: state.source,
        size: state.size,
        fileHash: state.fileHash
      })
    })

    // Añadir imágenes de fondo
    const skin = this.config?.theme?.skin
    if (skin?.light?.backgroundType === 'image' && skin.light.backgroundImage) {
      resources.files.push({
        type: 'background',
        filename: 'background_light.raw',
        source: skin.light.backgroundImage,
        mode: 'light'
      })
    }
    if (skin?.dark?.backgroundType === 'image' && skin.dark.backgroundImage) {
      resources.files.push({
        type: 'background', 
        filename: 'background_dark.raw',
        source: skin.dark.backgroundImage,
        mode: 'dark'
      })
    }

    return resources
  }

  /**
   * Preprocesa las fuentes personalizadas.
   * @param {Function} progressCallback - Función de devolución de llamada de progreso  
   * @returns {Promise<void>}
   */
  async preprocessCustomFonts(progressCallback = null) {
    const fontInfo = this.getFontInfo()
    
    if (fontInfo && fontInfo.type === 'custom' && !this.convertedFonts.has(fontInfo.filename)) {
      if (progressCallback) progressCallback(20, 'Converting custom font...')
      
      try {
        const convertOptions = {
          fontFile: fontInfo.source,
          fontName: fontInfo.filename.replace(/\.bin$/, ''),
          fontSize: fontInfo.config.size,
          bpp: fontInfo.config.bpp,
          charset: fontInfo.config.charset,
          symbols: fontInfo.config.symbols || '',
          range: fontInfo.config.range || '',
          compression: false,
          progressCallback: (progress, message) => {
            if (progressCallback) progressCallback(20 + progress * 0.2, `Font conversion: ${message}`)
          }
        }
        
        let convertedFont
        
        // Usar el convertidor de fuentes del lado del navegador
        await this.fontConverterBrowser.initialize()
        convertedFont = await this.fontConverterBrowser.convertToCBIN(convertOptions)
        this.convertedFonts.set(fontInfo.filename, convertedFont)

        // Guardar la fuente convertida en el almacenamiento temporal
        if (this.autoSaveEnabled) {
          const tempKey = `converted_font_${fontInfo.filename}`
          try {
            await this.configStorage.saveTempData(tempKey, convertedFont, 'converted_font', {
              filename: fontInfo.filename,
              size: fontInfo.config.size,
              bpp: fontInfo.config.bpp,
              charset: fontInfo.config.charset
            })
            console.log(`Converted font saved to storage: ${fontInfo.filename}`)
          } catch (error) {
            console.warn(`Failed to save converted font: ${fontInfo.filename}`, error)
          }
        }
      } catch (error) {
        console.error('Font conversion failed:', error)
        throw new Error(`Font conversion failed: ${error.message}`)
      }
    }
  }

  /**
   * Genera assets.bin.
   * @param {Function} progressCallback - Función de devolución de llamada de progreso
   * @returns {Promise<Blob>} El archivo assets.bin generado
   */
  async generateAssetsBin(progressCallback = null) {
    if (!this.config) {
      throw new Error('Configuration object not set')
    }

    try {
      if (progressCallback) progressCallback(0, 'Starting generation...')
      
      // Preprocesar fuentes personalizadas
      await this.preprocessCustomFonts(progressCallback)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      if (progressCallback) progressCallback(40, 'Preparing resource files...')
      
      const resources = this.preparePackageResources()
      
      // Limpiar el estado del generador
      this.wakenetPacker.clear()
      this.spiffsGenerator.clear()
      
      // Procesar varios tipos de archivos de recursos
      await this.processResourceFiles(resources, progressCallback)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      if (progressCallback) progressCallback(90, 'Generating final file...')

      // Print file list
      this.spiffsGenerator.printFileList()
      
      // Generar el archivo assets.bin final
      const assetsBinData = await this.spiffsGenerator.generate((progress, message) => {
        if (progressCallback) {
          progressCallback(90 + progress * 0.1, message)
        }
      })
      
      if (progressCallback) progressCallback(100, 'Generation completed')
      
      return new Blob([assetsBinData], { type: 'application/octet-stream' })
      
    } catch (error) {
      console.error('Failed to generate assets.bin:', error)
      throw error
    }
  }

  /**
   * Descarga el archivo assets.bin.
   * @param {Blob} blob - Datos del archivo assets.bin
   * @param {string} filename - Nombre del archivo a descargar
   */
  downloadAssetsBin(blob, filename = 'assets.bin') {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /**
   * Obtiene la información de la fuente (incluida la función de conversión).
   * @param {File} fontFile - Archivo de fuente (opcional, si se proporciona, obtiene la información de ese archivo)
   * @returns {Promise<Object>} Información de la fuente
   */
  async getFontInfoWithDetails(fontFile = null) {
    try {
      const file = fontFile || this.config?.theme?.font?.custom?.file
      if (!file) return null
      
      let info
      
      // Usar el convertidor de fuentes del lado del navegador
      await this.fontConverterBrowser.initialize()
      info = await this.fontConverterBrowser.getFontInfo(file)
      
      return {
        ...info,
        file: file,
        isCustom: true
      }
    } catch (error) {
      console.error('Failed to get font details:', error)
      return null
    }
  }

  /**
   * Estima el tamaño de la fuente.
   * @param {Object} fontConfig - Configuración de la fuente
   * @returns {Promise<Object>} Resultado de la estimación del tamaño
   */
  async estimateFontSize(fontConfig = null) {
    try {
      const config = fontConfig || this.config?.theme?.font?.custom
      if (!config) return null
      
      const estimateOptions = {
        fontSize: config.size,
        bpp: config.bpp,
        charset: config.charset,
        symbols: config.symbols || '',
        range: config.range || ''
      }
      
      let sizeInfo
      
      // Usar el convertidor de fuentes del lado del navegador
      sizeInfo = this.fontConverterBrowser.estimateSize(estimateOptions)
      
      return sizeInfo
    } catch (error) {
      console.error('Failed to estimate font size:', error)
      return null
    }
  }

  /**
   * Valida la configuración de la fuente personalizada.
   * @param {Object} fontConfig - Configuración de la fuente
   * @returns {Object} Resultado de la validación
   */
  validateCustomFont(fontConfig) {
    const errors = []
    const warnings = []
    
    if (!fontConfig.file) {
      errors.push('Missing font file')
    } else {
      // Validar con el convertidor del lado del navegador
      const isValid = this.fontConverterBrowser.validateFont(fontConfig.file)
        
      if (!isValid) {
        errors.push('Font file format not supported')
      }
    }
    
    if (fontConfig.size < 8 || fontConfig.size > 80) {
      errors.push('Font size must be between 8-80')
    }
    
    if (![1, 2, 4, 8].includes(fontConfig.bpp)) {
      errors.push('BPP must be 1, 2, 4 or 8')
    }
    
    if (!fontConfig.charset && !fontConfig.symbols && !fontConfig.range) {
      warnings.push('No charset, symbols or range specified, default charset will be used')
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }


  /**
   * Obtiene el estado del convertidor de fuentes.
   * @returns {Object} Información del estado del convertidor
   */
  getConverterStatus() {
    return {
      initialized: this.fontConverterBrowser.initialized,
      supportedFormats: this.fontConverterBrowser.supportedFormats
    }
  }

  /**
   * Procesa los archivos de recursos.
   * @param {Object} resources - Configuración de recursos
   * @param {Function} progressCallback - Devolución de llamada de progreso
   */
  async processResourceFiles(resources, progressCallback = null) {
    let processedCount = 0
    const totalFiles = resources.files.length
    
    // Añadir el archivo index.json
    const indexJsonData = new TextEncoder().encode(JSON.stringify(resources.indexJson, null, 2))
    // print json string
    console.log('index.json', resources.indexJson);
    this.spiffsGenerator.addFile('index.json', indexJsonData.buffer)
    
    for (const resource of resources.files) {
      const progressPercent = 40 + (processedCount / totalFiles) * 40
      if (progressCallback) {
        progressCallback(progressPercent, `Processing file: ${resource.filename}`)
      }
      
      try {
        await this.processResourceFile(resource)
        processedCount++
      } catch (error) {
        console.error(`Failed to process resource file: ${resource.filename}`, error)
        throw new Error(`Failed to process resource file: ${resource.filename} - ${error.message}`)
      }
    }
  }

  /**
   * Procesa un único archivo de recurso.
   * @param {Object} resource - Configuración del recurso
   */
  async processResourceFile(resource) {
    switch (resource.type) {
      case 'wakeword':
        await this.processWakewordModel(resource)
        break
      case 'font':
        await this.processFontFile(resource)
        break
      case 'emoji':
        await this.processEmojiFile(resource)
        break
      case 'state':
        await this.processStateFile(resource)
        break
      case 'background':
        await this.processBackgroundFile(resource)
        break
      default:
        console.warn(`Unknown resource type: ${resource.type}`)
    }
  }

  /**
   * Procesa el archivo de estado (misma lógica que emojis personalizados).
   * @param {Object} resource - Configuración del recurso
   */
  async processStateFile(resource) {
    let imageData
    let needsScaling = false
    let imageFormat = 'png'
    let isGif = false

    let file = resource.source

    if (typeof resource.source === 'string' && resource.source.startsWith('preset:')) {
      const presetName = resource.source.replace('preset:', '')
      imageData = await this.loadPresetState(presetName, resource.name)
      this.spiffsGenerator.addFile(resource.filename, imageData, {
        width: resource.size?.width || 0,
        height: resource.size?.height || 0
      })
      if (resource.fileHash) {
        console.log(`State file added (preset): ${resource.filename}`)
      }
      return
    }

    file = resource.source
    isGif = this.isGifFile(file)
    const fileExtension = file.name.split('.').pop().toLowerCase()
    imageFormat = fileExtension

    try {
      const actualDimensions = await this.getImageDimensions(file)
      const targetSize = resource.size || { width: 160, height: 120 }
      if (actualDimensions.width > targetSize.width || actualDimensions.height > targetSize.height) {
        needsScaling = true
        console.log(`State ${resource.name} needs scaling: ${actualDimensions.width}x${actualDimensions.height} -> ${targetSize.width}x${targetSize.height}`)
      }
    } catch (error) {
      console.warn(`Failed to get state image dimensions: ${resource.name}`, error)
    }

    if (!needsScaling) {
      imageData = await this.fileToArrayBuffer(file)
    } else {
      try {
        const targetSize = resource.size || { width: 160, height: 120 }
        if (isGif) {
          const scaledGifBlob = await this.gifScaler.scaleGif(resource.source, {
            maxWidth: targetSize.width,
            maxHeight: targetSize.height,
            keepAspectRatio: true,
            lossy: 30
          })
          imageData = await this.fileToArrayBuffer(scaledGifBlob)
        } else {
          imageData = await this.scaleImageToFit(resource.source, targetSize, imageFormat)
        }
      } catch (error) {
        console.error(`Failed to scale state image: ${resource.name}`, error)
        imageData = await this.fileToArrayBuffer(resource.source)
      }
    }

    this.spiffsGenerator.addFile(resource.filename, imageData, {
      width: resource.size?.width || 0,
      height: resource.size?.height || 0
    })

    if (resource.fileHash) {
      console.log(`State file added: ${resource.filename} (hash: ${resource.fileHash.substring(0, 8)})`)
    }
  }

  /**
   * Procesa el modelo de palabra de activación.
   * @param {Object} resource - Configuración del recurso
   */
  async processWakewordModel(resource) {
    const success = await this.wakenetPacker.loadModelFromShare(resource.name)
    if (!success) {
      throw new Error(`Failed to load wakeword model: ${resource.name}`)
    }
    
    const srmodelsData = this.wakenetPacker.packModels()
    this.spiffsGenerator.addFile(resource.filename, srmodelsData)
  }

  /**
   * Procesa el archivo de fuente.
   * @param {Object} resource - Configuración del recurso
   */
  async processFontFile(resource) {
    if (resource.config) {
      // Fuente personalizada, usar los datos convertidos
      const convertedFont = this.convertedFonts.get(resource.filename)
      if (convertedFont) {
        this.spiffsGenerator.addFile(resource.filename, convertedFont)
      } else {
        throw new Error(`Converted font not found: ${resource.filename}`)
      }
    } else {
      // Fuente preestablecida, cargar desde el directorio share/fonts
      const fontData = await this.loadPresetFont(resource.source)
      this.spiffsGenerator.addFile(resource.filename, fontData)
    }
  }

  /**
   * Procesa el archivo de emoji.
   * @param {Object} resource - Configuración del recurso
   */
  async processEmojiFile(resource) {
    // Nota: La deduplicación de archivos ya se ha completado en la fase preparePackageResources()
    // Cada archivo procesado aquí es único
    
    let imageData
    let needsScaling = false
    let imageFormat = 'png' // Formato por defecto
    let isGif = false
    
    if (typeof resource.source === 'string' && resource.source.startsWith('preset:')) {
      // Paquete de emojis preestablecido
      const presetName = resource.source.replace('preset:', '')
      imageData = await this.loadPresetEmoji(presetName, resource.name)
    } else {
      // Emoji personalizado
      const file = resource.source
      
      // Detectar si es un formato GIF
      isGif = this.isGifFile(file)
      
      // Obtener el formato del archivo
      const fileExtension = file.name.split('.').pop().toLowerCase()
      imageFormat = fileExtension
      
      // Comprobar las dimensiones reales de la imagen
      try {
        const actualDimensions = await this.getImageDimensions(file)
        const targetSize = resource.size || { width: 64, height: 64 }
        
        // Si las dimensiones reales superan el rango de destino, es necesario escalar
        if (actualDimensions.width > targetSize.width || 
            actualDimensions.height > targetSize.height) {
          needsScaling = true
          console.log(`Emoji ${resource.name} needs scaling: ${actualDimensions.width}x${actualDimensions.height} -> ${targetSize.width}x${targetSize.height}`)
        }
      } catch (error) {
        console.warn(`Failed to get emoji image dimensions: ${resource.name}`, error)
      }
      
      // Si no es necesario escalar, leer directamente el archivo
      if (!needsScaling) {
        imageData = await this.fileToArrayBuffer(file)
      }
    }
    
    // Si es necesario escalar, elegir el método de escalado según el tipo de archivo
    if (needsScaling) {
      try {
        const targetSize = resource.size || { width: 64, height: 64 }
        
        if (isGif) {
          // Usar WasmGifScaler para procesar archivos GIF
          console.log(`Using WasmGifScaler to process GIF emoji: ${resource.name}`)
          const scaledGifBlob = await this.gifScaler.scaleGif(resource.source, {
            maxWidth: targetSize.width,
            maxHeight: targetSize.height,
            keepAspectRatio: true,
            lossy: 30  // Usar compresión con pérdida para reducir el tamaño del archivo
          })
          imageData = await this.fileToArrayBuffer(scaledGifBlob)
        } else {
          // Usar métodos convencionales para procesar otros formatos de imagen
          imageData = await this.scaleImageToFit(resource.source, targetSize, imageFormat)
        }
      } catch (error) {
        console.error(`Failed to scale emoji image: ${resource.name}`, error)
        // Usar la imagen original en caso de fallo de escalado
        imageData = await this.fileToArrayBuffer(resource.source)
      }
    }
    
    // Añadir el archivo a SPIFFS
    this.spiffsGenerator.addFile(resource.filename, imageData, {
      width: resource.size?.width || 0,
      height: resource.size?.height || 0
    })
    
    // Registrar el procesamiento
    if (resource.fileHash) {
      console.log(`Emoji file added: ${resource.filename} (hash: ${resource.fileHash.substring(0, 8)})`)
    }
  }

  /**
   * Procesa el archivo de fondo  
   * @param {Object} resource - Configuración del recurso
   */
  async processBackgroundFile(resource) {
    const imageData = await this.fileToArrayBuffer(resource.source)
    
    // Convertir la imagen a datos sin procesar en formato RGB565
    const rawData = await this.convertImageToRgb565(imageData)
    this.spiffsGenerator.addFile(resource.filename, rawData)
  }

  /**
   * Carga la fuente preestablecida.
   * @param {string} fontName - Nombre de la fuente
   * @returns {Promise<ArrayBuffer>} Datos de la fuente
   */
  async loadPresetFont(fontName) {
    try {
      const response = await fetch(`./static/fonts/${fontName}.bin`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return await response.arrayBuffer()
    } catch (error) {
      throw new Error(`Failed to load preset font: ${fontName} - ${error.message}`)
    }
  }

  /**
   * Carga el emoji preestablecido.
   * @param {string} presetName - Nombre del preajuste (twemoji32/twemoji64)
   * @param {string} emojiName - Nombre del emoji
   * @returns {Promise<ArrayBuffer>} Datos del emoji
   */
  async loadPresetEmoji(presetName, emojiName) {
    try {
      const presetMeta = {
        twemoji32: 'png',
        twemoji64: 'png',
        notoemoji64: 'gif',
        notoemoji128: 'gif',
        kotty64: 'gif',
        kotty128: 'gif',
        kotty240: 'gif'
      }
      const ext = presetMeta[presetName] || 'png'
      const response = await fetch(`./static/${presetName}/${emojiName}.${ext}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return await response.arrayBuffer()
    } catch (error) {
      throw new Error(`Failed to load preset emoji: ${presetName}/${emojiName} - ${error.message}`)
    }
  }

  /**
   * Carga estado preestablecido.
   * @param {string} presetName - Nombre del preajuste (state_kotty/state_echoear)
   * @param {string} stateName - Nombre del estado
   * @returns {Promise<ArrayBuffer>} Datos del estado
   */
  async loadPresetState(presetName, stateName) {
    const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : '/'
    const tryFetch = async (ext) => {
      const response = await fetch(`${base}static/${presetName}/${stateName}.${ext}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.arrayBuffer()
    }
    try {
      return await tryFetch('png')
    } catch (errorPng) {
      try {
        return await tryFetch('gif')
      } catch (errorGif) {
        throw new Error(`Failed to load preset state: ${presetName}/${stateName} - png: ${errorPng.message}; gif: ${errorGif.message}`)
      }
    }
  }

  /**
   * Convierte un archivo a ArrayBuffer.
   * @param {File|Blob} file - Objeto de archivo
   * @returns {Promise<ArrayBuffer>} Datos del archivo
   */
  fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsArrayBuffer(file)
    })
  }

  /**
   * Escala la imagen para que se ajuste a las dimensiones especificadas (escalado proporcional, efecto de contención).
   * @param {ArrayBuffer|File} imageData - Datos de la imagen
   * @param {Object} targetSize - Dimensiones de destino {width, height}
   * @param {string} format - Formato de la imagen (para el manejo de fondos transparentes)
   * @returns {Promise<ArrayBuffer>} Datos de la imagen escalada
   */
  async scaleImageToFit(imageData, targetSize, format = 'png') {
    return new Promise((resolve, reject) => {
      const blob = imageData instanceof File ? imageData : new Blob([imageData])
      const url = URL.createObjectURL(blob)
      const img = new Image()
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          // Establecer las dimensiones del lienzo de destino
          canvas.width = targetSize.width
          canvas.height = targetSize.height
          
          // Calcular las dimensiones de escalado proporcional (efecto de contención)
          const imgAspectRatio = img.width / img.height
          const targetAspectRatio = targetSize.width / targetSize.height
          
          let drawWidth, drawHeight, offsetX, offsetY
          
          if (imgAspectRatio > targetAspectRatio) {
            // Imagen más ancha, escalar por ancho
            drawWidth = targetSize.width
            drawHeight = targetSize.width / imgAspectRatio
            offsetX = 0
            offsetY = (targetSize.height - drawHeight) / 2
          } else {
            // Imagen más alta, escalar por altura
            drawHeight = targetSize.height
            drawWidth = targetSize.height * imgAspectRatio
            offsetX = (targetSize.width - drawWidth) / 2
            offsetY = 0
          }
          
          // Mantener el fondo transparente para el formato PNG
          if (format === 'png') {
            // Limpiar el lienzo, mantener la transparencia
            ctx.clearRect(0, 0, canvas.width, canvas.height)
          } else {
            // Usar fondo blanco para otros formatos
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }
          
          // Dibujar la imagen escalada
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
          
          // Convertir a ArrayBuffer
          canvas.toBlob((blob) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = () => reject(new Error('Failed to convert image data'))
            reader.readAsArrayBuffer(blob)
          }, `image/${format}`)
          
          URL.revokeObjectURL(url)
        } catch (error) {
          URL.revokeObjectURL(url)
          reject(error)
        }
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Unable to load image'))
      }
      
      img.src = url
    })
  }

  /**
   * Detecta si un archivo es de formato GIF.
   * @param {File} file - Objeto de archivo
   * @returns {boolean} Si es de formato GIF
   */
  isGifFile(file) {
    // Comprobar el tipo MIME
    if (file.type === 'image/gif') {
      return true
    }
    
    // Comprobar la extensión del archivo
    const extension = file.name.split('.').pop().toLowerCase()
    return extension === 'gif'
  }

  /**
   * Obtiene la información de las dimensiones de la imagen.
   * @param {ArrayBuffer|File} imageData - Datos de la imagen
   * @returns {Promise<Object>} Información de las dimensiones de la imagen {width, height}
   */
  async getImageDimensions(imageData) {
    return new Promise((resolve, reject) => {
      const blob = imageData instanceof File ? imageData : new Blob([imageData])
      const url = URL.createObjectURL(blob)
      const img = new Image()
      
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({
          width: img.width,
          height: img.height
        })
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Unable to get image dimensions'))
      }
      
      img.src = url
    })
  }

  /**
   * Convierte la imagen a datos sin procesar en formato RGB565.
   * @param {ArrayBuffer} imageData - Datos de la imagen
   * @returns {Promise<ArrayBuffer>} Datos sin procesar en formato RGB565
   */
  async convertImageToRgb565(imageData) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([imageData])
      const url = URL.createObjectURL(blob)
      const img = new Image()
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          
          canvas.width = this.config?.chip?.display?.width || 320
          canvas.height = this.config?.chip?.display?.height || 240
          
          // Usar el modo de cubierta para dibujar la imagen, manteniendo la proporción y centrándola
          const imgAspectRatio = img.width / img.height
          const canvasAspectRatio = canvas.width / canvas.height
          
          let drawWidth, drawHeight, offsetX, offsetY
          
          if (imgAspectRatio > canvasAspectRatio) {
            // Imagen más ancha, escalar por altura (efecto de cubierta)
            drawHeight = canvas.height
            drawWidth = canvas.height * imgAspectRatio
            offsetX = (canvas.width - drawWidth) / 2
            offsetY = 0
          } else {
            // Imagen más alta, escalar por ancho (efecto de cubierta)
            drawWidth = canvas.width
            drawHeight = canvas.width / imgAspectRatio
            offsetX = 0
            offsetY = (canvas.height - drawHeight) / 2
          }
          
          // Dibujar la imagen en el lienzo, usando el modo de cubierta para mantener la proporción y centrarla
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
          
          // Obtener los datos de los píxeles
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const pixels = imageData.data
          
          // Convertir al formato RGB565
          const rgb565Data = new ArrayBuffer(canvas.width * canvas.height * 2)
          const rgb565View = new Uint16Array(rgb565Data)
          
          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i] >> 3      // 5 bits para el rojo
            const g = pixels[i + 1] >> 2  // 6 bits para el verde 
            const b = pixels[i + 2] >> 3  // 5 bits para el azul
            
            rgb565View[i / 4] = (r << 11) | (g << 5) | b
          }
          
          // Definiciones de constantes de LVGL
          const LV_IMAGE_HEADER_MAGIC = 0x19  // Número mágico de la cabecera de la imagen de LVGL
          const LV_COLOR_FORMAT_RGB565 = 0x12 // Formato de color RGB565
          
          // Calcular el stride (número de bytes por fila)
          const stride = canvas.width * 2  // RGB565, 2 bytes por píxel
          
          // Crear una cabecera que cumpla con la estructura lv_image_dsc_t
          const headerSize = 28  // Tamaño de la estructura lv_image_dsc_t: cabecera(12) + data_size(4) + datos(4) + reservado(4) + reservado_2(4) = 28 bytes
          const totalSize = headerSize + rgb565Data.byteLength
          const finalData = new ArrayBuffer(totalSize)
          const finalView = new Uint8Array(finalData)
          const headerView = new DataView(finalData)
          
          let offset = 0
          
          // Estructura lv_image_header_t (16 bytes)
          // magic: 8 bits, cf: 8 bits, flags: 16 bits (total 4 bytes)
          const headerWord1 = (0 << 24) | (0 << 16) | (LV_COLOR_FORMAT_RGB565 << 8) | LV_IMAGE_HEADER_MAGIC
          headerView.setUint32(offset, headerWord1, true)
          offset += 4
          
          // w: 16 bits, h: 16 bits (total 4 bytes)
          const sizeWord = (canvas.height << 16) | canvas.width

          headerView.setUint32(offset, sizeWord, true)  
          offset += 4
          
          // stride: 16 bits, reserved_2: 16 bits (total 4 bytes)
          const strideWord = (0 << 16) | stride
          headerView.setUint32(offset, strideWord, true)
          offset += 4
          
          // Campos restantes de lv_image_dsc_t
          // data_size: 32 bits (4 bytes)
          headerView.setUint32(offset, rgb565Data.byteLength, true)
          offset += 4
          
          // Marcador de posición del puntero de datos (4 bytes, en el uso real apuntará a la sección de datos)
          headerView.setUint32(offset, headerSize, true)  // Desplazamiento relativo
          offset += 4
          
          // reservado (4 bytes)
          headerView.setUint32(offset, 0, true)
          offset += 4
          
          // reservado_2 (4 bytes)  
          headerView.setUint32(offset, 0, true)
          offset += 4
          
          // Copiar los datos RGB565 después de la cabecera
          finalView.set(new Uint8Array(rgb565Data), headerSize)
          
          URL.revokeObjectURL(url)
          resolve(finalData)
        } catch (error) {
          URL.revokeObjectURL(url)
          reject(error)
        }
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Unable to load image'))
      }
      
      img.src = url
    })
  }

  /**
   * Limpia los recursos temporales.
   */
  cleanup() {
    this.resources.clear()
    this.tempFiles = []
    this.convertedFonts.clear()
    this.wakenetPacker.clear()
    this.spiffsGenerator.clear()
    this.gifScaler.dispose() // Limpiar los recursos de WasmGifScaler
  }

  /**
   * Limpia todos los datos almacenados (función de empezar de nuevo).
   * @returns {Promise<void>}
   */
  async clearAllStoredData() {
    try {
      await this.configStorage.clearAll()
      this.cleanup()
      console.log('All stored data cleared')
    } catch (error) {
      console.error('Failed to clear stored data:', error)
      throw error
    }
  }

  /**
   * Obtiene la información del estado de almacenamiento.
   * @returns {Promise<Object>} Información del estado de almacenamiento
   */
  async getStorageStatus() {
    try {
      const storageInfo = await this.configStorage.getStorageInfo()
      const hasConfig = await this.configStorage.hasStoredConfig()
      
      return {
        hasStoredData: hasConfig,
        storageInfo,
        autoSaveEnabled: this.autoSaveEnabled
      }
    } catch (error) {
      console.error('Failed to get storage status:', error)
      return {
        hasStoredData: false,
        storageInfo: null,
        autoSaveEnabled: this.autoSaveEnabled
      }
    }
  }

  /**
   * Habilita/deshabilita el guardado automático.
   * @param {boolean} enabled - Si está habilitado
   */
  setAutoSave(enabled) {
    this.autoSaveEnabled = enabled
    console.log(`Auto-save ${enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * Obtiene el manifiesto de recursos para su visualización.
   * @returns {Array} Manifiesto de recursos
   */
  getResourceSummary() {
    const summary = []
    const resources = this.preparePackageResources()
    
    // Contar varios tipos de recursos
    const counts = {
      wakeword: 0,
      font: 0, 
      emoji: 0,
      state: 0,
      background: 0
    }
    
    resources.files.forEach(file => {
      counts[file.type] = (counts[file.type] || 0) + 1
      
      let description = ''
      switch (file.type) {
        case 'wakeword':
          description = `Wakeword model: ${file.name} (${file.modelType})`
          break
        case 'font':
          if (file.config) {
            description = `Custom font: size ${file.config.size}px, BPP ${file.config.bpp}`
          } else {
            description = `Preset font: ${file.source}`
          }
          break
        case 'emoji':
          description = `Emoji: ${file.name} (${file.size.width}x${file.size.height})`
          break
        case 'state':
          description = `State: ${file.name} (${file.size.width}x${file.size.height})`
          break
        case 'background':
          description = `${file.mode === 'light' ? 'Light' : 'Dark'} mode background`
          break
      }
      
      summary.push({
        type: file.type,
        filename: file.filename,
        description
      })
    })
    
    return {
      files: summary,
      counts,
      totalFiles: summary.length,
      indexJson: resources.indexJson
    }
  }
}

export default AssetsBuilder
