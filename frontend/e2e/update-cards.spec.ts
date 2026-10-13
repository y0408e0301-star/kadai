import { expect, test } from '@playwright/test'
import type { APIRequestContext, Locator, Page } from '@playwright/test'

// 画面でカードを並べ替え・移動・編集したあと、
// (1) API（= DB）の中身が操作どおりに変わっていること
// (2) ページを読み直しても同じ表示になること
// を確かめる。各テストは自分用のリストを作って使い、終わったら消す

type Card = { id: number; title: string; priority: 'high' | 'mid' | 'low'; due: string | null }
type List = { id: number; title: string; cards: Card[] }

// ---- API で準備・確認する ----

async function board(request: APIRequestContext): Promise<List[]> {
  const res = await request.get('/api/board')
  expect(res.ok()).toBe(true)
  return ((await res.json()) as { lists: List[] }).lists
}

async function listOf(request: APIRequestContext, listId: number): Promise<List> {
  const list = (await board(request)).find((l) => l.id === listId)
  if (!list) throw new Error(`リスト ${listId} がありません`)
  return list
}

async function cardIds(request: APIRequestContext, listId: number): Promise<number[]> {
  return (await listOf(request, listId)).cards.map((c) => c.id)
}

async function cardOf(request: APIRequestContext, cardId: number): Promise<Card> {
  const res = await request.get(`/api/cards/${cardId}`)
  expect(res.ok()).toBe(true)
  return (await res.json()) as Card
}

// テストで作ったリスト。テストが終わったら消す
let createdLists: number[] = []

async function createList(request: APIRequestContext, name: string): Promise<{ id: number; title: string }> {
  // 前のテストの消し残しと重ならないように、時刻を付ける
  const title = `E2E ${name} ${Date.now().toString(36)}`
  const res = await request.post('/api/lists', { data: { title } })
  expect(res.status()).toBe(201)
  const { id } = (await res.json()) as { id: number }
  createdLists.push(id)
  return { id, title }
}

async function createCard(request: APIRequestContext, listId: number, title: string,
  extra: { priority?: Card['priority']; due?: string } = {}): Promise<number> {
  const res = await request.post(`/api/lists/${listId}/cards`, { data: { title, ...extra } })
  expect(res.status()).toBe(201)
  return ((await res.json()) as { id: number }).id
}

test.afterEach(async ({ request }) => {
  for (const id of createdLists) await request.delete(`/api/lists/${id}`)
  createdLists = []
})

// 今日から days 日後の日付（YYYY-MM-DD）
function daysFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---- 画面を操作する ----

const listColumn = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })
const cardEl = (page: Page, cardId: number) => page.locator(`[data-card-id="${cardId}"]`)

// 画面に出ているカードの id を上から順に返す
async function shownIds(column: Locator): Promise<number[]> {
  const ids = await column.locator('[data-card-id]').evaluateAll(
    (els) => els.map((el) => Number(el.getAttribute('data-card-id'))))
  return ids
}

// 指定した API の呼び出しが終わるのを待つ（操作の前に呼んでおく）
function waitForApi(page: Page, method: string, path: string) {
  return page.waitForResponse((r) => r.request().method() === method && new URL(r.url()).pathname === path)
}

// source をつかんで target の上（top）・下（bottom）・真ん中（center）・下端ぎりぎり（edge：次のカードとの境目）に置く。
// dnd-kit は 5px 動かすとドラッグが始まるので、少しずつ動かす
async function dragTo(page: Page, source: Locator, target: Locator, where: 'top' | 'bottom' | 'center' | 'edge') {
  await source.scrollIntoViewIfNeeded()
  const s = await source.boundingBox()
  const t = await target.boundingBox()
  if (!s || !t) throw new Error('ドラッグする要素が見えません')
  const y = { top: t.y + 4, bottom: t.y + t.height - 4, center: t.y + t.height / 2, edge: t.y + t.height - 1 }[where]
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2)
  await page.mouse.down()
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2 + 10, { steps: 5 })
  await page.mouse.move(t.x + t.width / 2, y, { steps: 20 })
  await page.mouse.move(t.x + t.width / 2, y, { steps: 5 })
  await page.mouse.up()
}

// ---- テスト ----

