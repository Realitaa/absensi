const INDONESIAN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short'
})

export function formatDateIndonesia(
  value: Date | string | number | null | undefined
): string {
  if (value === null || value === undefined || value === '') return '-'

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return INDONESIAN_DATE_TIME_FORMATTER.format(date)
}
