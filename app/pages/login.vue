<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: false })

const { fetch } = useUserSession()
const loading = ref(false)
const error = ref<string | null>(null)

const fields: AuthFormField[] = [
  {
    name: 'identifier',
    type: 'text',
    label: 'Username atau NIM',
    placeholder: 'Masukkan username atau NIM',
    required: true,
    autocomplete: 'username'
  },
  {
    name: 'password',
    type: 'password',
    label: 'Kata Sandi',
    placeholder: 'Masukkan kata sandi',
    required: true,
    autocomplete: 'current-password'
  }
]

async function onSubmit(
  event: FormSubmitEvent<{ identifier: string; password: string }>
) {
  error.value = null
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        identifier: event.data.identifier.trim(),
        password: event.data.password
      }
    })
    await fetch()
    const route = useRoute()
    const redirect =
      typeof route.query.redirect === 'string'
        ? route.query.redirect
        : '/dashboard'
    await navigateTo(redirect.startsWith('/') ? redirect : '/dashboard')
    console.log("Redirected to dashboard")
  } catch (err: unknown) {
    error.value = getApiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UMain class="flex min-h-screen items-center justify-center px-4 py-10">
    <UCard class="w-full max-w-md">
      <UAuthForm
        :fields="fields"
        :loading="loading"
        title="Masuk"
        description="Masuk dengan username atau NIM dan kata sandi Anda."
        icon="i-lucide-graduation-cap"
        :submit="{ label: 'Masuk', block: true }"
        @submit="onSubmit"
      >
        <template #validation>
          <UAlert
            v-if="error"
            color="error"
            variant="soft"
            :description="error"
            class="mb-4"
          />
        </template>
      </UAuthForm>
    </UCard>
  </UMain>
</template>
