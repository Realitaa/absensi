<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'default' })

const FALLBACK_LATITUDE = -7.7495
const FALLBACK_LONGITUDE = 110.3778

const toast = useToast()
const router = useRouter()
const isMobile = useMediaQuery('(max-width: 767px)')
const { coords } = useGeolocation()
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const drawerOpen = ref(false)
const coordinateChanged = ref(false)
let coordinateResetTimer: ReturnType<typeof setTimeout> | undefined

const form = reactive({
  name: '',
  latitude: String(FALLBACK_LATITUDE),
  longitude: String(FALLBACK_LONGITUDE),
  radius: '20'
})

function markCoordinateChanged() {
  coordinateChanged.value = true
  if (coordinateResetTimer) clearTimeout(coordinateResetTimer)
  coordinateResetTimer = setTimeout(() => {
    coordinateChanged.value = false
  }, 900)
}

function updateLatitude(value: number) {
  form.latitude = String(value)
  markCoordinateChanged()
}

function updateLongitude(value: number) {
  form.longitude = String(value)
  markCoordinateChanged()
}

watch(
  () => [coords.value.latitude, coords.value.longitude],
  ([latitude, longitude]) => {
    if (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      form.latitude = latitude.toFixed(7)
      form.longitude = longitude.toFixed(7)
      markCoordinateChanged()
    }
  }
)

onUnmounted(() => {
  if (coordinateResetTimer) clearTimeout(coordinateResetTimer)
})

async function onSubmit() {
  errorMessage.value = null
  loading.value = true
  try {
    await $fetch('/api/rooms', {
      method: 'POST',
      body: {
        name: form.name.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radius: Number(form.radius)
      }
    })
    toast.add({
      title: 'Berhasil',
      description: 'Ruangan berhasil dibuat.',
      color: 'success'
    })
    await router.push('/rooms')
  } catch (err: unknown) {
    errorMessage.value = getApiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    class="relative min-h-[calc(100dvh-7rem)] md:grid md:grid-cols-[minmax(340px,420px)_1fr] md:gap-6"
  >
    <div class="relative z-10 hidden md:block">
      <div class="mb-4">
        <h1 class="text-2xl font-semibold">Tambah Ruangan</h1>
        <p class="text-sm text-muted">
          Geser peta untuk menentukan titik tengah ruangan. Koordinat akan
          diperbarui otomatis.
        </p>
      </div>
      <UCard>
        <RoomForm
          v-model="form"
          :error-message="errorMessage"
          :loading="loading"
          submit-label="Simpan"
          @submit="onSubmit"
          @cancel="router.push('/rooms')"
        />
      </UCard>
    </div>

    <div class="absolute inset-0 md:relative md:inset-auto md:min-h-[600px]">
      <RoomMap
        :latitude="Number(form.latitude)"
        :longitude="Number(form.longitude)"
        :radius="Number(form.radius) || 1"
        height="100%"
        @update:latitude="updateLatitude"
        @update:longitude="updateLongitude"
      />
      <div
        class="pointer-events-none absolute inset-x-4 bottom-4 z-1000 md:hidden"
      >
        <UCard
          class="pointer-events-auto cursor-pointer shadow-xl"
          role="button"
          tabindex="0"
          @click="drawerOpen = true"
          @keydown.enter.prevent="drawerOpen = true"
          @keydown.space.prevent="drawerOpen = true"
        >
          <div class="mb-2 flex justify-center">
            <UIcon
              name="i-lucide-chevron-up"
              class="size-6 transition-colors"
              :class="coordinateChanged ? 'text-primary' : 'text-muted'"
              :style="
                coordinateChanged
                  ? {
                      animation:
                        'room-coordinate-caret-jiggle 0.45s ease-in-out 2'
                    }
                  : undefined
              "
              aria-hidden="true"
            />
          </div>
          <h1 class="text-lg font-semibold">Tambah Ruangan</h1>
          <p class="text-xs text-muted">
            Geser peta untuk menentukan titik ruangan. Ketuk kartu untuk membuka
            formulir.
          </p>
        </UCard>
      </div>
    </div>

    <UDrawer v-if="isMobile" v-model:open="drawerOpen" direction="bottom">
      <template #content>
        <div class="max-h-[72dvh] overflow-y-auto p-4">
          <div class="mb-4">
            <h2 class="text-base font-semibold">Informasi Ruangan</h2>
            <p class="text-xs text-muted">Radius maksimal 20 meter.</p>
          </div>
          <RoomForm
            v-model="form"
            :error-message="errorMessage"
            :loading="loading"
            submit-label="Simpan"
            @submit="onSubmit"
            @cancel="router.push('/rooms')"
          />
        </div>
      </template>
    </UDrawer>
  </div>
</template>
