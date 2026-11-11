<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'default' })

interface Session {
  id: number
  lecturerId: number
  roomId: number
  roomName: string | null
  room: {
    id: number
    name: string
    latitude?: number | null
    longitude?: number | null
    radius?: number | null
  } | null
  name: string
  description: string | null
  startsAt: string
  lateThresholdAt: string
  closesAt: string
  manuallyClosedAt: string | null
  status: string
  createdAt: string
  updatedAt: string
}

interface Attendance {
  id: number
  studentName: string
  nim: string | null
  status: string
  attendanceTimestamp: string
  accuracy: number | null
  calculatedDistance: number | null
  validationPolicy: string
}

const route = useRoute()
const toast = useToast()
const sessionId = Number(route.params.id)
const session = ref<Session | null>(null)
const attendances = ref<Attendance[]>([])
const loading = ref(true)
const attendanceLoading = ref(true)
const loadError = ref<string | null>(null)
const actionLoading = ref(false)
const showDelete = ref(false)
const showClose = ref(false)

function statusLabel(status: string) {
  const map: Record<string, string> = {
    scheduled: 'Terjadwal',
    'open-present': 'Terbuka - Hadir',
    'open-late': 'Terbuka - Terlambat',
    closed: 'Ditutup'
  }
  return map[status] ?? status
}

function statusColor(status: string) {
  const map: Record<string, 'neutral' | 'success' | 'warning' | 'error'> = {
    scheduled: 'neutral',
    'open-present': 'success',
    'open-late': 'warning',
    closed: 'error'
  }
  return map[status] ?? 'neutral'
}

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const [sessionRes, attendanceRes] = await Promise.all([
      $fetch<{ session: Session }>(`/api/sessions/${sessionId}`),
      $fetch<{ attendances: Attendance[] }>(
        `/api/sessions/${sessionId}/attendances`
      )
    ])
    session.value = sessionRes.session
    attendances.value = attendanceRes.attendances
  } catch (err: unknown) {
    loadError.value = getApiErrorMessage(err)
  } finally {
    loading.value = false
    attendanceLoading.value = false
  }
}

onMounted(load)

async function onClose() {
  actionLoading.value = true
  try {
    const res = await $fetch<{ session: Session }>(
      `/api/sessions/${sessionId}/close`,
      {
        method: 'POST'
      }
    )
    session.value = res.session
    showClose.value = false
    toast.add({
      title: 'Berhasil',
      description: 'Sesi berhasil ditutup.',
      color: 'success'
    })
  } catch (err: unknown) {
    toast.add({
      title: 'Gagal menutup sesi',
      description: getApiErrorMessage(err),
      color: 'error'
    })
  } finally {
    actionLoading.value = false
  }
}

