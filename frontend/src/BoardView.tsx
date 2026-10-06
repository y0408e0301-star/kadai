import type { List, Priority } from './types'

const priorityLabel: Record<Priority, string> = { high: '高', mid: '中', low: '低' }

// リストを列として並べる。通常のボードと検索結果の両方で使う
function BoardView({ lists }: { lists: List[] }) {
  return (
    <main className="board">
      {lists.map((list) => (
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
  )
}

export default BoardView
