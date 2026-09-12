import { JSDOM } from 'jsdom'
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement })
const { render, screen, fireEvent, cleanup } = await import('@testing-library/react')
const { default: React, useState } = await import('react')
const { default: BuyerCategorySelect } = await import('../src/BuyerCategorySelect')
const categories = ['Chair', 'Desk', 'Table', 'Sofa', 'TV', 'Lamp', 'Shelf'].map(name => ({ id: name.toLowerCase(), name }))
afterEach(cleanup)
function Picker({ initial = ['chair'] }: { initial?: string[] }) {
  const [value, setValue] = useState(initial)
  return <BuyerCategorySelect value={value} onChange={setValue} />
}
function setup() { globalThis.fetch = async () => Response.json(categories) }

test('search and continuous multi-selection add removable tags without closing panel', async () => {
  setup(); render(<Picker />)
  fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
  const search = screen.getByRole('textbox', { name: 'Search categories' })
  assert.equal(document.activeElement, search)
  fireEvent.change(search, { target: { value: 'de' } })
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Desk' }))
  assert.ok(screen.getByRole('button', { name: 'Remove Desk' }))
  assert.ok(screen.getByRole('textbox'))
  fireEvent.change(search, { target: { value: 'zzzz' } })
  assert.ok(screen.getByText('No categories found. Try another name.'))
  fireEvent.click(screen.getByRole('button', { name: 'Remove Chair' }))
  assert.equal(screen.queryByRole('button', { name: 'Remove Chair' }), null)
  assert.ok(screen.getByRole('button', { name: 'Remove Desk' }))
})

test('six-category limit blocks additions but allows deselection and replacement', async () => {
  setup(); render(<Picker initial={categories.slice(0, 6).map(c => c.id)} />)
  fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
  const shelf = await screen.findByRole('checkbox', { name: 'Shelf' }) as HTMLInputElement
  assert.equal(shelf.disabled, true)
  const chair = screen.getByRole('checkbox', { name: 'Chair' }) as HTMLInputElement
  assert.equal(chair.disabled, false)
  fireEvent.click(chair)
  assert.equal(shelf.disabled, false)
  fireEvent.click(shelf)
  assert.ok(screen.getByRole('button', { name: 'Remove Shelf' }))
  assert.match(screen.getByRole('status').textContent!, /6 \/ 6/)
})

test('Escape restores trigger focus, outside click closes, and restored values render as tags', async () => {
  setup()
  const view = render(<BuyerCategorySelect value={['chair']} onChange={() => {}} />)
  const add = screen.getByRole('button', { name: 'Add category' })
  fireEvent.click(add)
  await screen.findByRole('checkbox', { name: 'Shelf' })
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
  assert.equal(add.getAttribute('aria-expanded'), 'false')
  assert.equal(document.activeElement, add)
  fireEvent.click(add)
  fireEvent.pointerDown(document.body)
  assert.equal(screen.queryByRole('textbox'), null)
  view.rerender(<BuyerCategorySelect value={['desk', 'shelf']} onChange={() => {}} />)
  assert.ok(screen.getByRole('button', { name: 'Remove Desk' }))
  assert.ok(screen.getByRole('button', { name: 'Remove Shelf' }))
  assert.equal(screen.queryByRole('button', { name: 'Remove Chair' }), null)
})
