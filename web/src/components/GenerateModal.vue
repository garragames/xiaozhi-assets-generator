<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
      <!-- Encabezado del modal -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <h3 class="text-lg font-medium text-gray-900">{{ $t('generateModal.title') }}</h3>
        <button
          v-if="!isFlashing"
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-500"
        >
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
        <!-- Aviso de flasheo en curso -->
        <div v-else class="text-sm text-orange-600 font-medium">
          {{ $t('generateModal.flashingInProgress') }}
        </div>
      </div>

      <!-- Contenido del modal -->
      <div class="p-6 overflow-y-auto" style="max-height: calc(90vh - 140px)">
        <div v-if="!isGenerating && !isCompleted" class="space-y-6">
          <!-- Confirmación de configuración -->
          <div>
            <h4 class="font-medium text-gray-900 mb-3">{{ $t('generateModal.confirmConfig') }}</h4>
            <div class="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">{{ $t('generateModal.chipModel') }}</span>
                <span class="font-medium">{{ config.chip.model.toUpperCase() }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">{{ $t('generateModal.resolution') }}</span>
                <span class="font-medium">{{ config.chip.display.width }}×{{ config.chip.display.height }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">{{ $t('generateModal.wakeword') }}</span>
                <span class="font-medium">{{ getWakewordName() }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">{{ $t('generateModal.font') }}</span>
                <span class="font-medium">{{ getFontName() }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">{{ $t('generateModal.state') }}</span>
                <span class="font-medium">{{ getStateName() }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">{{ $t('generateModal.emoji') }}</span>
                <span class="font-medium">{{ getEmojiName() }}</span>
              </div>
            </div>
          </div>

          <!-- Lista de archivos -->
          <div>
            <h4 class="font-medium text-gray-900 mb-3">{{ $t('generateModal.fileList') }}</h4>
            <div class="space-y-2 max-h-64 overflow-y-auto">
              <div
                v-for="item in fileList"
                :key="item.id"
                class="flex items-center justify-between px-3 py-2 border border-gray-200 rounded bg-gray-50"
              >
                <div class="flex items-center">
                  <component :is="item.icon" class="w-4 h-4 mr-2" :class="item.iconColor" />
                  <span class="text-sm font-medium text-gray-900">{{ item.name }}</span>
                </div>
                <div class="text-sm text-gray-700">
                  {{ item.size }}
                  <span v-if="item.estimated" class="text-xs text-gray-500 ml-1">{{ $t('generateModal.estimated') }}</span>
                  <span v-if="item.isCustomEmoji" class="text-xs text-gray-500 ml-1">{{ $t('generateModal.compressed') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Progreso de generación -->
        <div v-if="isGenerating" class="space-y-6 text-center">
          <div class="flex items-center justify-center">
            <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500"></div>
          </div>
          
          <div class="space-y-4">
            <p class="text-gray-600 mt-2">{{ $t('generateModal.generating') }}</p>
            <div class="bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                class="bg-primary-500 h-2 rounded-full transition-all duration-500 ease-out"
                :style="{ width: progress + '%' }"
              ></div>
            </div>
            <div class="text-sm text-gray-600">
              <div>{{ currentStep }}</div>
              <div class="mt-1">{{ $t('generateModal.progress', { progress: progress }) }}</div>
            </div>
          </div>

          <!-- Pasos de progreso -->
          <div class="space-y-2 text-left">
            <div
              v-for="step in progressSteps"
              :key="step.id"
              class="flex items-center text-sm"
            >
              <div class="flex-shrink-0 mr-3">
                <div v-if="step.status === 'completed'" class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                  </svg>
                </div>
                <div v-else-if="step.status === 'processing'" class="w-5 h-5 bg-primary-500 rounded-full animate-pulse"></div>
                <div v-else class="w-5 h-5 bg-gray-300 rounded-full"></div>
              </div>
              <span :class="[
                step.status === 'completed' ? 'text-green-700' : 
                step.status === 'processing' ? 'text-primary-700' : 
                'text-gray-500'
              ]">{{ step.name }}</span>
            </div>
          </div>
        </div>

        <!-- Estado completado -->
        <div v-if="isCompleted && !isFlashing" class="text-center space-y-6">
          <div class="mx-auto flex items-center justify-center">
            <svg class="w-20 h-20 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
          </div>
          
          <div>
            <p class="text-gray-600 mt-2">{{ $t('generateModal.completed') }}</p>
          </div>

          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <div class="text-sm text-green-800 space-y-1">
              <div>{{ $t('generateModal.filename') }}</div>
              <div>{{ $t('generateModal.fileSize', { size: generatedFileSize }) }}</div>
              <div>{{ $t('generateModal.generationTime', { time: generationTime }) }}</div>
            </div>
          </div>

          <div class="space-y-3">
            <button
              @click="downloadFile"
              class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
              {{ $t('generateModal.downloadAssets') }}
            </button>

            <button
              @click="startOnlineFlash"
              :disabled="!deviceOnline"
              class="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
              {{ $t('generateModal.flashToDevice') }}
            </button>
          </div>
        </div>

        <!-- Progreso de flasheo en línea -->
        <!-- Flasheo en curso -->
        <div v-if="isFlashing && !flashError" class="space-y-6 text-center">
          <div class="flex items-center justify-center">
            <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
          </div>

          <div class="space-y-4">
            <p class="text-gray-600">{{ $t('generateModal.flashing') }}</p>
            <div class="bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                class="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                :style="{ width: flashProgress + '%' }"
              ></div>
            </div>
            <div class="text-sm text-gray-600">
              <div>{{ flashCurrentStep }}</div>
              <div class="mt-1">{{ $t('generateModal.progress', { progress: flashProgress }) }}</div>
            </div>
          </div>

          <!-- Botón de cancelar -->
          <button
            @click="cancelFlash"
            class="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
          >
            {{ $t('generateModal.flashingCancel') }}
          </button>
        </div>

        <!-- Mensaje de error de flasheo -->
        <div v-if="flashError" class="text-center mt-4">
          <p class="text-sm text-red-600">{{ flashError }}</p>
        </div>
      </div>

      <!-- Pie del modal -->
      <div class="flex justify-end space-x-3 p-6 border-t border-gray-200">
        <button
          v-if="!isGenerating && !isCompleted"
          @click="$emit('close')"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          v-if="!isGenerating && !isCompleted"
          @click="startGeneration"
          :disabled="!hasSelectedFiles"
          class="px-6 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 rounded-md transition-colors"
        >
          {{ $t('common.start') }} {{ $t('common.generate') }}
        </button>
        <button
          v-if="isCompleted && !isFlashing"
          @click="$emit('close')"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          {{ $t('common.close') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, markRaw, h } from 'vue'
import { useI18n } from 'vue-i18n'
import AssetsBuilder from '@/utils/AssetsBuilder.js'
import { useDeviceStatus } from '@/composables/useDeviceStatus'

const { t } = useI18n()

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'generate', 'startFlash', 'cancelFlash'])

// Obtener el estado del dispositivo
const { deviceInfo } = useDeviceStatus()

const isGenerating = ref(false)
const isCompleted = ref(false)
const progress = ref(0)
const currentStep = ref('')
const generatedFileSize = ref('')
const generationTime = ref('')
const generatedBlob = ref(null)
const generationStartTime = ref(null)
const deviceOnline = ref(false)
const isFlashing = ref(false)
const flashProgress = ref(0)
const flashCurrentStep = ref('')
const flashError = ref('')

const defaultPresetEmotions = [
  'neutral', 'happy', 'laughing', 'funny', 'sad', 'angry', 'crying',
  'loving', 'embarrassed', 'surprised', 'shocked', 'thinking', 'winking',
  'cool', 'relaxed', 'delicious', 'kissy', 'confident', 'sleepy', 'silly', 'confused'
]

const presetEmotionMap = {
  twemoji32: defaultPresetEmotions,
  twemoji64: defaultPresetEmotions,
  notoemoji64: defaultPresetEmotions,
  notoemoji128: defaultPresetEmotions,
  kotty64: ['silly', 'sleepy', 'surprised', 'thinking', 'winking'],
  kotty128: ['neutral', 'happy', 'laughing', 'funny'],
  kotty240: ['neutral', 'eyes', 'happy', 'funny']
}

const getPresetEmotions = (preset) => presetEmotionMap[preset] || defaultPresetEmotions


// Usar propiedades computadas para obtener los nombres de los pasos de progreso traducidos
const progressSteps = computed(() => [
  { id: 1, name: t('progressSteps.init'), status: 'pending' },
  { id: 2, name: t('progressSteps.font'), status: 'pending' },
  { id: 3, name: t('progressSteps.wakeword'), status: 'pending' },
  { id: 4, name: t('progressSteps.state'), status: 'pending' },
  { id: 5, name: t('progressSteps.emoji'), status: 'pending' },
  { id: 6, name: t('progressSteps.background'), status: 'pending' },
  { id: 7, name: t('progressSteps.index'), status: 'pending' },
  { id: 8, name: t('progressSteps.spiffs'), status: 'pending' },
  { id: 9, name: t('progressSteps.package'), status: 'pending' }
])

const fileList = ref([])

// Componente de icono - usar la función de renderizado y envolver con markRaw para evitar la reactividad
const FileIcon = markRaw({
  render: () => h('svg', {
    fill: 'currentColor',
    viewBox: '0 0 20 20'
  }, [
    h('path', {
      d: 'M4 3a2 2 0 00-2 2v1a1 1 0 001 1h14a1 1 0 001-1V5a2 2 0 00-2-2H4zM3 8a1 1 0 011-1h12a1 1 0 011 1v5a2 2 0 01-2 2H5a2 2 0 01-2-2V8z'
    })
  ])
})

const MicIcon = markRaw({
  render: () => h('svg', {
    fill: 'currentColor',
    viewBox: '0 0 20 20'
  }, [
    h('path', {
      'fill-rule': 'evenodd',
      d: 'M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z',
      'clip-rule': 'evenodd'
    })
  ])
})

const FontIcon = markRaw({
  render: () => h('svg', {
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, [
    h('path', {
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'stroke-width': '2',
      d: 'M8 4l8 16m-6-6h4'
    })
  ])
})

const ImageIcon = markRaw({
  render: () => h('svg', {
    fill: 'currentColor',
    viewBox: '0 0 20 20'
  }, [
    h('path', {
      'fill-rule': 'evenodd',
      d: 'M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z',
      'clip-rule': 'evenodd'
    })
  ])
})

const hasSelectedFiles = computed(() => {
  return fileList.value.length > 0
})

const getWakewordName = () => {
  const wakeword = props.config.theme.wakeword
  if (!wakeword || wakeword.type === 'none') return t('wakewordConfig.noWakeword')
  
  if (wakeword.type === 'preset') {
    const names = {
      'wn9s_hilexin': 'Hi, Lexin',
      'wn9s_hiesp': 'Hi,ESP',
      'wn9s_nihaoxiaozhi': 'Hola, Xiaozhi',
      'wn9_nihaoxiaozhi_tts': 'Hola, Xiaozhi',
      'wn9_alexa': 'Alexa'
    }
    return names[wakeword.preset] || wakeword.preset
  }
  
  if (wakeword.type === 'custom') {
    return wakeword.custom.name || t('wakewordConfig.customWakeword')
  }
  
  return t('wakewordConfig.noWakeword')
}

const getFontName = () => {
  if (props.config.theme.font.type === 'preset') {
    return props.config.theme.font.preset.replace('font_', '').replace('_', ' ')
  }
  return t('generateModal.customFont')
}

const getStateName = () => {
  if (props.config.theme.state.type === 'preset') {
    const names = {
      state_kotty: 'Kotty States',
      state_echoear: 'EchoEar States'
    }
    return names[props.config.theme.state.preset] || props.config.theme.state.preset
  } else if (props.config.theme.state.type === 'custom') {
    const count = Object.keys(props.config.theme.state.custom?.images || {}).length
    return t('generateModal.customState', { count })
  }
  return t('generateModal.noStatePack')
}

const getEmojiName = () => {
  if (props.config.theme.emoji.type === 'preset' && props.config.theme.emoji.preset) {
    if (props.config.theme.emoji.preset === 'twemoji32') return 'Twemoji 32×32'
    if (props.config.theme.emoji.preset === 'twemoji64') return 'Twemoji 64×64'
    if (props.config.theme.emoji.preset === 'kotty128') return t('emojiConfig.kottyEmojiName', { size: 128 })
    if (props.config.theme.emoji.preset === 'kotty64') return t('emojiConfig.kottyEmojiName', { size: 64 })
    if (props.config.theme.emoji.preset === 'kotty240') return t('emojiConfig.kottyEmojiName', { size: 240 })
    if (props.config.theme.emoji.preset === 'notoemoji64') return t('emojiConfig.notoEmojiName', { size: 64 })
    if (props.config.theme.emoji.preset === 'notoemoji128') return t('emojiConfig.notoEmojiName', { size: 128 })
  } else if (props.config.theme.emoji.type === 'custom') {
    return t('generateModal.customEmoji')
  } else if (props.config.theme.emoji.type === 'none') {
    return t('emojiConfig.noEmojiPack')
  }
  return t('generateModal.notConfigured')
}

const initializeFileList = () => {
  fileList.value = []

  // Agregar archivo de índice
  fileList.value.push({
    id: 'index',
    name: 'index.json',
    description: 'Archivo de índice de configuración',
    icon: FileIcon,
    iconColor: 'text-blue-500',
    size: '1KB'
  })

  // Agregar modelo de palabra de activación (si está configurado)
  const wakeword = props.config.theme.wakeword
  if (wakeword && wakeword.type !== 'none') {
    fileList.value.push({
      id: 'srmodels',
      name: 'srmodels.bin',
      description: wakeword.type === 'custom' ? 'Modelo de palabra de comando personalizado' : 'Modelo de palabra de activación preestablecido',
      icon: MicIcon,
      iconColor: 'text-green-500',
      size: wakeword.type === 'custom' ? '~1.2MB' : '~300KB'
    })
  }

  // Agregar archivo de fuente
  if (props.config.theme.font.type === 'preset') {
    const fontSizes = {
      'font_puhui_deepseek_14_1': '180KB',
      'font_puhui_deepseek_16_4': '720KB',
      'font_puhui_deepseek_20_4': '1.1MB',
      'font_puhui_deepseek_30_4': '2.5MB'
    }
    
    fileList.value.push({
      id: 'font',
      name: `${props.config.theme.font.preset}.bin`,
      description: 'Archivo de fuente preestablecido',
      icon: FontIcon,
      iconColor: 'text-yellow-500',
      size: fontSizes[props.config.theme.font.preset] || '500KB'
    })
  } else if (props.config.theme.font.custom.file) {
    const custom = props.config.theme.font.custom
    const estimatedSize = Math.max(100, custom.size * custom.size * custom.bpp * 0.7)
    
    fileList.value.push({
      id: 'font',
      name: `font_custom_${custom.size}_${custom.bpp}.bin`,
      description: 'Archivo de fuente personalizado',
      icon: FontIcon,
      iconColor: 'text-yellow-500',
      size: estimatedSize > 1024 ? `${(estimatedSize/1024).toFixed(1)}MB` : `${Math.round(estimatedSize)}KB`,
      estimated: true
    })
  }

  // Agregar archivos de estados
  if (props.config.theme.state.type === 'preset' && props.config.theme.state.preset) {
    const presetStates = {
      state_kotty: { size: '5KB', ext: 'gif' },
      state_echoear: { size: '5KB', ext: 'gif' }
    }
    const meta = presetStates[props.config.theme.state.preset] || { size: '5KB', ext: 'png' }
    const stateList = [
      'standby','starting','wifi_config','connecting','listening','thinking','speaking','activating','upgrading','audio_testing','fatal_error'
    ]
    stateList.forEach(state => {
      fileList.value.push({
        id: `state_${state}`,
        name: `${state}.${meta.ext}`,
        description: `Imagen de estado ${state}`,
        icon: ImageIcon,
        iconColor: 'text-blue-500',
        size: meta.size
      })
    })
  } else if (props.config.theme.state.type === 'custom') {
    const stateCustom = props.config.theme.state.custom
    const stateMap = stateCustom.stateMap || {}
    const fileMap = stateCustom.fileMap || {}
    const images = stateCustom.images || {}

    if (Object.keys(stateMap).length === 0 || Object.keys(fileMap).length === 0) {
      console.error(t('errors.incompatibleStateData') || 'Datos de estados incompatibles')
    } else {
      const uniqueFiles = new Map()
      Object.entries(stateMap).forEach(([state, fileHash]) => {
        const file = fileMap[fileHash]
        if (file) {
          if (!uniqueFiles.has(fileHash)) {
            const fileSizeKB = Math.round(file.size / 1024)
            uniqueFiles.set(fileHash, {
              file,
              size: fileSizeKB > 1024 ? `${(fileSizeKB/1024).toFixed(1)}MB` : `${fileSizeKB}KB`,
              states: []
            })
          }
          uniqueFiles.get(fileHash).states.push(state)
        }
      })

      uniqueFiles.forEach((fileInfo, fileHash) => {
        const stateNames = fileInfo.states.join(', ')
        const isShared = fileInfo.states.length > 1
        fileList.value.push({
          id: `state_${fileHash.substring(0, 8)}`,
          name: `state_${fileHash.substring(0, 8)}.${fileInfo.file.name.split('.').pop()}`,
          description: isShared
            ? `Imagen de estado compartida (${stateNames})`
            : `Imagen de estado ${stateNames}`,
          icon: ImageIcon,
          iconColor: isShared ? 'text-purple-500' : 'text-blue-500',
          size: fileInfo.size,
          isCustomState: true
        })
      })
    }
  }

  // Agregar archivos de emoji
  if (props.config.theme.emoji.type === 'preset' && props.config.theme.emoji.preset) {
    const emotionList = getPresetEmotions(props.config.theme.emoji.preset)
    const presetSize = {
      twemoji32: '1KB',
      twemoji64: '3KB',
      kotty128: '90KB',
      kotty64: '40KB',
      kotty240: '180KB',
      notoemoji64: '80KB',
      notoemoji128: '220KB'
    }
    const presetExt = {
      twemoji32: 'png',
      twemoji64: 'png',
      kotty128: 'gif',
      kotty64: 'gif',
      kotty240: 'gif',
      notoemoji64: 'gif',
      notoemoji128: 'gif'
    }
    const size = presetSize[props.config.theme.emoji.preset] || '1KB'
    const ext = presetExt[props.config.theme.emoji.preset] || 'png'
    
    emotionList.forEach(emotion => {
      fileList.value.push({
        id: `emoji_${emotion}`,
        name: `${emotion}.${ext}`,
        description: `Imagen de emoji ${emotion}`,
        icon: ImageIcon,
        iconColor: 'text-pink-500',
        size: size
      })
    })
  } else if (props.config.theme.emoji.type === 'custom') {
    const custom = props.config.theme.emoji.custom
    const emotionMap = custom.emotionMap || {}
    const fileMap = custom.fileMap || {}
    const images = custom.images || {}
    
    // Debe usar la nueva estructura de mapeo de hash
    if (Object.keys(emotionMap).length === 0 || Object.keys(fileMap).length === 0) {
      console.error(t('errors.incompatibleEmojiData'))
      return
    }
    
    // Contar archivos únicos
    const uniqueFiles = new Map()
    const emotionsPerFile = new Map()
    
    Object.entries(emotionMap).forEach(([emotion, fileHash]) => {
      const file = fileMap[fileHash]
      if (file) {
        if (!uniqueFiles.has(fileHash)) {
          const fileSizeKB = Math.round(file.size / 1024)
          uniqueFiles.set(fileHash, {
            file,
            size: fileSizeKB > 1024 ? `${(fileSizeKB/1024).toFixed(1)}MB` : `${fileSizeKB}KB`,
            emotions: []
          })
        }
        uniqueFiles.get(fileHash).emotions.push(emotion)
        emotionsPerFile.set(emotion, fileHash)
      }
    })
    
    // Agregar archivos deduplicados a la lista
    uniqueFiles.forEach((fileInfo, fileHash) => {
      const emotionNames = fileInfo.emotions.join(', ')
      const isShared = fileInfo.emotions.length > 1
      
      fileList.value.push({
        id: `emoji_${fileHash.substring(0, 8)}`,
        name: `emoji_${fileHash.substring(0, 8)}.${fileInfo.file.name.split('.').pop()}`,
        description: isShared 
          ? `Imagen de emoji compartida (${emotionNames})` 
          : `Imagen de emoji ${emotionNames}`,
        icon: ImageIcon,
        iconColor: isShared ? 'text-purple-500' : 'text-pink-500',
        size: fileInfo.size,
        isCustomEmoji: true
      })
    })
    
    // Agregar estadísticas de deduplicación
    if (uniqueFiles.size < Object.keys(emotionMap).length) {
      console.log(`Deduplicación de emojis: ${Object.keys(emotionMap).length} emojis usaron ${uniqueFiles.size} archivos`)
    }
  }

  // Agregar archivos de fondo
  if (props.config.theme.skin.light.backgroundType === 'image' && props.config.theme.skin.light.backgroundImage) {
    const { width, height } = props.config.chip.display
    const estimatedSize = Math.round(width * height * 2 / 1024) // RGB565
    
    fileList.value.push({
      id: 'bg_light',
      name: 'background_light.raw',
      description: 'Imagen de fondo del modo claro',
      icon: ImageIcon,
      iconColor: 'text-indigo-500',
      size: estimatedSize > 1024 ? `${(estimatedSize/1024).toFixed(1)}MB` : `${estimatedSize}KB`,
      estimated: true
    })
  }

  if (props.config.theme.skin.dark.backgroundType === 'image' && props.config.theme.skin.dark.backgroundImage) {
    const { width, height } = props.config.chip.display
    const estimatedSize = Math.round(width * height * 2 / 1024) // RGB565
    
    fileList.value.push({
      id: 'bg_dark',
      name: 'background_dark.raw',
      description: 'Imagen de fondo del modo oscuro',
      icon: ImageIcon,
      iconColor: 'text-indigo-500',
      size: estimatedSize > 1024 ? `${(estimatedSize/1024).toFixed(1)}MB` : `${estimatedSize}KB`,
      estimated: true
    })
  }
}

const getTotalSize = () => {
  let totalKB = 0
  
  fileList.value.forEach(file => {
    const sizeStr = file.size.replace('~', '').replace('estimado', '')
    if (sizeStr.includes('MB')) {
      totalKB += parseFloat(sizeStr.replace('MB', '')) * 1024
    } else {
      totalKB += parseFloat(sizeStr.replace('KB', ''))
    }
  })
  
  return totalKB > 1024 ? `${(totalKB / 1024).toFixed(1)}MB` : `${Math.round(totalKB)}KB`
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

const formatDuration = (milliseconds) => {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`
  } else {
    const minutes = Math.floor(milliseconds / 60000)
    const seconds = Math.floor((milliseconds % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }
}

const startGeneration = async () => {
  isGenerating.value = true
  progress.value = 0
  generationStartTime.value = Date.now()
  
  try {
    // Crear instancia de AssetsBuilder
    const builder = new AssetsBuilder()
    builder.setConfig(props.config)
    
    // Generar assets.bin
    const blob = await builder.generateAssetsBin((progressPercent, message) => {
      progress.value = parseInt(progressPercent)
      currentStep.value = message
      
      // Actualizar el estado de los pasos de progreso
      const stepIndex = Math.floor(progressPercent / (100 / progressSteps.value.length))
      progressSteps.value.forEach((step, index) => {
        if (index < stepIndex) {
          step.status = 'completed'
        } else if (index === stepIndex) {
          step.status = 'processing'
        } else {
          step.status = 'pending'
        }
      })
    })
    
    // Generación completa
    isGenerating.value = false
    isCompleted.value = true
    
    // Actualizar resultado de la generación
    generatedFileSize.value = formatFileSize(blob.size)
    const endTime = Date.now()
    const duration = endTime - generationStartTime.value
    generationTime.value = formatDuration(duration)
    
    // Almacenar el archivo generado para la descarga
    generatedBlob.value = blob
    
    // Marcar todos los pasos como completados
    progressSteps.value.forEach(step => {
      step.status = 'completed'
    })
    
    // Notificar al componente principal
    emit('generate', fileList.value.map(f => ({ id: f.id, name: f.name })))
    
  } catch (error) {
    console.error('Error al generar assets.bin:', error)
    
    // Restablecer estado
    isGenerating.value = false
    isCompleted.value = false
    
    // Mostrar error
    alert(t('errors.generationFailed', { error: error.message }))
  }
}

const downloadFile = () => {
  if (generatedBlob.value) {
    const url = URL.createObjectURL(generatedBlob.value)
    const element = document.createElement('a')
    element.href = url
    element.download = 'assets.bin'
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    URL.revokeObjectURL(url)
  } else {
    console.error(t('errors.noFileToDownload'))
  }
}

// Comprobar el estado en línea del dispositivo
const checkDeviceOnline = async () => {
  try {
    // Obtener el token de los parámetros de la URL
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token')

    if (!token) {
      deviceOnline.value = false
      return
    }

    const response = await fetch('/api/messaging/device/tools/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })

    deviceOnline.value = response.ok
  } catch (error) {
    console.error(t('flashProgress.unableToGetDeviceStatus'), error)
    deviceOnline.value = false
  }
}

// Iniciar flasheo en línea
const startOnlineFlash = async () => {
  if (!generatedBlob.value) {
    alert(t('errors.noFileToDownload'))
    return
  }

  if (!deviceOnline.value) {
    alert(t('errors.deviceOffline'))
    return
  }

  // Comprobar si el tamaño del archivo excede el tamaño de la partición de assets
  if (deviceInfo.value.assetsPartition && deviceInfo.value.assetsPartition.size) {
    const assetsPartitionSize = deviceInfo.value.assetsPartition.size
    const fileSize = generatedBlob.value.size
    
    if (fileSize > assetsPartitionSize) {
      const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2)
      const partitionSizeMB = (assetsPartitionSize / 1024 / 1024).toFixed(2)
      alert(t('errors.fileTooLarge', { fileSize: fileSizeMB, partitionSize: partitionSizeMB }))
      return
    }
  }

  isFlashing.value = true
  flashProgress.value = 0
  flashCurrentStep.value = t('flashProgress.startingFileTransfer')
  flashError.value = ''

  try {
    // Notificar al componente principal para que inicie el flasheo en línea
    emit('startFlash', {
      blob: generatedBlob.value,
      onProgress: (progress, step) => {
        flashProgress.value = progress
        flashCurrentStep.value = step
      },
      onComplete: () => {
        isFlashing.value = false
        flashProgress.value = 100
        flashCurrentStep.value = t('flashProgress.flashCompleted')
      },
      onError: (error) => {
        isFlashing.value = false
        flashError.value = error
        console.error(t('flashProgress.onlineFlashFailed', { error }))
      }
    })
  } catch (error) {
    isFlashing.value = false
    flashError.value = t('flashProgress.onlineFlashFailed', { error: error.message })
    console.error(t('flashProgress.onlineFlashFailed', { error }))
  }
}

// Cancelar flasheo
const cancelFlash = () => {
  if (confirm(t('errors.flashCancelConfirm'))) {
    isFlashing.value = false
    flashProgress.value = 0
    flashCurrentStep.value = ''
    flashError.value = ''
    emit('cancelFlash')
  }
}


onMounted(async () => {
  initializeFileList()
  await checkDeviceOnline()
})
</script>
