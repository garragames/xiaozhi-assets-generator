/**
 * ConfigStorage class
 * An IndexedDB storage for managing configurations and files
 *
 * Primary functions:
 * - Stores and restores user configurations
 * - Stores and restores user-uploaded files
 * - Provides functionality to clear configurations
 */


class ConfigStorage {
  constructor() {
    this.dbName = 'XiaozhiConfigDB'
    this.version = 1
    this.db = null
    this.initialized = false
  }

  /**
   * Initialize IndexedDB
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized && this.db) {
      return
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        console.error('IndexedDB Initialization failed:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.initialized = true
        console.log('IndexedDB Initialization successful')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        // Create configuration store
        if (!db.objectStoreNames.contains('configs')) {
          const configStore = db.createObjectStore('configs', { keyPath: 'key' })
          configStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // Create file store
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' })
          fileStore.createIndex('type', 'type', { unique: false })
          fileStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // Create temporary store (for converted fonts, etc.)
        if (!db.objectStoreNames.contains('temp_data')) {
          const tempStore = db.createObjectStore('temp_data', { keyPath: 'key' })
          tempStore.createIndex('type', 'type', { unique: false })
          tempStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        console.log('IndexedDB Table structure creation completed')
      }
    })
  }

  /**
   * Save configuration to IndexedDB
   * @param {Object} config - Complete configuration object
   * @returns {Promise<void>}
   */
  async saveConfig(config) {
    if (!this.initialized) {
      await this.initialize()
    }

    const sanitizedConfig = this.sanitizeConfigForStorage(config)

    const configData = {
      key: 'current_config',
      config: sanitizedConfig, // Deep copy and remove non-serializable fields
      timestamp: Date.now()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['configs'], 'readwrite')
      const store = transaction.objectStore('configs')
      const request = store.put(configData)

      request.onerror = () => {
        console.error('Failed to save configuration:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log('Configuration saved to IndexedDB')
        resolve()
      }
    })
  }

  /**
   * Generate a configuration object safe for storage
   * - Set non-serializable fields like File/Blob to null
   * - Retain keys of images to allow restoration by key from storage
   */
  sanitizeConfigForStorage(config) {
    const cloned = JSON.parse(JSON.stringify(config || {}))

    try {
      // Font files (always retain custom configuration, even if the current selection is a preset font)
      if (cloned?.theme?.font?.custom) {
        // Retain custom configuration but set file to null
        cloned.theme.font.custom.file = null
      }

      // Emoji images (support new hash deduplication structure)
      if (cloned?.theme?.emoji?.type === 'custom') {
        if (!cloned.theme.emoji.custom) cloned.theme.emoji.custom = {}
        
        // Retain old structure images (set to null)
        const images = cloned.theme.emoji?.custom?.images || {}
        const sanitizedImages = {}
        Object.keys(images).forEach((k) => {
          sanitizedImages[k] = null
        })
        cloned.theme.emoji.custom.images = sanitizedImages
        
        // Retain new structure emotionMap (emotion -> hash mapping)
        if (cloned.theme.emoji.custom.emotionMap) {
          // emotionMap only contains string mappings and can be retained directly
          // No processing needed as it does not contain File objects
        }
        
        // Clean up fileMap (hash -> File mapping), set File objects to null
        if (cloned.theme.emoji.custom.fileMap) {
          const fileMap = cloned.theme.emoji.custom.fileMap
          const sanitizedFileMap = {}
          Object.keys(fileMap).forEach((hash) => {
            sanitizedFileMap[hash] = null
          })
          cloned.theme.emoji.custom.fileMap = sanitizedFileMap
        }
      }

      // Background images
      if (cloned?.theme?.skin?.light) {
        cloned.theme.skin.light.backgroundImage = null
      }
      if (cloned?.theme?.skin?.dark) {
        cloned.theme.skin.dark.backgroundImage = null
      }
    } catch (e) {
      // Ignore sanitization errors and return the cloned object
    }

    return cloned
  }

  /**
   * Load configuration from IndexedDB
   * @returns {Promise<Object|null>} Configuration data or null
   */
  async loadConfig() {
    if (!this.initialized) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['configs'], 'readonly')
      const store = transaction.objectStore('configs')
      const request = store.get('current_config')

      request.onerror = () => {
        console.error('Failed to load configuration:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        const result = request.result
        if (result) {
          console.log('Configuration successfully restored from IndexedDB')
          resolve({
            config: result.config,
            timestamp: result.timestamp
          })
        } else {
          resolve(null)
        }
      }
    })
  }

  /**
   * Save file to IndexedDB
   * @param {string} id - File ID
   * @param {File} file - File object
   * @param {string} type - File type (font, emoji, background)
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async saveFile(id, file, type, metadata = {}) {
    if (!this.initialized) {
      await this.initialize()
    }

    // Convert file to ArrayBuffer for storage
    const arrayBuffer = await this.fileToArrayBuffer(file)

    // Ensure metadata is structurally cloneable (remove Proxy/Ref/cycles, etc.)
    let safeMetadata = {}
    try {
      safeMetadata = metadata ? JSON.parse(JSON.stringify(metadata)) : {}
    } catch (e) {
      // Fallback to a shallow copy of a plain object
      safeMetadata = { ...metadata }
    }

    const fileData = {
      id,
      type,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      lastModified: file.lastModified,
      data: arrayBuffer,
      metadata: safeMetadata,
      timestamp: Date.now()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readwrite')
      const store = transaction.objectStore('files')
      const request = store.put(fileData)

      request.onerror = () => {
        console.error('Failed to save file:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log(`File ${file.name} has been saved to IndexedDB`)
        resolve()
      }
    })
  }

  /**
   * Load file from IndexedDB
   * @param {string} id - File ID
   * @returns {Promise<File|null>} File object or null
   */
  async loadFile(id) {
    if (!this.initialized) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readonly')
      const store = transaction.objectStore('files')
      const request = store.get(id)

      request.onerror = () => {
        console.error('Failed to load file:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        const result = request.result
        if (result) {
          // Convert ArrayBuffer back to File object
          const blob = new Blob([result.data], { type: result.mimeType })
          const file = new File([blob], result.name, {
            type: result.mimeType,
            lastModified: result.lastModified
          })

          // Add additional metadata
          file.storedId = result.id
          file.storedType = result.type
          file.storedMetadata = result.metadata
          file.storedTimestamp = result.timestamp

          console.log(`File ${result.name} has been successfully restored from IndexedDB`)
          resolve(file)
        } else {
          resolve(null)
        }
      }
    })
  }

  /**
   * Get all files of a specific type
   * @param {string} type - File type
   * @returns {Promise<Array>} List of files
   */
  async getFilesByType(type) {
    if (!this.initialized) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readonly')
      const store = transaction.objectStore('files')
      const index = store.index('type')
      const request = index.getAll(type)

      request.onerror = () => {
        console.error('Failed to retrieve file list:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        const results = request.result || []
        const files = results.map(result => {
          const blob = new Blob([result.data], { type: result.mimeType })
          const file = new File([blob], result.name, {
            type: result.mimeType,
            lastModified: result.lastModified
          })

          file.storedId = result.id
          file.storedType = result.type
          file.storedMetadata = result.metadata
          file.storedTimestamp = result.timestamp

          return file
        })

        resolve(files)
      }
    })
  }

  /**
   * Save temporary data (e.g., converted fonts, etc.)
   * @param {string} key - Data key
   * @param {ArrayBuffer} data - Data
   * @param {string} type - Data type
   * @param {Object} metadata - Metadata
   * @returns {Promise<void>}
   */
  async saveTempData(key, data, type, metadata = {}) {
    if (!this.initialized) {
      await this.initialize()
    }

    const tempData = {
      key,
      type,
      data,
      metadata,
      timestamp: Date.now()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['temp_data'], 'readwrite')
      const store = transaction.objectStore('temp_data')
      const request = store.put(tempData)

      request.onerror = () => {
        console.error('Failed to save temporary data:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log(`Temporary data ${key} has been saved`)
        resolve()
      }
    })
  }

  /**
   * Load temporary data
   * @param {string} key - Data key
   * @returns {Promise<Object|null>} Temporary data or null
   */
  async loadTempData(key) {
    if (!this.initialized) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['temp_data'], 'readonly')
      const store = transaction.objectStore('temp_data')
      const request = store.get(key)

      request.onerror = () => {
        console.error('Failed to load temporary data:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        const result = request.result
        resolve(result || null)
      }
    })
  }

  /**
   * Clear all stored data
   * @returns {Promise<void>}
   */
  async clearAll() {
    if (!this.initialized) {
      await this.initialize()
    }

    const storeNames = ['configs', 'files', 'temp_data']
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeNames, 'readwrite')
      let completedStores = 0
      let hasError = false

      const checkComplete = () => {
        completedStores++
        if (completedStores === storeNames.length) {
          if (hasError) {
            reject(new Error('Error occurred while clearing some data'))
          } else {
            console.log('All stored data has been cleared')
            resolve()
          }
        }
      }

      storeNames.forEach(storeName => {
        const store = transaction.objectStore(storeName)
        const request = store.clear()

        request.onerror = () => {
          console.error(`Clear ${storeName} Failure:`, request.error)
          hasError = true
          checkComplete()
        }

        request.onsuccess = () => {
          console.log(`${storeName} Cleared`)
          checkComplete()
        }
      })
    })
  }

  /**
   * Delete a specific file
   * @param {string} id - File ID
   * @returns {Promise<void>}
   */
  async deleteFile(id) {
    if (!this.initialized) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readwrite')
      const store = transaction.objectStore('files')
      const request = store.delete(id)

      request.onerror = () => {
        console.error('Failed to delete file:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log(`File ${id} has been deleted`)
        resolve()
      }
    })
  }

  /**
   * Get storage usage information
   * @returns {Promise<Object>} Storage statistics
   */
  async getStorageInfo() {
    if (!this.initialized) {
      await this.initialize()
    }

    const storeNames = ['configs', 'files', 'temp_data']
    const info = {}

    for (const storeName of storeNames) {
      const count = await new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readonly')
        const store = transaction.objectStore(storeName)
        const request = store.count()

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
      })

      info[storeName] = { count }
    }

    // Get the last saved configuration time
    const configData = await this.loadConfig()
    info.lastSaved = configData ? new Date(configData.timestamp) : null

    return info
  }

  /**
   * Check if there is a stored configuration
   * @returns {Promise<boolean>}
   */
  async hasStoredConfig() {
    try {
      const config = await this.loadConfig()
      return config !== null
    } catch (error) {
      console.error('Error checking stored configuration:', error)
      return false
    }
  }

  /**
   * Convert a file to an ArrayBuffer
   * @param {File} file - File object
   * @returns {Promise<ArrayBuffer>}
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
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initialized = false
      console.log('IndexedDB connection has been closed')
    }
  }
}

// Create a singleton instance
const configStorage = new ConfigStorage()

export default configStorage
