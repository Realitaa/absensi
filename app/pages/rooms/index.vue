<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'default' })

interface Room {
  id: number
  name: string
  latitude: number
  longitude: number
  radius: number
  createdAt: string | Date
  updatedAt: string | Date
}

const { user } = useUserSession()
const toast = useToast()
const isMobile = useMediaQuery('(max-width: 767px)')
const isAdmin = computed(() => user.value?.role === 'admin')

const rooms = ref<Room[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const deletingRoom = ref<Room | null>(null)
const selectedMapRoom = ref<Room | null>(null)
const deleteLoading = ref(false)

const columns = computed(() => [
  { accessorKey: 'name', header: 'Nama Ruangan' },
  { accessorKey: 'latitude', header: 'Latitude' },
  { accessorKey: 'longitude', header: 'Longitude' },
  { accessorKey: 'radius', header: 'Radius (m)' },
  { accessorKey: 'createdAt', header: 'Dibuat' },
  ...(isMobile.value ? [{ accessorKey: 'map', header: 'Peta' }] : []),
  ...(isAdmin.value ? [{ accessorKey: 'actions', header: 'Aksi' }] : [])
])

async function loadRooms() {
  loading.value = true
  try {
    const res = await $fetch<{ rooms: Room[]; total: number }>('/api/rooms', {
      query: { page: page.value, pageSize }
    })
    rooms.value = res.rooms
    total.value = res.total
  } catch (err: unknown) {
    toast.add({
      title: 'Gagal memuat ruangan',
      description: getApiErrorMessage(err),
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

onMounted(loadRooms)
watch(page, loadRooms)

async function onDelete() {
  if (!deletingRoom.value) return
  deleteLoading.value = true
  try {
    await $fetch(`/api/rooms/${deletingRoom.value.id}`, { method: 'DELETE' })
    toast.add({
      title: 'Berhasil',
      description: 'Ruangan berhasil dihapus.',
      color: 'success'
    })
    deletingRoom.value = null
    await loadRooms()
  } catch (err: unknown) {
    toast.add({
      title: 'Gagal menghapus ruangan',
      description: getApiErrorMessage(err),
      color: 'error'
    })
  } finally {
    deleteLoading.value = false
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Ruangan</h1>
        <p class="text-sm text-muted">Kelola ruangan dan radius geofence.</p>
      </div>
      <UButton
        v-if="isAdmin"
        icon="i-lucide-plus"
        label="Tambah Ruangan"
        to="/rooms/new"
      />
    </div>

    <UCard>
      <UTable :data="rooms" :columns="columns" :loading="loading">
        <template #empty>
          <p class="py-6 text-center text-sm text-muted">Belum ada ruangan.</p>
        </template>
        <template #name-cell="{ row }">
          <UTooltip
            :disabled="isMobile"
            :content="{ side: 'bottom', sideOffset: 8 }"
          >
            <span class="cursor-help font-medium">{{ row.original.name }}</span>
            <template #content>
              <div class="w-72 p-1">
                <RoomMap
                  :latitude="row.original.latitude"
                  :longitude="row.original.longitude"
                  :radius="row.original.radius"
                  :interactive="false"
                  height="220px"
                />
                <p class="mt-2 text-xs text-muted">
                  Radius {{ row.original.radius }} meter
                </p>
              </div>
            </template>
          </UTooltip>
        </template>
        <template #radius-cell="{ row }">
          {{ row.original.radius }} m
        </template>
        <template #createdAt-cell="{ row }">
          {{ formatDateIndonesia(row.original.createdAt) }}
        </template>
        <template #map-cell="{ row }">
          <UButton
            label="Tampilkan Peta"
            icon="i-lucide-map"
            size="xs"
            variant="soft"
            @click="selectedMapRoom = row.original"
          />
        </template>
        <template #actions-cell="{ row }">
          <div v-if="isAdmin" class="flex gap-1">
            <UButton
              icon="i-lucide-pencil"
              size="xs"
              variant="ghost"
              :to="`/rooms/${row.original.id}/edit`"
              aria-label="Ubah ruangan"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="xs"
              variant="ghost"
              color="error"
              aria-label="Hapus ruangan"
              @click="deletingRoom = row.original"
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
      :open="selectedMapRoom !== null"
      @update:open="
        value => {
          if (!value) selectedMapRoom = null
        }
      "
    >
      <template #content>
        <UCard v-if="selectedMapRoom">
          <template #header>
            <h2 class="text-base font-semibold">{{ selectedMapRoom.name }}</h2>
          </template>
          <RoomMap
            :latitude="selectedMapRoom.latitude"
            :longitude="selectedMapRoom.longitude"
            :radius="selectedMapRoom.radius"
            :interactive="false"
            height="min(60vh, 420px)"
          />
          <p class="mt-3 text-sm text-muted">
            Radius geofence: {{ selectedMapRoom.radius }} meter
          </p>
        </UCard>
      </template>
    </UModal>

    <UModal
      :open="deletingRoom !== null"
      @update:open="
        value => {
          if (!value) deletingRoom = null
        }
      "
    >
      <template #content>
        <UCard>
          <template #header>
            <h2 class="text-base font-semibold">Hapus Ruangan</h2>
          </template>
          <p class="text-sm">
            Yakin ingin menghapus ruangan
            <span class="font-semibold">{{ deletingRoom?.name }}</span
            >?
          </p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                label="Batal"
                variant="ghost"
                @click="deletingRoom = null"
              />
              <UButton
                label="Hapus"
                color="error"
                :loading="deleteLoading"
                @click="onDelete"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
