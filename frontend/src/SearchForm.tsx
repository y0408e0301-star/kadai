import { useState } from 'react'
import type { FormEvent } from 'react'
import type { List, SearchConditions } from './types'

const emptyConditions: SearchConditions = { q: '', listId: '', priority: '', dueFrom: '', dueTo: '' }

type Props = {
  lists: List[]
  onSearch: (conditions: SearchConditions) => void
  onClear: () => void
}

// カードの検索条件を入力するフォーム（GET /api/cards のパラメーターと 1 対 1）
function SearchForm({ lists, onSearch, onClear }: Props) {
  const [conditions, setConditions] = useState<SearchConditions>(emptyConditions)

  const set = <K extends keyof SearchConditions>(key: K, value: SearchConditions[K]) =>
    setConditions((c) => ({ ...c, [key]: value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSearch(conditions)
  }

  const clear = () => {
    setConditions(emptyConditions)
    onClear()
  }

  return (
    <form className="search" onSubmit={submit}>
      <label>
        タイトル
        <input type="search" value={conditions.q} maxLength={200} placeholder="タイトルの一部"
          onChange={(e) => set('q', e.target.value)} />
      </label>
      <label>
        リスト
        <select value={conditions.listId} onChange={(e) => set('listId', e.target.value)}>
          <option value="">すべて</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
      </label>
      <label>
        優先順位
        <select value={conditions.priority}
          onChange={(e) => set('priority', e.target.value as SearchConditions['priority'])}>
          <option value="">すべて</option>
          <option value="high">高</option>
          <option value="mid">中</option>
          <option value="low">低</option>
        </select>
      </label>
      <label>
        期限
        <span className="range">
          <input type="date" value={conditions.dueFrom} onChange={(e) => set('dueFrom', e.target.value)} />
          〜
          <input type="date" value={conditions.dueTo} onChange={(e) => set('dueTo', e.target.value)} />
        </span>
      </label>
      <div className="search-buttons">
        <button type="submit">検索</button>
        <button type="button" onClick={clear}>クリア</button>
      </div>
    </form>
  )
}

export default SearchForm
