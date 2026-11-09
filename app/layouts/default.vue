<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { user, clear } = useUserSession()
const toast = useToast()
const loading = ref(false)

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  lecturer: 'Dosen',
  student: 'Mahasiswa'
}

const items: NavigationMenuItem[][] = [
  [
    { label: 'Dasbor', icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
    { label: 'Profil', icon: 'i-lucide-user-round', to: '/profile' }
  ]
]

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
  <UDashboardGroup>
    <UDashboardSidebar collapsible :ui="{ footer: 'border-t border-default' }">
      <template #header="{ collapsed }">
        <div
          v-if="!collapsed"
          class="flex items-center gap-2 text-sm font-semibold"
        >
          <UIcon name="i-lucide-graduation-cap" class="size-6 text-primary" />
          <span>Absensi</span>
        </div>
        <UIcon
          v-else
          name="i-lucide-graduation-cap"
          class="mx-auto size-6 text-primary"
        />
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="items[0]!"
          orientation="vertical"
        />
      </template>

      <template #footer="{ collapsed }">
        <div class="flex w-full flex-col gap-2">
          <div
            v-if="user"
            class="flex items-center gap-2 px-1"
            :class="{ 'justify-center': collapsed }"
          >
            <UAvatar :text="user.name?.slice(0, 1).toUpperCase()" size="sm" />
            <div v-if="!collapsed" class="min-w-0">
              <p class="truncate text-sm font-medium">{{ user.name }}</p>
              <p class="truncate text-xs text-muted">
                {{ roleLabels[user.role] ?? user.role }}
              </p>
            </div>
          </div>
          <UButton
            :label="collapsed ? undefined : 'Keluar'"
            icon="i-lucide-log-out"
            color="error"
            variant="soft"
            block
            :square="collapsed"
            :loading="loading"
            @click="onLogout"
          />
        </div>
      </template>
    </UDashboardSidebar>

    <UDashboardPanel>
      <template #header>
        <UDashboardNavbar title="Absensi" />
      </template>
      <template #body>
        <div class="w-full">
          <slot />
        </div>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
