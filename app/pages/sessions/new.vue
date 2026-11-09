<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'default' })

interface Room {
  id: number
  name: string
  latitude: number
  longitude: number
  radius: number
  createdAt: string
  updatedAt: string
}

const toast = useToast()
const router = useRouter()
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const rooms = ref<Room[]>([])
const roomsLoading = ref(true)

const form = reactive({
  name: '',
  description: '',
  roomId: '',
  startsLocal: '',
  lateLocal: '',
  closesLocal: ''
})

const selectedRoom = computed(
  () => rooms.value.find(r => String(r.id) === form.roomId) ?? null
)

onMounted(async () => {
  try {
    const res = await $fetch<{ rooms: Room[] }>('/api/rooms', {
      query: { page: 1, pageSize: 100 }
    })
    rooms.value = res.rooms
  } catch (err: unknown) {
    errorMessage.value = getApiErrorMessage(err)
  } finally {
    roomsLoading.value = false
  }
})

async function onSubmit() {
  errorMessage.value = null
  const startsAt = parseLocalToIsoUtc(form.startsLocal)
  const lateThresholdAt = parseLocalToIsoUtc(form.lateLocal)
  const closesAt = parseLocalToIsoUtc(form.closesLocal)
  if (!startsAt || !lateThresholdAt || !closesAt) {
    errorMessage.value = 'Format tanggal tidak valid.'
    return
  }
  loading.value = true
  try {
    await $fetch('/api/sessions', {
      method: 'POST',
      body: {
        name: form.name.trim(),
        description: form.description.trim() || null,
        roomId: Number(form.roomId),
        startsAt,
        lateThresholdAt,
        closesAt
      }
    })
    toast.add({
      title: 'Berhasil',
      description: 'Sesi berhasil dibuat.',
      color: 'success'
    })
    await router.push('/sessions')
  } catch (err: unknown) {
    errorMessage.value = getApiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Tambah Sesi</h1>
      <p class="text-sm text-muted">
        Buat sesi absensi baru untuk ruangan Anda.
      </p>
    </div>

    <!-- Split layout 50/50 desktop, map first on mobile -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <!-- Map (right on desktop, first on mobile via order) -->
      <div
        class="order-1 min-h-[320px] overflow-hidden rounded-lg border border-default bg-muted/20 md:order-2 md:min-h-[600px]"
      >
        <div v-if="selectedRoom" class="flex h-full flex-col">
          <div class="flex items-center justify-between px-4 pt-4 pb-2">
            <div>
              <p class="font-medium">{{ selectedRoom.name }}</p>
              <p class="text-xs text-muted">
                Radius geofence: {{ selectedRoom.radius }} meter
              </p>
            </div>
            <UBadge color="neutral" variant="soft" class="shrink-0">
              {{ selectedRoom.latitude.toFixed(4) }},
              {{ selectedRoom.longitude.toFixed(4) }}
            </UBadge>
          </div>
          <div class="min-h-0 flex-1 px-4 pb-4">
            <RoomMap
              :latitude="selectedRoom.latitude"
              :longitude="selectedRoom.longitude"
              :radius="selectedRoom.radius"
              :interactive="false"
              height="100%"
              class="h-full min-h-[280px]"
            />
          </div>
          <p class="px-4 pb-4 text-xs text-muted">
            Lokasi ruangan hanya untuk visualisasi. Koordinat tidak dapat diubah
            dari halaman ini.
          </p>
        </div>
        <div
          v-else
          class="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 p-6 text-center md:min-h-[600px]"
        >
          <UIcon name="i-lucide-map-pin" class="size-8 text-muted" />
          <p class="text-sm text-muted">
            Pilih ruangan untuk melihat lokasi kelas.
          </p>
          <p class="text-xs text-muted/70">
            Peta akan menampilkan titik tengah dan radius geofence ruangan.
          </p>
        </div>
      </div>

      <!-- Form -->
      <div class="order-2 md:order-1">
        <UCard>
          <SessionForm
            v-model="form"
            :rooms="rooms"
            :rooms-loading="roomsLoading"
            :error-message="errorMessage"
            :loading="loading"
            submit-label="Simpan"
            @submit="onSubmit"
            @cancel="router.push('/sessions')"
          />
        </UCard>
      </div>
    </div>
  </div>
</template>
