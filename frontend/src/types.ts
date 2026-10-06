// GET /api/board が返す JSON の形（要件定義書 6. データ構造）
export type Priority = 'high' | 'mid' | 'low'

export type Card = {
  id: number
  title: string
  priority: Priority
  due: string | null
}

export type List = {
  id: number
  title: string
  cards: Card[]
}

export type Board = {
  lists: List[]
}

// GET /api/cards（検索）・GET /api/cards/{id} が返すカード。入っているリストの id と名前が付く
export type CardDetail = Card & {
  listId: number
  listTitle: string
}

export type CardSearchResult = {
  cards: CardDetail[]
}

// POST /api/lists/{listId}/cards で送る JSON。due は null で期限なし
export type CardCreateRequest = {
  title: string
  priority: Priority
  due: string | null
}

// 検索フォームの値。空文字は「指定なし」
export type SearchConditions = {
  q: string
  listId: string
  priority: '' | Priority
  dueFrom: string
  dueTo: string
}
