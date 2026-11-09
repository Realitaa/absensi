<script setup lang="ts">
import {
  DateFormatter,
  parseDate,
  parseTime,
  fromDate,
  today
} from '@internationalized/date'
import type { DateValue, Time } from '@internationalized/date'

interface RoomOption {
  id: number
  name: string
}

interface SessionFormState {
  name: string
  description: string
  roomId: string
  startsLocal: string
  lateLocal: string
  closesLocal: string
}

const form = defineModel<SessionFormState>({ required: true })

const props = defineProps<{
  rooms: RoomOption[]
  roomsLoading: boolean
  errorMessage: string | null
  loading: boolean
  submitLabel: string
}>()

const emit = defineEmits<{
  submit: []
  cancel: []
}>()

const roomItems = computed(() =>
  props.rooms.map(r => ({ label: r.name, value: String(r.id) }))
)

const APP_TIMEZONE = 'Asia/Jakarta'

const df = new DateFormatter('id-ID', {
  dateStyle: 'medium'
})

const todayDate = today(APP_TIMEZONE)

function isDateUnavailable(date: DateValue) {
  return date.compare(todayDate) < 0
}

function splitLocal(local: string): { date: string; time: string } {
  const m = local.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/)
  if (!m) return { date: '', time: '' }
  return { date: m[1]!, time: m[2]! }
}

function joinLocal(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) return ''
  return `${dateStr}T${timeStr}`
}

function toCalendarDate(local: string): DateValue | undefined {
  const { date } = splitLocal(local)
  if (!date) return undefined
  try {
    return parseDate(date)
  } catch {
    return undefined
  }
}

function toTime(local: string): Time | undefined {
  const { time } = splitLocal(local)
  if (!time) return undefined
  try {
    return parseTime(time)
  } catch {
    return undefined
  }
}

const startsDate = shallowRef<DateValue | undefined>(
  toCalendarDate(form.value.startsLocal)
)
const lateDate = shallowRef<DateValue | undefined>(
  toCalendarDate(form.value.lateLocal)
)
const closesDate = shallowRef<DateValue | undefined>(
  toCalendarDate(form.value.closesLocal)
)

watch(
  () => form.value.startsLocal,
  v => {
    startsDate.value = toCalendarDate(v)
  }
)
watch(
  () => form.value.lateLocal,
  v => {
    lateDate.value = toCalendarDate(v)
  }
)
watch(
  () => form.value.closesLocal,
  v => {
    closesDate.value = toCalendarDate(v)
  }
)

function updateDate(
  field: 'startsLocal' | 'lateLocal' | 'closesLocal',
  v: DateValue | undefined
) {
  if (!v) return
  const model = form.value
  const { time } = splitLocal(model[field])
  const dateStr = v.toString()
  model[field] = joinLocal(dateStr, time || '08:00')
}

watch(startsDate, v => updateDate('startsLocal', v))
watch(lateDate, v => updateDate('lateLocal', v))
watch(closesDate, v => updateDate('closesLocal', v))

function updateTime(
  field: 'startsLocal' | 'lateLocal' | 'closesLocal',
  v: Time | undefined
) {
  if (!v) return
  const model = form.value
  const { date } = splitLocal(model[field])
  const timeStr = v.toString().slice(0, 5)
  if (!date) {
    const fallbackDate =
      toCalendarDate(model.startsLocal) ??
      toCalendarDate(model.lateLocal) ??
      toCalendarDate(model.closesLocal)
    const dateStr = fallbackDate ? fallbackDate.toString() : todayInput()
    model[field] = joinLocal(dateStr, timeStr)
    return
  }
  model[field] = joinLocal(date, timeStr)
}

