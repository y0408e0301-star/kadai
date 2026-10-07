import type {
  Board, Card, CardCreateRequest, CardDetail, CardSearchResult, CardUpdateRequest, List, SearchConditions,
} from './types'

// API がエラーを返したとき。message は画面にそのまま出せる理由
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }

  // String(err) で「Error: …」ではなく理由だけが出るようにする
  override toString(): string {
    return this.message
  }
}

// 200 番台以外なら ApiError にする。理由は API が返す Problem Details（RFC 9457）の detail を使い、
// 読めなければ「HTTP 500」のようにステータスだけを出す
export async function ensureOk(res: Response): Promise<Response> {
  if (res.ok) return res
  let detail: unknown
  try {
    detail = ((await res.json()) as { detail?: unknown }).detail
  } catch {
    detail = undefined
  }
  throw new ApiError(res.status, typeof detail === 'string' && detail ? detail : `HTTP ${res.status}`)
}

// GET して JSON を返す。200 番台以外はエラーにする。signal で途中でやめられる
async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await ensureOk(await fetch(url, { signal }))
  return res.json() as Promise<T>
}

// JSON を送る（本文は省略できる）。200 番台以外はエラーにする
async function send(method: string, url: string, body?: unknown): Promise<Response> {
  return ensureOk(await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
}

// JSON を送って、返ってきた JSON を返す
async function sendJson<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await send(method, url, body)
  return res.json() as Promise<T>
}

// リストを右端に追加し、保存されたリスト（id 付き、カードは空）を返す
export function createList(title: string): Promise<List> {
  return sendJson<List>('POST', '/api/lists', { title })
}

// リストの名前を変える
export async function renameList(id: number, title: string): Promise<void> {
  await send('PATCH', `/api/lists/${id}`, { title })
}

// リストを削除する。中のカードも一緒に消える
export async function deleteList(id: number): Promise<void> {
  await send('DELETE', `/api/lists/${id}`)
}

// カードをリストの末尾に追加し、保存されたカード（id 付き）を返す
export function createCard(listId: number, card: CardCreateRequest): Promise<Card> {
  return sendJson<Card>('POST', `/api/lists/${listId}/cards`, card)
}

// 送った項目だけを変え、変えたあとのカードを返す
export function updateCard(id: number, changes: CardUpdateRequest): Promise<Card> {
  return sendJson<Card>('PATCH', `/api/cards/${id}`, changes)
}

// カードを削除する
export async function deleteCard(id: number): Promise<void> {
  await send('DELETE', `/api/cards/${id}`)
}

// カードを listId のリストの position 番目（0 始まり）へ移動する。同じリストの中の並べ替えにも使う
export async function moveCard(id: number, listId: number, position: number): Promise<void> {
  await send('PUT', `/api/cards/${id}/move`, { listId, position })
}

// 各リストを期限順に並べ替えて保存し、並べ替えたあとのボードを返す
export function sortCardsByDue(): Promise<Board> {
  return sendJson<Board>('POST', '/api/board/sort-by-due')
}

export function fetchBoard(signal?: AbortSignal): Promise<Board> {
  return getJson<Board>('/api/board', signal)
}

// 空でない条件だけを付けて検索する。結果は画面と同じ順（リストの順 → リストの中の順）
export async function searchCards(conditions: SearchConditions): Promise<CardDetail[]> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(conditions)) {
    const v = value.trim()
    if (v) params.set(key, v)
  }
  const result = await getJson<CardSearchResult>(`/api/cards?${params}`)
  return result.cards
}
