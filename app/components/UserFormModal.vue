<script setup lang="ts">
export interface ManagedUser {
  id: number
  name: string
  username: string
  role: 'admin' | 'lecturer' | 'student'
  nim: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

const props = withDefaults(
  defineProps<{
    open: boolean
    user?: ManagedUser | null
  }>(),
  { user: null }
)

const emit = defineEmits<{
  close: []
  saved: []
}>()

const toast = useToast()
const isEdit = computed(() => props.user !== null && props.user !== undefined)
const loading = ref(false)
const error = ref<string | null>(null)

const form = reactive({
  name: '',
  username: '',
  password: '',
  role: 'student' as 'admin' | 'lecturer' | 'student',
  nim: ''
})

const roleOptions = [
  { label: 'Admin', value: 'admin' },
  { label: 'Dosen', value: 'lecturer' },
  { label: 'Mahasiswa', value: 'student' }
]

interface FormState {
  name: string
  username: string
  password: string
  role: string
  nim: string
}

function resetForm() {
  form.name = props.user?.name ?? ''
  form.username = props.user?.username ?? ''
  form.password = ''
  form.role = (props.user?.role ?? 'student') as
    'admin' | 'lecturer' | 'student'
  form.nim = props.user?.nim ?? ''
  error.value = null
}

watch(
  () => props.open,
  open => {
    if (open) resetForm()
  }
)
watch(
  () => props.user,
  () => {
    if (props.open) resetForm()
  }
)

function validate(state: FormState) {
  const errors: Array<{ name: string; message: string }> = []
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

  if (isEdit.value) {
    if (
      state.password &&
      (state.password.length < 8 || state.password.length > 128)
    )
      errors.push({
        name: 'password',
        message: 'Kata sandi harus 8-128 karakter.'
      })
  } else {
    if (!state.password)
      errors.push({ name: 'password', message: 'Kata sandi wajib diisi.' })
    else if (state.password.length < 8 || state.password.length > 128)
      errors.push({
        name: 'password',
        message: 'Kata sandi harus 8-128 karakter.'
      })
  }

  if (state.role === 'student') {
    const nim = state.nim.trim()
    if (!nim)
      errors.push({ name: 'nim', message: 'NIM wajib diisi untuk mahasiswa.' })
    else if (nim.length < 8 || nim.length > 20)
      errors.push({ name: 'nim', message: 'NIM harus 8-20 digit.' })
    else if (!/^[0-9]+$/.test(nim))
      errors.push({ name: 'nim', message: 'NIM hanya boleh berisi angka.' })
  }
  return errors
}

async function onSubmit() {
  error.value = null
  loading.value = true
  try {
    if (isEdit.value && props.user) {
      const body: Record<string, string> = {
        name: form.name.trim(),
        username: form.username.trim(),
        role: form.role,
        nim: form.role === 'student' ? form.nim.trim() : ''
      }
      if (form.password) body.password = form.password
      await $fetch(`/api/users/${props.user.id}`, { method: 'PATCH', body })
      toast.add({
        title: 'Berhasil',
        description: 'Pengguna berhasil diperbarui.',
        color: 'success'
      })
    } else {
      await $fetch('/api/users', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          username: form.username.trim(),
          password: form.password,
          role: form.role,
          nim: form.role === 'student' ? form.nim.trim() : null
        }
      })
      toast.add({
        title: 'Berhasil',
        description: 'Pengguna berhasil dibuat.',
        color: 'success'
      })
    }
    emit('saved')
    emit('close')
  } catch (err: unknown) {
    error.value = getApiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="isEdit ? 'Ubah Pengguna' : 'Tambah Pengguna'"
    :description="
      isEdit ? 'Perbarui informasi pengguna.' : 'Buat akun pengguna baru.'
    "
    @update:open="
      val => {
        if (!val) emit('close')
      }
    "
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="user?.deletedAt"
          color="error"
          variant="soft"
          description="Akun ini telah dihapus (soft delete). Catatan historis tetap disimpan."
        />
        <UForm :state="form" :validate="validate" @submit="onSubmit">
          <div class="space-y-4">
            <UAlert
              v-if="error"
              color="error"
              variant="soft"
              :description="error"
            />
            <UFormField label="Nama" name="name" required>
              <UInput
                v-model="form.name"
                class="w-full"
                placeholder="Masukkan nama"
                autocomplete="name"
              />
            </UFormField>
            <UFormField label="Nama pengguna" name="username" required>
              <UInput
                v-model="form.username"
                class="w-full"
                placeholder="Masukkan nama pengguna"
                autocomplete="username"
              />
            </UFormField>
            <UFormField
              :label="isEdit ? 'Kata sandi baru' : 'Kata sandi'"
              name="password"
              :required="!isEdit"
              :help="isEdit ? 'Kosongkan jika tidak diubah.' : undefined"
            >
              <UInput
                v-model="form.password"
                class="w-full"
                type="password"
                :placeholder="
                  isEdit ? 'Kosongkan jika tidak diubah' : 'Minimal 8 karakter'
                "
                autocomplete="new-password"
              />
            </UFormField>
            <UFormField label="Peran" name="role" required>
              <USelect
                v-model="form.role"
                :items="roleOptions"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="form.role === 'student'"
              label="NIM"
              name="nim"
              required
            >
              <UInput
                v-model="form.nim"
                class="w-full"
                placeholder="Masukkan NIM"
                inputmode="numeric"
              />
            </UFormField>
            <div class="flex justify-end gap-2">
              <UButton
                color="neutral"
                variant="soft"
                label="Batal"
                @click="emit('close')"
              />
              <UButton type="submit" label="Simpan" :loading="loading" />
            </div>
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
