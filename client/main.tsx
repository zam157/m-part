/* eslint-disable perfectionist/sort-imports */
import { render } from '@solidjs/web'

import './styles/main.css'
import 'uno.css'
import App from './App'
import { Router } from './router'
import { startPlayerPersistence } from './composables/player-persistence'

const playerPersistence = startPlayerPersistence()
import.meta.hot?.dispose(() => playerPersistence.dispose())

render(
  () => (
    <Router>
      {props => <App>{props.children}</App>}
    </Router>
  ),
  document.getElementById('app')!,
)
