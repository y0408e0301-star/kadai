import { useEffect, useState } from 'react'
import { createCard, deleteCard, fetchBoard, moveCard, searchCards, sortCardsByDue, updateCard } from './api'
import BoardView from './BoardView'
import SearchForm from './SearchForm'
import type { Board, Card, CardCreateRequest, CardDetail, CardUpdateRequest, List, SearchConditions } from './types'

// 保存の結果。ヘッダーに出す
type SaveStatus = { ok: boolean; text: string }

const now = () => new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function App() {
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 検索結果と、そのときの条件。null は「検索していない（全カードを表示）」
  const [results, setResults] = useState<CardDetail[] | null>(null)
  const [conditions, setConditions] = useState<SearchConditions | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  // 保存中の API 呼び出しの数と、最後に終わった保存の結果
  const [saving, setSaving] = useState(0)
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null)

  // 起動時にボード全体を API（PostgreSQL）から読む
  useEffect(() => {
    fetchBoard()
      .then(setBoard)
      .catch((e: unknown) => setError(String(e)))
  }, [])

  const search = (c: SearchConditions) => {
    setSearchError(null)
    setConditions(c)
    searchCards(c)
      .then(setResults)
      .catch((e: unknown) => setSearchError(String(e)))
  }

  // 画面は先に変えておき（すぐ反映されるように）、API に保存する。
  // 保存できなかったら、ボード（と検索結果）を DB から読み直して表示を DB に揃える
  const save = (request: () => Promise<unknown>) => {
    setSaving((n) => n + 1)
    request()
      .then(() => setSaveStatus({ ok: true, text: `保存しました ${now()}` }))
      .catch((e: unknown) => {
        setSaveStatus({ ok: false, text: `保存できませんでした（${String(e)}）。最新の状態を読み直しました` })
        fetchBoard().then(setBoard).catch((err: unknown) => setError(String(err)))
        if (conditions) searchCards(conditions).then(setResults).catch(() => setResults(null))
      })
      .finally(() => setSaving((n) => n - 1))
  }

  // API に保存できたら、返ってきたカード（id 付き）をそのリストの末尾に足す
  const addCard = async (listId: number, card: CardCreateRequest) => {
    const created = await createCard(listId, card)
    setBoard((b) => b && {
      lists: b.lists.map((l) => (l.id === listId ? { ...l, cards: [...l.cards, created] } : l)),
    })
  }

  // タイトル・期限・優先順位の変更。ボードと検索結果の両方に反映する
  const editCard = (cardId: number, changes: CardUpdateRequest) => {
    const apply = <C extends Card>(c: C): C => (c.id === cardId ? { ...c, ...changes } : c)
    setBoard((b) => b && { lists: b.lists.map((l) => ({ ...l, cards: l.cards.map(apply) })) })
    setResults((r) => r && r.map(apply))
    save(() => updateCard(cardId, changes))
  }

  // カードの削除。ボードと検索結果の両方から消す
  const removeCard = (cardId: number) => {
    setBoard((b) => b && { lists: b.lists.map((l) => ({ ...l, cards: l.cards.filter((c) => c.id !== cardId) })) })
    setResults((r) => r && r.filter((c) => c.id !== cardId))
    save(() => deleteCard(cardId))
  }

  // ドラッグ＆ドロップでの並べ替え・リスト間の移動
  const dropCard = (cardId: number, listId: number, position: number) => {
    setBoard((b) => {
      if (!b) return b
      const card = b.lists.flatMap((l) => l.cards).find((c) => c.id === cardId)
      if (!card) return b
      const lists = b.lists.map((l) => ({ ...l, cards: l.cards.filter((c) => c.id !== cardId) }))
      return {
        lists: lists.map((l) => (l.id === listId
          ? { ...l, cards: [...l.cards.slice(0, position), card, ...l.cards.slice(position)] }
          : l)),
      }
    })
    save(() => moveCard(cardId, listId, position))
  }

  // 並べ替えは API が決めるので、返ってきたボードで表示を置き換える
  const sortByDue = () => save(() => sortCardsByDue().then(setBoard))

  const clear = () => {
    setSearchError(null)
    setConditions(null)
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
        <span className="spacer" />
        <span className={`save-state${saveStatus && !saveStatus.ok && saving === 0 ? ' error' : ''}`} role="status">
          {saving > 0 ? '保存中…' : saveStatus?.text}
        </span>
        <button type="button" className="ghost-btn" onClick={sortByDue} disabled={results !== null}
          title="各リストのカードを期限が近い順に並べます。期限なしは最後、同じ期限なら優先順位の高い順">
          期限順に並べる
        </button>
      </header>
      <SearchForm lists={board.lists} onSearch={search} onClear={clear} />
      {searchError && <p className="search-status error">検索できませんでした（{searchError}）</p>}
      {results !== null && <p className="search-status">検索結果 {results.length} 件</p>}
      <BoardView lists={lists} onUpdateCard={editCard} onDeleteCard={removeCard}
        onAddCard={results === null ? addCard : undefined}
        onMoveCard={results === null ? dropCard : undefined} />
      <footer>
        カードはドラッグ（またはフォーカスして Space → 矢印 → Space）で移動できます。「完了」へ動かすと完了です。
        クリック（または Enter）でタイトル・期限・優先順位を編集でき、右上の × で削除できます。
      </footer>
    </>
  )
}

export default App
