<template>
  <div class="space-y-6">
    <!-- Selección de tipo de paquete de estados -->
    <div class="space-y-4">
      <div class="flex flex-wrap gap-3">
        <button
          @click="setStateType('none')"
          :class="[
            'px-4 py-2 border rounded-lg transition-colors',
            modelValue.type === 'none'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-300 hover:border-gray-400'
          ]"
        >
          {{ $t('stateConfig.noStatePack') }}
        </button>
        <button
          @click="setStateType('custom')"
          :class="[
            'px-4 py-2 border rounded-lg transition-colors',
            modelValue.type === 'custom'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-300 hover:border-gray-400'
          ]"
        >
          {{ $t('stateConfig.customStatePack') }}
        </button>
      </div>
      <p v-if="modelValue.type === 'none'" class="text-sm text-gray-500">
        {{ $t('stateConfig.noStatePackDescription') }}
      </p>
    </div>

    <div v-if="modelValue.type === 'custom'" class="space-y-6">
      <h4 class="font-medium text-gray-900">{{ $t('stateConfig.customStatePackConfig') }}</h4>

      <!-- Configuración básica -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('stateConfig.maxImageWidth') }}</label>
          <input
            type="number"
            v-model.number="localCustom.size.width"
            min="32"
            :max="maxCanvasWidth"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('stateConfig.maxImageHeight') }}</label>
          <input
            type="number"
            v-model.number="localCustom.size.height"
            min="32"
            :max="maxCanvasHeight"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
        </div>
      </div>

      <!-- Carga de imágenes de estados -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h5 class="font-medium text-gray-900">{{ $t('stateConfig.uploadStateImages') }}</h5>
          <button
            @click="addCustomState"
            class="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            {{ $t('stateConfig.addState') }}
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="state in stateList"
            :key="state.key"
            class="space-y-2"
          >
            <div class="flex items-center justify-between text-sm text-gray-700">
              <div class="flex items-center gap-2">
                <span class="text-lg">{{ state.icon }}</span>
                <span>{{ state.name }}</span>
                <span v-if="state.required" class="text-red-500">{{ $t('stateConfig.required') }}</span>
              </div>
              <button
                v-if="!state.required"
                @click="removeCustomState(state.key)"
                class="text-xs text-gray-400 hover:text-red-600"
                :title="$t('stateConfig.removeState')"
              >
                ×
              </button>
            </div>

            <div
              @drop="(e) => handleFileDrop(e, state.key)"
              @dragover.prevent
              @dragenter.prevent
              :class="[
                'border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors aspect-video flex flex-col items-center justify-center',
                modelValue.custom.images[state.key]
                  ? 'border-green-300 bg-green-50'
                  : state.required
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300 hover:border-gray-400'
              ]"
            >
              <input
                :ref="state.key + 'Input'"
                type="file"
                accept=".png,.gif,.jpg,.jpeg,.webp"
                @change="(e) => handleFileSelect(e, state.key)"
                class="hidden"
              >

              <div v-if="!modelValue.custom.images[state.key]" @click="$refs[state.key + 'Input'][0]?.click()">
                <svg class="w-6 h-6 text-gray-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
                <div class="text-xs text-gray-500">{{ $t('stateConfig.clickToUploadOrDrag') }}</div>
              </div>

              <div v-else class="w-full h-full relative">
                <img
                  v-if="getImagePreview(state.key)"
                  :src="getImagePreview(state.key)"
                  :alt="state.name"
                  class="w-full h-full object-cover rounded"
                  @error="handleImageError"
                >
                <button
                  @click.stop="removeImage(state.key)"
                  class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="text-xs text-gray-500 mt-2">
          {{ $t('stateConfig.requiredNotice') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import StorageHelper from '@/utils/StorageHelper.js'

const { t } = useI18n()

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  },
  displayWidth: {
    type: Number,
    default: 320
  },
  displayHeight: {
    type: Number,
    default: 240
  }
})

const emit = defineEmits(['update:modelValue'])

