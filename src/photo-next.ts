type ArchiveResult = {
  ok: true
  drive_file_id: string
  drive_name: string
}

let pendingMomentArchive: Promise<ArchiveResult> | null = null
let pendingProfileFile: File | null = null

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Fotku sa nepodařilo otevřít.'))
    }
    image.src = url
  })
}

function renderWebp(image: HTMLImageElement, width: number, height: number, quality: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Prohlížeč odmítl nachystat fotku.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/webp', quality)
}

async function compressImage(file: File, maxEdge: number, quality: number, maxOutputLength: number) {
  if (!file.type.startsWith('image/')) throw new Error('Tohle nevypadá jak fotka.')
  const image = await loadImage(file)
  const initialScale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
  let width = Math.max(1, Math.round(image.naturalWidth * initialScale))
  let height = Math.max(1, Math.round(image.naturalHeight * initialScale))

  // Nejdřív ubíráme kvalitu, pak i rozměry. Detailní fotky z moderních mobilů
  // se jinak dokážou nevejít ani při nízké WebP kvalitě.
  for (let resizeAttempt = 0; resizeAttempt < 7; resizeAttempt += 1) {
    for (let currentQuality = quality; currentQuality >= 0.42; currentQuality -= 0.07) {
      const output = renderWebp(image, width, height, Math.max(0.42, currentQuality))
      if (output.length <= maxOutputLength) return output
    }

    width = Math.max(480, Math.round(width * 0.82))
    height = Math.max(480, Math.round(height * 0.82))
  }

  const emergency = renderWebp(image, width, height, 0.4)
  if (emergency.length <= maxOutputLength) return emergency
  throw new Error('Fotku sa nepodařilo rozumně zmenšit. Zkus ju cvaknút znova.')
}

export async function uploadOriginalPhoto(file: File, purpose: 'moment' | 'profile') {
  const form = new FormData()
  form.append('file', file, file.name || `hody-${purpose}.jpg`)
  form.append('purpose', purpose)
  const response = await fetch('/api/photos/original', {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  })
  const text = await response.text()
  let payload: (ArchiveResult & { error?: string }) | null = null
  try {
    payload = text ? JSON.parse(text) as ArchiveResult & { error?: string } : null
  } catch {
    payload = null
  }
  if (!response.ok || !payload?.drive_file_id) {
    throw new Error(payload?.error || `Archiv originálu vrátil chybu ${response.status}.`)
  }
  return payload
}

export async function compressProfilePhoto(file: File) {
  pendingProfileFile = file
  try {
    return await compressImage(file, 720, 0.82, 650_000)
  } catch (error) {
    pendingProfileFile = null
    throw error
  }
}

export async function compressMomentPhoto(file: File) {
  pendingMomentArchive = null
  const webCopy = await compressImage(file, 1600, 0.82, 1_050_000)
  // Archivujeme až po úspěšné přípravě webové kopie, ale pořád posíláme původní File.
  pendingMomentArchive = uploadOriginalPhoto(file, 'moment')
  return webCopy
}

export async function takePendingMomentArchive() {
  const pending = pendingMomentArchive
  pendingMomentArchive = null
  if (!pending) return null
  return pending
}

export function takePendingProfileFile() {
  const file = pendingProfileFile
  pendingProfileFile = null
  return file
}
