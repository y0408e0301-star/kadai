import type { UniqueIdentifier } from '@dnd-kit/core'

// ドラッグ＆ドロップで使う id。カードとリストの id が重ならないように前に付ける
export const cardKey = (id: number) => `card-${id}`
export const listKey = (id: number) => `list-${id}`

// cardKey で作った id からカードの id を取り出す
export const cardIdOf = (key: UniqueIdentifier) => Number(String(key).replace('card-', ''))
