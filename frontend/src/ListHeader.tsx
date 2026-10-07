import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { List } from './types'

type Props = {
  list: List
  // 渡したときだけ名前の変更・削除ができる（検索結果の表示中は渡さない）
  onRename?: (title: string) => void
  onDelete?: () => void
}

// リストの見出し。名前をクリックすると入力欄になり、× で削除の確認を出す（F-01, F-06。モックと同じ動き）
function ListHeader({ list, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const deleteButton = useRef<HTMLButtonElement>(null)

  // 確認を閉じたら × にフォーカスを戻す（キーボードで続けて操作できるように）
  const cancelDelete = () => {
    setConfirming(false)
    deleteButton.current?.focus()
  }

  return (
    <>
      {/* 確認を出している間は × を出したままにする（閉じたときに × へフォーカスを戻せるように） */}
      <div className={`list-head${confirming ? ' confirming' : ''}`}>
        {editing && onRename
          ? <ListTitleEditor title={list.title} onDone={(title) => {
            setEditing(false)
            if (title !== null && title !== list.title) onRename(title)
          }} />
          : onRename
            ? <button type="button" className="list-title list-title-btn" title="クリックで名前を変更"
              onClick={() => setEditing(true)}>{list.title}</button>
            : <h2 className="list-title">{list.title}</h2>}
        <span className="count">{list.cards.length}</span>
        {onDelete && (
          <button ref={deleteButton} type="button" className="icon-btn" aria-label={`リスト「${list.title}」を削除`}
            title="削除" onClick={() => setConfirming(true)}>×</button>
        )}
      </div>
      {confirming && onDelete && (
        // 確認の中のどのボタンにフォーカスがあっても Esc で閉じられるようにする
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div className="confirm list-confirm" role="alert" onKeyDown={(e) => e.key === 'Escape' && cancelDelete()}>
          <span>「{list.title}」とカード {list.cards.length} 枚を削除しますか？</span>
          <button type="button" className="danger-btn" autoFocus onClick={onDelete}>削除する</button>
          <button type="button" className="ghost-btn" onClick={cancelDelete}>キャンセル</button>
        </div>
      )}
    </>
  )
}

type EditorProps = {
  title: string
  // 確定したら新しい名前、取り消したら null を渡す
  onDone: (title: string | null) => void
}

// リスト名の入力欄。Enter・フォーカスを外すと確定、Esc で取り消し。空のときは元の名前に戻す
function ListTitleEditor({ title, onDone }: EditorProps) {
  const [value, setValue] = useState(title)
  // Enter・Esc のあとの blur で、もう一度確定しないようにする
  const done = useRef(false)

  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    const t = value.trim()
    onDone(save && t ? t : null)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) finish(true)
    if (e.key === 'Escape') finish(false)
  }

  return (
    <input className="edit-input list-title-input" value={value} maxLength={100} aria-label="リストの名前" autoFocus
      onFocus={(e) => e.target.select()} onChange={(e) => setValue(e.target.value)} onKeyDown={onKeyDown}
      onBlur={() => finish(true)} />
  )
}

export default ListHeader
