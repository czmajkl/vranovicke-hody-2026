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

async function compressImage(file: File, maxEdge: number, quality: number, maxOutputLength: number) {
  if (!file.type.startsWith('image/')) throw new Error('Tohle nevypadá jak fotka.')
  const image = await loadImage(file)
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Prohlížeč odmítl nachystat fotku.')
  context.drawImage(image, 0, 0, width, height)

  let currentQuality = quality
  let output = canvas.toDataURL('image/webp', currentQuality)
  while (output.length > maxOutputLength && currentQuality > 0.42) {
    currentQuality -= 0.08
    output = canvas.toDataURL('image/webp', currentQuality)
  }
  if (output.length > maxOutputLength) throw new Error('Fotka je furt moc veliká. Zkus jinú.')
  return output
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
    return await compressImage(file, 420, 0.76, 820_000)
  } catch (error) {
    pendingProfileFile = null
    throw error
  }
}

export async function compressMomentPhoto(file: File) {
  pendingMomentArchive = uploadOriginalPhoto(file, 'moment')
  try {
    return await compressImage(file, 1280, 0.78, 1_250_000)
  } catch (error) {
    pendingMomentArchive = null
    throw error
  }
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
