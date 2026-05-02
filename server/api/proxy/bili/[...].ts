import { parseProxyRequestHeaders } from '#server/utils/proxy'
import { defineHandler, HTTPError } from 'nitro'
import { proxyRequest } from 'nitro/h3'

export const API_HOST = 'https://api.bilibili.com'
const WHITELIST = [
  '/x/frontend/finger/spi',
  '/x/web-interface/nav',
  '/x/web-interface/wbi/search/type',
  '/x/web-interface/view',
  '/x/player/wbi/playurl',
] as const

export default defineHandler(async (event) => {
  const { pathname } = event.url
  const path = pathname.slice('/api/proxy/bili'.length)

  // #region TODO: MOCK Data, remove this after testing
  // if (path === '/x/player/wbi/playurl') {
  //   return {
  //     code: 0,
  //     message: 'OK',
  //     ttl: 1,
  //     data: {
  //       from: 'local',
  //       result: 'suee',
  //       message: '',
  //       quality: 32,
  //       format: 'flv480',
  //       timelength: 1991978,
  //       accept_format: 'hdflv2,flv,flv720,flv480,mp4',
  //       accept_description: [
  //         '高清 1080P+',
  //         '高清 1080P',
  //         '高清 720P',
  //         '清晰 480P',
  //         '流畅 360P',
  //       ],
  //       accept_quality: [
  //         112,
  //         80,
  //         64,
  //         32,
  //         16,
  //       ],
  //       video_codecid: 7,
  //       seek_param: 'start',
  //       seek_type: 'offset',
  //       dash: {
  //         duration: 1992,
  //         minBufferTime: 1.5,
  //         min_buffer_time: 1.5,
  //         video: [
  //           {
  //             id: 32,
  //             baseUrl: 'https://cn-sccd-ct-02-10.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100110.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&deadline=1778743279&nbs=1&uipk=5&gen=playurlv3&og=hw&trid=000028222d11e1204012a479e3315f9ef59u&oi=3029218910&os=bcache&platform=pc&mid=0&upsig=14f80b1b30142d66266657305557be85&uparams=e,deadline,nbs,uipk,gen,og,trid,oi,os,platform,mid&cdnid=89710&bvc=vod&nettype=0&bw=238036&lrs=17&agrr=0&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&orderid=0,3',
  //             base_url: 'https://cn-sccd-ct-02-10.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100110.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&deadline=1778743279&nbs=1&uipk=5&gen=playurlv3&og=hw&trid=000028222d11e1204012a479e3315f9ef59u&oi=3029218910&os=bcache&platform=pc&mid=0&upsig=14f80b1b30142d66266657305557be85&uparams=e,deadline,nbs,uipk,gen,og,trid,oi,os,platform,mid&cdnid=89710&bvc=vod&nettype=0&bw=238036&lrs=17&agrr=0&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&orderid=0,3',
  //             backupUrl: [
  //               'https://upos-sz-mirrorbd.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100110.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&deadline=1778743279&nbs=1&gen=playurlv3&og=hw&uipk=5&platform=pc&oi=3029218910&os=bdbv&trid=28222d11e1204012a479e3315f9ef59u&mid=0&upsig=7eae1847379edde6b6ed6d466322d1bb&uparams=e,deadline,nbs,gen,og,uipk,platform,oi,os,trid,mid&bvc=vod&nettype=0&bw=238036&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&build=0&orderid=1,3',
  //               'https://upos-sz-mirrorbd.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100110.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&mid=0&deadline=1778743279&uipk=5&gen=playurlv3&os=bdbv&og=hw&nbs=1&oi=3029218910&platform=pc&trid=28222d11e1204012a479e3315f9ef59u&upsig=3b040d92e83ef1e39458b6619f4a9cf6&uparams=e,mid,deadline,uipk,gen,os,og,nbs,oi,platform,trid&bvc=vod&nettype=0&bw=238036&agrr=0&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&orderid=2,3',
  //             ],
  //             backup_url: [
  //               'https://upos-sz-mirrorbd.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100110.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&deadline=1778743279&nbs=1&gen=playurlv3&og=hw&uipk=5&platform=pc&oi=3029218910&os=bdbv&trid=28222d11e1204012a479e3315f9ef59u&mid=0&upsig=7eae1847379edde6b6ed6d466322d1bb&uparams=e,deadline,nbs,gen,og,uipk,platform,oi,os,trid,mid&bvc=vod&nettype=0&bw=238036&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&build=0&orderid=1,3',
  //               'https://upos-sz-mirrorbd.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100110.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&mid=0&deadline=1778743279&uipk=5&gen=playurlv3&os=bdbv&og=hw&nbs=1&oi=3029218910&platform=pc&trid=28222d11e1204012a479e3315f9ef59u&upsig=3b040d92e83ef1e39458b6619f4a9cf6&uparams=e,mid,deadline,uipk,gen,os,og,nbs,oi,platform,trid&bvc=vod&nettype=0&bw=238036&agrr=0&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&orderid=2,3',
  //             ],
  //             bandwidth: 237955,
  //             mimeType: 'video/mp4',
  //             mime_type: 'video/mp4',
  //             codecs: 'hev1.1.6.L120.90',
  //             width: 852,
  //             height: 480,
  //             frameRate: '25',
  //             frame_rate: '25',
  //             sar: '640:639',
  //             startWithSap: 1,
  //             start_with_sap: 1,
  //             SegmentBase: {
  //               Initialization: '0-1064',
  //               indexRange: '1065-5884',
  //             },
  //             segment_base: {
  //               initialization: '0-1064',
  //               index_range: '1065-5884',
  //             },
  //             codecid: 12,
  //           },
  //           {
  //             id: 32,
  //             baseUrl: 'https://cn-sccd-ct-02-07.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100047.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&uipk=5&platform=pc&oi=3029218910&gen=playurlv3&os=bcache&og=hw&trid=000028222d11e1204012a479e3315f9ef59u&mid=0&deadline=1778743279&nbs=1&upsig=e8ff641874c7c62d765b779bc8925295&uparams=e,uipk,platform,oi,gen,os,og,trid,mid,deadline,nbs&cdnid=89707&bvc=vod&nettype=0&bw=365664&lrs=17&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&build=0&orderid=0,3',
  //             base_url: 'https://cn-sccd-ct-02-07.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100047.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&uipk=5&platform=pc&oi=3029218910&gen=playurlv3&os=bcache&og=hw&trid=000028222d11e1204012a479e3315f9ef59u&mid=0&deadline=1778743279&nbs=1&upsig=e8ff641874c7c62d765b779bc8925295&uparams=e,uipk,platform,oi,gen,os,og,trid,mid,deadline,nbs&cdnid=89707&bvc=vod&nettype=0&bw=365664&lrs=17&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&build=0&orderid=0,3',
  //             backupUrl: [
  //               'https://upos-sz-mirror08h.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100047.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&platform=pc&trid=28222d11e1204012a479e3315f9ef59u&deadline=1778743279&nbs=1&gen=playurlv3&os=08hbv&og=hw&mid=0&oi=3029218910&uipk=5&upsig=aaf3c79c71fb9b2a277272e178d950e9&uparams=e,platform,trid,deadline,nbs,gen,os,og,mid,oi,uipk&bvc=vod&nettype=0&bw=365664&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&orderid=1,3',
  //               'https://upos-sz-mirror08c.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100047.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&mid=0&nbs=1&gen=playurlv3&os=08cbv&og=hw&uipk=5&platform=pc&trid=28222d11e1204012a479e3315f9ef59u&deadline=1778743279&oi=3029218910&upsig=9062bdda3a1a8da0d6a8984d8d0b6f25&uparams=e,mid,nbs,gen,os,og,uipk,platform,trid,deadline,oi&bvc=vod&nettype=0&bw=365664&agrr=0&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&orderid=2,3',
  //             ],
  //             backup_url: [
  //               'https://upos-sz-mirror08h.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100047.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&platform=pc&trid=28222d11e1204012a479e3315f9ef59u&deadline=1778743279&nbs=1&gen=playurlv3&os=08hbv&og=hw&mid=0&oi=3029218910&uipk=5&upsig=aaf3c79c71fb9b2a277272e178d950e9&uparams=e,platform,trid,deadline,nbs,gen,os,og,mid,oi,uipk&bvc=vod&nettype=0&bw=365664&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&orderid=1,3',
  //               'https://upos-sz-mirror08c.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100047.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&mid=0&nbs=1&gen=playurlv3&os=08cbv&og=hw&uipk=5&platform=pc&trid=28222d11e1204012a479e3315f9ef59u&deadline=1778743279&oi=3029218910&upsig=9062bdda3a1a8da0d6a8984d8d0b6f25&uparams=e,mid,nbs,gen,os,og,uipk,platform,trid,deadline,oi&bvc=vod&nettype=0&bw=365664&agrr=0&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&orderid=2,3',
  //             ],
  //             bandwidth: 365517,
  //             mimeType: 'video/mp4',
  //             mime_type: 'video/mp4',
  //             codecs: 'avc1.64001F',
  //             width: 852,
  //             height: 480,
  //             frameRate: '25',
  //             frame_rate: '25',
  //             sar: '640:639',
  //             startWithSap: 1,
  //             start_with_sap: 1,
  //             SegmentBase: {
  //               Initialization: '0-1011',
  //               indexRange: '1012-5819',
  //             },
  //             segment_base: {
  //               initialization: '0-1011',
  //               index_range: '1012-5819',
  //             },
  //             codecid: 7,
  //           },
  //           {
  //             id: 16,
  //             baseUrl: 'https://cn-sccd-ct-02-11.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100109.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&og=cos&uipk=5&trid=000028222d11e1204012a479e3315f9ef59u&oi=3029218910&os=bcache&platform=pc&mid=0&deadline=1778743279&nbs=1&gen=playurlv3&upsig=671987314797617784b573d0102ae67b&uparams=e,og,uipk,trid,oi,os,platform,mid,deadline,nbs,gen&cdnid=89711&bvc=vod&nettype=0&bw=164895&lrs=17&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&build=0&dl=0&orderid=0,3',
  //             base_url: 'https://cn-sccd-ct-02-11.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100109.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&og=cos&uipk=5&trid=000028222d11e1204012a479e3315f9ef59u&oi=3029218910&os=bcache&platform=pc&mid=0&deadline=1778743279&nbs=1&gen=playurlv3&upsig=671987314797617784b573d0102ae67b&uparams=e,og,uipk,trid,oi,os,platform,mid,deadline,nbs,gen&cdnid=89711&bvc=vod&nettype=0&bw=164895&lrs=17&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&build=0&dl=0&orderid=0,3',
  //             backupUrl: [
  //               'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100109.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&deadline=1778743279&uipk=5&platform=pc&gen=playurlv3&os=cosbv&og=cos&mid=0&nbs=1&oi=3029218910&trid=28222d11e1204012a479e3315f9ef59u&upsig=ab5fe95a878a96dd34a483b285e225bb&uparams=e,deadline,uipk,platform,gen,os,og,mid,nbs,oi,trid&bvc=vod&nettype=0&bw=164895&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&orderid=1,3',
  //               'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100109.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&oi=3029218910&gen=playurlv3&og=cos&deadline=1778743279&nbs=1&os=cosbv&uipk=5&platform=pc&trid=28222d11e1204012a479e3315f9ef59u&mid=0&upsig=9393afe4aadfc1cb0fb38bfb28434901&uparams=e,oi,gen,og,deadline,nbs,os,uipk,platform,trid,mid&bvc=vod&nettype=0&bw=164895&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&build=0&orderid=2,3',
  //             ],
  //             backup_url: [
  //               'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100109.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&deadline=1778743279&uipk=5&platform=pc&gen=playurlv3&os=cosbv&og=cos&mid=0&nbs=1&oi=3029218910&trid=28222d11e1204012a479e3315f9ef59u&upsig=ab5fe95a878a96dd34a483b285e225bb&uparams=e,deadline,uipk,platform,gen,os,og,mid,nbs,oi,trid&bvc=vod&nettype=0&bw=164895&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&orderid=1,3',
  //               'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100109.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&oi=3029218910&gen=playurlv3&og=cos&deadline=1778743279&nbs=1&os=cosbv&uipk=5&platform=pc&trid=28222d11e1204012a479e3315f9ef59u&mid=0&upsig=9393afe4aadfc1cb0fb38bfb28434901&uparams=e,oi,gen,og,deadline,nbs,os,uipk,platform,trid,mid&bvc=vod&nettype=0&bw=164895&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&build=0&orderid=2,3',
  //             ],
  //             bandwidth: 164839,
  //             mimeType: 'video/mp4',
  //             mime_type: 'video/mp4',
  //             codecs: 'hev1.1.6.L120.90',
  //             width: 640,
  //             height: 360,
  //             frameRate: '25',
  //             frame_rate: '25',
  //             sar: '1:1',
  //             startWithSap: 1,
  //             start_with_sap: 1,
  //             SegmentBase: {
  //               Initialization: '0-1058',
  //               indexRange: '1059-5878',
  //             },
  //             segment_base: {
  //               initialization: '0-1058',
  //               index_range: '1059-5878',
  //             },
  //             codecid: 12,
  //           },
  //           {
  //             id: 16,
  //             baseUrl: 'https://cn-sccd-ct-02-15.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100046.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&og=cos&uipk=5&trid=000028222d11e1204012a479e3315f9ef59u&deadline=1778743279&nbs=1&gen=playurlv3&os=bcache&platform=pc&mid=0&oi=3029218910&upsig=c5d6871f69888fe06bb37d44f252283b&uparams=e,og,uipk,trid,deadline,nbs,gen,os,platform,mid,oi&cdnid=89715&bvc=vod&nettype=0&bw=219772&lrs=17&agrr=0&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&orderid=0,3',
  //             base_url: 'https://cn-sccd-ct-02-15.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100046.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&og=cos&uipk=5&trid=000028222d11e1204012a479e3315f9ef59u&deadline=1778743279&nbs=1&gen=playurlv3&os=bcache&platform=pc&mid=0&oi=3029218910&upsig=c5d6871f69888fe06bb37d44f252283b&uparams=e,og,uipk,trid,deadline,nbs,gen,os,platform,mid,oi&cdnid=89715&bvc=vod&nettype=0&bw=219772&lrs=17&agrr=0&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&orderid=0,3',
  //             backupUrl: [
  //               'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100046.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&uipk=5&trid=28222d11e1204012a479e3315f9ef59u&og=cos&nbs=1&oi=3029218910&platform=pc&mid=0&deadline=1778743279&gen=playurlv3&os=cosbv&upsig=07271f0b6c963ddebd7be4b71e51dc2f&uparams=e,uipk,trid,og,nbs,oi,platform,mid,deadline,gen,os&bvc=vod&nettype=0&bw=219772&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&orderid=1,3',
  //               'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100046.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&oi=3029218910&og=cos&uipk=5&trid=28222d11e1204012a479e3315f9ef59u&deadline=1778743279&nbs=1&gen=playurlv3&os=cosbv&platform=pc&mid=0&upsig=f495cdfa535a1ba6c9f0a0a9e17ca54c&uparams=e,oi,og,uipk,trid,deadline,nbs,gen,os,platform,mid&bvc=vod&nettype=0&bw=219772&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&orderid=2,3',
  //             ],
  //             backup_url: [
  //               'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100046.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&uipk=5&trid=28222d11e1204012a479e3315f9ef59u&og=cos&nbs=1&oi=3029218910&platform=pc&mid=0&deadline=1778743279&gen=playurlv3&os=cosbv&upsig=07271f0b6c963ddebd7be4b71e51dc2f&uparams=e,uipk,trid,og,nbs,oi,platform,mid,deadline,gen,os&bvc=vod&nettype=0&bw=219772&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&orderid=1,3',
  //               'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-100046.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&oi=3029218910&og=cos&uipk=5&trid=28222d11e1204012a479e3315f9ef59u&deadline=1778743279&nbs=1&gen=playurlv3&os=cosbv&platform=pc&mid=0&upsig=f495cdfa535a1ba6c9f0a0a9e17ca54c&uparams=e,oi,og,uipk,trid,deadline,nbs,gen,os,platform,mid&bvc=vod&nettype=0&bw=219772&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&orderid=2,3',
  //             ],
  //             bandwidth: 219683,
  //             mimeType: 'video/mp4',
  //             mime_type: 'video/mp4',
  //             codecs: 'avc1.64001E',
  //             width: 640,
  //             height: 360,
  //             frameRate: '25',
  //             frame_rate: '25',
  //             sar: '1:1',
  //             startWithSap: 1,
  //             start_with_sap: 1,
  //             SegmentBase: {
  //               Initialization: '0-1015',
  //               indexRange: '1016-5823',
  //             },
  //             segment_base: {
  //               initialization: '0-1015',
  //               index_range: '1016-5823',
  //             },
  //             codecid: 7,
  //           },
  //         ],
  //         audio: [
  //           {
  //             id: 30216,
  //             baseUrl: 'https://cn-sccd-ct-02-22.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30216.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&os=bcache&platform=pc&trid=000028222d11e1204012a479e3315f9ef59u&mid=0&og=cos&nbs=1&oi=3029218910&uipk=5&deadline=1778743279&gen=playurlv3&upsig=cd4ab714e0cb0608eaa314de1166ea90&uparams=e,os,platform,trid,mid,og,nbs,oi,uipk,deadline,gen&cdnid=89722&bvc=vod&nettype=0&bw=39374&lrs=17&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&orderid=0,3',
  //             base_url: 'https://cn-sccd-ct-02-22.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30216.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&os=bcache&platform=pc&trid=000028222d11e1204012a479e3315f9ef59u&mid=0&og=cos&nbs=1&oi=3029218910&uipk=5&deadline=1778743279&gen=playurlv3&upsig=cd4ab714e0cb0608eaa314de1166ea90&uparams=e,os,platform,trid,mid,og,nbs,oi,uipk,deadline,gen&cdnid=89722&bvc=vod&nettype=0&bw=39374&lrs=17&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&orderid=0,3',
  //             backupUrl: [
  //               'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30216.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&oi=3029218910&trid=28222d11e1204012a479e3315f9ef59u&deadline=1778743279&gen=playurlv3&og=cos&nbs=1&uipk=5&platform=pc&mid=0&os=cosbv&upsig=65a9cfc207fd514343d6d93bb7150d8e&uparams=e,oi,trid,deadline,gen,og,nbs,uipk,platform,mid,os&bvc=vod&nettype=0&bw=39374&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&build=0&orderid=1,3',
  //               'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30216.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&uipk=5&trid=28222d11e1204012a479e3315f9ef59u&mid=0&deadline=1778743279&oi=3029218910&gen=playurlv3&platform=pc&nbs=1&os=cosbv&og=cos&upsig=249dae91115c276e2adb49da83443b33&uparams=e,uipk,trid,mid,deadline,oi,gen,platform,nbs,os,og&bvc=vod&nettype=0&bw=39374&agrr=0&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&orderid=2,3',
  //             ],
  //             backup_url: [
  //               'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30216.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&oi=3029218910&trid=28222d11e1204012a479e3315f9ef59u&deadline=1778743279&gen=playurlv3&og=cos&nbs=1&uipk=5&platform=pc&mid=0&os=cosbv&upsig=65a9cfc207fd514343d6d93bb7150d8e&uparams=e,oi,trid,deadline,gen,og,nbs,uipk,platform,mid,os&bvc=vod&nettype=0&bw=39374&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&build=0&orderid=1,3',
  //               'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30216.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&uipk=5&trid=28222d11e1204012a479e3315f9ef59u&mid=0&deadline=1778743279&oi=3029218910&gen=playurlv3&platform=pc&nbs=1&os=cosbv&og=cos&upsig=249dae91115c276e2adb49da83443b33&uparams=e,uipk,trid,mid,deadline,oi,gen,platform,nbs,os,og&bvc=vod&nettype=0&bw=39374&agrr=0&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&orderid=2,3',
  //             ],
  //             bandwidth: 39355,
  //             mimeType: 'audio/mp4',
  //             mime_type: 'audio/mp4',
  //             codecs: 'mp4a.40.5',
  //             width: 0,
  //             height: 0,
  //             frameRate: '',
  //             frame_rate: '',
  //             sar: '',
  //             startWithSap: 0,
  //             start_with_sap: 0,
  //             SegmentBase: {
  //               Initialization: '0-943',
  //               indexRange: '944-5763',
  //             },
  //             segment_base: {
  //               initialization: '0-943',
  //               index_range: '944-5763',
  //             },
  //             codecid: 0,
  //           },
  //           {
  //             id: 30232,
  //             baseUrl: 'https://cn-sccd-ct-02-03.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30232.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&nbs=1&oi=3029218910&platform=pc&trid=000028222d11e1204012a479e3315f9ef59u&deadline=1778743279&os=bcache&og=cos&uipk=5&mid=0&gen=playurlv3&upsig=154f98bdc5c7df56c9b1ec4e4181464d&uparams=e,nbs,oi,platform,trid,deadline,os,og,uipk,mid,gen&cdnid=89703&bvc=vod&nettype=0&bw=86020&lrs=17&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&build=0&dl=0&orderid=0,3',
  //             base_url: 'https://cn-sccd-ct-02-03.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30232.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&nbs=1&oi=3029218910&platform=pc&trid=000028222d11e1204012a479e3315f9ef59u&deadline=1778743279&os=bcache&og=cos&uipk=5&mid=0&gen=playurlv3&upsig=154f98bdc5c7df56c9b1ec4e4181464d&uparams=e,nbs,oi,platform,trid,deadline,os,og,uipk,mid,gen&cdnid=89703&bvc=vod&nettype=0&bw=86020&lrs=17&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&build=0&dl=0&orderid=0,3',
  //             backupUrl: [
  //               'https://upos-sz-mirrorcoso1.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30232.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&os=coso1bv&og=cos&uipk=5&platform=pc&mid=0&nbs=1&oi=3029218910&gen=playurlv3&trid=28222d11e1204012a479e3315f9ef59u&deadline=1778743279&upsig=a7dd3dc28a9d6985307e7292b63855f4&uparams=e,os,og,uipk,platform,mid,nbs,oi,gen,trid,deadline&bvc=vod&nettype=0&bw=86020&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&orderid=1,3',
  //               'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30232.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&deadline=1778743279&gen=playurlv3&os=cosbv&og=cos&nbs=1&oi=3029218910&trid=28222d11e1204012a479e3315f9ef59u&mid=0&uipk=5&platform=pc&upsig=60d700919fbe533ab9469ca4d39339f0&uparams=e,deadline,gen,os,og,nbs,oi,trid,mid,uipk,platform&bvc=vod&nettype=0&bw=86020&agrr=0&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&orderid=2,3',
  //             ],
  //             backup_url: [
  //               'https://upos-sz-mirrorcoso1.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30232.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&os=coso1bv&og=cos&uipk=5&platform=pc&mid=0&nbs=1&oi=3029218910&gen=playurlv3&trid=28222d11e1204012a479e3315f9ef59u&deadline=1778743279&upsig=a7dd3dc28a9d6985307e7292b63855f4&uparams=e,os,og,uipk,platform,mid,nbs,oi,gen,trid,deadline&bvc=vod&nettype=0&bw=86020&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&orderid=1,3',
  //               'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30232.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&deadline=1778743279&gen=playurlv3&os=cosbv&og=cos&nbs=1&oi=3029218910&trid=28222d11e1204012a479e3315f9ef59u&mid=0&uipk=5&platform=pc&upsig=60d700919fbe533ab9469ca4d39339f0&uparams=e,deadline,gen,os,og,nbs,oi,trid,mid,uipk,platform&bvc=vod&nettype=0&bw=86020&agrr=0&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&orderid=2,3',
  //             ],
  //             bandwidth: 85981,
  //             mimeType: 'audio/mp4',
  //             mime_type: 'audio/mp4',
  //             codecs: 'mp4a.40.2',
  //             width: 0,
  //             height: 0,
  //             frameRate: '',
  //             frame_rate: '',
  //             sar: '',
  //             startWithSap: 0,
  //             start_with_sap: 0,
  //             SegmentBase: {
  //               Initialization: '0-933',
  //               indexRange: '934-5753',
  //             },
  //             segment_base: {
  //               initialization: '0-933',
  //               index_range: '934-5753',
  //             },
  //             codecid: 0,
  //           },
  //           {
  //             id: 30280,
  //             baseUrl: 'https://cn-sccd-ct-02-03.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30280.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&nbs=1&uipk=5&mid=0&os=bcache&og=hw&oi=3029218910&platform=pc&trid=000028222d11e1204012a479e3315f9ef59u&deadline=1778743279&gen=playurlv3&upsig=80509248ebf5043cf6e9f438f1c4f406&uparams=e,nbs,uipk,mid,os,og,oi,platform,trid,deadline,gen&cdnid=89703&bvc=vod&nettype=0&bw=86020&lrs=17&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&build=0&dl=0&f=u_0_0&orderid=0,3',
  //             base_url: 'https://cn-sccd-ct-02-03.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30280.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&nbs=1&uipk=5&mid=0&os=bcache&og=hw&oi=3029218910&platform=pc&trid=000028222d11e1204012a479e3315f9ef59u&deadline=1778743279&gen=playurlv3&upsig=80509248ebf5043cf6e9f438f1c4f406&uparams=e,nbs,uipk,mid,os,og,oi,platform,trid,deadline,gen&cdnid=89703&bvc=vod&nettype=0&bw=86020&lrs=17&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&build=0&dl=0&f=u_0_0&orderid=0,3',
  //             backupUrl: [
  //               'https://upos-sz-mirror08c.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30280.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&mid=0&trid=28222d11e1204012a479e3315f9ef59u&os=08cbv&deadline=1778743279&nbs=1&oi=3029218910&uipk=5&platform=pc&gen=playurlv3&og=hw&upsig=9b24fe5e43af202c545aa3d0c2ea9d12&uparams=e,mid,trid,os,deadline,nbs,oi,uipk,platform,gen,og&bvc=vod&nettype=0&bw=86020&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&build=0&orderid=1,3',
  //               'https://upos-sz-mirror08c.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30280.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&oi=3029218910&platform=pc&mid=0&deadline=1778743279&gen=playurlv3&os=08cbv&nbs=1&uipk=5&trid=28222d11e1204012a479e3315f9ef59u&og=hw&upsig=da60dbb1fe8e6e2fe4cb016150abdc14&uparams=e,oi,platform,mid,deadline,gen,os,nbs,uipk,trid,og&bvc=vod&nettype=0&bw=86020&agrr=0&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&orderid=2,3',
  //             ],
  //             backup_url: [
  //               'https://upos-sz-mirror08c.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30280.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&mid=0&trid=28222d11e1204012a479e3315f9ef59u&os=08cbv&deadline=1778743279&nbs=1&oi=3029218910&uipk=5&platform=pc&gen=playurlv3&og=hw&upsig=9b24fe5e43af202c545aa3d0c2ea9d12&uparams=e,mid,trid,os,deadline,nbs,oi,uipk,platform,gen,og&bvc=vod&nettype=0&bw=86020&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&agrr=0&buvid=&build=0&orderid=1,3',
  //               'https://upos-sz-mirror08c.bilivideo.com/upgcxcode/55/54/1255285455/1255285455-1-30280.m4s?e=ig8euxZM2rNcNbdlhoNvNC8BqJIzNbfqXBvEqxTEto8BTrNvN0GvT90W5JZMkX_YN0MvXg8gNEV4NC8xNEV4N03eN0B5tZlqNxTEto8BTrNvNeZVuJ10Kj_g2UB02J0mN0B5tZlqNCNEto8BTrNvNC7MTX502C8f2jmMQJ6mqF2fka1mqx6gqj0eN0B599M=&oi=3029218910&platform=pc&mid=0&deadline=1778743279&gen=playurlv3&os=08cbv&nbs=1&uipk=5&trid=28222d11e1204012a479e3315f9ef59u&og=hw&upsig=da60dbb1fe8e6e2fe4cb016150abdc14&uparams=e,oi,platform,mid,deadline,gen,os,nbs,uipk,trid,og&bvc=vod&nettype=0&bw=86020&agrr=0&buvid=&build=0&dl=0&f=u_0_0&qn_dyeid=cbc6f6ab954d25e9002658c76a055bcf&orderid=2,3',
  //             ],
  //             bandwidth: 85981,
  //             mimeType: 'audio/mp4',
  //             mime_type: 'audio/mp4',
  //             codecs: 'mp4a.40.2',
  //             width: 0,
  //             height: 0,
  //             frameRate: '',
  //             frame_rate: '',
  //             sar: '',
  //             startWithSap: 0,
  //             start_with_sap: 0,
  //             SegmentBase: {
  //               Initialization: '0-933',
  //               indexRange: '934-5753',
  //             },
  //             segment_base: {
  //               initialization: '0-933',
  //               index_range: '934-5753',
  //             },
  //             codecid: 0,
  //           },
  //         ],
  //         dolby: {
  //           type: 0,
  //           audio: null,
  //         },
  //         flac: null,
  //       },
  //       support_formats: [
  //         {
  //           quality: 112,
  //           format: 'hdflv2',
  //           new_description: '1080P 高码率',
  //           display_desc: '1080P',
  //           superscript: '高码率',
  //           codecs: [
  //             'avc1.640032',
  //             'hev1.1.6.L150.90',
  //           ],
  //           can_watch_qn_reason: 0,
  //           limit_watch_reason: 0,
  //           report: {},
  //         },
  //         {
  //           quality: 80,
  //           format: 'flv',
  //           new_description: '1080P 高清',
  //           display_desc: '1080P',
  //           superscript: '',
  //           codecs: [
  //             'avc1.640032',
  //             'hev1.1.6.L150.90',
  //           ],
  //           can_watch_qn_reason: 0,
  //           limit_watch_reason: 0,
  //           report: {},
  //         },
  //         {
  //           quality: 64,
  //           format: 'flv720',
  //           new_description: '720P 准高清',
  //           display_desc: '720P',
  //           superscript: '',
  //           codecs: [
  //             'avc1.640028',
  //             'hev1.1.6.L120.90',
  //           ],
  //           can_watch_qn_reason: 0,
  //           limit_watch_reason: 0,
  //           report: {},
  //         },
  //         {
  //           quality: 32,
  //           format: 'flv480',
  //           new_description: '480P 标清',
  //           display_desc: '480P',
  //           superscript: '',
  //           codecs: [
  //             'avc1.64001F',
  //             'hev1.1.6.L120.90',
  //           ],
  //           can_watch_qn_reason: 0,
  //           limit_watch_reason: 0,
  //           report: {},
  //         },
  //         {
  //           quality: 16,
  //           format: 'mp4',
  //           new_description: '360P 流畅',
  //           display_desc: '360P',
  //           superscript: '',
  //           codecs: [
  //             'avc1.64001E',
  //             'hev1.1.6.L120.90',
  //           ],
  //           can_watch_qn_reason: 0,
  //           limit_watch_reason: 0,
  //           report: {},
  //         },
  //       ],
  //       high_format: null,
  //       last_play_time: 0,
  //       last_play_cid: 0,
  //       view_info: null,
  //       play_conf: {
  //         is_new_description: false,
  //       },
  //       cur_language: '',
  //       cur_production_type: 0,
  //       auto_qn_resp: {
  //         dyeid: 'cbc6f6ab954d25e9002658c76a055bcf',
  //       },
  //     },
  //   }
  // }
  // #endregion

  if (!WHITELIST.includes(path as any))
    throw new HTTPError('Unsupported URL', { status: 403 })

  const proxyHeaders = parseProxyRequestHeaders(event.req.headers)

  const newUrl = new URL(event.req.url)
  newUrl.pathname = path
  newUrl.hostname = API_HOST.replace(/^https?:\/\//, '')
  newUrl.port = ''
  newUrl.protocol = 'https:'

  return proxyRequest(event, newUrl.toString(), {
    headers: proxyHeaders,
  })
})
