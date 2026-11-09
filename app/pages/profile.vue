<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'default' })

const { user, fetch } = useUserSession()
const toast = useToast()

const profileForm = reactive({
  name: '',
  username: '',
  nim: ''
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const profileLoading = ref(false)
const passwordLoading = ref(false)
const profileError = ref<string | null>(null)
const passwordError = ref<string | null>(null)

const isStudent = computed(() => user.value?.role === 'student')

const roleLabel = computed(() => {
  const map: Record<string, string> = {
    admin: 'Admin',
    lecturer: 'Dosen',
    student: 'Mahasiswa'
  }
  return user.value ? (map[user.value.role] ?? user.value.role) : ''
})

function initForms() {
  if (!user.value) return
  profileForm.name = user.value.name
  profileForm.username = user.value.username
  profileForm.nim = user.value.nim ?? ''
}

watch(user, initForms, { immediate: true })

interface ProfileState {
  name: string
  username: string
  nim: string
}

interface PasswordState {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

function validateProfile(state: ProfileState) {
  const errors = []
  const name = state.name.trim()
  if (!name) errors.push({ name: 'name', message: 'Nama wajib diisi.' })
  else if (name.length < 2 || name.length > 100)
    errors.push({ name: 'name', message: 'Nama harus 2-100 karakter.' })

  const username = state.username.trim()
  if (!username)
    errors.push({ name: 'username', message: 'Nama pengguna wajib diisi.' })
  else if (username.length < 3 || username.length > 50)
    errors.push({
      name: 'username',
      message: 'Nama pengguna harus 3-50 karakter.'
    })
  else if (!/^[a-zA-Z0-9_.-]+$/.test(username))
    errors.push({
      name: 'username',
      message:
        'Nama pengguna hanya boleh berisi huruf, angka, garis bawah, titik, atau tanda hubung.'
    })

  if (isStudent.value) {
    const nim = state.nim.trim()
    if (nim) {
      if (nim.length < 8 || nim.length > 20)
        errors.push({ name: 'nim', message: 'NIM harus 8-20 digit.' })
      else if (!/^[0-9]+$/.test(nim))
        errors.push({ name: 'nim', message: 'NIM hanya boleh berisi angka.' })
    }
  }
  return errors
}

function validatePassword(state: PasswordState) {
  const errors = []
  if (!state.currentPassword)
    errors.push({
      name: 'currentPassword',
      message: 'Kata sandi saat ini wajib diisi.'
    })
  if (!state.newPassword)
    errors.push({
      name: 'newPassword',
      message: 'Kata sandi baru wajib diisi.'
    })
  else if (state.newPassword.length < 8 || state.newPassword.length > 128)
    errors.push({
      name: 'newPassword',
      message: 'Kata sandi baru harus 8-128 karakter.'
    })
  if (state.newPassword !== state.confirmPassword)
    errors.push({
      name: 'confirmPassword',
      message: 'Konfirmasi kata sandi tidak cocok.'
    })
  return errors
}

async function onProfileSubmit() {
  profileError.value = null
  profileLoading.value = true
  try {
    const body: Record<string, string | null> = {
      name: profileForm.name.trim(),
      username: profileForm.username.trim()
    }
    if (isStudent.value) body.nim = profileForm.nim.trim() || null
    await $fetch('/api/auth/me', { method: 'PATCH', body })
    await fetch()
    toast.add({
      title: 'Berhasil',
      description: 'Profil berhasil diperbarui.',
      color: 'success'
    })
  } catch (err: unknown) {
    profileError.value = getApiErrorMessage(err)
  } finally {
    profileLoading.value = false
  }
}

async function onPasswordSubmit() {
  passwordError.value = null
  passwordLoading.value = true
  try {
    await $fetch('/api/auth/password', {
      method: 'POST',
      body: {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      }
    })
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    toast.add({
      title: 'Berhasil',
      description: 'Kata sandi berhasil diubah.',
      color: 'success'
    })
  } catch (err: unknown) {
    passwordError.value = getApiErrorMessage(err)
  } finally {
    passwordLoading.value = false
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Profil</h1>
      <p class="text-sm text-muted">
        Kelola informasi profil dan kata sandi Anda.
      </p>
    </div>

    <UCard>
      <UForm
        :state="profileForm"
        :validate="validateProfile"
        @submit="onProfileSubmit"
      >
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold">Informasi Profil</h2>
            <UBadge color="neutral" variant="soft">{{ roleLabel }}</UBadge>
          </div>
          <UAlert
            v-if="profileError"
            color="error"
            variant="soft"
            :description="profileError"
          />
          <UFormField label="Nama" name="name" required>
            <UInput
              v-model="profileForm.name"
              class="w-full"
              placeholder="Masukkan nama"
              autocomplete="name"
            />
          </UFormField>
          <UFormField label="Nama pengguna" name="username" required>
            <UInput
              v-model="profileForm.username"
              class="w-full"
              placeholder="Masukkan nama pengguna"
              autocomplete="username"
            />
          </UFormField>
          <UFormField v-if="isStudent" label="NIM" name="nim">
            <UInput
              v-model="profileForm.nim"
              class="w-full"
              placeholder="Masukkan NIM"
              inputmode="numeric"
            />
          </UFormField>
          <div class="flex justify-end">
            <UButton
              type="submit"
              :loading="profileLoading"
              label="Simpan perubahan"
            />
          </div>
        </div>
      </UForm>
    </UCard>

    <UCard>
      <UForm
        :state="passwordForm"
        :validate="validatePassword"
        @submit="onPasswordSubmit"
      >
        <div class="space-y-4">
          <h2 class="text-base font-semibold">Ubah Kata Sandi</h2>
          <UAlert
            v-if="passwordError"
            color="error"
            variant="soft"
            :description="passwordError"
          />
          <UFormField
            label="Kata sandi saat ini"
            name="currentPassword"
            required
          >
            <UInput
              v-model="passwordForm.currentPassword"
              class="w-full"
              type="password"
              placeholder="Masukkan kata sandi saat ini"
              autocomplete="current-password"
            />
          </UFormField>
          <UFormField label="Kata sandi baru" name="newPassword" required>
            <UInput
              v-model="passwordForm.newPassword"
              class="w-full"
              type="password"
              placeholder="Minimal 8 karakter"
              autocomplete="new-password"
            />
          </UFormField>
          <UFormField
            label="Konfirmasi kata sandi baru"
            name="confirmPassword"
            required
          >
            <UInput
              v-model="passwordForm.confirmPassword"
              class="w-full"
              type="password"
              placeholder="Ulangi kata sandi baru"
              autocomplete="new-password"
            />
          </UFormField>
          <div class="flex justify-end">
            <UButton
              type="submit"
              :loading="passwordLoading"
              label="Ubah kata sandi"
            />
          </div>
        </div>
      </UForm>
    </UCard>
  </div>
</template>
