export async function compressProfilePhoto(file: File, maxSize = 360): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Tohle nevypadá jak fotka.')

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Fotku sa nepodařilo načíst.'))
      element.src = objectUrl
    })

    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Prohlížeč odmítl připravit fotku.')
    context.drawImage(image, 0, 0, width, height)

    let data = canvas.toDataURL('image/webp', 0.72)
    if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/jpeg', 0.75)
    if (data.length > 850_000) {
      data = canvas.toDataURL('image/jpeg', 0.58)
    }
    if (data.length > 900_000) throw new Error('Fotka je aj po zmenšení moc veliká. Zkus inú.')
    return data
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
