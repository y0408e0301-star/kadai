import { useEffect, useState } from 'react'
import type { Board, Priority } from './types'

const priorityLabel: Record<Priority, string> = { high: '高', mid: '中', low: '低' }

function App() {
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 起動時にボード全体を API（PostgreSQL）から読む
  useEffect(() => {
    fetch('/api/board')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Board>
      })
      .then(setBoard)
      .catch((e: unknown) => setError(String(e)))
  }, [])

  if (error) return <p className="message">ボードを読み込めませんでした（{error}）。API サーバーが起動しているか確認してください。</p>
  if (!board) return <p className="message">読み込み中…</p>

  return (
    <>
      <header>
        <h1>タスク管理</h1>
      </header>
      <main className="board">
        {board.lists.map((list) => (
          <section key={list.id} className="list">
            <div className="list-head">
              <h2 className="list-title">{list.title}</h2>
              <span className="count">{list.cards.length}</span>
            </div>
            <div className="cards">
              {list.cards.map((card) => (
                <article key={card.id} className="card">
                  <div className="card-title">{card.title}</div>
                  <div className="card-meta">
                    <span className={`prio prio-${card.priority}`}>{priorityLabel[card.priority]}</span>
                    {card.due && <span className="due">{card.due}</span>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  )
}

export default App
