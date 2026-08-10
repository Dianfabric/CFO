export type HiemBoothStatus = 'confirmed' | 'pending'

export type HiemBooth = {
  id: string
  brand: string
  hall: string
  booth: string
  status: HiemBoothStatus
}

const confirmed: Array<[string, string, string]> = [
  ['DIANBU', '5.2', 'A53'],
  ['Ricky', '6.2', 'D39'],
  ['HengLi', '5.1', 'F12'],
  ['Lugano', '5.1', 'G02'],
  ['Yinuo', '5.1', 'F08'],
  ['Shengli', '5.1', 'G33'],
  ['wonderful', '5.2', 'A40'],
  ['Taeren', '5.1', 'G45'],
  ['MingJi', '5.1', 'C03'],
  ['Modern', '5.2', 'H55'],
  ['nagelbu', '5.2', 'C48'],
  ['Xinhong', '5.1', 'A03'],
  ['Minazzi', '5.1', 'C09'],
  ['Julai', '5.1', 'F13'],
  ['Tony', '5.1', 'A27'],
  ['CCBF', '6.1', 'F96'],
  ['Kaidan', '6.1', 'C72'],
  ['Yilai', '6.2', 'F39'],
  ['Hexin', '5.1', 'F32'],
  ['Top choice', '6.2', 'D73'],
  ['NABOO', '5.1', 'F10'],
  ['KELLY FU', '5.1', 'H33'],
  ['DEKAI', '6.2', 'D60'],
  ['QBH', '5.1', 'F20'],
  ['EASTERN', '5.1', 'C31'],
  ['JES', '6.2', 'F67'],
]

const pending = ['NOVATEX', 'ALWAYS']

export const hiem2026Booths: HiemBooth[] = [
  ...confirmed.map(([brand, hall, booth]) => ({
    id: `${brand}-${hall}-${booth}`.toLowerCase().replace(/[^a-z0-9]/g, ''),
    brand,
    hall,
    booth,
    status: 'confirmed' as const,
  })),
  ...pending.map((brand) => ({
    id: `${brand}-pending`.toLowerCase(),
    brand,
    hall: '확인 중',
    booth: '부스 확인 중',
    status: 'pending' as const,
  })),
]

export const hiem2026Unavailable = ['Kashen', 'dido', 'GTA', 'Davis (9월)', 'EK']

export function boothSummary(booths: HiemBooth[]) {
  return {
    confirmed: booths.filter((booth) => booth.status === 'confirmed').length,
    pending: booths.filter((booth) => booth.status === 'pending').length,
  }
}
