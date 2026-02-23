<template>
  <div class="space-y-6">
    <!-- Selección de tipo de emoji -->
    <div class="space-y-4">
      <div class="flex flex-wrap gap-3">
        <button
          @click="setEmojiType('none')"
          :class="[
            'px-4 py-2 border rounded-lg transition-colors',
            modelValue.type === 'none'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-300 hover:border-gray-400'
          ]"
        >
          {{ $t('emojiConfig.noEmojiPack') }}
        </button>
        <button
          @click="setEmojiType('preset')"
          :class="[
            'px-4 py-2 border rounded-lg transition-colors',
            modelValue.type === 'preset'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-300 hover:border-gray-400'
          ]"
        >
          {{ $t('emojiConfig.presetEmojiPack') }}
        </button>
        <button
          @click="setEmojiType('custom')"
          :class="[
            'px-4 py-2 border rounded-lg transition-colors',
            modelValue.type === 'custom'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-300 hover:border-gray-400'
          ]"
        >
          {{ $t('emojiConfig.customEmojiPack') }}
        </button>
      </div>
      <p v-if="modelValue.type === 'none'" class="text-sm text-gray-500">
        {{ $t('emojiConfig.noEmojiPackDescription') }}
      </p>
    </div>

    <div v-if="modelValue.type === 'preset'" class="space-y-4">
      <h4 class="font-medium text-gray-900">{{ $t('emojiConfig.selectPresetEmojiPack') }}</h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          v-for="pack in presetEmojis"
          :key="pack.id"
          @click="selectPresetEmoji(pack.id)"
          :class="[
            'border-2 rounded-lg p-4 cursor-pointer transition-all',
            modelValue.preset === pack.id
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
          ]"
        >
          <div class="flex items-start justify-between mb-3">
            <div>
              <h5 class="font-medium text-gray-900">{{ pack.name }}</h5>
              <p class="text-sm text-gray-600">{{ pack.description }}</p>
              <div class="text-xs text-gray-500 mt-1">
                {{ $t('emojiConfig.size') }}: {{ pack.size }}px × {{ pack.size }}px
              </div>
            </div>
            <div 
              v-if="modelValue.preset === pack.id"
              class="flex-shrink-0 ml-3"
            >
              <div class="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
              </div>
            </div>
          </div>
          
          <!-- Cuadrícula de vista previa de emojis -->
          <div
            :class="[
              'grid justify-items-center',
              pack.size >= 240 ? 'grid-cols-2 gap-4' : pack.size > 64 ? 'grid-cols-4 gap-3' : 'grid-cols-7 gap-1'
            ]"
          >
            <div
              v-for="emotion in getPreviewList(pack)"
              :key="emotion"
              :style="{ width: pack.size + 'px', height: pack.size + 'px' }"
              class="bg-gray-100 rounded flex items-center justify-center"
            >
              <img 
                :src="getPresetEmojiUrl(pack.id, emotion)"
                :alt="emotion"
                :style="{ width: pack.size + 'px', height: pack.size + 'px' }"
                class="object-contain rounded"
                @error="handleImageError"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="modelValue.type === 'custom'" class="space-y-6">
      <h4 class="font-medium text-gray-900">{{ $t('emojiConfig.customEmojiPackConfig') }}</h4>
      
      <!-- Configuración básica -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Tamaño de la imagen -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('emojiConfig.maxImageWidth') }}</label>
          <input
            type="number"
            v-model.number="localCustom.size.width"
            min="16"
            max="200"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('emojiConfig.maxImageHeight') }}</label>
          <input
            type="number"
            v-model.number="localCustom.size.height"
            min="16"
            max="200"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
        </div>
      </div>

      <!-- Carga de imágenes de emoji -->
      <div class="space-y-4">
        <h5 class="font-medium text-gray-900">{{ $t('emojiConfig.uploadEmojiImages') }}</h5>
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div
            v-for="emotion in emotionList"
            :key="emotion.key"
            class="space-y-2"
          >
            <div class="text-center">
              <div class="text-lg mb-1">{{ emotion.emoji }}</div>
              <div class="text-xs text-gray-600 flex items-center justify-center gap-1">
                <span>{{ emotion.name }}</span>
                <span v-if="emotion.key === 'neutral'" class="text-red-500">{{ $t('emojiConfig.required') }}</span>
              </div>
            </div>
            
            <div 
              @drop="(e) => handleFileDrop(e, emotion.key)"
              @dragover.prevent
              @dragenter.prevent
              :class="[
                'border-2 border-dashed rounded-lg p-2 text-center cursor-pointer transition-colors aspect-square flex flex-col items-center justify-center',
                modelValue.custom.images[emotion.key]
                  ? 'border-green-300 bg-green-50'
                  : emotion.key === 'neutral'
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300 hover:border-gray-400'
              ]"
            >
              <input
                :ref="emotion.key + 'Input'"
                type="file"
                accept=".png,.gif"
                @change="(e) => handleFileSelect(e, emotion.key)"
                class="hidden"
              >
              
              <div v-if="!modelValue.custom.images[emotion.key]" @click="$refs[emotion.key + 'Input'][0]?.click()">
                <svg class="w-6 h-6 text-gray-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
                <div class="text-xs text-gray-500">{{ $t('emojiConfig.clickToUploadOrDrag') }}</div>
              </div>
              
              <div v-else class="w-full h-full relative">
                <img 
                  v-if="getImagePreview(emotion.key)"
                  :src="getImagePreview(emotion.key)" 
                  :alt="emotion.name"
                  class="w-full h-full object-cover rounded"
                  @error="handleImageError"
                >
                <button
                  @click="removeImage(emotion.key)"
                  class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="text-xs text-gray-500 mt-2">
          {{ $t('emojiConfig.neutralRequiredNotice') }}
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
  }
})

