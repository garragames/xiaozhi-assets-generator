<template>
  <!-- Diseño de escritorio -->
  <div v-if="showComponent" class="hidden lg:flex items-center space-x-4" :class="deviceStatus.isOnline ? '' : 'opacity-60'">
    <!-- Indicador de estado del dispositivo -->
    <div class="flex items-center space-x-2">
      <!-- Icono de estado en línea -->
      <div class="flex items-center space-x-1">
        <div
          :class="[
            'w-2 h-2 rounded-full',
            deviceStatus.isOnline ? 'bg-green-500' : 'bg-gray-400'
          ]"
        ></div>
        <span :class="[
          'text-sm font-medium',
          deviceStatus.isOnline ? 'text-gray-700' : 'text-gray-500'
        ]">
          {{ deviceStatus.isOnline ? $t('device.online') : $t('device.offline') }}
        </span>
      </div>

      <!-- Estado de la red -->
      <div v-if="deviceStatus.isOnline && deviceInfo.network" class="flex items-center space-x-1">
        <!-- Icono de Wi-Fi -->
        <WifiIcon v-if="deviceInfo.network.type === 'wifi'" color="text-blue-500" />
        <!-- Icono de señal 4G -->
        <Signal4GIcon v-else-if="deviceInfo.network.type === '4g'" />
        <span class="text-xs text-gray-500">{{ getSignalDisplayText(deviceInfo.network.signal, t) }}</span>
      </div>
    </div>

    <!-- Información detallada del dispositivo -->
    <div v-if="deviceStatus.isOnline" class="flex items-center space-x-4 text-sm text-gray-600">
      <!-- Información del chip -->
      <div v-if="deviceInfo.chip" class="flex items-center space-x-1">
        <ChipIcon />
        <span>{{ deviceInfo.chip.model }}</span>
      </div>

      <!-- Tamaño del flash -->
      <div v-if="deviceInfo.flash" class="flex items-center space-x-1">
        <FlashIcon />
        <span>{{ deviceInfo.flash.size }}</span>
      </div>

      <!-- Información de la placa -->
      <div v-if="deviceInfo.board" class="flex items-center space-x-1">
        <BoardIcon />
        <span>{{ deviceInfo.board.model }}</span>
      </div>

      <!-- Resolución de pantalla -->
      <div v-if="deviceInfo.screen" class="flex items-center space-x-1">
        <ScreenIcon />
        <span>{{ deviceInfo.screen.resolution }}</span>
      </div>
    </div>

  </div>

  <!-- Diseño móvil -->
  <div v-if="showComponent" class="lg:hidden flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
    <!-- Barra de estado superior -->
    <div class="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
      <div class="flex items-center space-x-2">
        <div
          :class="[
            'w-2.5 h-2.5 rounded-full',
            deviceStatus.isOnline ? 'bg-green-500' : 'bg-red-400'
          ]"
        ></div>
        <span :class="[
          'text-sm font-medium',
          deviceStatus.isOnline ? 'text-gray-800' : 'text-gray-600'
        ]">
          {{ deviceStatus.isOnline ? $t('device.online') : $t('device.offline') }}
        </span>
      </div>

      <!-- Estado de la red -->
      <div v-if="deviceStatus.isOnline && deviceInfo.network" class="flex items-center space-x-1">
        <WifiIcon v-if="deviceInfo.network.type === 'wifi'" color="text-blue-500" />
        <Signal4GIcon v-else-if="deviceInfo.network.type === '4g'" />
        <span class="text-xs font-medium text-gray-600">{{ getSignalDisplayText(deviceInfo.network.signal, t) }}</span>
      </div>
    </div>

    <!-- Área de información del dispositivo -->
    <div v-if="deviceStatus.isOnline" class="px-4 py-3">
      <div class="grid grid-cols-1 gap-2.5">
        <!-- Primera fila: chip y placa -->
        <div class="flex justify-between items-center py-1.5 border-b border-gray-100">
          <div v-if="deviceInfo.chip" class="flex items-center space-x-2 flex-1">
            <ChipIcon class="flex-shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="text-xs text-gray-500 leading-tight">{{ $t('device.chip') }}</div>
              <div class="text-sm text-gray-800 font-medium truncate">{{ deviceInfo.chip.model }}</div>
            </div>
          </div>

          <div v-if="deviceInfo.board" class="flex items-center space-x-2 flex-1 ml-3">
            <BoardIcon class="flex-shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="text-xs text-gray-500 leading-tight">{{ $t('device.board') }}</div>
              <div class="text-sm text-gray-800 font-medium truncate">{{ deviceInfo.board.model }}</div>
            </div>
          </div>
        </div>

        <!-- Segunda fila: Flash y pantalla -->
        <div class="flex justify-between items-center py-1.5">
          <div v-if="deviceInfo.flash" class="flex items-center space-x-2 flex-1">
            <FlashIcon class="flex-shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="text-xs text-gray-500 leading-tight">{{ $t('device.flash') }}</div>
              <div class="text-sm text-gray-800 font-medium">{{ deviceInfo.flash.size }}</div>
            </div>
          </div>

          <div v-if="deviceInfo.screen" class="flex items-center space-x-2 flex-1 ml-3">
            <ScreenIcon class="flex-shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="text-xs text-gray-500 leading-tight">{{ $t('device.screen') }}</div>
              <div class="text-sm text-gray-800 font-medium">{{ deviceInfo.screen.resolution }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDeviceStatus } from '@/composables/useDeviceStatus'
import { WifiIcon, Signal4GIcon, ChipIcon, FlashIcon, BoardIcon, ScreenIcon } from '@/components/icons'

const { t } = useI18n()

// Usar el estado del dispositivo compartido
const {
  deviceStatus,
  deviceInfo,
  hasToken,
  initializeDeviceStatus,
  cleanupDeviceStatus,
  getSignalDisplayText
} = useDeviceStatus()

// Decidir si mostrar el componente según si hay un token
const showComponent = computed(() => hasToken.value)

// Inicializar el componente
onMounted(() => {
  initializeDeviceStatus()
})

// Limpiar recursos
onUnmounted(() => {
  cleanupDeviceStatus()
})
</script>
