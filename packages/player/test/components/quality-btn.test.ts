import { createComponent, render } from '@solidjs/web'
import { createSignal, flush } from 'solid-js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import QualityBtn from '~/components/MusicPlayer/components/QualityBtn'
import { mockPopover } from '../helpers/popover'

let dispose: (() => void) | undefined
let restore: () => void
beforeEach(() => { restore = mockPopover() })
afterEach(() => { dispose?.(); restore(); document.body.replaceChildren() })
it('uses the shared Select for mapped qualities and follows active-quality updates', () => {
  const high = { name: '高音质', url: 'https://audio.example.test/high', active: true }
  const low = { name: '标准', url: 'https://audio.example.test/low', active: false }
  const [qualities, setQualities] = createSignal([high, low])
  const select = vi.fn()
  dispose = render(() => createComponent(QualityBtn, { get qualities() { return qualities() }, onSelect: select }), document.body)
  flush()
  const trigger = document.querySelector<HTMLButtonElement>('[role="combobox"]')!
  trigger.click(); flush()
  expect(document.querySelector('[role="option"][aria-selected="true"]')?.textContent).toBe('高音质')
  expect(document.getElementById(trigger.getAttribute('aria-activedescendant')!)?.textContent).toBe('高音质')
  const options = [...document.querySelectorAll('[role="option"]')]
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); flush()
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); flush()
  expect(select).toHaveBeenCalledExactlyOnceWith(low)
  setQualities([{ ...high, active: false }, { ...low, active: true }]); flush()
  trigger.click(); flush()
  expect(document.querySelector('[role="option"][aria-selected="true"]')?.textContent).toBe('标准')
  for (const [index, option] of document.querySelectorAll('[role="option"]').entries())
    expect(option).toBe(options[index])
})
