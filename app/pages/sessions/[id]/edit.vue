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

interface Session {
  id: number
  roomId: number
  name: string
  description: string | null
  startsAt: string
  lateThresholdAt: string
  closesAt: string
  status: string
}

const route = useRoute()
const toast = useToast()
const router = useRouter()
const sessionId = Number(route.params.id)
const loading = ref(false)
const loaded = ref(false)
const loadError = ref<string | null>(null)
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

onMounted(async () => {
  try {
    const [sessionRes, roomsRes] = await Promise.all([
      $fetch<{ session: Session }>(`/api/sessions/${sessionId}`),
      $fetch<{ rooms: Room[] }>('/api/rooms', {
        query: { page: 1, pageSize: 100 }
      })
    ])
    const s = sessionRes.session
    form.name = s.name
    form.description = s.description ?? ''
    form.roomId = String(s.roomId)
    form.startsLocal = toLocalInputValue(s.startsAt)
    form.lateLocal = toLocalInputValue(s.lateThresholdAt)
    form.closesLocal = toLocalInputValue(s.closesAt)
    rooms.value = roomsRes.rooms
    loaded.value = true
  } catch (err: unknown) {
    loadError.value = getApiErrorMessage(err)
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
    await $fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
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
      description: 'Sesi berhasil diperbarui.',
      color: 'success'
    })
    await router.push(`/sessions/${sessionId}`)
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
      <h1 class="text-2xl font-semibold">Ubah Sesi</h1>
      <p class="text-sm text-muted">Perbarui rincian sesi absensi Anda.</p>
    </div>
    <UAlert
      v-if="loadError"
      color="error"
      variant="soft"
      :description="loadError"
    />
    <UCard v-else-if="!loaded">
      <p class="text-sm text-muted">Memuat…</p>
    </UCard>
    <UCard v-else>
      <SessionForm
        v-model="form"
        :rooms="rooms"
        :rooms-loading="roomsLoading"
        :error-message="errorMessage"
        :loading="loading"
        submit-label="Simpan perubahan"
        @submit="onSubmit"
        @cancel="router.push(`/sessions/${sessionId}`)"
      />
    </UCard>
  </div>
</template>
