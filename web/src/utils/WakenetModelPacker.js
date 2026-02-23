/**
 * Clase WakenetModelPacker
 * Imita la funcionalidad de pack_model.py para empaquetar modelos de palabras de activación en el navegador.
 * 
 * Nota: Se han solucionado problemas de compatibilidad con la versión de Python:
 * - Se utiliza la codificación ASCII en lugar de UTF-8.
 * - Se asegura la coherencia del formato de enteros little-endian.
 * - Se han eliminado las operaciones de reemplazo de cadenas redundantes.
 * 
 * Formato de empaquetado:
 * {
 *     model_num: int (4 bytes)
 *     model1_info: model_info_t
 *     model2_info: model_info_t
 *     ...
 *     datos del modelo 1
 *     datos del modelo 2
 *     ...
 * }
 * 
 * formato model_info_t:
 * {
 *     model_name: char[32] (32 bytes)
 *     file_number: int (4 bytes)
 *     file1_name: char[32] (32 bytes)
 *     file1_start: int (4 bytes)  
 *     file1_len: int (4 bytes)
 *     file2_name: char[32] (32 bytes)
 *     file2_start: int (4 bytes)   
 *     file2_len: int (4 bytes)
 *     ...
 * }
 */

class WakenetModelPacker {
  constructor() {
    this.models = new Map()
  }

  /**
   * Añade un archivo de modelo.
   * @param {string} modelName - Nombre del modelo
   * @param {string} fileName - Nombre del archivo
   * @param {ArrayBuffer} fileData - Datos del archivo
   */
  addModelFile(modelName, fileName, fileData) {
    if (!this.models.has(modelName)) {
      this.models.set(modelName, new Map())
    }
    this.models.get(modelName).set(fileName, fileData)
  }

  /**
   * Carga un modelo desde el directorio share/wakenet_model o multinet_model.
   * @param {string} modelName - Nombre del modelo (por ejemplo, wn9s_nihaoxiaozhi o mn6_cn)
   * @returns {Promise<boolean>} Si la carga fue exitosa
   */
  async loadModelFromShare(modelName) {
    try {
      let modelFiles = []
      let baseUrl = ''

      if (modelName.startsWith('wn9')) {
        // modelo wakenet
        modelFiles = ['_MODEL_INFO_', 'wn9_data', 'wn9_index']
        baseUrl = `./static/wakenet_model/${modelName}/`
      } else if (modelName.startsWith('mn6') || modelName.startsWith('mn7')) {
        // modelo multinet
        modelFiles = ['_MODEL_INFO_', `${modelName.substring(0, 3)}_data`, `${modelName.substring(0, 3)}_index`, 'vocab']
        baseUrl = `./static/multinet_model/${modelName}/`
        
        // Cargar simultáneamente los archivos del modelo fst (requerido para Multinet 6/7)
        await this.loadFSTModel()
      } else {
        throw new Error(`Unknown model type: ${modelName}`)
      }

      let loadedFiles = 0
      for (const fileName of modelFiles) {
        try {
          const response = await fetch(`${baseUrl}${fileName}`)
          if (response.ok) {
            const fileData = await response.arrayBuffer()
            this.addModelFile(modelName, fileName, fileData)
            loadedFiles++
          } else {
            console.warn(`No se pudo cargar el archivo: ${fileName}, estado: ${response.status}`)
          }
        } catch (error) {
          console.warn(`Error al cargar el archivo: ${fileName}`, error)
        }
      }

      return loadedFiles === modelFiles.length
    } catch (error) {
      console.error(`Error al cargar el modelo: ${modelName}`, error)
      return false
    }
  }

  /**
   * Carga los archivos del modelo FST (requerido para Multinet 6/7).
   * @returns {Promise<boolean>} Si la carga fue exitosa
   */
  async loadFSTModel() {
    try {
      const modelName = 'fst'
      
      // Si ya está cargado, devolver directamente
      if (this.models.has(modelName)) {
        return true
      }

      const modelFiles = ['commands_cn.txt', 'commands_en.txt']
      const baseUrl = `./static/multinet_model/fst/`
      
      let loadedFiles = 0
      for (const fileName of modelFiles) {
        try {
          const response = await fetch(`${baseUrl}${fileName}`)
          if (response.ok) {
            const fileData = await response.arrayBuffer()
            this.addModelFile(modelName, fileName, fileData)
            loadedFiles++
          } else {
            console.warn(`No se pudo cargar el archivo FST: ${fileName}, estado: ${response.status}`)
          }
        } catch (error) {
          console.warn(`Error al cargar el archivo FST: ${fileName}`, error)
        }
      }
      
      return loadedFiles > 0
    } catch (error) {
      console.error('Error al cargar el modelo FST', error)
      return false
    }
  }

