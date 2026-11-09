<script setup lang="ts">
interface RoomFormState {
  name: string
  latitude: string
  longitude: string
  radius: string
}

const form = defineModel<RoomFormState>({ required: true })

const props = defineProps<{
  errorMessage: string | null
  loading: boolean
  submitLabel: string
}>()

const emit = defineEmits<{
  submit: []
  cancel: []
}>()

function validate(state: RoomFormState) {
  const errors: Array<{ name: string; message: string }> = []
  const name = state.name.trim()
  if (!name) errors.push({ name: 'name', message: 'Nama ruangan wajib diisi.' })
  else if (name.length > 100) {
    errors.push({
      name: 'name',
      message: 'Nama ruangan maksimal 100 karakter.'
    })
  }

  const latitude = Number(state.latitude)
  if (state.latitude === '' || Number.isNaN(latitude)) {
    errors.push({
      name: 'latitude',
      message: 'Latitude wajib berupa angka.'
    })
  } else if (latitude < -90 || latitude > 90) {
    errors.push({
      name: 'latitude',
      message: 'Latitude harus antara -90 dan 90.'
    })
  }

  const longitude = Number(state.longitude)
  if (state.longitude === '' || Number.isNaN(longitude)) {
    errors.push({
      name: 'longitude',
      message: 'Longitude wajib berupa angka.'
    })
  } else if (longitude < -180 || longitude > 180) {
    errors.push({
      name: 'longitude',
      message: 'Longitude harus antara -180 dan 180.'
    })
  }

  const radius = Number(state.radius)
  if (state.radius === '' || Number.isNaN(radius)) {
    errors.push({ name: 'radius', message: 'Radius wajib berupa angka.' })
  } else if (radius <= 0) {
    errors.push({
      name: 'radius',
      message: 'Radius harus lebih dari 0 meter.'
    })
  } else if (radius > 20) {
    errors.push({ name: 'radius', message: 'Radius maksimal 20 meter.' })
  }

  return errors
}
</script>

<template>
  <UForm
    :state="form"
    :validate="validate"
    class="space-y-4"
    @submit="emit('submit')"
  >
    <UAlert
      v-if="props.errorMessage"
      color="error"
      variant="soft"
      :description="props.errorMessage"
    />
    <UFormField label="Nama ruangan" name="name" required>
      <UInput
        v-model="form.name"
        class="w-full"
        placeholder="Masukkan nama ruangan"
      />
    </UFormField>
    <UFormField label="Latitude" name="latitude" required hint="-90 sampai 90">
      <UInput
        v-model="form.latitude"
        class="w-full"
        type="number"
        step="any"
        placeholder="Contoh: -7.7495"
      />
    </UFormField>
    <UFormField
      label="Longitude"
      name="longitude"
      required
      hint="-180 sampai 180"
    >
      <UInput
        v-model="form.longitude"
        class="w-full"
        type="number"
        step="any"
        placeholder="Contoh: 110.3778"
      />
    </UFormField>
    <UFormField
      label="Radius (meter)"
      name="radius"
      required
      hint="Maksimal 20 meter"
    >
      <UInput
        v-model="form.radius"
        class="w-full"
        type="number"
        min="0.1"
        max="20"
        step="any"
        placeholder="Maksimal 20 meter"
      />
    </UFormField>
    <div class="flex justify-end gap-2">
      <UButton label="Batal" variant="ghost" @click="emit('cancel')" />
      <UButton
        type="submit"
        :loading="props.loading"
        :label="props.submitLabel"
      />
    </div>
  </UForm>
</template>
