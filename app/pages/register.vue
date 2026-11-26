<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: false })

const loading = ref(false)
const error = ref<string | null>(null)

interface RegisterForm {
  name: string
  username: string
  nim: string
  password: string
  confirmPassword: string
}

const fields: AuthFormField[] = [
  {
    name: 'name',
    type: 'text',
    label: 'Nama Lengkap',
    placeholder: 'Masukkan nama lengkap',
    required: true,
    autocomplete: 'name'
  },
  {
    name: 'username',
    type: 'text',
    label: 'Nama Pengguna',
    placeholder: 'Masukkan nama pengguna',
    required: true,
    autocomplete: 'username'
  },
  {
    name: 'nim',
    type: 'text',
    label: 'NIM',
    placeholder: 'Masukkan NIM',
    required: true
  },
  {
    name: 'password',
    type: 'password',
    label: 'Kata Sandi',
    placeholder: 'Minimal 8 karakter',
    required: true,
    autocomplete: 'new-password'
  },
  {
    name: 'confirmPassword',
    type: 'password',
    label: 'Konfirmasi Kata Sandi',
    placeholder: 'Ulangi kata sandi',
    required: true,
    autocomplete: 'new-password'
  }
]

async function onSubmit(event: FormSubmitEvent<RegisterForm>) {
  error.value = null
  loading.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        name: event.data.name.trim(),
        username: event.data.username.trim(),
        nim: event.data.nim.trim(),
        password: event.data.password,
        confirmPassword: event.data.confirmPassword
      }
    })
    await navigateTo('/login?registered=1')
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
        title="Daftar"
        description="Buat akun mahasiswa untuk menggunakan sistem absensi."
        icon="i-lucide-graduation-cap"
        :submit="{ label: 'Daftar', block: true }"
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
      <template #footer>
        <p class="text-center text-sm text-muted">
          Sudah punya akun?
          <ULink to="/login" class="font-medium text-primary">Masuk</ULink>
        </p>
      </template>
    </UCard>
  </UMain>
</template>
