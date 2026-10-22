/* eslint-disable perfectionist/sort-imports */
import { render } from '@solidjs/web'

import './styles/main.css'
import 'uno.css'
import App from './App'
import { Router } from './router'
import { startPlayerPersistence } from './composables/player-persistence'
import { startMediaSession } from './composables/media-session'

const playerPersistence = startPlayerPersistence()
const disposeMediaSession = startMediaSession()
import.meta.hot?.dispose(() => {
  playerPersistence.dispose()
  disposeMediaSession()
})

render(
  () => (
    <Router>
      {props => <App>{props.children}</App>}
    </Router>
  ),
  document.getElementById('app')!,
)