const emit = defineEmits(['update:modelValue'])

/**
 * Calcula el hash SHA-256 de un archivo
 * @param {File} file - El objeto de archivo
 * @returns {Promise<string>} El valor hash del archivo
 */
const calculateFileHash = async (file) => {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

const presetEmojis = [
  {
    id: 'twemoji32',
    name: t('emojiConfig.twitterEmojiName', { size: 32 }),
    description: t('emojiConfig.twitterEmojiDescription', { size: 32 }),
    size: 32,
    preview: ['neutral', 'happy', 'laughing', 'funny', 'sad', 'angry', 'crying']
  },
  {
    id: 'twemoji64',
    name: t('emojiConfig.twitterEmojiName', { size: 64 }),
    description: t('emojiConfig.twitterEmojiDescription', { size: 64 }),
    size: 64,
    preview: ['neutral', 'happy', 'laughing', 'funny', 'sad', 'angry', 'crying']
  },
  {
    id: 'notoemoji64',
    name: t('emojiConfig.notoEmojiName', { size: 64 }),
    description: t('emojiConfig.notoEmojiDescription', { size: 64 }),
    size: 64,
    preview: ['neutral', 'happy', 'laughing', 'funny', 'sad', 'angry', 'crying']
  },
  {
    id: 'kotty64',
    name: t('emojiConfig.kottyEmojiName', { size: 64 }),
    description: t('emojiConfig.kottyEmojiDescription', { size: 64 }),
    size: 64,
    preview: ['silly', 'sleepy', 'surprised', 'thinking', 'winking']
  },
  {
    id: 'kotty240',
    name: t('emojiConfig.kottyEmojiName', { size: 240 }),
    description: t('emojiConfig.kottyEmojiDescription', { size: 240 }),
    size: 240,
    preview: ['neutral', 'happy', 'funny']
  },
  {
    id: 'kotty128',
    name: t('emojiConfig.kottyEmojiName', { size: 128 }),
    description: t('emojiConfig.kottyEmojiDescription', { size: 128 }),
    size: 128,
    preview: ['neutral', 'happy', 'laughing', 'funny']
  },
  {
    id: 'notoemoji128',
    name: t('emojiConfig.notoEmojiName', { size: 128 }),
    description: t('emojiConfig.notoEmojiDescription', { size: 128 }),
    size: 128,
    preview: ['neutral', 'happy', 'laughing', 'funny']
  }
]

// Usar una propiedad computada para obtener los nombres de los emojis traducidos
const emotionList = computed(() => [
  { key: 'neutral', name: t('emojiConfig.emotions.neutral'), emoji: '😶' },
  { key: 'happy', name: t('emojiConfig.emotions.happy'), emoji: '🙂' },
  { key: 'laughing', name: t('emojiConfig.emotions.laughing'), emoji: '😆' },
  { key: 'funny', name: t('emojiConfig.emotions.funny'), emoji: '😂' },
  { key: 'sad', name: t('emojiConfig.emotions.sad'), emoji: '😔' },
  { key: 'angry', name: t('emojiConfig.emotions.angry'), emoji: '😠' },
  { key: 'crying', name: t('emojiConfig.emotions.crying'), emoji: '😭' },
  { key: 'loving', name: t('emojiConfig.emotions.loving'), emoji: '😍' },
  { key: 'embarrassed', name: t('emojiConfig.emotions.embarrassed'), emoji: '😳' },
  { key: 'surprised', name: t('emojiConfig.emotions.surprised'), emoji: '😯' },
  { key: 'shocked', name: t('emojiConfig.emotions.shocked'), emoji: '😱' },
  { key: 'thinking', name: t('emojiConfig.emotions.thinking'), emoji: '🤔' },
  { key: 'winking', name: t('emojiConfig.emotions.winking'), emoji: '😉' },
  { key: 'cool', name: t('emojiConfig.emotions.cool'), emoji: '😎' },
  { key: 'relaxed', name: t('emojiConfig.emotions.relaxed'), emoji: '😌' },
  { key: 'delicious', name: t('emojiConfig.emotions.delicious'), emoji: '🤤' },
  { key: 'kissy', name: t('emojiConfig.emotions.kissy'), emoji: '😘' },
  { key: 'confident', name: t('emojiConfig.emotions.confident'), emoji: '😏' },
  { key: 'sleepy', name: t('emojiConfig.emotions.sleepy'), emoji: '😴' },
  { key: 'silly', name: t('emojiConfig.emotions.silly'), emoji: '😜' },
  { key: 'confused', name: t('emojiConfig.emotions.confused'), emoji: '🙄' }
])

const localCustom = ref({
  size: { width: 32, height: 32 }
})

const setEmojiType = (type) => {
  // Evitar la configuración repetida del mismo tipo
  if (props.modelValue.type === type) return
  
  const newValue = { ...props.modelValue, type }
  
  if (type === 'none') {
    // Seleccionar sin paquete de emojis
    newValue.preset = ''
    newValue.custom = {
      ...props.modelValue.custom,
      images: props.modelValue.custom.images || {}
    }
  } else if (type === 'preset') {
    // Al cambiar a emojis preestablecidos, conservar los datos de emojis personalizados
    newValue.preset = props.modelValue.preset || 'twemoji32'
    newValue.custom = {
      ...props.modelValue.custom,
      images: props.modelValue.custom.images || {}
    }
  } else if (type === 'custom') {
    newValue.preset = ''
    newValue.custom = {
      ...props.modelValue.custom,
      images: props.modelValue.custom.images || {}
    }
  }
  
  emit('update:modelValue', newValue)
}

const selectPresetEmoji = (id) => {
  // Evitar la selección repetida del mismo preajuste
  if (props.modelValue.preset === id) return
  
  // Al seleccionar diferentes {{ $t('emojiConfig.presetEmojiPack') }}, conservar los datos de emojis personalizados
  emit('update:modelValue', {
    ...props.modelValue,
    preset: id,
    custom: {
      ...props.modelValue.custom,
      images: props.modelValue.custom.images || {}
    }
  })
}

const handleFileSelect = (event, emotionKey) => {
  const file = event.target.files[0]
  if (file) {
    updateEmojiImage(emotionKey, file)
  }
}

const handleFileDrop = (event, emotionKey) => {
  event.preventDefault()
  const files = event.dataTransfer.files
  if (files.length > 0) {
    updateEmojiImage(emotionKey, files[0])
  }
}

const updateEmojiImage = async (emotionKey, file) => {
  const validFormats = ['png', 'gif']
  const fileExtension = file.name.split('.').pop().toLowerCase()
  
  if (!validFormats.includes(fileExtension)) {
    alert(t('emojiConfig.selectValidFormat'))
    return
  }

  // Calcular el hash del archivo
  const fileHash = await calculateFileHash(file)
  
  // Obtener o inicializar fileMap y emotionMap
  const currentCustom = props.modelValue.custom || {}
  const fileMap = { ...(currentCustom.fileMap || {}) }
  const emotionMap = { ...(currentCustom.emotionMap || {}) }
  const images = { ...(currentCustom.images || {}) }
  
  // Comprobar si ya existe el mismo archivo
  let existingEmotions = []
  for (const [emotion, hash] of Object.entries(emotionMap)) {
    if (hash === fileHash && emotion !== emotionKey) {
      existingEmotions.push(emotion)
    }
  }
  
  // Si se detecta el mismo archivo, avisar al usuario
  if (existingEmotions.length > 0) {
    console.log(t('emojiConfig.sharedFileMessage', { emotionKey, existingEmotions: existingEmotions.join(', ') }))
  }
  
  // Actualizar las relaciones de mapeo
  fileMap[fileHash] = file
  emotionMap[emotionKey] = fileHash
  images[emotionKey] = file  // Mantener la compatibilidad con versiones anteriores
  
  emit('update:modelValue', {
    ...props.modelValue,
    custom: {
      ...currentCustom,
      size: localCustom.value.size,
      images,
      fileMap,      // Nuevo: hash -> Archivo
      emotionMap    // Nuevo: emoción -> hash
    }
  })

  // Guardar automáticamente el archivo de emoji en el almacenamiento (guardar por hash para evitar duplicados)
  await StorageHelper.saveEmojiFile(`hash_${fileHash}`, file, {
    size: localCustom.value.size,
    format: fileExtension,
    emotions: [...existingEmotions, emotionKey]  // Registrar todos los emojis que usan este archivo
  })
}

const removeImage = async (emotionKey) => {
  const currentCustom = props.modelValue.custom || {}
  const newImages = { ...currentCustom.images }
  const newEmotionMap = { ...(currentCustom.emotionMap || {}) }
  const newFileMap = { ...(currentCustom.fileMap || {}) }
  
  // Obtener el hash correspondiente al emoji que se va a eliminar
  const fileHash = newEmotionMap[emotionKey]
  
  // Eliminar el mapeo de la emoción al hash
  delete newImages[emotionKey]
  delete newEmotionMap[emotionKey]
  
  // Comprobar si algún otro emoji utiliza el mismo archivo
  const otherEmotionsUsingFile = Object.values(newEmotionMap).filter(h => h === fileHash)
  
  // Si ningún otro emoji utiliza este archivo, eliminar el archivo en sí
  if (otherEmotionsUsingFile.length === 0 && fileHash) {
    delete newFileMap[fileHash]
    // Eliminar el archivo del almacenamiento
    await StorageHelper.deleteEmojiFile(`hash_${fileHash}`)
    console.log(t('emojiConfig.fileDeleted', { fileHash }))
  } else {
    console.log(t('emojiConfig.fileRetained', { fileHash }))
  }
  
  emit('update:modelValue', {
    ...props.modelValue,
    custom: {
      ...currentCustom,
      images: newImages,
      emotionMap: newEmotionMap,
      fileMap: newFileMap
    }
  })
}

const getPresetEmojiUrl = (packId, emotion) => {
  if (packId === 'notoemoji128' || packId === 'notoemoji64' || packId === 'kotty128' || packId === 'kotty64' || packId === 'kotty240') {
    const dir = packId === 'notoemoji128'
      ? 'notoemoji128'
      : packId === 'notoemoji64'
        ? 'notoemoji64'
        : packId === 'kotty128'
          ? 'kotty128'
          : packId === 'kotty64'
            ? 'kotty64'
            : 'kotty240'
    return `./static/${dir}/${emotion}.gif`
  }
  const size = packId === 'twemoji64' ? '64' : '32'
  return `./static/twemoji${size}/${emotion}.png`
}

const getPreviewList = (pack) => {
  if (!pack?.preview) return []
  if (pack.size >= 240) return pack.preview.slice(0, 2)
  if (pack.size > 128) return pack.preview.slice(0, 4)
  return pack.preview
}

const getImagePreview = (emotionKey) => {
  if (props.modelValue.type === 'preset') {
    return getPresetEmojiUrl(props.modelValue.preset, emotionKey)
  } else {
    const file = props.modelValue.custom.images[emotionKey]
    // Solo crear una vista previa si es un Archivo o Blob, para evitar errores con objetos de marcador de posición después de la restauración
    if (file instanceof File || file instanceof Blob) {
      return URL.createObjectURL(file)
    }
    return null
  }
}

const handleImageError = (event) => {
  console.warn(t('emojiConfig.imageLoadFailed'), event.target.src)
  // Se puede establecer una imagen de respaldo predeterminada
  event.target.style.display = 'none'
}

// Eliminar el observador que podría causar una recursión infinita
// Usar una propiedad computada para sincronizar localCustom y evitar conflictos de enlace bidireccional
watch(() => localCustom.value.size, (newSize) => {
  if (props.modelValue.type === 'custom') {
    const currentCustom = props.modelValue.custom
    // Solo activar la actualización si el valor del tamaño realmente ha cambiado
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
