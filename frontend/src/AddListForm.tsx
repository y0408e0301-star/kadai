import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'

type Props = {
  // 保存できたら resolve、失敗したら reject する
  onAdd: (title: string) => Promise<void>
}

// ボードの右端の「＋ リストを追加」。押すと名前の入力欄を開く（モックと同じ動き）
function AddListForm({ onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const close = () => {
    setOpen(false)
    setTitle('')
    setError(null)
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (saving) return
    const t = title.trim()
    if (!t) {
      setError('リストの名前を入力してください')
      return
    }
    setSaving(true)
    setError(null)
    onAdd(t)
      // 続けて追加できるように、入力欄は開いたまま空にする
      .then(() => setTitle(''))
      .catch((err: unknown) => setError(`追加できませんでした（${String(err)}）`))
      .finally(() => setSaving(false))
  }

  // Enter で追加、Esc で閉じる
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit(e)
    if (e.key === 'Escape') close()
  }

  if (!open) {
    return (
      <div className="add-list">
        <button type="button" className="add-trigger" onClick={() => setOpen(true)}>＋ リストを追加</button>
      </div>
    )
  }

  return (
    <form className="add-list composer" onSubmit={submit}>
      <input className="edit-input" value={title} maxLength={100} placeholder="リストの名前" aria-label="リストの名前"
        autoFocus onChange={(e) => setTitle(e.target.value)} onKeyDown={onKeyDown} />
      {error && <div className="form-error">{error}</div>}
      <div className="composer-row">
        <button type="submit" className="primary-btn" disabled={saving}>リストを追加</button>
        <button type="button" className="close-btn" aria-label="閉じる" onClick={close}>×</button>
      </div>
    </form>
  )
}

export default AddListForm