function todayInput(): string {
  try {
    const d = fromDate(new Date(), APP_TIMEZONE)
    return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function formatPickerLabel(value: DateValue | undefined): string {
  if (!value) return 'Pilih tanggal'
  try {
    return df.format(value.toDate(APP_TIMEZONE))
  } catch {
    return 'Pilih tanggal'
  }
}

function validate(state: SessionFormState) {
  const errors: Array<{ name: string; message: string }> = []
  const name = state.name.trim()
  if (!name) errors.push({ name: 'name', message: 'Nama sesi wajib diisi.' })
  else if (name.length < 2 || name.length > 200)
    errors.push({ name: 'name', message: 'Nama sesi harus 2-200 karakter.' })

  if (!state.roomId)
    errors.push({ name: 'roomId', message: 'Ruangan wajib dipilih.' })

  if (!state.startsLocal)
    errors.push({ name: 'startsLocal', message: 'Waktu mulai wajib diisi.' })
  if (!state.lateLocal)
    errors.push({
      name: 'lateLocal',
      message: 'Batas keterlambatan wajib diisi.'
    })
  if (!state.closesLocal)
    errors.push({
      name: 'closesLocal',
      message: 'Waktu penutupan wajib diisi.'
    })

  if (state.startsLocal && state.lateLocal && state.closesLocal) {
    const starts = new Date(state.startsLocal).getTime()
    const late = new Date(state.lateLocal).getTime()
    const closes = new Date(state.closesLocal).getTime()
    if (Number.isNaN(starts) || Number.isNaN(late) || Number.isNaN(closes)) {
      errors.push({
        name: 'startsLocal',
        message: 'Format tanggal tidak valid.'
      })
    } else {
      if (starts > late)
        errors.push({
          name: 'lateLocal',
          message: 'Batas keterlambatan harus sama atau setelah waktu mulai.'
        })
      if (late >= closes)
        errors.push({
          name: 'closesLocal',
          message: 'Waktu penutupan harus setelah batas keterlambatan.'
        })
    }
  }

  return errors
}
</script>

<template>
  <UForm
    :state="form"
    :validate="validate"
    class="space-y-5"
    @submit="emit('submit')"
  >
    <UAlert
      v-if="props.errorMessage"
      color="error"
      variant="soft"
      :description="props.errorMessage"
    />

    <UFormField label="Nama sesi" name="name" required>
      <UInput
        v-model="form.name"
        class="w-full"
        placeholder="Masukkan nama sesi"
      />
    </UFormField>

    <UFormField label="Deskripsi" name="description">
      <UTextarea
        v-model="form.description"
        class="w-full"
        placeholder="Deskripsi singkat (opsional)"
        :rows="3"
      />
    </UFormField>

    <UFormField
      label="Ruangan"
      name="roomId"
      required
      :help="props.roomsLoading ? 'Memuat ruangan…' : undefined"
    >
      <USelect
        v-model="form.roomId"
        :items="roomItems"
        class="w-full"
        placeholder="Pilih ruangan"
        :disabled="props.roomsLoading || props.rooms.length === 0"
      />
    </UFormField>

    <UFormField label="Tanggal sesi" name="startsLocal" required>
      <div class="grid grid-cols-2 gap-2">
        <UPopover :content="{ align: 'start' } as never">
          <UButton
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar"
            class="w-full justify-start font-normal"
          >
            {{ formatPickerLabel(startsDate) }}
          </UButton>
          <template #content>
            <UCalendar
              v-model="startsDate"
              class="p-2"
              :min-value="todayDate"
              :is-date-unavailable="isDateUnavailable"
            />
          </template>
        </UPopover>
        <UInputTime
          class="w-full"
          :hour-cycle="24"
          :model-value="toTime(form.startsLocal)"
          @update:model-value="
            v => updateTime('startsLocal', v as Time | undefined)
          "
        />
      </div>
    </UFormField>

    <UFormField label="Batas keterlambatan" name="lateLocal" required>
      <div class="grid grid-cols-2 gap-2">
        <UPopover :content="{ align: 'start' } as never">
          <UButton
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar"
            class="w-full justify-start font-normal"
          >
            {{ formatPickerLabel(lateDate) }}
          </UButton>
          <template #content>
            <UCalendar
              v-model="lateDate"
              class="p-2"
              :min-value="todayDate"
              :is-date-unavailable="isDateUnavailable"
            />
          </template>
        </UPopover>
        <UInputTime
          class="w-full"
          :hour-cycle="24"
          :model-value="toTime(form.lateLocal)"
          @update:model-value="
            v => updateTime('lateLocal', v as Time | undefined)
          "
        />
      </div>
    </UFormField>

    <UFormField label="Waktu penutupan" name="closesLocal" required>
      <div class="grid grid-cols-2 gap-2">
        <UPopover :content="{ align: 'start' } as never">
          <UButton
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar"
            class="w-full justify-start font-normal"
          >
            {{ formatPickerLabel(closesDate) }}
          </UButton>
          <template #content>
            <UCalendar
              v-model="closesDate"
              class="p-2"
              :min-value="todayDate"
              :is-date-unavailable="isDateUnavailable"
            />
          </template>
        </UPopover>
        <UInputTime
          class="w-full"
          :hour-cycle="24"
          :model-value="toTime(form.closesLocal)"
          @update:model-value="
            v => updateTime('closesLocal', v as Time | undefined)
          "
        />
      </div>
    </UFormField>

    <p class="text-xs text-muted">
      Semua waktu memakai zona waktu Asia/Jakarta. Aturan: waktu mulai ≤ batas
      keterlambatan &lt; waktu penutupan.
    </p>

    <div class="flex justify-end gap-2">
      <UButton
        color="neutral"
        variant="soft"
        label="Batal"
        :disabled="props.loading"
        @click="emit('cancel')"
      />
      <UButton
        type="submit"
        :label="props.submitLabel"
        :loading="props.loading"
      />
    </div>
  </UForm>
</template>
