import NeteaseCloudMusicApi from 'NeteaseCloudMusicApi'

export default defineEventHandler(async () => {
  return await NeteaseCloudMusicApi.banner({ type: 0 })
})
