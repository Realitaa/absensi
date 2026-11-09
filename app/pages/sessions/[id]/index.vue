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

const route = useRoute()
const toast = useToast()
const sessionId = Number(route.params.id)
const session = ref<Session | null>(null)
const loading = ref(true)
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
    const res = await $fetch<{ session: Session }>(`/api/sessions/${sessionId}`)
    session.value = res.session
  } catch (err: unknown) {
    loadError.value = getApiErrorMessage(err)
  } finally {
    loading.value = false
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

    <div v-else-if="session" class="space-y-4">
      <UCard>
        <div class="space-y-2">
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
        </div>
      </UCard>
      <UCard>
        <dl class="grid grid-cols-[180px_1fr] gap-y-1 text-sm">
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
      </UCard>
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
