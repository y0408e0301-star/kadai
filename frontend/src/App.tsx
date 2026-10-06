import { useEffect, useState } from 'react'
import { createCard, fetchBoard, searchCards } from './api'
import BoardView from './BoardView'
import SearchForm from './SearchForm'
import type { Board, CardCreateRequest, CardDetail, List, SearchConditions } from './types'

function App() {
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 検索結果。null は「検索していない（全カードを表示）」
  const [results, setResults] = useState<CardDetail[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  // 起動時にボード全体を API（PostgreSQL）から読む
  useEffect(() => {
    fetchBoard()
      .then(setBoard)
      .catch((e: unknown) => setError(String(e)))
  }, [])

  const search = (conditions: SearchConditions) => {
    setSearchError(null)
    searchCards(conditions)
      .then(setResults)
      .catch((e: unknown) => setSearchError(String(e)))
  }

  // API に保存できたら、返ってきたカード（id 付き）をそのリストの末尾に足す
  const addCard = async (listId: number, card: CardCreateRequest) => {
    const created = await createCard(listId, card)
    setBoard((b) => b && {
      lists: b.lists.map((l) => (l.id === listId ? { ...l, cards: [...l.cards, created] } : l)),
    })
  }

  const clear = () => {
    setSearchError(null)
    setResults(null)
  }

  if (error) return <p className="message">ボードを読み込めませんでした（{error}）。API サーバーが起動しているか確認してください。</p>
  if (!board) return <p className="message">読み込み中…</p>

  // 検索中は、列（リスト）はそのまま残して中のカードだけを検索結果に差し替える。
  // API が画面と同じ順で返すので、並べ替えは要らない
  const lists: List[] = results === null
    ? board.lists
    : board.lists.map((list) => ({ ...list, cards: results.filter((c) => c.listId === list.id) }))

  return (
    <>
      <header>
        <h1>タスク管理</h1>
      </header>
      <SearchForm lists={board.lists} onSearch={search} onClear={clear} />
      {searchError && <p className="search-status error">検索できませんでした（{searchError}）</p>}
      {results !== null && <p className="search-status">検索結果 {results.length} 件</p>}
      <BoardView lists={lists} onAddCard={results === null ? addCard : undefined} />
    </>
  )
}

export default App
