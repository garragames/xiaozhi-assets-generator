/**
 * Clase de utilidad StorageHelper
 * Proporciona funciones de almacenamiento de archivos convenientes para varios componentes.
 */

import configStorage from './ConfigStorage.js'

class StorageHelper {
  /**
   * Proporciona guardado automático para archivos de fuentes.
   * @param {File} file - El archivo de fuente
   * @param {Object} config - Configuración de la fuente
   * @returns {Promise<void>}
   */
  static async saveFontFile(file, config = {}) {
    if (file) {
      const key = 'custom_font'
      try {
        await configStorage.saveFile(key, file, 'font', {
          size: config.size || 20,
          bpp: config.bpp || 4,
          charset: config.charset || 'deepseek'
        })
        console.log(`Archivo de fuente guardado: ${file.name}`)
      } catch (error) {
        console.warn(`Error al guardar el archivo de fuente: ${file.name}`, error)
      }
    }
  }

  /**
   * Proporciona guardado automático para archivos de emojis.
   * @param {string} emojiName - Nombre del emoji o hash del archivo (si comienza con hash_)
   * @param {File} file - El archivo de emoji
   * @param {Object} config - Configuración del emoji
   * @returns {Promise<void>}
   */
  static async saveEmojiFile(emojiName, file, config = {}) {
    if (file && emojiName) {
      // Si emojiName ya comienza con hash_ (nueva estructura de deduplicación), úselo directamente
      // De lo contrario, agregue el prefijo emoji_ (estructura antigua, para compatibilidad con versiones anteriores)
      const key = emojiName.startsWith('hash_') ? emojiName : `emoji_${emojiName}`
      
      try {
        const width = config?.size?.width ?? 64
        const height = config?.size?.height ?? 64

        // Pasar un objeto simple clonable para evitar Vue Proxy
        await configStorage.saveFile(key, file, 'emoji', {
          name: emojiName,
          size: { width, height },
          format: config?.format,
          emotions: config?.emotions  // Nuevo: registrar la lista de emojis que usan este archivo
        })
        console.log(`Archivo de emoji guardado: ${key} - ${file.name}`)
      } catch (error) {
        console.warn(`Error al guardar el archivo de emoji: ${emojiName}`, error)
      }
    }
  }

  /**
   * Proporciona guardado automático para archivos de fondo.
   * @param {string} mode - modo ('light' o 'dark')
   * @param {File} file - El archivo de fondo
   * @param {Object} config - Configuración de fondo
   * @returns {Promise<void>}
   */
  static async saveBackgroundFile(mode, file, config = {}) {
    if (file && mode) {
      const key = `background_${mode}`
      try {
        let safeConfig = {}
        try {
          safeConfig = config ? JSON.parse(JSON.stringify(config)) : {}
        } catch (e) {
          safeConfig = { ...config }
        }

        await configStorage.saveFile(key, file, 'background', {
          mode,
          ...safeConfig
        })
        console.log(`Archivo de fondo guardado: ${mode} - ${file.name}`)
      } catch (error) {
        console.warn(`Error al guardar el archivo de fondo: ${mode}`, error)
      }
    }
  }

  /**
   * Restaura el archivo de fuente.
   * @returns {Promise<File|null>}
   */
  static async restoreFontFile() {
    try {
      return await configStorage.loadFile('custom_font')
    } catch (error) {
      console.warn('Error al restaurar el archivo de fuente:', error)
      return null
    }
  }

  /**
   * Restaura el archivo de emoji.
   * @param {string} emojiName - Nombre del emoji o hash del archivo (si comienza con hash_)
   * @returns {Promise<File|null>}
   */
  static async restoreEmojiFile(emojiName) {
    if (!emojiName) return null

    try {
      // Si emojiName ya comienza con hash_ (nueva estructura de deduplicación), úselo directamente
      // De lo contrario, agregue el prefijo emoji_ (estructura antigua, para compatibilidad con versiones anteriores)
      const key = emojiName.startsWith('hash_') ? emojiName : `emoji_${emojiName}`
      return await configStorage.loadFile(key)
    } catch (error) {
      console.warn(`Error al restaurar el archivo de emoji: ${emojiName}`, error)
      return null
    }
  }

  /**
   * Restaura el archivo de fondo.
   * @param {string} mode - modo ('light' o 'dark')
   * @returns {Promise<File|null>}
   */
  static async restoreBackgroundFile(mode) {
    if (!mode) return null

    try {
      const key = `background_${mode}`
      return await configStorage.loadFile(key)
    } catch (error) {
      console.warn(`Error al restaurar el archivo de fondo: ${mode}`, error)
      return null
    }
  }

  /**
   * Elimina el archivo de fuente.
   * @returns {Promise<void>}
   */
  static async deleteFontFile() {
    try {
      await configStorage.deleteFile('custom_font')
      console.log('Archivo de fuente eliminado')
    } catch (error) {
      console.warn('Error al eliminar el archivo de fuente:', error)
    }
  }

  /**
   * Elimina el archivo de emoji.
   * @param {string} emojiName - Nombre del emoji o hash del archivo (si comienza con hash_)
   * @returns {Promise<void>}
   */
  static async deleteEmojiFile(emojiName) {
    if (!emojiName) return

    try {
      // Si emojiName ya comienza con hash_ (nueva estructura de deduplicación), úselo directamente
      // De lo contrario, agregue el prefijo emoji_ (estructura antigua, para compatibilidad con versiones anteriores)
      const key = emojiName.startsWith('hash_') ? emojiName : `emoji_${emojiName}`
      await configStorage.deleteFile(key)
      console.log(`Archivo de emoji eliminado: ${key}`)
    } catch (error) {
      console.warn(`Error al eliminar el archivo de emoji: ${emojiName}`, error)
    }
  }

  /**
   * Elimina el archivo de fondo.
   * @param {string} mode - modo ('light' o 'dark')
   * @returns {Promise<void>}
   */
  static async deleteBackgroundFile(mode) {
    if (!mode) return

    try {
      const key = `background_${mode}`
      await configStorage.deleteFile(key)
      console.log(`Archivo de fondo eliminado: ${mode}`)
    } catch (error) {
      console.warn(`Error al eliminar el archivo de fondo: ${mode}`, error)
    }
  }

  /**
   * Obtiene información de almacenamiento de archivos.
   * @returns {Promise<Object>}
   */
  static async getStorageInfo() {
    try {
      return await configStorage.getStorageInfo()
    } catch (error) {
      console.warn('Error al obtener la información de almacenamiento:', error)
      return {
        configs: { count: 0 },
        files: { count: 0 },
        temp_data: { count: 0 },
        lastSaved: null
      }
    }
  }

  /**
   * Limpia todo el almacenamiento de archivos.
   * @returns {Promise<void>}
   */
  static async clearAllFiles() {
    try {
      await configStorage.clearAll()
      console.log('Todos los archivos almacenados han sido limpiados')
    } catch (error) {
      console.warn('Error al limpiar los archivos almacenados:', error)
      throw error
    }
  }
}

export default StorageHelper
