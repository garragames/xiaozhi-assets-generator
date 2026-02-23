<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold text-gray-900 mb-4">{{ $t('generateSummary.title') }}</h2>
      <p class="text-gray-600 mb-6">{{ $t('generateSummary.description') }}</p>
    </div>

    <!-- Área de vista previa del dispositivo -->
    <div class="flex flex-col lg:flex-row gap-8">
      <!-- Simulador de dispositivo -->
      <div class="flex-1">
        <h3 class="text-lg font-medium text-gray-900 mb-4">{{ $t('generateSummary.devicePreview') }}</h3>
        <div class="bg-gray-100 p-4 rounded-lg">
          <div class="max-w-full overflow-auto flex justify-center">
            <!-- Marco del dispositivo -->
            <div class="bg-gray-800 p-6 rounded-2xl shadow-2xl inline-block">
              <div class="bg-gray-900 p-2 rounded-xl">
                <!-- Área de la pantalla -->
                <div 
                  :style="getScreenStyle()"
                  class="relative rounded-lg overflow-hidden border-2 border-gray-700 flex flex-col items-center justify-center"
                >
                <!-- Capa de fondo -->
                <div 
                  :style="getBackgroundStyle()"
                  class="absolute inset-0"
                ></div>
                
                <!-- Capa de contenido -->
                <div class="relative z-10 flex flex-col items-center justify-center p-4 text-center">
                  <!-- Visualización de emoji -->
                  <div class="mb-4">
                    <div v-if="currentEmoji && availableEmotions.length > 0" class="emoji-container">
                      <img 
                        v-if="currentEmojiImage"
                        :src="currentEmojiImage" 
                        :alt="currentEmoji"
                        :style="getEmojiStyle()"
                        class="emoji-image"
                      />
                      <div 
                        v-else
                        :style="getEmojiStyle()"
                        class="emoji-fallback bg-gray-200 rounded-full flex items-center justify-center text-2xl"
                      >
                        {{ getEmojiCharacter(currentEmoji) }}
                      </div>
                    </div>
                    <div v-else class="emoji-container">
                      <div 
                        :style="getEmojiStyle()"
                        class="emoji-placeholder flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded bg-gray-50"
                      >
                        <div class="text-center">
                          <div class="text-sm">{{ config.theme.emoji.type === 'none' ? '📦' : '😕' }}</div>
                          <div class="text-xs">{{ config.theme.emoji.type === 'none' ? $t('emojiConfig.noEmojiPack') : $t('generateSummary.noEmotionConfigured') }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Visualización de texto -->
                  <div 
                    v-if="!config.theme.font.hide_subtitle"
                    :style="getTextStyle()"
                    class="text-message max-w-full break-words relative"
                  >
                    <div v-if="!fontLoaded" class="absolute inset-0 flex items-center justify-center">
                      <div class="animate-pulse text-gray-400 text-xs">{{ $t('generateSummary.fontLoading') }}</div>
                    </div>
                    <div :class="{ 'opacity-0': !fontLoaded }">
                      {{ previewText }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Información del dispositivo -->
            <div class="mt-3 text-center text-xs text-gray-400">
              {{ config.chip.display.width }} × {{ config.chip.display.height }}
              {{ config.chip.model.toUpperCase() }}
            </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Panel de control -->
      <div class="w-full lg:w-80">
        <h3 class="text-lg font-medium text-gray-900 mb-4">{{ $t('generateSummary.previewSettings') }}</h3>
        <div class="space-y-6 bg-white border border-gray-200 rounded-lg p-4">
          
          <!-- Edición de contenido de texto -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('generateSummary.previewText') }}</label>
            <textarea
              v-model="previewText"
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows="3"
              placeholder="Hi, I'm your friend Xiaozhi!"
            ></textarea>
          </div>

          <!-- Cambio de emoji -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('generateSummary.currentEmotion') }}</label>
            <div v-if="availableEmotions.length > 0" class="flex flex-wrap gap-2 max-h-32 overflow-y-auto justify-center">
              <button
                v-for="emotion in availableEmotions"
                :key="emotion.key"
                @click="changeEmotion(emotion.key)"
                :class="[
                  'p-2 border rounded transition-colors flex items-center justify-center',
                  currentEmoji === emotion.key 
                    ? 'border-primary-500 bg-primary-50' 
                    : 'border-gray-200 hover:border-gray-300'
                ]"
                :title="emotion.name"
                :style="{ width: getEmojiControlSize() + 'px', height: getEmojiControlSize() + 'px' }"
              >
                <div v-if="getEmotionImage(emotion.key)">
                  <img 
                    :src="getEmotionImage(emotion.key)"
                    :alt="emotion.name"
                    :style="{ width: getEmojiDisplaySize() + 'px', height: getEmojiDisplaySize() + 'px' }"
                    class="object-contain rounded"
                  />
                </div>
                <div v-else class="text-lg">{{ emotion.emoji }}</div>
              </button>
            </div>
            <div v-else class="text-center py-4 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
              <div class="text-2xl mb-2">{{ config.theme.emoji.type === 'none' ? '📦' : '😕' }}</div>
              <div class="text-sm">{{ config.theme.emoji.type === 'none' ? $t('emojiConfig.noEmojiPackDescription') : $t('generateSummary.configureEmojiFirst') }}</div>
            </div>
          </div>

          <!-- Cambio de modo de tema -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('generateSummary.themeMode') }}</label>
            <div class="flex space-x-2">
              <button
                @click="themeMode = 'light'"
                :class="[
                  'flex-1 py-2 px-3 text-sm border rounded transition-colors',
                  themeMode === 'light'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 hover:border-gray-400'
                ]"
              >
                🌞 {{ $t('generateSummary.lightMode') }}
              </button>
              <button
                @click="themeMode = 'dark'"
                :class="[
                  'flex-1 py-2 px-3 text-sm border rounded transition-colors',
                  themeMode === 'dark'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 hover:border-gray-400'
                ]"
              >
                🌙 {{ $t('generateSummary.darkMode') }}
              </button>
            </div>
          </div>


          <!-- Resumen de configuración -->
          <div class="border-t pt-4">
            <h4 class="font-medium text-gray-900 mb-2">{{ $t('generateSummary.configSummary') }}</h4>
            <div class="text-xs text-gray-600 space-y-1">
              <div v-if="config.theme.wakeword">{{ $t('generateSummary.wakeword') }} {{ getWakewordName() }}</div>
              <div class="flex items-center">
                <span>{{ $t('generateSummary.font') }} {{ getFontName() }}</span>
                <span v-if="!fontLoaded" class="ml-2 animate-pulse text-blue-500">{{ $t('generateSummary.loading') }}</span>
              </div>
              <div>{{ $t('generateSummary.emotion') }} {{ getEmojiName() }}</div>
              <div>{{ $t('generateSummary.skin') }} {{ getSkinName() }}</div>
              <div v-if="config.theme.font.hide_subtitle">{{ $t('generateSummary.hideSubtitle') }} {{ $t('common.yes') }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Botones de acción -->
    <div class="flex justify-between">
      <button 
        @click="$emit('prev')"
        class="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
      >
        {{ $t('generateSummary.previous') }}
      </button>
      <button 
        @click="$emit('generate')"
        class="bg-green-500 hover:bg-green-600 text-white px-8 py-2 rounded-lg font-medium transition-colors flex items-center"
      >
        <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
        {{ $t('generateSummary.generate') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
})

defineEmits(['prev', 'generate'])

// Estado de la vista previa
const previewText = ref(t('generateSummary.defaultPreviewText'))
const currentEmoji = ref('happy')
const themeMode = ref('light')
const fontLoaded = ref(false)
const loadedFontFamily = ref('')

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
  kotty240: ['neutral', 'happy', 'funny']
}

