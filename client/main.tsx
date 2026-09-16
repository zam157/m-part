/* eslint-disable perfectionist/sort-imports */
import { render } from '@solidjs/web'

import './styles/main.css'
import 'uno.css'
import App from './App'
import { Router } from './router'

render(
  () => (
    <Router>
      {props => <App>{props.children}</App>}
    </Router>
  ),
  document.getElementById('app')!,
)
