<script setup lang="ts">
import type { Circle, CircleMarker, Map as LeafletMap, Marker } from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps<{
  room: { latitude: number; longitude: number; radius: number }
  student: { latitude: number; longitude: number } | null
  valid: boolean
}>()

const element = ref<HTMLElement | null>(null)
let map: LeafletMap | null = null
let roomMarker: Marker | null = null
let studentMarker: CircleMarker | null = null
let circle: Circle | null = null
let leaflet: typeof import('leaflet') | null = null

async function init() {
  if (!element.value) return
  leaflet = await import('leaflet')
  map = leaflet.map(element.value, {
    center: [props.room.latitude, props.room.longitude],
    zoom: 18
  })
  leaflet
    .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    })
    .addTo(map)
  roomMarker = leaflet
    .marker([props.room.latitude, props.room.longitude])
    .addTo(map)
  roomMarker.bindPopup('Lokasi ruangan')
  circle = leaflet
    .circle([props.room.latitude, props.room.longitude], {
      radius: props.room.radius,
      color: 'var(--ui-color-primary-500)',
      fillColor: 'var(--ui-color-primary-400)',
      fillOpacity: 0.16
    })
    .addTo(map)
  updateStudent()
  nextTick(() => map?.invalidateSize())
}

function updateStudent() {
  if (!map || !leaflet) return
  if (!props.student) {
    if (studentMarker) {
      studentMarker.remove()
      studentMarker = null
    }
    return
  }
  const position: [number, number] = [
    props.student.latitude,
    props.student.longitude
  ]
  if (!studentMarker) {
    const marker = leaflet
      .circleMarker(position, {
        radius: 8,
        color: props.valid ? '#16a34a' : '#dc2626',
        fillColor: props.valid ? '#22c55e' : '#ef4444',
        fillOpacity: 0.9
      })
      .addTo(map)
    studentMarker = marker
    marker.bindPopup('Lokasi Anda')
  } else {
    studentMarker.setLatLng(position)
    studentMarker.setStyle({
      color: props.valid ? '#16a34a' : '#dc2626',
      fillColor: props.valid ? '#22c55e' : '#ef4444'
    })
  }
}

watch(() => [props.student, props.valid] as const, updateStudent, {
  deep: true
})
watch(
  () => props.room,
  () => {
    if (!map || !circle || !roomMarker) return
    const center: [number, number] = [props.room.latitude, props.room.longitude]
    map.setView(center, map.getZoom(), { animate: false })
    roomMarker.setLatLng(center)
    circle.setLatLng(center).setRadius(props.room.radius)
  },
  { deep: true }
)
onMounted(init)
onUnmounted(() => map?.remove())
</script>

<template>
  <div ref="element" class="h-72 w-full overflow-hidden rounded-lg" />
</template>
