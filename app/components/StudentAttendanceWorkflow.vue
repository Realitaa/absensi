<script setup lang="ts">
interface StudentSession {
  id: number
  name: string
  description: string | null
  lecturerName: string
  startsAt: string
  lateThresholdAt: string
  closesAt: string
  status: 'open-present' | 'open-late'
  room: {
    id: number
    name: string
    latitude: number
    longitude: number
    radius: number
  }
}

type WorkflowState =
  | 'loading-sessions'
  | 'selecting'
  | 'gps-requesting'
  | 'gps-acquiring'
  | 'gps-failed'
  | 'gps-succeeded'
  | 'camera-initializing'
  | 'camera-ready'
  | 'selfie-captured'
  | 'uploading'
  | 'submitting'
  | 'succeeded'
  | 'failed'
  | 'closed'

const sessions = ref<StudentSession[]>([])
const selected = ref<StudentSession | null>(null)
const search = ref('')
const state = ref<WorkflowState>('loading-sessions')
const stateMessage = ref('')
const sessionError = ref('')
const serverTime = ref('')
const gps = ref<{
  latitude: number
  longitude: number
  accuracy: number
} | null>(null)
const gpsPolicy = ref<'K1' | 'K2' | 'K3' | null>(null)
const gpsDistance = ref<number | null>(null)
const gpsValid = ref(false)
const video = ref<HTMLVideoElement | null>(null)
const previewUrl = ref<string | null>(null)
const capturedBlob = ref<Blob | null>(null)
const uploadPath = ref('')
const attendance = ref<{
  sessionName: string
  roomName: string
  timestamp: string
  status: string
} | null>(null)
let watchId: number | null = null
let mediaStream: MediaStream | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null

const filteredSessions = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  if (!term) return sessions.value
  return sessions.value.filter(session =>
    `${session.name} ${session.room.name}`.toLocaleLowerCase().includes(term)
  )
})

function formatTime(value: string) {
  return formatDateIndonesia(value)
}

function distanceBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const r = 6_371_000
  const rad = (v: number) => (v * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2
  return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function evaluateCurrentGps() {
  if (!gps.value || !selected.value || !gpsPolicy.value) return false
  gpsDistance.value = distanceBetween(gps.value, selected.value.room)
  const radius = selected.value.room.radius
  gpsValid.value =
    gpsPolicy.value === 'K1'
      ? gpsDistance.value <= radius
      : gpsPolicy.value === 'K2'
        ? gpsDistance.value <= radius && gps.value.accuracy <= radius
        : gpsDistance.value + gps.value.accuracy <= radius
  return gpsValid.value
}

function stopGps() {
  if (
    watchId !== null &&
    typeof navigator !== 'undefined' &&
    navigator.geolocation
  ) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }
}

function stopCamera() {
  mediaStream?.getTracks().forEach(track => track.stop())
  mediaStream = null
  if (video.value) video.value.srcObject = null
}

function resetCapture() {
  stopCamera()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
  capturedBlob.value = null
  uploadPath.value = ''
}

async function loadSessions() {
  state.value = 'loading-sessions'
  sessionError.value = ''
  try {
    const result = await $fetch<{
      sessions: StudentSession[]
      serverTime: string
    }>('/api/attendance/sessions')
    sessions.value = result.sessions
    serverTime.value = result.serverTime
    state.value = 'selecting'
  } catch (error) {
    state.value = 'failed'
    sessionError.value = getApiErrorMessage(error)
  }
}

function beginMonitoring() {
  if (!navigator.geolocation) {
    state.value = 'gps-failed'
    stateMessage.value = 'Peramban tidak mendukung lokasi GPS.'
    return
  }
  state.value = 'gps-requesting'
  watchId = navigator.geolocation.watchPosition(
    position => {
      gps.value = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      }
      if (gpsPolicy.value) {
        const valid = evaluateCurrentGps()
        if (
          !valid &&
          ['camera-initializing', 'camera-ready', 'selfie-captured'].includes(
            state.value
          )
        ) {
          stopCamera()
          state.value = 'gps-failed'
          stateMessage.value =
            'Posisi Anda sudah berada di luar area yang diizinkan. Verifikasi ulang GPS.'
        }
      }
      if (state.value === 'gps-requesting') state.value = 'gps-acquiring'
    },
    error => {
      state.value = 'gps-failed'
      stateMessage.value =
        error.code === 1
          ? 'Izin lokasi ditolak. Aktifkan izin lokasi untuk melanjutkan.'
          : error.code === 3
            ? 'Permintaan lokasi habis waktu. Coba lagi.'
            : 'Lokasi GPS tidak tersedia saat ini.'
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }
  )
}

