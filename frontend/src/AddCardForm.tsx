import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import type { CardCreateRequest, Priority } from './types'

const priorities: { value: Priority; label: string }[] = [
  { value: 'high', label: '高' },
  { value: 'mid', label: '中' },
  { value: 'low', label: '低' },
]

type Props = {
  listId: number
  // 保存できたら resolve、失敗したら reject する
  onAdd: (card: CardCreateRequest) => Promise<void>
}

// リストの下の「＋ カードを追加」。押すとタイトル・期限・優先順位の入力欄を開く（モックと同じ動き）
function AddCardForm({ listId, onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState<Priority>('mid')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const close = () => {
    setOpen(false)
    setTitle('')
    setDue('')
    setPriority('mid')
    setError(null)
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (saving) return
    const t = title.trim()
    if (!t) {
      setError('タイトルを入力してください')
      return
    }
    setSaving(true)
    setError(null)
    onAdd({ title: t, priority, due: due || null })
      // 続けて追加できるように、入力欄は開いたまま空にする
      .then(() => setTitle(''))
      .catch((err: unknown) => setError(`追加できませんでした（${String(err)}）`))
      .finally(() => setSaving(false))
  }

  // Enter で追加（Shift + Enter は改行）、Esc で閉じる
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
    if (e.key === 'Escape') close()
  }

  if (!open) {
    return (
      <div className="add-card">
        <button type="button" className="add-trigger" onClick={() => setOpen(true)}>＋ カードを追加</button>
      </div>
    )
  }

  return (
    <form className="add-card composer" onSubmit={submit}>
      <textarea value={title} rows={2} maxLength={200} placeholder="カードのタイトル" aria-label="カードのタイトル"
        autoFocus onChange={(e) => setTitle(e.target.value)} onKeyDown={onKeyDown} />
      {error && <div className="form-error">{error}</div>}
      <div className="field-row">
        <label className="field-label" htmlFor={`new-due-${listId}`}>期限</label>
        <input id={`new-due-${listId}`} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>
      <div className="field-row">
        <span className="field-label">優先順位</span>
        <span className="prio-group" role="radiogroup" aria-label="優先順位">
          {priorities.map((p) => (
            <label key={p.value} className={`prio-opt opt-${p.value}`}>
              <input type="radio" name={`new-prio-${listId}`} value={p.value} checked={priority === p.value}
                onChange={() => setPriority(p.value)} />
              <span>{p.label}</span>
            </label>
          ))}
        </span>
      </div>
      <div className="composer-row">
        <button type="submit" className="primary-btn" disabled={saving}>カードを追加</button>
        <button type="button" className="close-btn" aria-label="閉じる" onClick={close}>×</button>
      </div>
    </form>
  )
}

export default AddCardForm
