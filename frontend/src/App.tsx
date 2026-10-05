import type { Board, Priority } from './types'

// 仮データ。ステップ 3 で fetch('/api/board') に置き換える
const sampleBoard: Board = {
  lists: [
    {
      id: 1,
      title: 'やること',
      cards: [
        { id: 1, title: 'レポートを書く', priority: 'high', due: '2026-10-10' },
        { id: 2, title: '資料を読む', priority: 'mid', due: null },
      ],
    },
    { id: 2, title: '作業中', cards: [] },
    { id: 3, title: '完了', cards: [] },
  ],
}

const priorityLabel: Record<Priority, string> = { high: '高', mid: '中', low: '低' }

function App() {
  const board = sampleBoard

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
