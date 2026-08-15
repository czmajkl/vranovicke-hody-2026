export const SHOT_KINDS = [
  { id: 'slivovica', label: 'Slivovica' },
  { id: 'zelena', label: 'Zelená' },
  { id: 'vodka', label: 'Vodka' },
  { id: 'rum', label: 'Rum' },
  { id: 'fernet', label: 'Fernet' },
  { id: 'tequila', label: 'Tequila' },
  { id: 'jager', label: 'Jäger' },
  { id: 'borovicka', label: 'Borovička' },
  { id: 'becherovka', label: 'Becherovka' },
  { id: 'soft', label: 'Něco hodnějšího' },
] as const

export type ShotKind = typeof SHOT_KINDS[number]['id']

export function shotKindLabel(kind: string | null | undefined) {
  return SHOT_KINDS.find((item) => item.id === kind)?.label ?? 'Panák'
}