async function selectSession(session: StudentSession) {
  resetCapture()
  stopGps()
  selected.value = session
  gps.value = null
  gpsPolicy.value = null
  gpsDistance.value = null
  gpsValid.value = false
  attendance.value = null
  stateMessage.value = ''
  beginMonitoring()
}

async function verifyGps() {
  if (!selected.value) return
  if (!gps.value) {
    state.value = 'gps-failed'
    stateMessage.value =
      'Tunggu sampai lokasi berhasil diperoleh, lalu coba lagi.'
    return
  }
  state.value = 'gps-acquiring'
  try {
    const result = await $fetch<{
      policy: 'K1' | 'K2' | 'K3'
      distance: number
    }>('/api/attendance/verify-gps', {
      method: 'POST',
      body: { sessionId: selected.value.id, ...gps.value }
    })
    gpsPolicy.value = result.policy
    gpsDistance.value = result.distance
    gpsValid.value = true
    state.value = 'gps-succeeded'
    await openCamera()
  } catch (error) {
    gpsValid.value = false
    const details = getApiErrorDetails(error)
    if (details?.policy === 'K1' || details?.policy === 'K2' || details?.policy === 'K3') {
      gpsPolicy.value = details.policy
    }
    if (typeof details?.distance === 'number') gpsDistance.value = details.distance
    state.value = 'gps-failed'
    if (
      typeof details?.accuracy === 'number' &&
      typeof details?.radius === 'number'
    ) {
      stateMessage.value = `Akurasi GPS Anda ${details.accuracy.toFixed(1)} m, sedangkan radius ruangan hanya ${details.radius.toFixed(1)} m. Pindah ke area terbuka atau tunggu sinyal GPS lebih baik.`
    } else {
      stateMessage.value = getApiErrorMessage(error)
    }
  }
}

async function openCamera() {
  state.value = 'camera-initializing'
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false
    })
    if (!video.value) throw new Error('Camera element is unavailable')
    video.value.srcObject = mediaStream
    await video.value.play()
    state.value = 'camera-ready'
  } catch {
    state.value = 'failed'
    stateMessage.value = 'Kamera tidak tersedia atau izinnya ditolak.'
  }
}

function captureSelfie() {
  if (!video.value) return
  const canvas = document.createElement('canvas')
  canvas.width = video.value.videoWidth || 640
  canvas.height = video.value.videoHeight || 480
  canvas
    .getContext('2d')
    ?.drawImage(video.value, 0, 0, canvas.width, canvas.height)
  canvas.toBlob(
    blob => {
      if (!blob) return
      capturedBlob.value = blob
      previewUrl.value = URL.createObjectURL(blob)
      stopCamera()
      state.value = 'selfie-captured'
    },
    'image/jpeg',
    0.88
  )
}

async function uploadAndSubmit() {
  if (!capturedBlob.value || !selected.value || !gps.value) return
  state.value = 'uploading'
  const form = new FormData()
  form.append('file', capturedBlob.value, 'selfie.jpg')
  try {
    const upload = await $fetch<{ upload: { photoPath: string } }>(
      '/api/selfies/upload',
      { method: 'POST', body: form }
    )
    uploadPath.value = upload.upload.photoPath
    state.value = 'submitting'
    const result = await $fetch<{ attendance: typeof attendance.value }>(
      '/api/attendance/submit',
      {
        method: 'POST',
        body: {
          sessionId: selected.value.id,
          photoPath: uploadPath.value,
          ...gps.value
        }
      }
    )
    attendance.value = result.attendance
    state.value = 'succeeded'
    stopGps()
    stopCamera()
  } catch (error) {
    state.value = 'failed'
    stateMessage.value = getApiErrorMessage(error)
  }
}

