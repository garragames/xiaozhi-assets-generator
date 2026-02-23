// Custom Error type to simplify error messaging
// Versión ES6

class AppError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AppError'
    
    // Mantener el seguimiento de la pila (solo disponible en el motor V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }
}

export default AppError
