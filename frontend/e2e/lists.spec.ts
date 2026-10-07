import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

// 画面でリストを追加・名前変更・削除したあと、
// (1) API（= DB）の中身が操作どおりに変わっていること
// (2) ページを読み直しても同じ表示になること
// を確かめる（F-01, F-06）。各テストで作ったリストは、終わったら消す

type List = { id: number; title: string; cards: { id: number }[] }

async function board(request: APIRequestContext): Promise<List[]> {
  const res = await request.get('/api/board')
  expect(res.ok()).toBe(true)
  return ((await res.json()) as { lists: List[] }).lists
}

// テストで作ったリスト。テストが終わったら消す（画面で消したものは 404 になるだけ）
let createdLists: number[] = []

// 前のテストの消し残しと重ならないように、時刻を付ける
const uniqueTitle = (name: string) => `E2E ${name} ${Date.now().toString(36)}`

async function createList(request: APIRequestContext, name: string): Promise<{ id: number; title: string }> {
  const title = uniqueTitle(name)
  const res = await request.post('/api/lists', { data: { title } })
  expect(res.status()).toBe(201)
  const { id } = (await res.json()) as { id: number }
  createdLists.push(id)
  return { id, title }
}

async function createCard(request: APIRequestContext, listId: number, title: string): Promise<number> {
  const res = await request.post(`/api/lists/${listId}/cards`, { data: { title } })
  expect(res.status()).toBe(201)
  return ((await res.json()) as { id: number }).id
}

test.afterEach(async ({ request }) => {
  for (const id of createdLists) await request.delete(`/api/lists/${id}`)
  createdLists = []
})

const listColumn = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })

function waitForApi(page: Page, method: string, path: string) {
  return page.waitForResponse((r) => r.request().method() === method && new URL(r.url()).pathname === path)
}

test('「＋ リストを追加」で右端にリストが追加され、DB にも保存される', async ({ page, request }) => {
  const title = uniqueTitle('追加')

  await page.goto('/')
  await page.getByRole('button', { name: '＋ リストを追加' }).click()
  const input = page.getByRole('textbox', { name: 'リストの名前' })

  // 空の名前は追加できない
  await page.getByRole('button', { name: 'リストを追加', exact: true }).click()
  await expect(page.getByText('リストの名前を入力してください')).toBeVisible()

  const saved = waitForApi(page, 'POST', '/api/lists')
  await input.fill(`  ${title}  `)
  await input.press('Enter')
  const res = await saved
  expect(res.status()).toBe(201)
  const { id } = (await res.json()) as { id: number }
  createdLists.push(id)

  // 前後の空白は取り除かれ、右端（最後）に入る。続けて追加できるように入力欄は開いたまま空になる
  const lists = await board(request)
  expect(lists.at(-1)).toMatchObject({ id, title, cards: [] })
  await expect(page.locator('section.list').last()).toHaveAttribute('aria-label', title)
  await expect(input).toHaveValue('')

  // Esc で閉じる
  await input.press('Escape')
  await expect(input).toHaveCount(0)

  await page.reload()
  await expect(page.locator('section.list').last()).toHaveAttribute('aria-label', title)
})

test('リスト名をクリックして変えると保存され、Esc や空の名前では変わらない', async ({ page, request }) => {
  const list = await createList(request, '名前')
  const renamed = `${list.title} 改`

  await page.goto('/')
  const titleButton = (title: string) => page.getByRole('button', { name: title, exact: true })
  const input = page.getByRole('textbox', { name: 'リストの名前' })

  // Esc で取り消すと API は呼ばれない
  let patched = false
  page.on('request', (r) => {
    if (r.method() === 'PATCH') patched = true
  })
  await titleButton(list.title).click()
  await input.fill('取り消す名前')
  await input.press('Escape')
  await expect(titleButton(list.title)).toBeVisible()

  // 空にして確定しても元の名前のまま
  await titleButton(list.title).click()
  await input.fill('   ')
  await input.press('Enter')
  await expect(titleButton(list.title)).toBeVisible()
  expect(patched).toBe(false)

  // Enter で保存
  const saved = waitForApi(page, 'PATCH', `/api/lists/${list.id}`)
  await titleButton(list.title).click()
  await input.fill(renamed)
  await input.press('Enter')
  expect((await saved).status()).toBe(200)
  await expect(listColumn(page, renamed)).toBeVisible()
  expect((await board(request)).find((l) => l.id === list.id)?.title).toBe(renamed)

  // フォーカスを外しても保存される
  const blurred = waitForApi(page, 'PATCH', `/api/lists/${list.id}`)
  await titleButton(renamed).click()
  await input.fill(list.title)
  await page.locator('header h1').click()
  expect((await blurred).status()).toBe(200)

  await page.reload()
  await expect(listColumn(page, list.title)).toBeVisible()
})