async function onDelete() {
  actionLoading.value = true
  try {
    await $fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
    toast.add({
      title: 'Berhasil',
      description: 'Sesi berhasil dihapus.',
      color: 'success'
    })
    await navigateTo('/sessions')
  } catch (err: unknown) {
    toast.add({
      title: 'Gagal menghapus sesi',
      description: getApiErrorMessage(err),
      color: 'error'
    })
  } finally {
    actionLoading.value = false
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Detail Sesi</h1>
        <p class="text-sm text-muted">Rincian sesi absensi Anda.</p>
      </div>
      <UButton variant="ghost" label="Kembali" to="/sessions" />
    </div>

    <UAlert
      v-if="loadError"
      color="error"
      variant="soft"
      :description="loadError"
    />

    <UCard v-else-if="loading">
      <p class="text-sm text-muted">Memuat…</p>
    </UCard>

    <div v-else-if="session" class="space-y-6">
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div class="order-2 md:order-1">
          <UCard class="h-full">
            <div class="space-y-4">
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-semibold">{{ session.name }}</h2>
                <UBadge :color="statusColor(session.status)" variant="soft">
                  {{ statusLabel(session.status) }}
                </UBadge>
              </div>
              <p v-if="session.description" class="text-sm">
                {{ session.description }}
              </p>
              <p v-else class="text-sm text-muted">Tidak ada deskripsi.</p>
              <dl class="grid grid-cols-[180px_1fr] gap-y-2 text-sm">
                <dt class="text-muted">Ruangan</dt>
                <dd>{{ session.roomName ?? '-' }}</dd>
                <dt class="text-muted">Waktu mulai</dt>
                <dd>{{ formatDateIndonesia(session.startsAt) }}</dd>
                <dt class="text-muted">Batas keterlambatan</dt>
                <dd>{{ formatDateIndonesia(session.lateThresholdAt) }}</dd>
                <dt class="text-muted">Waktu penutupan</dt>
                <dd>{{ formatDateIndonesia(session.closesAt) }}</dd>
                <dt class="text-muted">Ditutup manual</dt>
                <dd>{{ formatDateIndonesia(session.manuallyClosedAt) }}</dd>
                <dt class="text-muted">Dibuat</dt>
                <dd>{{ formatDateIndonesia(session.createdAt) }}</dd>
                <dt class="text-muted">Diperbarui</dt>
                <dd>{{ formatDateIndonesia(session.updatedAt) }}</dd>
              </dl>
            </div>
          </UCard>
        </div>
        <div
          class="order-1 min-h-[320px] overflow-hidden rounded-lg border border-default bg-muted/20 md:order-2 md:min-h-[600px]"
        >
          <div
            v-if="
              session.room?.latitude !== undefined &&
              session.room.latitude !== null &&
              session.room.longitude !== undefined &&
              session.room.longitude !== null &&
              session.room.radius !== undefined &&
              session.room.radius !== null
            "
            class="flex h-full flex-col"
          >
            <div class="px-4 pt-4 pb-2">
              <p class="font-medium">{{ session.room.name }}</p>
              <p class="text-xs text-muted">
                Visualisasi lokasi dan radius geofence
              </p>
            </div>
            <div class="min-h-0 flex-1 px-4 pb-4">
              <RoomMap
                :latitude="session.room.latitude"
                :longitude="session.room.longitude"
                :radius="session.room.radius"
                :interactive="false"
                height="100%"
                class="h-full min-h-[280px]"
              />
            </div>
            <p class="px-4 pb-4 text-xs text-muted">
              Peta hanya untuk visualisasi dan tidak dapat diubah dari halaman
              detail.
            </p>
          </div>
          <div
            v-else
            class="flex h-full min-h-[320px] items-center justify-center p-6 text-center text-sm text-muted md:min-h-[600px]"
          >
            Data lokasi ruangan tidak tersedia.
          </div>
        </div>
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        <UButton
          label="Ubah sesi"
          variant="soft"
          :to="`/sessions/${session.id}/edit`"
        />
        <UButton
          v-if="
            session.status === 'open-present' || session.status === 'open-late'
          "
          label="Tutup sesi"
          color="warning"
          variant="soft"
          @click="showClose = true"
        />
        <UButton
          label="Hapus sesi"
          color="error"
          variant="soft"
          @click="showDelete = true"
        />
      </div>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="font-semibold">Mahasiswa yang sudah absensi</h2>
              <p class="text-sm text-muted">
                {{ attendances.length }} mahasiswa tercatat pada sesi ini.
              </p>
            </div>
            <UBadge color="neutral" variant="soft">{{
              attendances.length
            }}</UBadge>
          </div>
        </template>
        <UTable
          :data="attendances"
          :loading="attendanceLoading"
          :columns="[
            { accessorKey: 'studentName', header: 'Mahasiswa' },
            { accessorKey: 'nim', header: 'NIM' },
            { accessorKey: 'status', header: 'Status' },
            { accessorKey: 'attendanceTimestamp', header: 'Waktu' },
            { accessorKey: 'accuracy', header: 'Akurasi GPS' },
            { accessorKey: 'calculatedDistance', header: 'Jarak' }
          ]"
        >
          <template #empty>
            <p class="py-6 text-center text-sm text-muted">
              Belum ada mahasiswa yang melakukan absensi.
            </p>
          </template>
          <template #studentName-cell="{ row }">
            <div>
              <p class="font-medium">{{ row.original.studentName }}</p>
              <p class="text-xs text-muted">{{ row.original.nim ?? '-' }}</p>
            </div>
          </template>
          <template #nim-cell="{ row }">{{ row.original.nim ?? '-' }}</template>
          <template #status-cell="{ row }">
            <UBadge
              :color="
                row.original.status === 'present'
                  ? 'success'
                  : row.original.status === 'late'
                    ? 'warning'
                    : 'neutral'
              "
              variant="soft"
              >{{
                row.original.status === 'present'
                  ? 'Hadir'
                  : row.original.status === 'late'
                    ? 'Terlambat'
                    : row.original.status
              }}</UBadge
            >
          </template>
          <template #attendanceTimestamp-cell="{ row }">{{
            formatDateIndonesia(row.original.attendanceTimestamp)
          }}</template>
          <template #accuracy-cell="{ row }">{{
            row.original.accuracy === null
              ? '-'
              : `${row.original.accuracy.toFixed(1)} m`
          }}</template>
          <template #calculatedDistance-cell="{ row }">{{
            row.original.calculatedDistance === null
              ? '-'
              : `${row.original.calculatedDistance.toFixed(1)} m`
          }}</template>
        </UTable>
      </UCard>
    </div>

    <UModal
      :open="showClose"
      @update:open="
        value => {
          if (!value) showClose = false
        }
      "
    >
      <template #content>
        <UCard>
          <template #header>
            <h2 class="text-base font-semibold">Tutup Sesi</h2>
          </template>
          <p class="text-sm">
            Yakin ingin menutup sesi
            <span class="font-semibold">{{ session?.name }}</span
            >? Sesi tidak dapat dibuka kembali.
          </p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                label="Batal"
                variant="ghost"
                @click="showClose = false"
              />
              <UButton
                label="Tutup"
                color="warning"
                :loading="actionLoading"
                @click="onClose"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal
      :open="showDelete"
      @update:open="
        value => {
          if (!value) showDelete = false
        }
      "
    >
      <template #content>
        <UCard>
          <template #header>
            <h2 class="text-base font-semibold">Hapus Sesi</h2>
          </template>
          <p class="text-sm">
            Yakin ingin menghapus sesi
            <span class="font-semibold">{{ session?.name }}</span
            >? Tindakan ini tidak dapat dibatalkan.
          </p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                label="Batal"
                variant="ghost"
                @click="showDelete = false"
              />
              <UButton
                label="Hapus"
                color="error"
                :loading="actionLoading"
                @click="onDelete"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