  /**
   * Empaqueta una cadena en datos binarios de longitud fija.
   * Imita el comportamiento de struct_pack_string de la versión de Python, usando codificación ASCII.
   * @param {string} string - Cadena de entrada
   * @param {number} maxLen - Longitud máxima
   * @returns {Uint8Array} Datos binarios empaquetados
   */
  packString(string, maxLen) {
    const bytes = new Uint8Array(maxLen)
    
    // Usar codificación ASCII para mantener la coherencia con la versión de Python
    // No reservar espacio para el terminador nulo, usar completamente los bytes maxLen
    const copyLen = Math.min(string.length, maxLen)
    
    for (let i = 0; i < copyLen; i++) {
      // Usar charCodeAt para obtener el código ASCII, solo tomar los 8 bits inferiores para garantizar la compatibilidad
      bytes[i] = string.charCodeAt(i) & 0xFF
    }
    
    // Los bytes restantes se mantienen en 0 (valor de inicialización predeterminado)
    return bytes
  }

  /**
   * Convierte un entero de 32 bits a un array de bytes little-endian.
   * Coherente con struct.pack('<I', value) de la versión de Python.
   * @param {number} value - Valor entero
   * @returns {Uint8Array} Array de 4 bytes little-endian
   */
  packUint32(value) {
    const bytes = new Uint8Array(4)
    bytes[0] = value & 0xFF          // byte menos significativo (LSB)
    bytes[1] = (value >> 8) & 0xFF   // 
    bytes[2] = (value >> 16) & 0xFF  // 
    bytes[3] = (value >> 24) & 0xFF  // byte más significativo (MSB)
    return bytes
  }

