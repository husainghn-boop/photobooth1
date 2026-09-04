// Mock storage service (pluggable)
export const storageService = {
  async uploadPhoto(blob: Blob) {
    // in a real implementation we'd upload to cloud and return an id/url
    // here we convert to dataURL and return a pseudo-URL
    return new Promise<string>((res) => {
      const reader = new FileReader()
      reader.onload = () => res(String(reader.result))
      reader.readAsDataURL(blob)
    })
  },
  async getPhotoUrl(id: string) {
    return id
  }
}
