<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'default' })

const { user } = useUserSession()
</script>

<template>
  <div class="w-full">
    <div class="mb-6">
      <h1 class="text-2xl font-semibold">Dasbor</h1>
      <p class="text-sm text-muted">Selamat datang kembali.</p>
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

    <UCard v-else>
      <p class="text-sm text-muted">Belum ada data pengguna.</p>
    </UCard>
  </div>
</template>
