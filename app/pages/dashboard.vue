<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const { user, clear } = useUserSession()
const toast = useToast()
const loading = ref(false)

async function onLogout() {
  loading.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    await clear()
    toast.add({
      title: 'Keluar berhasil',
      description: 'Sesi Anda telah berakhir.',
      color: 'success'
    })
    await navigateTo('/login')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UMain class="mx-auto max-w-3xl px-4 py-10">
    <div class="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">Dasbor</h1>
        <p class="text-sm text-muted">Selamat datang kembali.</p>
      </div>
      <UButton color="error" variant="soft" :loading="loading" @click="onLogout"
        >Keluar</UButton
      >
    </div>

    <UCard v-if="user">
      <div class="space-y-2">
        <p class="text-sm text-muted">Pengguna saat ini</p>
        <dl class="grid grid-cols-[120px_1fr] gap-y-1 text-sm">
          <dt class="text-muted">Nama</dt>
          <dd>{{ user.name }}</dd>
          <dt class="text-muted">Nama pengguna</dt>
          <dd>{{ user.username }}</dd>
          <dt class="text-muted">Peran</dt>
          <dd>{{ user.role }}</dd>
          <dt class="text-muted">NIM</dt>
          <dd>{{ user.nim ?? '-' }}</dd>
        </dl>
      </div>
    </UCard>

    <UCard v-else class="mt-4">
      <p class="text-sm text-muted">Belum ada data pengguna.</p>
    </UCard>
  </UMain>
</template>