const getPresetEmotions = (preset) => presetEmotionMap[preset] || defaultPresetEmotions

// Datos de emojis
const emotionList = computed(() => [
  { key: 'neutral', name: t('generateSummary.emotions.neutral'), emoji: '😶' },
  { key: 'happy', name: t('generateSummary.emotions.happy'), emoji: '🙂' },
  { key: 'laughing', name: t('generateSummary.emotions.laughing'), emoji: '😆' },
  { key: 'funny', name: t('generateSummary.emotions.funny'), emoji: '😂' },
  { key: 'sad', name: t('generateSummary.emotions.sad'), emoji: '😔' },
  { key: 'angry', name: t('generateSummary.emotions.angry'), emoji: '😠' },
  { key: 'crying', name: t('generateSummary.emotions.crying'), emoji: '😭' },
  { key: 'loving', name: t('generateSummary.emotions.loving'), emoji: '😍' },
  { key: 'surprised', name: t('generateSummary.emotions.surprised'), emoji: '😯' },
  { key: 'thinking', name: t('generateSummary.emotions.thinking'), emoji: '🤔' },
  { key: 'cool', name: t('generateSummary.emotions.cool'), emoji: '😎' },
  { key: 'sleepy', name: t('generateSummary.emotions.sleepy'), emoji: '😴' }
])