test('同じリストの中でドラッグして並べ替えると、その順で保存される', async ({ page, request }) => {
  const list = await createList(request, '並べ替え')
  const a = await createCard(request, list.id, 'カードA')
  const b = await createCard(request, list.id, 'カードB')
  const c = await createCard(request, list.id, 'カードC')

  await page.goto('/')
  const column = listColumn(page, list.title)
  await expect(column.locator('[data-card-id]')).toHaveCount(3)

  // A を C の下へ
  const saved = waitForApi(page, 'PUT', `/api/cards/${a}/move`)
  await dragTo(page, cardEl(page, a), cardEl(page, c), 'bottom')
  expect((await saved).status()).toBe(204)

  expect(await cardIds(request, list.id)).toEqual([b, c, a])
  expect(await shownIds(column)).toEqual([b, c, a])
  await expect(page.locator('.save-state')).toContainText('保存しました')

  await page.reload()
  await expect(column.locator('[data-card-id]')).toHaveCount(3)
  expect(await shownIds(column)).toEqual([b, c, a])
})

// #53：別のリストのカードの下端（次のカードとの境目）に置くと、移す・戻すが繰り返されて画面が真っ白になっていた
// 置く位置はちょうど X と Y の境目なので、どこに入るかは決めない（画面が壊れず、表示と保存が一致していればよい）
test('別のリストのカードの下端に置いても画面が壊れず、移動が保存される', async ({ page, request }) => {
  const from = await createList(request, '移動元')
  const to = await createList(request, '移動先')
  const a = await createCard(request, from.id, 'カード A')
  const b = await createCard(request, from.id, 'カード B')
  const c = await createCard(request, from.id, 'カード C')
  const x = await createCard(request, to.id, 'カード X')
  const y = await createCard(request, to.id, 'カード Y')

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  const toColumn = listColumn(page, to.title)
  await expect(toColumn.locator('[data-card-id]')).toHaveCount(2)

  // B を「移動先」の X の下端ぎりぎり（Y との境目）へ
  const saved = waitForApi(page, 'PUT', `/api/cards/${b}/move`)
  await dragTo(page, cardEl(page, b), cardEl(page, x), 'edge')
  expect((await saved).status()).toBe(204)
  expect(errors).toEqual([])
  await expect(toColumn.locator('[data-card-id]')).toHaveCount(3)
  expect(await cardIds(request, from.id)).toEqual([a, c])
  const savedOrder = await cardIds(request, to.id)
  expect(savedOrder.toSorted((p, q) => p - q)).toEqual([x, y, b].toSorted((p, q) => p - q))
  expect(await shownIds(toColumn)).toEqual(savedOrder)

  await page.reload()
  await expect(toColumn.locator('[data-card-id]')).toHaveCount(3)
  expect(await shownIds(toColumn)).toEqual(savedOrder)
})

test('別のリストへドラッグすると移動が保存される（「完了」へ動かす操作）', async ({ page, request }) => {
  const doing = await createList(request, '作業中')
  const done = await createList(request, '完了')
  const empty = await createList(request, '空')
  const a = await createCard(request, doing.id, 'レポートを書く')
  const b = await createCard(request, doing.id, 'スライドを作る')
  const x = await createCard(request, done.id, '課題を提出する')

  await page.goto('/')
  const doingColumn = listColumn(page, doing.title)
  const doneColumn = listColumn(page, done.title)
  const emptyColumn = listColumn(page, empty.title)
  await expect(doneColumn.locator('[data-card-id]')).toHaveCount(1)

  // B を「完了」の先頭（X の上）へ
  let saved = waitForApi(page, 'PUT', `/api/cards/${b}/move`)
  await dragTo(page, cardEl(page, b), cardEl(page, x), 'top')
  expect((await saved).status()).toBe(204)
  expect(await cardIds(request, doing.id)).toEqual([a])
  expect(await cardIds(request, done.id)).toEqual([b, x])

  // A をカードのないリストへ
  saved = waitForApi(page, 'PUT', `/api/cards/${a}/move`)
  await dragTo(page, cardEl(page, a), emptyColumn.locator('.cards'), 'center')
  expect((await saved).status()).toBe(204)
  expect(await cardIds(request, doing.id)).toEqual([])
  expect(await cardIds(request, empty.id)).toEqual([a])

  await page.reload()
  await expect(doneColumn.locator('[data-card-id]')).toHaveCount(2)
  expect(await shownIds(doingColumn)).toEqual([])
  expect(await shownIds(doneColumn)).toEqual([b, x])
  expect(await shownIds(emptyColumn)).toEqual([a])
  await expect(doneColumn.locator('.count')).toHaveText('2')
})

