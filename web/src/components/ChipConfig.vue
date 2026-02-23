<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold text-gray-900 mb-4">{{ $t('chipConfig.title') }}</h2>
      <p class="text-gray-600 mb-6">
        <span v-if="isLoadingConfig">{{ $t('chipConfig.loadingFromDevice') }}</span>
        <span v-else-if="deviceConfigLoaded">{{ $t('chipConfig.loadedFromDevice') }}</span>
        <span v-else>{{ $t('chipConfig.manualConfig') }}</span>
      </p>
    </div>

    <!-- Estado de carga -->
    <div v-if="isLoadingConfig" class="space-y-4">
      <div class="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
        <div class="flex items-center justify-center space-x-3">
          <!-- Animación de carga -->
          <svg class="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div>
            <h3 class="text-lg font-medium text-blue-900">{{ $t('chipConfig.loadingTitle') }}</h3>
            <p class="text-sm text-blue-700 mt-1">{{ $t('chipConfig.loadingDesc') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Dispositivo en línea: mostrar configuración cargada automáticamente -->
    <div v-else-if="isDeviceOnline && deviceConfigLoaded" class="space-y-4">
      <div class="bg-green-50 border-2 border-green-200 rounded-lg p-4">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center">
            <div class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mr-2">
              <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            </div>
            <h3 class="text-lg font-medium text-green-900">{{ $t('chipConfig.autoLoadedTitle') }}</h3>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div class="bg-white rounded-lg p-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('chipConfig.chipModel') }}</label>
            <div class="text-base font-semibold text-gray-900">{{ currentChipModel }}</div>
          </div>
          
          <div class="bg-white rounded-lg p-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('chipConfig.screenWidth') }}</label>
            <div class="text-base font-semibold text-gray-900">{{ currentDisplay.width }} px</div>
          </div>
          
          <div class="bg-white rounded-lg p-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('chipConfig.screenHeight') }}</label>
            <div class="text-base font-semibold text-gray-900">{{ currentDisplay.height }} px</div>
          </div>
        </div>

        <div class="mt-3 text-sm text-green-700">
          ✓ {{ $t('chipConfig.colorFormat') }} {{ currentDisplay.color }}
        </div>
      </div>

      <!-- Opcional: configuración manual -->
      <div class="border border-gray-200 rounded-lg p-4">
        <button 
          @click="toggleManualEdit"
          class="flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          {{ showManualEdit ? $t('chipConfig.collapseManual') : $t('chipConfig.manualEdit') }}
        </button>
        
        <!-- Usar formulario de configuración reutilizable -->
        <div v-if="showManualEdit" class="mt-4">
          <ConfigForm :config="customConfig" /></div>
      </div>
    </div>

    <!-- Dispositivo sin conexión o carga fallida: mostrar configuración manual -->
    <div v-else class="space-y-4">
      <!-- Mensaje de advertencia -->
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div class="flex items-start">
          <svg class="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
          </svg>
          <div>
            <h4 class="font-medium text-yellow-900">{{ $t('chipConfig.manualConfigDesc') }}</h4>
            <p class="text-sm text-yellow-700 mt-1">
              {{ loadingError || $t('chipConfig.manualConfigHint') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Formulario de configuración manual -->
      <div class="border-2 border-gray-300 rounded-lg p-4">
        <h3 class="text-lg font-medium text-gray-900 mb-4">{{ $t('chipConfig.manualConfigTitle') }}</h3>
        <ConfigForm :config="customConfig" :show-required="true" />
      </div>
    </div>

    <!-- Botón Siguiente -->
    <div class="flex justify-end">
      <button 
        @click="handleNext"
        :disabled="!hasValidConfig"
        class="bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg font-medium transition-colors"
      >
        {{ $t('chipConfig.next') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, h, unref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDeviceStatus } from '@/composables/useDeviceStatus'

const { t } = useI18n()

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      model: '',
      display: {
        width: 320,
        height: 240,
        color: 'RGB565'
      },
    })
  }
})

const emit = defineEmits(['update:modelValue', 'next'])

// Constante de opciones del modelo de chip
const CHIP_OPTIONS = computed(() => [
  { value: '', label: t('chipConfig.selectChip') },
  { value: 'esp32s3', label: 'ESP32-S3' },
  { value: 'esp32c3', label: 'ESP32-C3' },
  { value: 'esp32c5', label: 'ESP32-C5' },
  { value: 'esp32c6', label: 'ESP32-C6' },
  { value: 'esp32p4', label: 'ESP32-P4' },
  { value: 'esp32', label: 'ESP32' },
  { value: 'others', label: t('common.other') }
])

