class WebSocketTransfer {
  constructor(token) {
    this.token = token
    this.ws = null
    this.isConnected = false
    this.isCancelled = false
    this.chunkSize = 64 * 1024 // 64KB per chunk
    this.onProgress = null
    this.onError = null
    this.onComplete = null
    this.onDownloadUrlReady = null
    this.onTransferStarted = null // Nuevo: devolución de llamada del evento transfer_started
    this.currentSession = null
    this.totalBytesSent = 0 // Nuevo: seguimiento del total de bytes enviados
    this.isSendingChunk = false // Nuevo: marca para indicar si se está enviando un fragmento de datos
  }

  // Conectar al servidor de transferencia
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // Usar la dirección fija del servidor de transferencia
        //const wsUrl = `wss://api.tenclass.net/transfer/?token=${encodeURIComponent(this.token)}`
        const wsUrl= `wss://api.xiaozhi.me/mcp/?token=${encodeURIComponent(this.token)}`
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          this.isConnected = true
          console.log('WebSocket connected to transfer server')
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event)
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.isConnected = false
          reject(new Error('WebSocket connection failed'))
        }

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason)
          this.isConnected = false
        }

        // Establecer tiempo de espera de conexión
        setTimeout(() => {
          if (!this.isConnected) {
            this.ws.close()
            reject(new Error('WebSocket connection timeout'))
          }
        }, 10000)

      } catch (error) {
        reject(new Error(`Failed to create WebSocket connection: ${error.message}`))
      }
    })
  }

  // Manejar mensajes de WebSocket
  handleMessage(event) {
    try {
      if (typeof event.data === 'string') {
        const message = JSON.parse(event.data)

        switch (message.type) {
          case 'file_created':
            if (this.currentSession) {
              this.currentSession.url = message.url
              // Notificar que la URL de descarga está lista
              if (this.onDownloadUrlReady) {
                this.onDownloadUrlReady(message.url)
              }
              // Esperar el mensaje transfer_started antes de comenzar a enviar datos
            }
            break

          case 'transfer_started':
            if (this.currentSession) {
              // Marcar que se ha recibido el mensaje transfer_started
              this.currentSession.transferStarted = true

              // Notificar a los oyentes externos
              if (this.onTransferStarted) {
                this.onTransferStarted()
              }

              // Si la transferencia está lista, comenzar a enviar los datos del archivo
              if (this.currentSession.transferReady) {
                this.sendFileData()
              }
            }
            break

          case 'ack':
            // Recibido el acuse de recibo, validar y actualizar bytesSent
            if (this.currentSession) {
              const { blob } = this.currentSession
              const totalSize = blob.size
              const serverBytesSent = message.bytesSent

              // Validar los bytesSent informados por el servidor
              if (serverBytesSent < 0) {
                console.error('Invalid server bytesSent (negative):', serverBytesSent)
                this.isSendingChunk = false // Restablecer la marca de envío
                if (this.onError) {
                  this.onError(new Error('Server returned invalid byte count'))
                }
                return
              }

              if (serverBytesSent > totalSize) {
                console.error(`Server bytesSent (${serverBytesSent}) exceeds fileSize (${totalSize})`)
                this.isSendingChunk = false // Restablecer la marca de envío
                if (this.onError) {
                  this.onError(new Error('Server byte count exceeds file size'))
                }
                return
              }

              // Marcar el fragmento de datos actual como enviado
              this.isSendingChunk = false

              // Usar los bytesSent confirmados por el servidor
              if (serverBytesSent > this.currentSession.bytesSent) {
                this.currentSession.bytesSent = serverBytesSent
              }

              // Enviar el siguiente fragmento de datos
              this.sendFileData()
            }
            break

          case 'transfer_completed':
            // Validar la integridad de la transferencia
            if (this.currentSession) {
              const expectedSize = this.currentSession.blob.size
              if (this.totalBytesSent !== expectedSize) {
                console.warn(`Transfer size mismatch: sent ${this.totalBytesSent} bytes, expected ${expectedSize} bytes`)
              }
            }

            if (this.onComplete) {
              this.onComplete()
            }
            break

          case 'error':
            console.error('Transfer error:', message.message)
            if (this.onError) {
              this.onError(new Error(message.message))
            }
            break
        }
      }
    } catch (error) {
      console.error('Error handling message:', error)
      if (this.onError) {
        this.onError(error)
      }
    }
  }

  // Enviar datos del archivo
  async sendFileData() {
    // Evitar envíos concurrentes
    if (this.isSendingChunk) {
      return
    }

    if (!this.currentSession || this.isCancelled) {
      return
    }

    const { blob } = this.currentSession
    const totalSize = blob.size
    let bytesSent = this.currentSession.bytesSent

    // Comprobación estricta: asegurarse de no enviar datos que excedan el tamaño del archivo
    if (bytesSent >= totalSize) {
      if (this.onProgress) {
        this.onProgress(100, 'Transfer completed, waiting for device confirmation...')
      }
      return
    }

    this.isSendingChunk = true

    // Validar de nuevo que bytesSent no exceda el tamaño del archivo
    if (bytesSent > totalSize) {
      console.error(`Critical error: bytesSent (${bytesSent}) exceeds fileSize (${totalSize})`)
      if (this.onError) {
        this.onError(new Error('Transfer byte count exceeds file size'))
      }
      return
    }

    // Calcular el tamaño del siguiente fragmento, asegurándose de no exceder los límites del archivo
    const remainingBytes = Math.max(0, totalSize - bytesSent)
    const chunkSize = Math.min(this.chunkSize, remainingBytes)

    if (chunkSize <= 0) {
      return
    }

    const chunk = blob.slice(bytesSent, bytesSent + chunkSize)

    try {
      // Leer el fragmento del archivo
      const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('File read failed'))
        reader.readAsArrayBuffer(chunk)
      })

      if (this.isCancelled) {
        return
      }

      // Enviar datos binarios
      this.ws.send(arrayBuffer)

      // Actualizar el recuento de bytesSent local (actualización optimista)
      const newBytesSent = bytesSent + chunkSize
      this.currentSession.bytesSent = newBytesSent
      this.totalBytesSent += chunkSize // Actualizar el total de bytes enviados
      // Validar que el bytesSent actualizado no exceda el tamaño del archivo
      if (newBytesSent > totalSize) {
        console.error(`Critical error: bytesSent (${newBytesSent}) exceeds fileSize (${totalSize})`)
        if (this.onError) {
          this.onError(new Error('Transfer byte count exceeds file size'))
        }
        return
      }

      // Validación adicional: el total de bytes enviados tampoco debe exceder el tamaño del archivo
      if (this.totalBytesSent > totalSize) {
        console.error(`Critical error: totalBytesSent (${this.totalBytesSent}) exceeds fileSize (${totalSize})`)
        if (this.onError) {
          this.onError(new Error('Total sent bytes exceed file size'))
        }
        return
      }

      // Actualizar el progreso (solo la parte de la transferencia)
      const transferProgress = Math.round(newBytesSent / totalSize * 60) + 40 // Rango 40-100
      const step = `Transferring... ${Math.round(newBytesSent / 1024)}KB / ${Math.round(totalSize / 1024)}KB`

      if (this.onProgress) {
        this.onProgress(transferProgress, step)
      }

    } catch (error) {
      console.error('Error sending file chunk:', error)
      this.isSendingChunk = false // Restablecer la marca de envío
      if (this.onError) {
        this.onError(error)
      }
    }
  }

  // Inicializar la sesión de transferencia (solo establece la conexión y obtiene la URL)
  async initializeSession(blob, onProgress, onError, onDownloadUrlReady) {
    return new Promise((resolve, reject) => {
      this.onProgress = onProgress
      this.onError = (error) => {
        if (onError) onError(error)
        reject(error)
      }
      this.onDownloadUrlReady = (url) => {
        if (onDownloadUrlReady) onDownloadUrlReady(url)
        resolve(url)
      }
      this.isCancelled = false

      try {
        // Conectar al servidor WebSocket
        if (this.onProgress) {
          this.onProgress(5, 'Connecting to transfer server...')
        }

        this.connect().then(() => {
          // Enviar solicitud de creación de archivo
          if (this.onProgress) {
            this.onProgress(10, 'Creating file session...')
          }

          const createMessage = {
            type: 'create_file',
            fileName: 'assets.bin',
            fileSize: blob.size
          }

          this.ws.send(JSON.stringify(createMessage))

          // Guardar la referencia del blob, esperar el mensaje file_created
          this.currentSession = {
            blob: blob,
            bytesSent: 0,
            fileSize: blob.size,
            transferStarted: false,
            transferReady: true // Establecer en true en la inicialización, ya que la transferencia puede comenzar después de initializeSession
          }
          // Restablecer el total de bytes enviados
          this.totalBytesSent = 0
        }).catch(error => {
          console.error('Transfer initialization failed:', error)
          if (this.onError) {
            this.onError(error)
          }
        })

      } catch (error) {
        console.error('Transfer initialization failed:', error)
        if (this.onError) {
          this.onError(error)
        }
      }
    })
  }

  // Comenzar a transferir los datos del archivo (suponiendo que la sesión ya ha sido inicializada)
  async startTransfer(onProgress, onError, onComplete) {
    return new Promise((resolve, reject) => {
      this.onProgress = onProgress
      this.onError = (error) => {
        this.isSendingChunk = false // Restablecer la marca de envío
        if (onError) onError(error)
        reject(error)
      }
      this.onComplete = () => {
        this.isSendingChunk = false // Restablecer la marca de envío
        if (onComplete) onComplete()
        resolve()
      }

      if (!this.currentSession || !this.currentSession.blob) {
        const error = new Error('Transfer session not initialized')
        if (this.onError) this.onError(error)
        reject(error)
        return
      }

      // Establecer el estado de la transferencia, esperar el mensaje transfer_started
      this.currentSession.transferReady = true

      // Si ya se ha recibido el mensaje transfer_started, comenzar la transferencia
      if (this.currentSession.transferStarted) {
        this.sendFileData()
      } else {
      }
      // De lo contrario, esperar el mensaje transfer_started
    })
  }

  // Iniciar la transferencia de archivos
  async transferFile(blob, onProgress, onError, onComplete, onDownloadUrlReady) {
    // Si se proporciona la devolución de llamada onDownloadUrlReady, usar la transferencia por etapas
    if (onDownloadUrlReady) {
      await this.initializeSession(blob, onProgress, onError, onDownloadUrlReady)
      // Devolver, para que el llamador decida cuándo comenzar la transferencia
      return
    }

    // De lo contrario, usar la transferencia tradicional de una sola vez
    this.onProgress = onProgress
    this.onError = onError
    this.onComplete = onComplete
    this.isCancelled = false

    try {
      // Conectar al servidor WebSocket
      if (this.onProgress) {
        this.onProgress(5, 'Connecting to transfer server...')
      }

      await this.connect()

      // Enviar solicitud de creación de archivo
      if (this.onProgress) {
        this.onProgress(10, 'Creating file session...')
      }

      const createMessage = {
        type: 'create_file',
        fileName: 'assets.bin',
        fileSize: blob.size
      }

      this.ws.send(JSON.stringify(createMessage))

      // Guardar la referencia del blob, esperar el mensaje file_created
      this.currentSession = {
        blob: blob,
        bytesSent: 0,
        fileSize: blob.size,
        transferStarted: false,
        transferReady: true // Establecer en true directamente en el modo tradicional
      }

    } catch (error) {
      console.error('Transfer initialization failed:', error)
      if (this.onError) {
        this.onError(error)
      }
    }
  }

  // Cancelar la transferencia
  cancel() {
    this.isCancelled = true
    this.isSendingChunk = false // Restablecer la marca de envío
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
    }
  }

  // Limpiar recursos
  destroy() {
    this.cancel()
    this.onProgress = null
    this.onError = null
    this.onComplete = null
    this.onDownloadUrlReady = null
    this.onTransferStarted = null
    this.totalBytesSent = 0
    this.isSendingChunk = false
  }
}

export default WebSocketTransfer
