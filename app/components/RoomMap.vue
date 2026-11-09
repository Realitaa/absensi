<script setup lang="ts">
import type { Map as LeafletMap, Circle } from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = withDefaults(
  defineProps<{
    latitude: number
    longitude: number
    radius: number
    interactive?: boolean
    height?: string
  }>(),
  {
    interactive: true,
    height: '360px'
  }
)

const emit = defineEmits<{
  'update:latitude': [value: number]
  'update:longitude': [value: number]
}>()

const mapElement = ref<HTMLElement | null>(null)
let map: LeafletMap | null = null
let circle: Circle | null = null
let leaflet: typeof import('leaflet') | null = null
let updatingFromProps = false

const mapStyle = computed(() => ({ height: props.height }))
const center = computed(
  () => [props.latitude, props.longitude] as [number, number]
)

function updateCircle() {
  if (!map || !circle) return
  circle.setLatLng(center.value)
  circle.setRadius(props.radius)
}

function emitMapCenter() {
  if (!map || updatingFromProps) return
  const current = map.getCenter()
  emit('update:latitude', Number(current.lat.toFixed(7)))
  emit('update:longitude', Number(current.lng.toFixed(7)))
  updateCircle()
}

async function initializeMap() {
  if (!mapElement.value || map) return

  leaflet = await import('leaflet')
  map = leaflet.map(mapElement.value, {
    center: center.value,
    zoom: 18,
    zoomControl: true,
    dragging: props.interactive,
    scrollWheelZoom: props.interactive,
    doubleClickZoom: props.interactive,
    touchZoom: props.interactive,
    boxZoom: false,
    keyboard: props.interactive
  })

  leaflet
    .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    })
    .addTo(map)

  circle = leaflet
    .circle(center.value, {
      radius: props.radius,
      color: 'var(--ui-color-primary-500)',
      fillColor: 'var(--ui-color-primary-400)',
      fillOpacity: 0.16,
      weight: 2
    })
    .addTo(map)

  map.on('moveend', emitMapCenter)
  nextTick(() => map?.invalidateSize())
}

watch(center, nextCenter => {
  if (!map) return
  const current = map.getCenter()
  if (
    Math.abs(current.lat - nextCenter[0]) < 0.0000001 &&
    Math.abs(current.lng - nextCenter[1]) < 0.0000001
  ) {
    updateCircle()
    return
  }

  updatingFromProps = true
  map.setView(nextCenter, map.getZoom(), { animate: false })
  updateCircle()
  nextTick(() => {
    updatingFromProps = false
  })
})

watch(() => props.radius, updateCircle)

onMounted(initializeMap)
onUnmounted(() => {
  map?.remove()
  map = null
  circle = null
})
</script>

<template>
  <div class="relative overflow-hidden rounded-lg" :style="mapStyle">
    <div ref="mapElement" class="size-full" />
    <div
      class="pointer-events-none absolute top-1/2 left-1/2 z-1000 -translate-x-1/2 -translate-y-1/2"
      aria-hidden="true"
    >
      <div
        class="size-5 rounded-full border-3 border-white bg-primary shadow-lg"
      />
      <div
        class="absolute top-1/2 left-1/2 h-8 w-px -translate-x-1/2 -translate-y-1/2 bg-primary/70"
      />
      <div
        class="absolute top-1/2 left-1/2 h-px w-8 -translate-x-1/2 -translate-y-1/2 bg-primary/70"
      />
    </div>
  </div>
</template>
