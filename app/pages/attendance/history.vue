<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'default' })

interface AttendanceHistoryItem {
  id: number
  sessionId: number
  sessionName: string
  roomName: string | null
  lecturerName: string
  status: string
  attendanceTimestamp: string
}

const attendances = ref<AttendanceHistoryItem[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)

function statusLabel(status: string) {
  const map: Record<string, string> = {
    present: 'Hadir',
    late: 'Terlambat',
    excused: 'Izin',
    sick: 'Sakit'
  }
  return map[status] ?? status
}

function statusColor(status: string) {
  const map: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
    present: 'success',
    late: 'warning',
    excused: 'info',
    sick: 'info'
  }
  return map[status] ?? 'neutral'
}

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const res = await $fetch<{ attendances: AttendanceHistoryItem[] }>(
      '/api/attendance/history'
    )
    attendances.value = res.attendances
  } catch (err: unknown) {
    loadError.value = getApiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="w-full space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Riwayat Absensi</h1>
      <p class="text-sm text-muted">Daftar kehadiran Anda pada sesi absensi.</p>
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

    <UCard v-else>
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="font-semibold">Riwayat Kehadiran</h2>
            <p class="text-sm text-muted">
              {{ attendances.length }} catatan absensi ditemukan.
            </p>
          </div>
          <UBadge color="neutral" variant="soft">{{
            attendances.length
          }}</UBadge>
        </div>
      </template>
      <UTable
        :data="attendances"
        :columns="[
          { accessorKey: 'sessionName', header: 'Sesi' },
          { accessorKey: 'roomName', header: 'Ruangan' },
          { accessorKey: 'lecturerName', header: 'Dosen' },
          { accessorKey: 'attendanceTimestamp', header: 'Waktu Absensi' },
          { accessorKey: 'status', header: 'Status' }
        ]"
      >
        <template #empty>
          <p class="py-6 text-center text-sm text-muted">
            Belum ada riwayat absensi.
          </p>
        </template>
        <template #roomName-cell="{ row }">
          {{ row.original.roomName ?? '-' }}
        </template>
        <template #attendanceTimestamp-cell="{ row }">
          {{ formatDateIndonesia(row.original.attendanceTimestamp) }}
        </template>
        <template #status-cell="{ row }">
          <UBadge :color="statusColor(row.original.status)" variant="soft">
            {{ statusLabel(row.original.status) }}
          </UBadge>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