// Definir componentes de formulario de configuración reutilizables (usando funciones de renderizado)
const ConfigForm = {
  name: 'ConfigForm',
  props: {
    config: {
      type: Object,
      required: true
    },
    showRequired: {
      type: Boolean,
      default: false
    }
  },
  render() {
    const t = this.$t
    return h('div', { class: 'grid grid-cols-1 md:grid-cols-3 gap-4' }, [
      // Selección del modelo de chip
      h('div', [
        h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, [
          t('chipConfig.chipRequired') + ' ',
          this.showRequired && h('span', { class: 'text-red-500' }, '*')
        ]),
        h('select', {
          class: 'w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
          value: this.config.model,
          onChange: (e) => { this.config.model = e.target.value }
        }, unref(CHIP_OPTIONS).map(option =>
          h('option', { value: option.value, key: option.value }, option.label)
        ))
      ]),

      // Ancho de la pantalla
      h('div', [
        h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, [
          t('chipConfig.widthRequired') + ' ',
          this.showRequired && h('span', { class: 'text-red-500' }, '*')
        ]),
        h('input', {
          type: 'number',
          class: 'w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
          value: this.config.display.width,
          min: 128,
          max: 800,
          placeholder: '320',
          onInput: (e) => { this.config.display.width = Number(e.target.value) }
        })
      ]),

      // Altura de la pantalla
      h('div', [
        h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, [
          t('chipConfig.heightRequired') + ' ',
          this.showRequired && h('span', { class: 'text-red-500' }, '*')
        ]),
        h('input', {
          type: 'number',
          class: 'w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
          value: this.config.display.height,
          min: 128,
          max: 600,
          placeholder: '240',
          onInput: (e) => { this.config.display.height = Number(e.target.value) }
        })
      ])
    ])
  }
}

// Usando el estado del dispositivo compartido
const {
  deviceInfo,
  isDeviceOnline,
  hasToken
} = useDeviceStatus()

// Estado local
// Si existe un token, el estado inicial debe ser de carga (ya que intenta conectarse al dispositivo).
const isLoadingConfig = ref(hasToken.value) 
const deviceConfigLoaded = ref(false)
const loadingError = ref('')
const showManualEdit = ref(false)

const customConfig = ref({
  model: '',
  display: {
    width: 320,
    height: 240,
    color: 'RGB565'
  }
})

// Mapeo del modelo de chip (mapea el modelo informado por el dispositivo a los valores de las opciones)
const chipModelMapping = {
  'ESP32-S3': 'esp32s3',
  'ESP32S3': 'esp32s3',
  'ESP32-C3': 'esp32c3',
  'ESP32C3': 'esp32c3',
  'ESP32-C5': 'esp32c5',
  'ESP32C5': 'esp32c5',
  'ESP32-P4': 'esp32p4',
  'ESP32P4': 'esp32p4',
  'ESP32-C6': 'esp32c6',
  'ESP32C6': 'esp32c6',
  'ESP32': 'esp32'
}

// Cargar la configuración desde la información del dispositivo
const loadConfigFromDevice = () => {
  try {
    // Comprobar si el equipo está en línea
    if (!isDeviceOnline.value) {
      // Cuando el dispositivo está fuera de línea, si todavía está en estado de carga, no falla inmediatamente (puede que esté intentando conectarse).
      if (!isLoadingConfig.value) {
        loadingError.value = t('chipConfig.deviceOffline')
        deviceConfigLoaded.value = false
      }
      return false
    }

    // Recuperar el modelo de chip
    const chipModel = deviceInfo.value.chip?.model
    if (!chipModel || chipModel === 'Desconocido') {
      // Si todavía se está cargando (antes del tiempo de espera de 5 segundos), no fallar inmediatamente, esperar la actualización de los datos
      // Solo establecer el error en caso de fallo explícito o tiempo de espera agotado
      return false
    }

    // Mapear modelo de chip
    let mappedChip = chipModelMapping[chipModel.toUpperCase()] ||
                     chipModelMapping[chipModel] ||
                     chipModel.toLowerCase().replace(/-/g, '')

    // Si el resultado del mapeo no se encuentra entre las opciones conocidas, establecerlo como otros
    // 
    const validChipModels = ['esp32s3', 'esp32c3', 'esp32c5', 'esp32p4', 'esp32c6', 'esp32', 'others']
    if (!validChipModels.includes(mappedChip)) {
      mappedChip = 'others'
    }

    // Obtener la resolución de la pantalla
    const resolution = deviceInfo.value.screen?.resolution
    if (!resolution || resolution === 'Desconocido') {
      // Del mismo modo, no fallar inmediatamente durante la carga
      return false
    }

    // Analizar la resolución
    const [width, height] = resolution.split('x').map(Number)
    if (!width || !height || isNaN(width) || isNaN(height)) {
      loadingError.value = t('chipConfig.resolutionFormatError')
      deviceConfigLoaded.value = false
      isLoadingConfig.value = false
      return false
    }

    // Establecer la configuración
    customConfig.value = {
      model: mappedChip,
      display: {
        width,
        height,
        color: 'RGB565'
      }
    }

    // Actualizar el componente principal
    emit('update:modelValue', {
      model: mappedChip,
      display: {
        width,
        height,
        color: 'RGB565'
      },
    })

    deviceConfigLoaded.value = true
    loadingError.value = ''
    isLoadingConfig.value = false
    console.log('✓ Configuración del dispositivo cargada correctamente:', { chip: mappedChip, width, height })
    return true

  } catch (error) {
    console.error('Error al cargar la configuración del dispositivo:', error)
    loadingError.value = t('chipConfig.loadingError')
    deviceConfigLoaded.value = false
    isLoadingConfig.value = false
    return false
  }
}