test('キーボードの「移動」ボタンで別のリストへ移動でき、タイトルの Enter で編集欄が開く', async ({ page, request }) => {
  const from = await createList(request, 'キー移動元')
  const to = await createList(request, 'キー移動先')
  const id = await createCard(request, from.id, 'キーで動かすカード')

  await page.goto('/')
  const card = cardEl(page, id)
  const handle = card.getByRole('button', { name: 'カード「キーで動かすカード」を移動', exact: true })

  // 「移動」ボタンは × と同じくふだんは隠れていて、タイトルから Tab で進むと出る
  await card.getByRole('button', { name: 'キーで動かすカード', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(handle).toBeFocused()

  // つかむ → 右のリストへ → 置く
  const saved = waitForApi(page, 'PUT', `/api/cards/${id}/move`)
  // dnd-kit がつかんだ状態になってから矢印を押す（速すぎると矢印が効かない）
  await page.keyboard.press('Space')
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('ArrowRight')
  await expect(listColumn(page, to.title).locator(`[data-card-id="${id}"]`)).toBeVisible()
  await page.keyboard.press('Space')
  expect((await saved).status()).toBe(204)
  expect(await cardIds(request, from.id)).toEqual([])
  expect(await cardIds(request, to.id)).toEqual([id])

  // タイトルにフォーカスして Enter で編集欄が開く。ラジオボタンの Space はドラッグにならない
  await card.getByRole('button', { name: 'キーで動かすカード', exact: true }).press('Enter')
  await expect(page.getByRole('textbox', { name: 'タイトル', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  const prio = waitForApi(page, 'PATCH', `/api/cards/${id}`)
  await cardEl(page, id).getByRole('radio', { name: '高' }).press('Space')
  expect((await prio).status()).toBe(200)
  expect(await cardIds(request, to.id)).toEqual([id])
})

test('カード上のラジオボタンで優先順位を切り替えると保存される', async ({ page, request }) => {
  const list = await createList(request, '優先順位')
  const id = await createCard(request, list.id, '資料を読む')

  await page.goto('/')
  const card = cardEl(page, id)
  await expect(card.getByRole('radio', { name: '中' })).toBeChecked()

  const saved = waitForApi(page, 'PATCH', `/api/cards/${id}`)
  await card.getByRole('radio', { name: '低' }).check()
  expect((await saved).status()).toBe(200)
  // ラジオボタンを押しても編集欄は開かない
  await expect(page.getByRole('textbox', { name: 'タイトル', exact: true })).toHaveCount(0)

  expect((await cardOf(request, id)).priority).toBe('low')
  await page.reload()
  await expect(cardEl(page, id).getByRole('radio', { name: '低' })).toBeChecked()
})

test('カードをクリックしてタイトル・期限・優先順位を編集すると保存される', async ({ page, request }) => {
  const list = await createList(request, '編集')
  const id = await createCard(request, list.id, 'レポート')
  const tomorrow = daysFromToday(1)

  await page.goto('/')
  await cardEl(page, id).click()
  const editor = listColumn(page, list.title).locator('form.editing')
  await editor.getByRole('textbox', { name: 'タイトル', exact: true }).fill('  レポートを書く  ')
  await editor.getByLabel('期限').fill(tomorrow)
  await editor.getByRole('radio', { name: '高' }).check()

  const saved = waitForApi(page, 'PATCH', `/api/cards/${id}`)
  await editor.getByRole('button', { name: '保存' }).click()
  expect((await saved).status()).toBe(200)

  // 前後の空白は取り除かれる
  expect(await cardOf(request, id)).toMatchObject({ title: 'レポートを書く', priority: 'high', due: tomorrow })

  await page.reload()
  const card = cardEl(page, id)
  await expect(card.locator('.card-title')).toHaveText('レポートを書く')
  await expect(card.getByRole('radio', { name: '高' })).toBeChecked()
  // 期限が 2 日以内なので黄色（soon）で出る
  await expect(card.locator('.due')).toHaveText(/明日まで/)
  await expect(card.locator('.due')).toHaveClass(/soon/)
})

test('期限を消すと「期限なし」で保存され、過ぎた期限は赤で出る', async ({ page, request }) => {
  const list = await createList(request, '期限')
  const keep = await createCard(request, list.id, '期限切れのカード', { due: daysFromToday(-1) })
  const clear = await createCard(request, list.id, '期限を消すカード', { due: daysFromToday(10) })

  await page.goto('/')
  await expect(cardEl(page, keep).locator('.due')).toHaveClass(/over/)

  await cardEl(page, clear).click()
  const editor = listColumn(page, list.title).locator('form.editing')
  await editor.getByLabel('期限').fill('')
  const saved = waitForApi(page, 'PATCH', `/api/cards/${clear}`)
  await editor.getByRole('textbox', { name: 'タイトル', exact: true }).press('Enter')
  expect((await saved).status()).toBe(200)

  expect((await cardOf(request, clear)).due).toBeNull()
  await page.reload()
  await expect(cardEl(page, clear).locator('.due')).toHaveText('期限なし')
})

test('空のタイトルや Esc では保存されない', async ({ page, request }) => {
  const list = await createList(request, '取り消し')
  const id = await createCard(request, list.id, '元のタイトル')
  let patched = false
  page.on('request', (r) => {
    if (r.method() === 'PATCH') patched = true
  })

  await page.goto('/')
  await cardEl(page, id).click()
  const title = page.getByRole('textbox', { name: 'タイトル', exact: true })
  await title.fill('   ')
  await title.press('Enter')
  await expect(page.getByText('タイトルを入力してください')).toBeVisible()

  await title.fill('変えたタイトル')
  await title.press('Escape')
  await expect(cardEl(page, id).locator('.card-title')).toHaveText('元のタイトル')

  expect(patched).toBe(false)
  expect((await cardOf(request, id)).title).toBe('元のタイトル')
})

test('保存に失敗したら、そのことを出して DB の状態に表示を戻す', async ({ page, request }) => {
  const list = await createList(request, '失敗')
  const id = await createCard(request, list.id, '保存できないカード', { priority: 'mid' })

  await page.goto('/')
  // この 1 回だけ API がエラーを返したことにする
  await page.route(`**/api/cards/${id}`, (route) => route.request().method() === 'PATCH'
    ? route.fulfill({ status: 500 })
    : route.fallback(), { times: 1 })

  const reloaded = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/board')
  await cardEl(page, id).getByRole('radio', { name: '高' }).check()
  await reloaded

  await expect(page.locator('.save-state')).toContainText('保存できませんでした')
  await expect(cardEl(page, id).getByRole('radio', { name: '中' })).toBeChecked()
  expect((await cardOf(request, id)).priority).toBe('mid')
})

test('API が返したエラーの理由を画面に出す', async ({ page, request }) => {
  const list = await createList(request, 'エラーの理由')

  await page.goto('/')
  const column = listColumn(page, list.title)
  await column.getByRole('button', { name: '＋ カードを追加' }).click()
  // 画面を開いたあとで、別の画面からリストが消されたことにする
  await request.delete(`/api/lists/${list.id}`)

  await column.getByRole('textbox', { name: 'カードのタイトル' }).fill('消えたリストへのカード')
  await column.getByRole('button', { name: 'カードを追加', exact: true }).click()
  await expect(column.locator('.form-error'))
    .toHaveText(`追加できませんでした（リストが見つかりません（id: ${list.id}））`)
})

test('カード右上の × → 確認の「削除する」で削除すると DB からも消え、再読み込みしても出ない', async ({ page, request }) => {
  const list = await createList(request, '削除')
  const keep = await createCard(request, list.id, '残すカード')
  const remove = await createCard(request, list.id, '消すカード')

  await page.goto('/')
  const column = listColumn(page, list.title)
  await expect(column.locator('[data-card-id]')).toHaveCount(2)

  // × はマウスを乗せると出る
  const button = page.getByRole('button', { name: 'カード「消すカード」を削除', exact: true })
  await expect(button).toBeHidden()
  await cardEl(page, remove).hover()
  await button.click()

  // × を押しても編集欄は開かず、確認が出る
  await expect(page.getByRole('textbox', { name: 'タイトル', exact: true })).toHaveCount(0)
  const confirm = cardEl(page, remove).getByRole('alertdialog')
  await expect(confirm).toHaveText(/カード「消すカード」を削除しますか？/)
  const saved = waitForApi(page, 'DELETE', `/api/cards/${remove}`)
  await confirm.getByRole('button', { name: '削除する' }).click()
  expect((await saved).status()).toBe(204)

  expect(await shownIds(column)).toEqual([keep])
  expect((await request.get(`/api/cards/${remove}`)).status()).toBe(404)
  expect(await cardIds(request, list.id)).toEqual([keep])

  await page.reload()
  await expect(column.locator('[data-card-id]')).toHaveCount(1)
  expect(await shownIds(column)).toEqual([keep])
  await expect(column.locator('.count')).toHaveText('1')
})

test('確認で「キャンセル」か Esc を押すと削除されない', async ({ page, request }) => {
  const list = await createList(request, '削除の取り消し')
  const id = await createCard(request, list.id, '残したいカード')
  let deleted = false
  page.on('request', (r) => {
    if (r.method() === 'DELETE') deleted = true
  })

  await page.goto('/')
  const card = cardEl(page, id)
  const button = page.getByRole('button', { name: 'カード「残したいカード」を削除', exact: true })
  const confirm = card.getByRole('alertdialog')

  // キャンセルで閉じると、× にフォーカスが戻る
  await card.hover()
  await button.click()
  await confirm.getByRole('button', { name: 'キャンセル' }).click()
  await expect(confirm).toHaveCount(0)
  await expect(button).toBeFocused()

  // 確認を出すと「削除する」にフォーカスが移り、Esc で閉じる。
  // 確認の中をクリックしても編集欄は開かない
  await button.click()
  await expect(confirm.getByRole('button', { name: '削除する' })).toBeFocused()
  await confirm.locator('span').click()
  await expect(page.getByRole('textbox', { name: 'タイトル', exact: true })).toHaveCount(0)
  await confirm.getByRole('button', { name: '削除する' }).focus()
  await page.keyboard.press('Escape')
  await expect(confirm).toHaveCount(0)

  expect(deleted).toBe(false)
  expect(await cardIds(request, list.id)).toEqual([id])
  await page.reload()
  await expect(cardEl(page, id)).toBeVisible()
})

test('検索結果の表示中も × で削除でき、結果の件数からも消える', async ({ page, request }) => {
  const list = await createList(request, '検索して削除')
  const word = `削除検索${Date.now().toString(36)}`
  const a = await createCard(request, list.id, `${word} A`)
  const b = await createCard(request, list.id, `${word} B`)

  await page.goto('/')
  await page.getByRole('searchbox').fill(word)
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.getByText('検索結果 2 件')).toBeVisible()

  await cardEl(page, a).hover()
  const saved = waitForApi(page, 'DELETE', `/api/cards/${a}`)
  await page.getByRole('button', { name: `カード「${word} A」を削除`, exact: true }).click()
  await cardEl(page, a).getByRole('button', { name: '削除する' }).click()
  expect((await saved).status()).toBe(204)

  await expect(page.getByText('検索結果 1 件')).toBeVisible()
  expect(await cardIds(request, list.id)).toEqual([b])

  // 検索をやめても消えたまま
  await page.getByRole('button', { name: 'クリア' }).click()
  expect(await shownIds(listColumn(page, list.title))).toEqual([b])
})

test('「期限順に並べる」で各リストが期限順に並び、その順で保存される', async ({ page, request }) => {
  // ボタンはすべてのリストを並べ替えるので、もとのカードの順を覚えておき、最後に戻す
  const before = await board(request)
  try {
    const list = await createList(request, '期限順')
    const none = await createCard(request, list.id, '期限なし')
    const late = await createCard(request, list.id, '遅い', { due: daysFromToday(20) })
    const earlyLow = await createCard(request, list.id, '早い・低', { due: daysFromToday(3), priority: 'low' })
    const earlyHigh = await createCard(request, list.id, '早い・高', { due: daysFromToday(3), priority: 'high' })

    await page.goto('/')
    const column = listColumn(page, list.title)
    await expect(column.locator('[data-card-id]')).toHaveCount(4)

    const saved = waitForApi(page, 'POST', '/api/board/sort-by-due')
    await page.getByRole('button', { name: '期限順に並べる' }).click()
    expect((await saved).status()).toBe(200)

    const expected = [earlyHigh, earlyLow, late, none]
    expect(await cardIds(request, list.id)).toEqual(expected)
    await expect.poll(() => shownIds(column)).toEqual(expected)

    await page.reload()
    await expect(column.locator('[data-card-id]')).toHaveCount(4)
    expect(await shownIds(column)).toEqual(expected)
  }
  finally {
    for (const list of before) {
      for (const [position, card] of list.cards.entries()) {
        await request.put(`/api/cards/${card.id}/move`, { data: { listId: list.id, position } })
      }
    }
  }
})
