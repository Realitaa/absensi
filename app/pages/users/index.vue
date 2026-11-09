<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ middleware: ['auth'], layout: 'default' })

interface ManagedUser {
  id: number
  name: string
  username: string
  role: 'admin' | 'lecturer' | 'student'
  nim: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

interface ListResponse {
  users: ManagedUser[]
  total: number
  page: number
  pageSize: number
}

const { user, fetch } = useUserSession()
const toast = useToast()
const isAdmin = computed(() => user.value?.role === 'admin')

const formOpen = ref(false)
const formUser = ref<ManagedUser | null>(null)

function openCreate() {
  formUser.value = null
  formOpen.value = true
}

function openEdit(u: ManagedUser) {
  formUser.value = u
  formOpen.value = true
}

async function onFormSaved() {
  await refresh()
}

const search = ref('')
const roleFilter = ref<'all' | ManagedUser['role']>('all')
const statusFilter = ref<'all' | 'active' | 'deleted'>('all')
const page = ref(1)
const pageSize = 20

const debouncedSearch = refDebounced(search, 400)

const roleOptions = [
  { label: 'Semua peran', value: 'all' },
  { label: 'Admin', value: 'admin' },
  { label: 'Dosen', value: 'lecturer' },
  { label: 'Mahasiswa', value: 'student' }
]

const statusOptions = [
  { label: 'Semua status', value: 'all' },
  { label: 'Aktif', value: 'active' },
  { label: 'Terhapus', value: 'deleted' }
]

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  lecturer: 'Dosen',
  student: 'Mahasiswa'
}

const { data, pending, error, refresh } = await useFetch<ListResponse>(
  '/api/users',
  {
    query: computed(() => ({
      search: debouncedSearch.value || undefined,
      role: roleFilter.value,
      status: statusFilter.value,
      page: page.value,
      pageSize
    })),
    watch: false
  }
)

watch([debouncedSearch, roleFilter, statusFilter, page], () => refresh())

const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize))
)

const deleteTarget = ref<ManagedUser | null>(null)
const deleteOpen = ref(false)
const deleteLoading = ref(false)

const columns: TableColumn<ManagedUser>[] = [
  {
    accessorKey: 'name',
    header: 'Nama',
    cell: ({ row }) => row.getValue('name') as string
  },
  {
    accessorKey: 'username',
    header: 'Nama pengguna',
    cell: ({ row }) => row.getValue('username') as string
  },
  {
    accessorKey: 'role',
    header: 'Peran',
    cell: ({ row }) => {
      const UBadge = resolveComponent('UBadge')
      return h(
        UBadge,
        { color: 'neutral', variant: 'soft' },
        () => roleLabels[row.getValue('role') as string] ?? row.getValue('role')
      )
    }
  },
  {
    accessorKey: 'nim',
    header: 'NIM',
    cell: ({ row }) => (row.getValue('nim') as string | null) ?? '-'
  },
  {
    accessorKey: 'deletedAt',
    header: 'Status',
    cell: ({ row }) => {
      const UBadge = resolveComponent('UBadge')
      const deleted = Boolean(row.getValue('deletedAt'))
      return h(
        UBadge,
        { color: deleted ? 'error' : 'success', variant: 'soft' },
        () => (deleted ? 'Terhapus' : 'Aktif')
      )
    }
  },
  {
    id: 'actions',
    enableHiding: false,
    meta: { class: { td: 'text-right' } },
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      return h('div', { class: 'flex justify-end gap-2' }, [
        h(UButton, {
          size: 'sm',
          color: 'neutral',
          variant: 'soft',
          icon: 'i-lucide-pen',
          label: 'Ubah',
          disabled: Boolean(row.original.deletedAt),
          onClick: () => openEdit(row.original)
        }),
        h(UButton, {
          size: 'sm',
          color: 'error',
          variant: 'soft',
          icon: 'i-lucide-trash-2',
          label: 'Hapus',
          disabled: Boolean(row.original.deletedAt),
          onClick: () => {
            deleteTarget.value = row.original
            deleteOpen.value = true
          }
        })
      ])
    }
  }
]

async function onDelete() {
  if (!deleteTarget.value) return
  deleteLoading.value = true
  try {
    await $fetch(`/api/users/${deleteTarget.value.id}`, { method: 'DELETE' })
    toast.add({
      title: 'Berhasil',
      description: `Akun ${deleteTarget.value.name} telah dihapus.`,
      color: 'success'
    })
    deleteOpen.value = false
    deleteTarget.value = null
    await refresh()
  } catch (err: unknown) {
    toast.add({
      title: 'Gagal menghapus',
      description: getApiErrorMessage(err),
      color: 'error'
    })
  } finally {
    deleteLoading.value = false
  }
}

onMounted(async () => {
  if (user.value) {
    return
  }
  await fetch()
  if (!isAdmin.value) {
    await navigateTo('/dashboard')
  }
})
</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Manajemen Pengguna</h1>
        <p class="text-sm text-muted">
          Kelola akun admin, dosen, dan mahasiswa.
        </p>
      </div>
      <UButton
        v-if="isAdmin"
        label="Tambah pengguna"
        icon="i-lucide-user-plus"
        @click="openCreate"
      />
    </div>

    <UAlert
      v-if="!isAdmin"
      color="warning"
      variant="soft"
      description="Anda tidak memiliki akses ke halaman ini."
    />

    <UCard v-else>
      <div class="space-y-4">
        <div class="flex flex-wrap gap-2">
          <UInput
            v-model="search"
            class="min-w-56 flex-1"
            placeholder="Cari nama, nama pengguna, atau NIM..."
            icon="i-lucide-search"
          />
          <USelect
            v-model="roleFilter"
            :items="roleOptions"
            class="w-44"
            aria-label="Filter peran"
          />
          <USelect
            v-model="statusFilter"
            :items="statusOptions"
            class="w-44"
            aria-label="Filter status"
          />
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          :description="getApiErrorMessage(error)"
        />

        <UTable
          :data="data?.users ?? []"
          :columns="columns"
          :loading="pending"
          empty="Tidak ada pengguna yang sesuai."
        />

        <div class="flex items-center justify-between text-sm text-muted">
          <span>{{ total }} pengguna</span>
          <div class="flex items-center gap-2">
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              label="Sebelumnya"
              :disabled="page <= 1"
              @click="page = Math.max(1, page - 1)"
            />
            <span>Halaman {{ page }} dari {{ totalPages }}</span>
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              label="Berikutnya"
              :disabled="page >= totalPages"
              @click="page = Math.min(totalPages, page + 1)"
            />
          </div>
        </div>
      </div>
    </UCard>

    <UserFormModal
      :open="formOpen"
      :user="formUser"
      @close="formOpen = false"
      @saved="onFormSaved"
    />

    <UModal
      v-model:open="deleteOpen"
      title="Hapus pengguna"
      :description="`Akun ${deleteTarget?.name ?? ''} akan dihapus (soft delete). Catatan historis tetap disimpan dan tidak dapat dihapus. Nama pengguna dan NIM tetap dicadangkan.`"
    >
      <template #footer="{ close }">
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="soft"
            label="Batal"
            @click="close"
          />
          <UButton
            color="error"
            label="Hapus pengguna"
            :loading="deleteLoading"
            @click="onDelete"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