function retake() {
  resetCapture()
  void openCamera()
}

async function switchSession() {
  resetCapture()
  stopGps()
  selected.value = null
  gps.value = null
  gpsPolicy.value = null
  attendance.value = null
  await loadSessions()
}

onMounted(() => {
  void loadSessions()
  refreshTimer = setInterval(async () => {
    if (!selected.value && state.value !== 'loading-sessions') {
      await loadSessions()
      return
    }
    if (!selected.value) return
    try {
      const result = await $fetch<{ sessions: StudentSession[] }>(
        '/api/attendance/sessions'
      )
      const current = result.sessions.find(
        session => session.id === selected.value?.id
      )
      if (!current) {
        stopGps()
        stopCamera()
        state.value = 'closed'
        stateMessage.value = 'Sesi sudah ditutup atau tidak lagi tersedia.'
      }
    } catch {
      // Keep the active workflow usable when a background refresh is unavailable.
    }
  }, 60_000)
})
onUnmounted(() => {
  stopGps()
  stopCamera()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div class="space-y-6">
    <div
      class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h1 class="text-2xl font-semibold">Absensi Mahasiswa</h1>
        <p class="text-sm text-muted">
          Pilih sesi yang sedang berlangsung untuk mengisi absensi.
        </p>
      </div>
      <UButton
        v-if="!selected"
        icon="i-lucide-refresh-cw"
        label="Muat ulang"
        variant="soft"
        :loading="state === 'loading-sessions'"
        @click="loadSessions"
      />
      <UButton
        v-else
        icon="i-lucide-arrow-left"
        label="Ganti sesi"
        variant="soft"
        :disabled="state === 'uploading' || state === 'submitting'"
        @click="switchSession"
      />
    </div>

    <UAlert
      v-if="sessionError"
      color="error"
      variant="soft"
      :description="sessionError"
    />
    <template v-if="!selected">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Cari nama sesi atau ruangan"
        class="w-full sm:max-w-md"
      />
      <div
        v-if="state === 'loading-sessions'"
        class="py-12 text-center text-sm text-muted"
      >
        Memuat sesi yang sedang berlangsung...
      </div>
      <div
        v-else-if="filteredSessions.length === 0"
        class="rounded-lg border border-dashed p-10 text-center text-sm text-muted"
      >
        Tidak ada sesi absensi yang sedang berlangsung.
      </div>
      <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <UCard
          v-for="session in filteredSessions"
          :key="session.id"
          class="flex flex-col"
        >
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-3">
              <h2 class="font-semibold">{{ session.name }}</h2>
              <UBadge
                :color="
                  session.status === 'open-present' ? 'success' : 'warning'
                "
                variant="soft"
                >{{
                  session.status === 'open-present' ? 'Hadir' : 'Terlambat'
                }}</UBadge
              >
            </div>
            <dl class="space-y-1 text-sm text-muted">
              <div>
                <dt class="inline">Ruangan:</dt>
                <dd class="inline font-medium text-default">
                  {{ session.room.name }}
                </dd>
              </div>
              <div>
                <dt class="inline">Dosen:</dt>
                <dd class="inline">{{ session.lecturerName }}</dd>
              </div>
              <div>
                <dt class="inline">Mulai:</dt>
                <dd class="inline">{{ formatTime(session.startsAt) }}</dd>
              </div>
              <div>
                <dt class="inline">Tutup:</dt>
                <dd class="inline">{{ formatTime(session.closesAt) }}</dd>
              </div>
            </dl>
          </div>
          <template #footer
            ><UButton block label="Pilih sesi" @click="selectSession(session)"
          /></template>
        </UCard>
      </div>
    </template>

    <template v-else-if="state === 'succeeded' && attendance">
      <UAlert
        color="success"
        icon="i-lucide-circle-check"
        title="Absensi berhasil"
        description="Bukti selfie telah tersimpan dan absensi Anda tercatat."
      />
      <UCard
        ><dl class="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-muted">Sesi</dt>
            <dd class="font-medium">{{ attendance.sessionName }}</dd>
          </div>
          <div>
            <dt class="text-muted">Ruangan</dt>
            <dd class="font-medium">{{ attendance.roomName }}</dd>
          </div>
          <div>
            <dt class="text-muted">Waktu</dt>
            <dd class="font-medium">{{ formatTime(attendance.timestamp) }}</dd>
          </div>
          <div>
            <dt class="text-muted">Status</dt>
            <dd class="font-medium">
              {{ attendance.status === 'present' ? 'Hadir' : 'Terlambat' }}
            </dd>
          </div>
        </dl></UCard
      >
    </template>

    <template v-else-if="selected">
      <UCard>
        <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">{{ selected.name }}</h2>
            <p class="text-sm text-muted">
              {{ selected.room.name }} · {{ selected.lecturerName }}
            </p>
          </div>
          <UBadge
            :color="selected.status === 'open-present' ? 'success' : 'warning'"
            variant="soft"
            >{{
              selected.status === 'open-present' ? 'Hadir' : 'Terlambat'
            }}</UBadge
          >
        </div>
        <StudentAttendanceMap
          :room="selected.room"
          :student="gps"
          :valid="gpsValid"
        />
        <div class="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <span class="text-muted">Jarak: </span
            >{{ gpsDistance === null ? '-' : `${gpsDistance.toFixed(1)} m` }}
          </div>
          <div>
            <span class="text-muted">Akurasi: </span
            >{{
              gps?.accuracy === undefined ? '-' : `${gps.accuracy.toFixed(1)} m`
            }}
          </div>
          <div>
            <span class="text-muted">Kebijakan: </span
            >{{ gpsPolicy ?? 'Menunggu server' }}
          </div>
        </div>
      </UCard>

      <UAlert
        v-if="stateMessage"
        color="error"
        variant="soft"
        :description="stateMessage"
      />
      <UAlert
        v-if="state === 'gps-requesting' || state === 'gps-acquiring'"
        color="info"
        variant="soft"
        title="Memeriksa lokasi"
        description="Izinkan akses lokasi dan tunggu sampai posisi Anda diperoleh."
      />
      <UAlert
        v-if="
          state === 'gps-succeeded' ||
          state === 'camera-initializing' ||
          state === 'camera-ready' ||
          state === 'selfie-captured' ||
          state === 'uploading' ||
          state === 'submitting'
        "
        color="success"
        variant="soft"
        :description="
          state === 'uploading'
            ? 'Mengunggah selfie...'
            : state === 'submitting'
              ? 'Mencatat absensi...'
              : 'Lokasi Anda memenuhi kebijakan GPS.'
        "
      />

      <div v-if="state === 'gps-failed'" class="flex flex-wrap gap-2">
        <UButton
          label="Coba verifikasi GPS lagi"
          icon="i-lucide-map-pin"
          @click="verifyGps"
        /><UButton label="Ganti sesi" variant="ghost" @click="switchSession" />
      </div>
      <div v-if="state === 'gps-acquiring' && gps" class="flex justify-end">
        <UButton
          label="Verifikasi lokasi"
          icon="i-lucide-map-pin-check"
          @click="verifyGps"
        />
      </div>

      <UCard
        v-if="
          state === 'camera-initializing' ||
          state === 'camera-ready' ||
          state === 'selfie-captured' ||
          state === 'uploading' ||
          state === 'submitting'
        "
      >
        <div class="space-y-4">
          <h2 class="font-semibold">Bukti selfie</h2>
          <video
            v-if="!previewUrl"
            ref="video"
            autoplay
            playsinline
            muted
            class="mx-auto aspect-video w-full max-w-lg rounded-lg bg-black object-cover"
          /><img
            v-else
            :src="previewUrl"
            alt="Pratinjau selfie"
            class="mx-auto aspect-video w-full max-w-lg rounded-lg bg-black object-contain"
          />
          <div class="flex flex-wrap justify-center gap-2">
            <UButton
              v-if="state === 'camera-ready'"
              label="Ambil selfie"
              icon="i-lucide-camera"
              @click="captureSelfie"
            /><UButton
              v-if="state === 'selfie-captured'"
              label="Ambil ulang"
              variant="soft"
              @click="retake"
            /><UButton
              v-if="state === 'selfie-captured'"
              label="Kirim absensi"
              icon="i-lucide-send"
              @click="uploadAndSubmit"
            />
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
