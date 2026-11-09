<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'default' })

const FALLBACK_LATITUDE = -7.7495
const FALLBACK_LONGITUDE = 110.3778

const route = useRoute()
const toast = useToast()
const router = useRouter()
const isMobile = useMediaQuery('(max-width: 767px)')
const loading = ref(false)
const loaded = ref(false)
const loadError = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const drawerOpen = ref(true)
const roomId = Number(route.params.id)

const form = reactive({
  name: '',
  latitude: String(FALLBACK_LATITUDE),
  longitude: String(FALLBACK_LONGITUDE),
  radius: '20'
})

onMounted(async () => {
  try {
    const res = await $fetch<{
      room: {
        name: string
        latitude: number
        longitude: number
        radius: number
      }
    }>(`/api/rooms/${roomId}`)
    form.name = res.room.name
    form.latitude = String(res.room.latitude)
    form.longitude = String(res.room.longitude)
    form.radius = String(res.room.radius)
    loaded.value = true
  } catch (err: unknown) {
    loadError.value = getApiErrorMessage(err)
  }
})

async function onSubmit() {
  errorMessage.value = null
  loading.value = true
  try {
    await $fetch(`/api/rooms/${roomId}`, {
      method: 'PATCH',
      body: {
        name: form.name.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radius: Number(form.radius)
      }
    })
    toast.add({
      title: 'Berhasil',
      description: 'Ruangan berhasil diperbarui.',
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
  <div v-if="loadError" class="w-full">
    <UAlert color="error" variant="soft" :description="loadError" />
  </div>
  <div
    v-else
    class="relative min-h-[calc(100dvh-7rem)] md:grid md:grid-cols-[minmax(340px,420px)_1fr] md:gap-6"
  >
    <div class="relative z-10 hidden md:block">
      <div class="mb-4">
        <h1 class="text-2xl font-semibold">Ubah Ruangan</h1>
        <p class="text-sm text-muted">
          Geser peta untuk memindahkan titik tengah ruangan.
        </p>
      </div>
      <UCard>
        <RoomForm
          v-model="form"
          :error-message="errorMessage"
          :loading="loading"
          submit-label="Simpan perubahan"
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
        @update:latitude="form.latitude = String($event)"
        @update:longitude="form.longitude = String($event)"
      />
      <div
        class="pointer-events-none absolute inset-x-4 top-4 z-1000 md:hidden"
      >
        <UCard class="pointer-events-auto shadow-xl">
          <h1 class="text-lg font-semibold">Ubah Ruangan</h1>
          <p class="text-xs text-muted">
            Geser peta untuk memindahkan titik ruangan.
          </p>
        </UCard>
      </div>
    </div>

    <UDrawer
      v-if="isMobile && loaded"
      v-model:open="drawerOpen"
      direction="bottom"
    >
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
            submit-label="Simpan perubahan"
            @submit="onSubmit"
            @cancel="router.push('/rooms')"
          />
        </div>
      </template>
    </UDrawer>
  </div>
</template>