// Propiedades computadas
const hasValidConfig = computed(() => {
  return customConfig.value.model && 
         customConfig.value.display.width && 
         customConfig.value.display.height
})

const currentChipModel = computed(() => {
  if (!customConfig.value.model) return ''
  return customConfig.value.model.toUpperCase().replace(/ESP32/i, 'ESP32-')
})

const currentDisplay = computed(() => {
  return customConfig.value.display
})

// Alternar edición manual
const toggleManualEdit = () => {
  showManualEdit.value = !showManualEdit.value
}

// Siguiente paso
const handleNext = () => {
  if (hasValidConfig.value) {
    emit('next')
  }
}

// Observar los cambios en la configuración personalizada
watch(() => customConfig.value, (newVal) => {
  emit('update:modelValue', {
    model: newVal.model,
    display: { ...newVal.display }
  })
}, { deep: true })

// Observar los cambios en el estado en línea del dispositivo
watch(() => isDeviceOnline.value, (online) => {
  if (online && !deviceConfigLoaded.value) {
    // Intentar cargar la configuración inmediatamente después de que el dispositivo se conecte (eliminar retrasos innecesarios)
    isLoadingConfig.value = true
    loadingError.value = '' // Limpiar errores de tiempo de espera anteriores
    // Usar nextTick para asegurarse de que el estado se actualice antes de la carga
    setTimeout(() => {
      loadConfigFromDevice()
    }, 100) // Reducido a 100 ms, solo para garantizar la sincronización del estado
  }
})

// Observar los cambios en la información del dispositivo
watch(() => [deviceInfo.value.chip, deviceInfo.value.screen], () => {
  if (isDeviceOnline.value && !deviceConfigLoaded.value) {
    loadConfigFromDevice()
  }
}, { deep: true })

// Intentar cargar la configuración del dispositivo al montar el componente
onMounted(() => {
  // Si no hay token, usar el modo de configuración manual directamente
  if (!hasToken.value) {
    isLoadingConfig.value = false
    loadingError.value = t('chipConfig.manualConfigRequired')
    console.log('⚠ No se detectó conexión del dispositivo, usando el modo de configuración manual')
    return
  }

  // Comprobar si ya hay información válida del dispositivo (posiblemente devuelta desde otra página)
  const hasValidDeviceInfo = isDeviceOnline.value && 
                             deviceInfo.value.chip && 
                             deviceInfo.value.chip.model !== 'Desconocido' &&
                             deviceInfo.value.screen && 
                             deviceInfo.value.screen.resolution !== 'Desconocido'
  
  if (hasValidDeviceInfo) {
    // Ya se tiene información del dispositivo, cargar inmediatamente (sin demora)
    console.log('✓ Información del dispositivo en caché detectada, cargando inmediatamente')
    loadConfigFromDevice()
  } else if (isDeviceOnline.value) {
    // El dispositivo está en línea pero la información no está completamente cargada, intentar después de un breve retraso
    console.log('⏳ El dispositivo está en línea, esperando que se cargue la información del dispositivo...')
    isLoadingConfig.value = true
    setTimeout(() => {
      loadConfigFromDevice()
    }, 500)
    
    // Set 10-second timeout
    setTimeout(() => {
      if (isLoadingConfig.value && !deviceConfigLoaded.value) {
        // Comprobación adicional: asegurarse de que el dispositivo todavía está en línea y la configuración no se ha cargado
        if (isDeviceOnline.value) {
          isLoadingConfig.value = false
          if (!deviceInfo.value.chip || deviceInfo.value.chip.model === 'Desconocido') {
            loadingError.value = t('chipConfig.chipModelError')
          } else if (!deviceInfo.value.screen || deviceInfo.value.screen.resolution === 'Desconocido') {
            loadingError.value = t('chipConfig.resolutionError')
          } else {
            loadingError.value = t('chipConfig.timeoutError')
          }
          console.warn('⚠ Tiempo de espera agotado para la carga de la configuración del dispositivo:', loadingError.value)
        }
      }
    }, 10000) // Extended to 10 seconds
  } else {
    // Device is temporarily offline, keep loading state and wait for device to come online
    console.log('⏳ Esperando conexión del dispositivo...')
    isLoadingConfig.value = true
    
    // Set 10-second timeout, if not connected yet, show manual configuration
    setTimeout(() => {
      if (isLoadingConfig.value && !deviceConfigLoaded.value && !isDeviceOnline.value) {
        // Additional check: only show timeout error if the device is indeed still offline
        isLoadingConfig.value = false
        loadingError.value = t('chipConfig.manualConfigHint')
        console.warn('⚠ Tiempo de espera agotado para la conexión del dispositivo')
      }
    }, 10000) // Extended to 10 seconds, giving the device more time to connect
  }
})
</script>
