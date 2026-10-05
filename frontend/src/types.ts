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
