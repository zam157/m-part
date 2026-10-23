/* eslint-disable perfectionist/sort-imports */
import { render } from '@solidjs/web'

import './styles/main.css'
import 'uno.css'
import App from './App'
import { Router } from './router'
import { startPlayerPersistence } from './composables/player-persistence'
import { startMediaSession } from './composables/media-session'
import { startListenTogether } from './composables/listen-room'

const playerPersistence = startPlayerPersistence()
const disposeMediaSession = startMediaSession()
const disposeListenTogether = startListenTogether()
import.meta.hot?.dispose(() => {
  playerPersistence.dispose()
  disposeMediaSession()
  disposeListenTogether()
})

render(
  () => (
    <Router>
      {props => <App>{props.children}</App>}
    </Router>
  ),
  document.getElementById('app')!,
)