// Utilidad para calcular hash del archivo
const calculateFileHash = async (file) => {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

const defaultStates = [
  { key: 'standby', icon: '💤', required: true },
  { key: 'listening', icon: '👂' },
  { key: 'thinking', icon: '🤔' },
  { key: 'speaking', icon: '🗣️' }
]

const stateList = computed(() => {
  const customStates = props.modelValue.custom?.order || defaultStates.map(s => s.key)
  const labels = {
    standby: t('stateConfig.states.standby'),
    listening: t('stateConfig.states.listening'),
    thinking: t('stateConfig.states.thinking'),
    speaking: t('stateConfig.states.speaking'),
    sleeping: t('stateConfig.states.sleeping'),
    error: t('stateConfig.states.error')
  }

  return customStates.map((key) => {
    const base = defaultStates.find(s => s.key === key)
    const icon = base?.icon || '📦'
    return {
      key,
      name: labels[key] || key,
      icon,
      required: base?.required || false
    }
  })
})

const localCustom = ref({
  size: { width: Math.min(props.displayWidth, 320), height: Math.min(props.displayHeight, 240) }
})

const maxCanvasWidth = computed(() => props.displayWidth || 320)
const maxCanvasHeight = computed(() => props.displayHeight || 240)

const setStateType = (type) => {
  if (props.modelValue.type === type) return

  const newValue = { ...props.modelValue, type }
  if (type === 'none') {
    newValue.custom = {
      ...props.modelValue.custom,
      images: props.modelValue.custom.images || {},
      order: props.modelValue.custom.order || defaultStates.map(s => s.key)
    }
  } else if (type === 'custom') {
    newValue.custom = {
      size: props.modelValue.custom.size || localCustom.value.size,
      images: props.modelValue.custom.images || {},
      fileMap: props.modelValue.custom.fileMap || {},
      stateMap: props.modelValue.custom.stateMap || {},
      order: props.modelValue.custom.order || defaultStates.map(s => s.key)
    }
  }
  emit('update:modelValue', newValue)
}

const handleFileSelect = (event, stateKey) => {
  const file = event.target.files[0]
  if (file) updateStateImage(stateKey, file)
}

const handleFileDrop = (event, stateKey) => {
  event.preventDefault()
  const files = event.dataTransfer.files
  if (files.length > 0) updateStateImage(stateKey, files[0])
}

const updateStateImage = async (stateKey, file) => {
  const validFormats = ['png', 'gif', 'jpg', 'jpeg', 'webp']
  const fileExtension = file.name.split('.').pop().toLowerCase()
  if (!validFormats.includes(fileExtension)) {
    alert(t('stateConfig.selectValidFormat'))
    return
  }

  const fileHash = await calculateFileHash(file)
  const currentCustom = props.modelValue.custom || {}
  const fileMap = { ...(currentCustom.fileMap || {}) }
  const stateMap = { ...(currentCustom.stateMap || {}) }
  const images = { ...(currentCustom.images || {}) }

  const existingStates = Object.entries(stateMap)
    .filter(([_, hash]) => hash === fileHash && stateKey !== _)
    .map(([state]) => state)

  if (existingStates.length > 0) {
    console.log(t('stateConfig.sharedFileMessage', { stateKey, existingStates: existingStates.join(', ') }))
  }

  fileMap[fileHash] = file
  stateMap[stateKey] = fileHash
  images[stateKey] = file

  emit('update:modelValue', {
    ...props.modelValue,
    custom: {
      ...currentCustom,
      size: localCustom.value.size,
      images,
      fileMap,
      stateMap,
      order: currentCustom.order || stateList.value.map(s => s.key)
    }
  })

  await StorageHelper.saveStateFile(`state_hash_${fileHash}`, file, {
    size: localCustom.value.size,
    format: fileExtension,
    states: [...existingStates, stateKey]
  })
}

const removeImage = async (stateKey) => {
  const currentCustom = props.modelValue.custom || {}
  const newImages = { ...currentCustom.images }
  const newStateMap = { ...(currentCustom.stateMap || {}) }
  const newFileMap = { ...(currentCustom.fileMap || {}) }

  const fileHash = newStateMap[stateKey]
  delete newImages[stateKey]
  delete newStateMap[stateKey]

  const otherStatesUsingFile = Object.values(newStateMap).filter(h => h === fileHash)
  if (otherStatesUsingFile.length === 0 && fileHash) {
    delete newFileMap[fileHash]
    await StorageHelper.deleteStateFile(`state_hash_${fileHash}`)
    console.log(t('stateConfig.fileDeleted', { fileHash }))
  } else {
    console.log(t('stateConfig.fileRetained', { fileHash }))
  }

  emit('update:modelValue', {
    ...props.modelValue,
    custom: {
      ...currentCustom,
      images: newImages,
      stateMap: newStateMap,
      fileMap: newFileMap
    }
  })
}

const getImagePreview = (stateKey) => {
  const file = props.modelValue.custom.images[stateKey]
  if (file instanceof File || file instanceof Blob) {
    return URL.createObjectURL(file)
  }
  return null
}

const handleImageError = (event) => {
  console.warn(t('stateConfig.imageLoadFailed'), event.target.src)
  event.target.style.display = 'none'
}

const addCustomState = () => {
  const key = `state_${Date.now().toString(16)}`
  const newOrder = [...(props.modelValue.custom.order || stateList.value.map(s => s.key)), key]
  emit('update:modelValue', {
    ...props.modelValue,
    custom: {
      ...props.modelValue.custom,
      order: newOrder,
      images: { ...(props.modelValue.custom.images || {}) },
      stateMap: { ...(props.modelValue.custom.stateMap || {}) },
      fileMap: { ...(props.modelValue.custom.fileMap || {}) }
    }
  })
}

const removeCustomState = (stateKey) => {
  if (defaultStates.find(s => s.key === stateKey)) return
  const currentCustom = props.modelValue.custom || {}
  const newOrder = (currentCustom.order || stateList.value.map(s => s.key)).filter(k => k !== stateKey)
  const newImages = { ...(currentCustom.images || {}) }
  const newStateMap = { ...(currentCustom.stateMap || {}) }
  const newFileMap = { ...(currentCustom.fileMap || {}) }

  const fileHash = newStateMap[stateKey]
  delete newImages[stateKey]
  delete newStateMap[stateKey]
  if (fileHash && !Object.values(newStateMap).includes(fileHash)) {
    delete newFileMap[fileHash]
  }

  emit('update:modelValue', {
    ...props.modelValue,
    custom: {
      ...currentCustom,
      order: newOrder,
      images: newImages,
      stateMap: newStateMap,
      fileMap: newFileMap
    }
  })
}

// Sincronizar tamaño local con modelo
watch(() => localCustom.value.size, (newSize) => {
  if (props.modelValue.type === 'custom') {
    const currentCustom = props.modelValue.custom
    if (JSON.stringify(currentCustom.size) !== JSON.stringify(newSize)) {
      emit('update:modelValue', {
        ...props.modelValue,
        custom: {
          ...currentCustom,
          size: newSize
        }
      })
    }
  }
}, { deep: true })

// Inicializar localCustom
if (props.modelValue.custom.size) {
  localCustom.value = {
    size: { ...props.modelValue.custom.size }
  }
}
</script>