  /**
   * Empaqueta todos los modelos en formato srmodels.bin.
   * @returns {ArrayBuffer} Datos binarios empaquetados
   */
  packModels() {
    if (this.models.size === 0) {
      throw new Error('No hay datos de modelo para empaquetar')
    }

    // Calcular el número total de archivos y datos
    let totalFileNum = 0
    const modelDataList = []
    
    // Recorrer ordenando por nombre de modelo
    for (const [modelName, files] of Array.from(this.models.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      totalFileNum += files.size
      // Ordenar por nombre de archivo para asegurar el mismo orden que en la versión de Python
      const sortedFiles = Array.from(files.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      modelDataList.push({
        name: modelName,
        files: sortedFiles
      })
    }

    // Calcular la longitud de la cabecera: número de modelos (4) + información de cada modelo (32+4+número de archivos*(32+4+4))
    const modelNum = this.models.size
    let headerLen = 4 // model_num
    
    for (const model of modelDataList) {
      headerLen += 32 + 4 // model_name + file_number
      headerLen += model.files.length * (32 + 4 + 4) // nombre de cada archivo + inicio + longitud
    }

    // Crear el búfer de salida
    const totalSize = headerLen + Array.from(this.models.values())
      .reduce((total, files) => total + Array.from(files.values())
        .reduce((fileTotal, fileData) => fileTotal + fileData.byteLength, 0), 0)
    
    const output = new Uint8Array(totalSize)
    let offset = 0

    // Escribir el número de modelos
    output.set(this.packUint32(modelNum), offset)
    offset += 4

    // Escribir la cabecera de información de los modelos
    let dataOffset = headerLen
    
    for (const model of modelDataList) {
      // Escribir el nombre del modelo
      output.set(this.packString(model.name, 32), offset)
      offset += 32
      
      // Escribir el número de archivos
      output.set(this.packUint32(model.files.length), offset)
      offset += 4

      // Escribir la información de cada archivo
      for (const [fileName, fileData] of model.files) {
        // Nombre del archivo
        output.set(this.packString(fileName, 32), offset)
        offset += 32
        
        // Posición de inicio del archivo
        output.set(this.packUint32(dataOffset), offset)
        offset += 4
        
        // Longitud del archivo
        output.set(this.packUint32(fileData.byteLength), offset)
        offset += 4

        dataOffset += fileData.byteLength
      }
    }

    // Escribir los datos de los archivos
    for (const model of modelDataList) {
      for (const [fileName, fileData] of model.files) {
        output.set(new Uint8Array(fileData), offset)
        offset += fileData.byteLength
      }
    }

    return output.buffer
  }

  /**
   * Obtiene la lista de modelos disponibles.
   * @returns {Promise<Array>} Lista de modelos
   */
  static async getAvailableModels() {
    try {
      // Intentar obtener la lista de modelos de varias maneras
      const wn9Models = [
        'wn9_alexa', 'wn9_astrolabe_tts', 'wn9_bluechip_tts2', 'wn9_computer_tts',
        'wn9_haixiaowu_tts', 'wn9_heyily_tts2', 'wn9_heyprinter_tts', 'wn9_heywanda_tts',
        'wn9_heywillow_tts', 'wn9_hiesp', 'wn9_hifairy_tts2', 'wn9_hijason_tts2',
        'wn9_hijolly_tts2', 'wn9_hijoy_tts', 'wn9_hilexin', 'wn9_hilili_tts',
        'wn9_himfive', 'wn9_himiaomiao_tts', 'wn9_hitelly_tts', 'wn9_hiwalle_tts2',
        'wn9_hixiaoxing_tts', 'wn9_jarvis_tts', 'wn9_linaiban_tts2', 'wn9_miaomiaotongxue_tts',
        'wn9_mycroft_tts', 'wn9_nihaobaiying_tts2', 'wn9_nihaodongdong_tts2', 'wn9_nihaomiaoban_tts2',
        'wn9_nihaoxiaoan_tts2', 'wn9_nihaoxiaoxin_tts', 'wn9_nihaoxiaoyi_tts2', 'wn9_nihaoxiaozhi',
        'wn9_nihaoxiaozhi_tts', 'wn9_sophia_tts', 'wn9_xiaoaitongxue', 'wn9_xiaobinxiaobin_tts',
        'wn9_xiaojianxiaojian_tts2', 'wn9_xiaokangtongxue_tts2', 'wn9_xiaolongxiaolong_tts',
        'wn9_xiaoluxiaolu_tts2', 'wn9_xiaomeitongxue_tts', 'wn9_xiaomingtongxue_tts2',
        'wn9_xiaosurou_tts2', 'wn9_xiaotexiaote_tts2', 'wn9_xiaoyaxiaoya_tts2', 'wn9_xiaoyutongxue_tts2'
      ]

      const wn9sModels = [
        'wn9s_alexa', 'wn9s_hiesp', 'wn9s_hijason', 'wn9s_hilexin', 'wn9s_nihaoxiaozhi'
      ]

      return {
        WakeNet9: wn9Models,
        WakeNet9s: wn9sModels
      }
    } catch (error) {
      console.error('Error al obtener la lista de modelos:', error)
      return { WakeNet9: [], WakeNet9s: [] }
    }
  }

  /**
   * Valida si el nombre del modelo es válido.
   * @param {string} modelName - Nombre del modelo
   * @param {string} chipModel - Modelo de chip
   * @returns {boolean} Si es válido
   */
  static isValidModel(modelName, chipModel) {
    const isC3OrC6 = chipModel === 'esp32c3' || chipModel === 'esp32c6'
    
    if (isC3OrC6) {
      return modelName.startsWith('wn9s_')
    } else {
      return modelName.startsWith('wn9_')
    }
  }

  /**
   * Limpia los datos del modelo cargado.
   */
  clear() {
    this.models.clear()
  }

  /**
   * Obtiene las estadísticas de los modelos cargados.
   * @returns {Object} Información de estadísticas
   */
  getStats() {
    let totalFiles = 0
    let totalSize = 0
    
    for (const files of this.models.values()) {
      totalFiles += files.size
      for (const fileData of files.values()) {
        totalSize += fileData.byteLength
      }
    }

    return {
      modelCount: this.models.size,
      fileCount: totalFiles,
      totalSize,
      models: Array.from(this.models.keys())
    }
  }

  /**
   * Valida la compatibilidad del formato de empaquetado.
   * Se utiliza para probar la coherencia con la versión de Python.
   * @returns {Object} Resultados de la validación
   */
  validatePackingCompatibility() {
    // Probar el empaquetado de cadenas
    const testString = "test_model"
    const packedString = this.packString(testString, 32)
    
    // Probar el empaquetado de enteros
    const testInt = 0x12345678
    const packedInt = this.packUint32(testInt)
    
    return {
      stringPacking: {
        input: testString,
        output: Array.from(packedString).map(b => `0x${b.toString(16).padStart(2, '0')}`),
        isASCII: packedString.every((b, i) => i >= testString.length || b === testString.charCodeAt(i))
      },
      intPacking: {
        input: `0x${testInt.toString(16)}`,
        output: Array.from(packedInt).map(b => `0x${b.toString(16).padStart(2, '0')}`),
        isLittleEndian: packedInt[0] === 0x78 && packedInt[3] === 0x12
      }
    }
  }
}

export default WakenetModelPacker
