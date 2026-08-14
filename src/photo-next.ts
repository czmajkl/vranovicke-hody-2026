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

export function compressProfilePhoto(file: File) {
  return compressImage(file, 420, 0.76, 820_000)
}

export function compressMomentPhoto(file: File) {
  return compressImage(file, 1280, 0.78, 1_250_000)
}
