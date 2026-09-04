import QRCode from 'qrcode'

export const qrService = {
  async toDataUrl(text: string) {
    return QRCode.toDataURL(text, { margin: 1 })
  }
}