// Lista de emojis disponibles
const availableEmotions = computed(() => {
  if (props.config.theme.emoji.type === 'preset' && props.config.theme.emoji.preset) {
    const allowed = new Set(getPresetEmotions(props.config.theme.emoji.preset))
    return emotionList.value.filter(e => allowed.has(e.key))
  } else if (props.config.theme.emoji.type === 'custom') {
    // Solo mostrar los emojis subidos por el usuario
    const customImages = props.config.theme.emoji.custom.images
    return emotionList.value.filter(emotion => customImages[emotion.key])
  } else {
    // Devolver un array vacío si no se han configurado emojis
    return []
  }
})

// Imagen del emoji actual
const currentEmojiImage = computed(() => {
  return getEmotionImage(currentEmoji.value)
})

// Obtener el estilo de la pantalla
const getScreenStyle = () => {
  const { width, height } = props.config.chip.display
  
  // Usar una relación de píxeles de 1:1, usar directamente el tamaño de la configuración
  return {
    width: `${width}px`,
    height: `${height}px`
  }
}

// Obtener el estilo del fondo
const getBackgroundStyle = () => {
  const bg = props.config.theme.skin[themeMode.value]
  
  if (bg.backgroundType === 'image' && bg.backgroundImage) {
    try {
      // Validar si el archivo de imagen de fondo es válido
      if (bg.backgroundImage && typeof bg.backgroundImage === 'object' && bg.backgroundImage.size) {
        return {
          backgroundImage: `url(${URL.createObjectURL(bg.backgroundImage)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }
      }
    } catch (error) {
      console.warn('Error al cargar la vista previa de la imagen de fondo:', error)
    }
  }
  
  return {
    backgroundColor: bg.backgroundColor || '#ffffff'
  }
}

// Obtener el estilo del emoji
const getEmojiStyle = () => {
  let size = 48 // Tamaño por defecto
  
  if (props.config.theme.emoji.type === 'preset') {
    if (props.config.theme.emoji.preset === 'twemoji64') size = 64
    else if (props.config.theme.emoji.preset === 'kotty64') size = 64
    else if (props.config.theme.emoji.preset === 'kotty128') size = 96
    else if (props.config.theme.emoji.preset === 'kotty240') size = 140
    else if (props.config.theme.emoji.preset === 'notoemoji64') size = 64
    else if (props.config.theme.emoji.preset === 'notoemoji128') size = 96
    else size = 32
  } else if (props.config.theme.emoji.custom.size) {
    size = Math.min(props.config.theme.emoji.custom.size.width, props.config.theme.emoji.custom.size.height)
  }
  
  // Usar una relación de píxeles de 1:1, usar directamente el tamaño del emoji de la configuración
  return {
    width: `${size}px`,
    height: `${size}px`
  }
}

// Obtener el estilo del texto
const getTextStyle = () => {
  let fontSize = 14
  
  // Ajustar el tamaño de la fuente según la configuración de la fuente
  if (props.config.theme.font.type === 'preset') {
    const fontConfig = props.config.theme.font.preset
    if (fontConfig.includes('_14_')) fontSize = 14
    else if (fontConfig.includes('_16_')) fontSize = 16
    else if (fontConfig.includes('_20_')) fontSize = 20
    else if (fontConfig.includes('_30_')) fontSize = 30
  } else if (props.config.theme.font.custom.size) {
    fontSize = props.config.theme.font.custom.size
  }
  
  // Usar una relación de píxeles de 1:1, usar directamente el tamaño de la fuente de la configuración
  const textColor = themeMode.value === 'dark' 
    ? props.config.theme.skin.dark.textColor 
    : props.config.theme.skin.light.textColor
  
  return {
    fontSize: `${fontSize}px`,
    color: textColor,
    fontFamily: getFontFamily(),
    textShadow: themeMode.value === 'dark' ? '1px 1px 2px rgba(0,0,0,0.5)' : '1px 1px 2px rgba(255,255,255,0.5)'
  }
}

// Cargar la fuente dinámicamente
const loadFont = async () => {
  // Limpiar las fuentes anteriores
  const existingStyles = document.querySelectorAll('style[data-font-preview]')
  existingStyles.forEach(style => style.remove())
  
  fontLoaded.value = false
  loadedFontFamily.value = ''

  try {
    if (props.config.theme.font.type === 'preset') {
      // Cargar fuente preestablecida
      const presetId = props.config.theme.font.preset
      let fontFamily, fontUrl
      
      // Determinar si es puhui o noto según el ID de la fuente preestablecida
      if (presetId && presetId.startsWith('font_noto_qwen_')) {
        fontFamily = 'NotoPreview'
        fontUrl = './static/fonts/noto_qwen.ttf'
      } else {
        // Por defecto, puhui
        fontFamily = 'PuHuiPreview'
        fontUrl = './static/fonts/puhui_deepseek.ttf'
      }
      
      const style = document.createElement('style')
      style.setAttribute('data-font-preview', 'true')
      style.textContent = `
        @font-face {
          font-family: '${fontFamily}';
          src: url('${fontUrl}') format('truetype');
          font-display: swap;
        }
      `
      document.head.appendChild(style)
      
      // Esperar a que la fuente se cargue
      await document.fonts.load(`16px "${fontFamily}"`)
      loadedFontFamily.value = fontFamily
      fontLoaded.value = true
      
    } else if (props.config.theme.font.custom.file) {
      // Cargar fuente personalizada
      try {
        const fontFile = props.config.theme.font.custom.file
        
        // Validar si el objeto de archivo de fuente es válido
        if (!fontFile || typeof fontFile !== 'object' || !fontFile.size) {
          throw new Error('Objeto de archivo de fuente no válido')
        }
        
        const fontFamily = 'CustomFontPreview'
        const fontUrl = URL.createObjectURL(fontFile)
        
        const style = document.createElement('style')
        style.setAttribute('data-font-preview', 'true')
        style.textContent = `
          @font-face {
            font-family: '${fontFamily}';
            src: url('${fontUrl}');
            font-display: swap;
          }
        `
        document.head.appendChild(style)
        
        // Esperar a que la fuente se cargue
        await document.fonts.load(`16px "${fontFamily}"`)
        loadedFontFamily.value = fontFamily
        fontLoaded.value = true
      } catch (error) {
        console.warn('Error al cargar la vista previa de la fuente personalizada:', error)
        // Usar la fuente predeterminada del sistema como alternativa
        loadedFontFamily.value = 'Arial, sans-serif'
        fontLoaded.value = true
      }
    } else {
      // Usar la fuente del sistema
      loadedFontFamily.value = 'system-ui'
      fontLoaded.value = true
    }
  } catch (error) {
    console.warn('Falló la carga de la fuente:', error)
    loadedFontFamily.value = 'system-ui'
    fontLoaded.value = true
  }
}

// Obtener la familia de fuentes
const getFontFamily = () => {
  if (fontLoaded.value && loadedFontFamily.value) {
    return `"${loadedFontFamily.value}", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`
  }
  return '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
}

// Obtener la imagen del emoji
const getEmotionImage = (emotionKey) => {
  if (props.config.theme.emoji.type === 'preset') {
    if (props.config.theme.emoji.preset === 'notoemoji128' || props.config.theme.emoji.preset === 'notoemoji64' || props.config.theme.emoji.preset === 'kotty128' || props.config.theme.emoji.preset === 'kotty64' || props.config.theme.emoji.preset === 'kotty240') {
      const dir = props.config.theme.emoji.preset === 'notoemoji128'
        ? 'notoemoji128'
        : props.config.theme.emoji.preset === 'notoemoji64'
          ? 'notoemoji64'
          : props.config.theme.emoji.preset === 'kotty128'
            ? 'kotty128'
            : props.config.theme.emoji.preset === 'kotty64'
              ? 'kotty64'
              : 'kotty240'
      return `./static/${dir}/${emotionKey}.gif`
    }
    const size = props.config.theme.emoji.preset === 'twemoji64' ? '64' : '32'
    return `./static/twemoji${size}/${emotionKey}.png`
  } else if (props.config.theme.emoji.type === 'custom' && props.config.theme.emoji.custom.images[emotionKey]) {
    try {
      const emojiFile = props.config.theme.emoji.custom.images[emotionKey]
      // Validar si el archivo de emoji es válido
      if (emojiFile && typeof emojiFile === 'object' && emojiFile.size) {
        return URL.createObjectURL(emojiFile)
      }
    } catch (error) {
      console.warn(`Error al cargar la vista previa de la imagen del emoji (${emotionKey}):`, error)
    }
  }
  return null
}

// Obtener el carácter del emoji
const getEmojiCharacter = (emotionKey) => {
  const emotion = emotionList.value.find(e => e.key === emotionKey)
  return emotion ? emotion.emoji : '😶'
}

// Obtener el tamaño del botón de control de emoji
const getEmojiControlSize = () => {
  if (props.config.theme.emoji.type === 'preset') {
    const baseSize = props.config.theme.emoji.preset === 'twemoji64'
      ? 64
      : props.config.theme.emoji.preset === 'kotty128'
        ? 96
        : props.config.theme.emoji.preset === 'kotty64'
          ? 64
          : props.config.theme.emoji.preset === 'kotty240'
            ? 140
            : props.config.theme.emoji.preset === 'notoemoji64'
              ? 64
              : props.config.theme.emoji.preset === 'notoemoji128'
                ? 96
                : 32
    return Math.min(baseSize + 16, 112) // limitar para mantener botones manejables
  } else if (props.config.theme.emoji.custom.size) {
    const baseSize = Math.min(props.config.theme.emoji.custom.size.width, props.config.theme.emoji.custom.size.height)
    return Math.min(baseSize + 16, 112) // Limitar el tamaño máximo
  }
  return 48 // Tamaño por defecto
}

// Obtener el tamaño de visualización de la imagen del emoji
const getEmojiDisplaySize = () => {
  if (props.config.theme.emoji.type === 'preset') {
    if (props.config.theme.emoji.preset === 'twemoji64') return 64
    if (props.config.theme.emoji.preset === 'kotty64') return 64
    if (props.config.theme.emoji.preset === 'kotty128') return 96
    if (props.config.theme.emoji.preset === 'kotty240') return 140
    if (props.config.theme.emoji.preset === 'notoemoji64') return 64
    if (props.config.theme.emoji.preset === 'notoemoji128') return 96
    return 32
  } else if (props.config.theme.emoji.custom.size) {
    return Math.min(props.config.theme.emoji.custom.size.width, props.config.theme.emoji.custom.size.height, 96)
  }
  return 32 // Tamaño por defecto
}

// Cambiar de emoji
const changeEmotion = (emotionKey) => {
  currentEmoji.value = emotionKey
}


// Método de resumen de configuración
const getWakewordName = () => {
  const wakeword = props.config.theme.wakeword
  if (!wakeword || wakeword.type === 'none') return t('wakewordConfig.noWakeword')
  
  if (wakeword.type === 'preset') {
    const names = {
      'wn9s_hilexin': 'Hi, Lexin', 'wn9s_hiesp': 'Hi,ESP', 'wn9s_nihaoxiaozhi': 'Hola, Xiaozhi',
      'wn9_nihaoxiaozhi_tts': 'Hola, Xiaozhi', 'wn9_alexa': 'Alexa', 'wn9_jarvis_tts': 'Jarvis'
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
    // Usar la traducción i18n para obtener el nombre de la fuente preestablecida
    return t('fontConfig.presetFontNames.' + props.config.theme.font.preset) || props.config.theme.font.preset
  } else {
    const custom = props.config.theme.font.custom
    return t('generateSummary.customFont', { size: custom.size })
  }
}

const getEmojiName = () => {
  if (props.config.theme.emoji.type === 'preset' && props.config.theme.emoji.preset) {
    if (props.config.theme.emoji.preset === 'twemoji64') return 'Twemoji 64×64'
    if (props.config.theme.emoji.preset === 'kotty64') return t('emojiConfig.kottyEmojiName', { size: 64 })
    if (props.config.theme.emoji.preset === 'kotty128') return t('emojiConfig.kottyEmojiName', { size: 128 })
    if (props.config.theme.emoji.preset === 'kotty240') return t('emojiConfig.kottyEmojiName', { size: 240 })
    if (props.config.theme.emoji.preset === 'notoemoji64') return t('emojiConfig.notoEmojiName', { size: 64 })
    if (props.config.theme.emoji.preset === 'notoemoji128') return t('emojiConfig.notoEmojiName', { size: 128 })
    return 'Twemoji 32×32'
  } else if (props.config.theme.emoji.type === 'custom') {
    const count = Object.keys(props.config.theme.emoji.custom.images).length
    return t('generateSummary.customEmoji', { count })
  } else if (props.config.theme.emoji.type === 'none') {
    return t('emojiConfig.noEmojiPack')
  } else {
    return t('generateSummary.notConfigured')
  }
}

const getSkinName = () => {
  const lightType = props.config.theme.skin.light.backgroundType === 'image' ? t('generateSummary.image') : t('generateSummary.color')
  const darkType = props.config.theme.skin.dark.backgroundType === 'image' ? t('generateSummary.image') : t('generateSummary.color')
  return t('generateSummary.skinLight', { type: lightType }) + '/' + t('generateSummary.skinDark', { type: darkType })
}

// Observar los cambios en la configuración de la fuente
watch(() => props.config.theme.font, () => {
  loadFont()
}, { deep: true })

// Montaje del componente
onMounted(async () => {
  // Asegurarse de que haya emojis disponibles
  if (availableEmotions.value.length > 0) {
    currentEmoji.value = availableEmotions.value[0].key
  } else {
    currentEmoji.value = ''
  }
  
  // Cargar la fuente
  await loadFont()
})

// Limpiar la fuente al desmontar el componente
onUnmounted(() => {
  const existingStyles = document.querySelectorAll('style[data-font-preview]')
  existingStyles.forEach(style => style.remove())
})
</script>

<style scoped>
.emoji-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.emoji-image {
  border-radius: 8px;
  object-fit: contain;
}

.emoji-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
}

.text-message {
  line-height: 1;
  word-wrap: break-word;
}
</style>
