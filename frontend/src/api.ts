import type { Board, CardDetail, CardSearchResult, SearchConditions } from './types'

// GET して JSON を返す。200 番台以外はエラーにする
async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export function fetchBoard(): Promise<Board> {
  return getJson<Board>('/api/board')
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