test('リストの × → 確認の「削除する」で、中のカードごと DB から消える', async ({ page, request }) => {
  const list = await createList(request, '削除')
  const a = await createCard(request, list.id, 'カードA')
  const b = await createCard(request, list.id, 'カードB')

  await page.goto('/')
  const column = listColumn(page, list.title)
  await expect(column.locator('[data-card-id]')).toHaveCount(2)

  // × は見出しにマウスを乗せると出る
  const button = page.getByRole('button', { name: `リスト「${list.title}」を削除`, exact: true })
  await expect(button).toBeHidden()
  await column.locator('.list-head').hover()
  await button.click()

  const confirm = column.getByRole('alertdialog')
  await expect(confirm).toHaveText(new RegExp(`「${list.title}」とカード 2 枚を削除しますか？`))
  await expect(confirm.getByRole('button', { name: '削除する' })).toBeFocused()
  const saved = waitForApi(page, 'DELETE', `/api/lists/${list.id}`)
  await confirm.getByRole('button', { name: '削除する' }).click()
  expect((await saved).status()).toBe(204)

  await expect(column).toHaveCount(0)
  expect((await board(request)).some((l) => l.id === list.id)).toBe(false)
  expect((await request.get(`/api/cards/${a}`)).status()).toBe(404)
  expect((await request.get(`/api/cards/${b}`)).status()).toBe(404)

  await page.reload()
  await expect(page.locator('section.list').first()).toBeVisible()
  await expect(column).toHaveCount(0)
})

test('リスト削除の確認で「キャンセル」か Esc を押すと削除されない', async ({ page, request }) => {
  const list = await createList(request, '削除の取り消し')
  let deleted = false
  page.on('request', (r) => {
    if (r.method() === 'DELETE') deleted = true
  })

  await page.goto('/')
  const column = listColumn(page, list.title)
  const button = page.getByRole('button', { name: `リスト「${list.title}」を削除`, exact: true })
  const confirm = column.getByRole('alertdialog')

  // キャンセルで閉じると、× にフォーカスが戻る
  await column.locator('.list-head').hover()
  await button.click()
  await confirm.getByRole('button', { name: 'キャンセル' }).click()
  await expect(confirm).toHaveCount(0)
  await expect(button).toBeFocused()

  await button.click()
  await page.keyboard.press('Escape')
  await expect(confirm).toHaveCount(0)

  expect(deleted).toBe(false)
  await page.reload()
  await expect(column).toBeVisible()
})

test('検索結果の表示中は、リストの追加・名前変更・削除を出さない', async ({ page, request }) => {
  const list = await createList(request, '検索中')
  await createCard(request, list.id, `${list.title} のカード`)

  await page.goto('/')
  await page.getByPlaceholder('タイトルの一部').fill(list.title)
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.getByText('検索結果 1 件')).toBeVisible()

  const column = listColumn(page, list.title)
  await expect(column.getByRole('heading', { name: list.title })).toBeVisible()
  await expect(page.getByRole('button', { name: list.title, exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: `リスト「${list.title}」を削除`, exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '＋ リストを追加' })).toHaveCount(0)

  // 「クリア」で戻すと使える
  await page.getByRole('button', { name: 'クリア' }).click()
  await expect(page.getByRole('button', { name: list.title, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '＋ リストを追加' })).toBeVisible()
})
