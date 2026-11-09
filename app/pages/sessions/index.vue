<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'default' })

interface Session {
  id: number
  lecturerId: number
  roomId: number
  roomName: string | null
  room: { id: number; name: string } | null
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

interface Room {
  id: number
  name: string
  latitude: number
  longitude: number
  radius: number
  createdAt: string
  updatedAt: string
}

const { user } = useUserSession()
const toast = useToast()
const isMobile = useMediaQuery('(max-width: 767px)')
const isLecturer = computed(() => user.value?.role === 'lecturer')

const sessions = ref<Session[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const loadError = ref<string | null>(null)
const deleting = ref<Session | null>(null)
const closing = ref<Session | null>(null)
const actionLoading = ref(false)
const rooms = ref<Room[]>([])
const roomsLoading = ref(false)

const columns = computed(() => [
  { accessorKey: 'name', header: 'Nama Sesi' },
  { accessorKey: 'roomName', header: 'Ruangan' },
  { accessorKey: 'startsAt', header: 'Mulai' },
  { accessorKey: 'lateThresholdAt', header: 'Batas Terlambat' },
  { accessorKey: 'closesAt', header: 'Tutup' },
  { accessorKey: 'status', header: 'Status' },
  ...(isMobile.value ? [] : [{ accessorKey: 'actions', header: 'Aksi' }]),
  ...(isMobile.value ? [{ accessorKey: 'actions', header: 'Aksi' }] : [])
])

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

async function loadRooms() {
  roomsLoading.value = true
  try {
    const res = await $fetch<{ rooms: Room[] }>('/api/rooms', {
      query: { page: 1, pageSize: 100 }
    })
    rooms.value = res.rooms
  } catch (err: unknown) {
    // Room options are display-only; session list remains usable.
    toast.add({
      title: 'Gagal memuat ruangan',
      description: getApiErrorMessage(err),
      color: 'error'
    })
  } finally {
    roomsLoading.value = false
  }
}

async function loadSessions() {
  loading.value = true
  loadError.value = null
  try {
    const res = await $fetch<{ sessions: Session[]; total: number }>(
      '/api/sessions',
      {
        query: { page: page.value, pageSize }
      }
    )
    sessions.value = res.sessions
    total.value = res.total
  } catch (err: unknown) {
    loadError.value = getApiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadSessions()
  if (isLecturer.value) void loadRooms()
})
watch(page, loadSessions)

async function onDelete() {
  if (!deleting.value) return
  actionLoading.value = true
  try {
    await $fetch(`/api/sessions/${deleting.value.id}`, { method: 'DELETE' })
    toast.add({
      title: 'Berhasil',
      description: 'Sesi berhasil dihapus.',
      color: 'success'
    })
    deleting.value = null
    await loadSessions()
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

async function onClose() {
  if (!closing.value) return
  actionLoading.value = true
  try {
    await $fetch(`/api/sessions/${closing.value.id}/close`, { method: 'POST' })
    toast.add({
      title: 'Berhasil',
      description: 'Sesi berhasil ditutup.',
      color: 'success'
    })
    closing.value = null
    await loadSessions()
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
</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Sesi Absensi</h1>
        <p class="text-sm text-muted">Kelola sesi absensi milik Anda.</p>
      </div>
      <UButton
        v-if="isLecturer"
        icon="i-lucide-plus"
        label="Tambah Sesi"
        to="/sessions/new"
      />
    </div>

    <UAlert
      v-if="loadError"
      color="error"
      variant="soft"
      :description="loadError"
    />

    <UCard v-else>
      <UTable :data="sessions" :columns="columns" :loading="loading">
        <template #empty>
          <p class="py-6 text-center text-sm text-muted">Belum ada sesi.</p>
        </template>
        <template #name-cell="{ row }">
          <NuxtLink
            :to="`/sessions/${row.original.id}`"
            class="font-medium text-primary hover:underline"
          >
            {{ row.original.name }}
          </NuxtLink>
        </template>
        <template #roomName-cell="{ row }">
          {{ row.original.roomName ?? '-' }}
        </template>
        <template #startsAt-cell="{ row }">
          {{ formatDateIndonesia(row.original.startsAt) }}
        </template>
        <template #lateThresholdAt-cell="{ row }">
          {{ formatDateIndonesia(row.original.lateThresholdAt) }}
        </template>
        <template #closesAt-cell="{ row }">
          {{ formatDateIndonesia(row.original.closesAt) }}
        </template>
        <template #status-cell="{ row }">
          <UBadge :color="statusColor(row.original.status)" variant="soft">
            {{ statusLabel(row.original.status) }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex gap-1">
            <UButton
              icon="i-lucide-eye"
              size="xs"
              variant="ghost"
              :to="`/sessions/${row.original.id}`"
              aria-label="Lihat detail sesi"
            />
            <UButton
              icon="i-lucide-pencil"
              size="xs"
              variant="ghost"
              :to="`/sessions/${row.original.id}/edit`"
              aria-label="Ubah sesi"
            />
            <UButton
              v-if="
                row.original.status === 'open-present' ||
                row.original.status === 'open-late'
              "
              icon="i-lucide-lock"
              size="xs"
              variant="ghost"
              color="warning"
              aria-label="Tutup sesi"
              @click="closing = row.original"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="xs"
              variant="ghost"
              color="error"
              aria-label="Hapus sesi"
              @click="deleting = row.original"
            />
          </div>
        </template>
      </UTable>
      <div v-if="total > pageSize" class="mt-4 flex justify-center">
        <UPagination
          v-model:page="page"
          :total="total"
          :items-per-page="pageSize"
        />
      </div>
    </UCard>

    <UModal
      :open="deleting !== null"
      @update:open="
        value => {
          if (!value) deleting = null
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
            <span class="font-semibold">{{ deleting?.name }}</span
            >? Tindakan ini tidak dapat dibatalkan.
          </p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton label="Batal" variant="ghost" @click="deleting = null" />
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

    <UModal
      :open="closing !== null"
      @update:open="
        value => {
          if (!value) closing = null
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
            <span class="font-semibold">{{ closing?.name }}</span
            >? Sesi tidak dapat dibuka kembali.
          </p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton label="Batal" variant="ghost" @click="closing = null" />
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
  </div>
</template>
