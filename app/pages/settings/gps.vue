<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'default' })

interface GpsSettings {
  policy: 'K1' | 'K2' | 'K3'
  name: string
  formula: string
  description: string
  updatedAt: string
}

const toast = useToast()
const settings = ref<GpsSettings | null>(null)
const selectedPolicy = ref<GpsSettings['policy']>('K2')
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')

const policyOptions = [
  { label: 'K1 — Jarak saja', value: 'K1' },
  { label: 'K2 — Jarak dan akurasi', value: 'K2' },
  { label: 'K3 — Akurasi konservatif', value: 'K3' }
]

const policyInfo: Record<
  GpsSettings['policy'],
  {
    title: string
    formula: string
    description: string
    recommendation: string
  }
> = {
  K1: {
    title: 'K1 — Jarak saja',
    formula: 'd ≤ r',
    description:
      'Absensi diterima jika jarak mahasiswa ke titik ruangan tidak melebihi radius geofence. Nilai akurasi GPS tidak menjadi syarat tambahan.',
    recommendation: 'Paling longgar terhadap kualitas sinyal GPS.'
  },
  K2: {
    title: 'K2 — Jarak dan akurasi',
    formula: 'd ≤ r dan a ≤ r',
    description:
      'Absensi diterima jika mahasiswa berada dalam radius dan akurasi GPS yang dilaporkan perangkat tidak lebih besar dari radius ruangan.',
    recommendation: 'Pilihan seimbang untuk penggunaan umum.'
  },
  K3: {
    title: 'K3 — Akurasi konservatif',
    formula: 'd + a ≤ r',
    description:
      'Jarak dan ketidakpastian akurasi GPS dijumlahkan. Semakin besar nilai akurasi, semakin dekat mahasiswa harus berada dari titik ruangan.',
    recommendation:
      'Paling ketat dan paling sensitif terhadap sinyal GPS yang tidak akurat.'
  }
}

const selectedInfo = computed(() => policyInfo[selectedPolicy.value])

async function loadSettings() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await $fetch<{ settings: GpsSettings }>('/api/settings/gps')
    settings.value = result.settings
    selectedPolicy.value = result.settings.policy
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  try {
    const result = await $fetch<{ settings: GpsSettings }>(
      '/api/settings/gps',
      {
        method: 'PATCH',
        body: { policy: selectedPolicy.value }
      }
    )
    settings.value = result.settings
    selectedPolicy.value = result.settings.policy
    toast.add({
      title: 'Konfigurasi disimpan',
      description: 'Kebijakan validasi GPS untuk absensi telah diperbarui.',
      color: 'success'
    })
  } catch (error) {
    toast.add({
      title: 'Gagal menyimpan konfigurasi',
      description: getApiErrorMessage(error),
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <div class="w-full space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Konfigurasi Akurasi GPS</h1>
      <p class="text-sm text-muted">
        Pilih kebijakan validasi lokasi yang digunakan saat mahasiswa mengisi
        absensi.
      </p>
    </div>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      :description="errorMessage"
    />

    <div v-if="loading" class="py-12 text-center text-sm text-muted">
      Memuat konfigurasi GPS...
    </div>
    <template v-else>
      <UCard>
        <template #header>
          <div>
            <h2 class="font-semibold">Kebijakan aktif</h2>
            <p class="mt-1 text-sm text-muted">
              Hanya satu kebijakan yang digunakan secara global untuk validasi
              absensi baru.
            </p>
          </div>
        </template>

        <div class="space-y-4">
          <UFormField
            label="Kebijakan validasi GPS"
            description="Perubahan ini berlaku untuk validasi absensi berikutnya."
            name="policy"
          >
            <USelect
              v-model="selectedPolicy"
              :items="policyOptions"
              value-key="value"
              class="w-full sm:max-w-lg"
            />
          </UFormField>

          <UAlert color="info" variant="soft" icon="i-lucide-info">
            <template #title
              >{{ selectedInfo.title }} · {{ selectedInfo.formula }}</template
            >
            <template #description>
              <span>{{ selectedInfo.description }}</span>
              <span class="mt-1 block font-medium">{{
                selectedInfo.recommendation
              }}</span>
            </template>
          </UAlert>
        </div>

        <template #footer>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p v-if="settings" class="text-xs text-muted">
              Terakhir diperbarui: {{ formatDateIndonesia(settings.updatedAt) }}
            </p>
            <UButton
              label="Simpan konfigurasi"
              icon="i-lucide-save"
              :loading="saving"
              :disabled="selectedPolicy === settings?.policy"
              @click="saveSettings"
            />
          </div>
        </template>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">Cara membaca akurasi GPS</h2>
        </template>
        <div class="space-y-3 text-sm text-muted">
          <p>
            <strong class="text-default">d</strong> adalah jarak hasil
            perhitungan server antara posisi mahasiswa dan koordinat ruangan.
          </p>
          <p>
            <strong class="text-default">a</strong> adalah nilai akurasi yang
            dilaporkan browser dalam meter. Nilai ini menunjukkan perkiraan
            ketidakpastian posisi; semakin kecil nilainya, semakin baik.
          </p>
          <p>
            <strong class="text-default">r</strong> adalah radius geofence
            ruangan yang dikonfigurasi admin.
          </p>
          <p>
            Server tetap menghitung ulang jarak dan menerapkan kebijakan aktif.
            Pilihan pada halaman ini tidak mempercayai hasil perhitungan dari
            perangkat mahasiswa.
          </p>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">Ringkasan kebijakan</h2>
        </template>
        <div class="grid gap-4 md:grid-cols-3">
          <div
            v-for="(info, policy) in policyInfo"
            :key="policy"
            class="rounded-lg border p-4"
            :class="{
              'border-primary bg-primary/5': selectedPolicy === policy
            }"
          >
            <div class="flex items-center justify-between gap-2">
              <h3 class="font-medium">{{ info.title }}</h3>
              <UBadge
                v-if="selectedPolicy === policy"
                color="primary"
                variant="soft"
                >Aktif</UBadge
              >
            </div>
            <p class="mt-2 font-mono text-sm">{{ info.formula }}</p>
            <p class="mt-2 text-sm text-muted">{{ info.description }}</p>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
