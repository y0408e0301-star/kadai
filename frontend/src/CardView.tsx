import { useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cardKey } from './dndKeys'
import { dueLabel } from './due'
import PriorityPicker from './PriorityPicker'
import type { Card, CardUpdateRequest, Priority } from './types'

type Props = {
  card: Card
  // false のときはドラッグで動かせない（検索結果の表示中）
  draggable: boolean
  onUpdate: (changes: CardUpdateRequest) => void
  onDelete: () => void
}

// リストの中のカード 1 枚。クリック（キーボードではタイトルで Enter）で編集欄を開き、ドラッグで移動する。
// × で削除の確認を出し、「削除する」で削除する（F-06）
function CardView({ card, draggable, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const deleteButton = useRef<HTMLButtonElement>(null)
  // 確認を出している間はドラッグしない
  const canDrag = draggable && !editing && !confirming
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: cardKey(card.id),
    disabled: !canDrag,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  if (editing) {
    return (
      <div ref={setNodeRef} style={style}>
        <CardEditor card={card} onCancel={() => setEditing(false)}
          onSave={(changes) => {
            setEditing(false)
            onUpdate(changes)
          }} />
      </div>
    )
  }

  // 確認を閉じたら × にフォーカスを戻す（キーボードで続けて操作できるように）
  const cancelDelete = () => {
    setConfirming(false)
    deleteButton.current?.focus()
  }

  const due = dueLabel(card.due)
  const confirmId = `confirm-${card.id}`
  return (
    // マウスではカードのどこをつかんでもドラッグできるように、dnd-kit の listeners はカード全体に付ける。
    // キーボードのドラッグ（Space）は「移動」ボタン（setActivatorNodeRef）にフォーカスがあるときだけ始まる
    <article ref={setNodeRef} style={style} className={`card${isDragging ? ' dragging' : ''}${confirming ? ' confirming' : ''}`}
      data-card-id={card.id} {...(canDrag ? listeners : {})}>
      <div className="card-top">
        {/* タイトルが編集ボタン。CSS でカード全体に広げているので、カードのどこをクリックしても編集欄が開く */}
        <button type="button" className="card-title" disabled={confirming}
          title={draggable ? 'クリックで編集・ドラッグで移動' : 'クリックで編集'} onClick={() => setEditing(true)}>
          {card.title}
        </button>
        {canDrag && (
          <button ref={setActivatorNodeRef} type="button" className="icon-btn drag-handle"
            aria-label={`カード「${card.title}」を移動`} title="ドラッグで移動（キーボードでは Space でつかみ、矢印で動かし、Space で置く）"
            {...attributes}>⠿</button>
        )}
        {/* × の上でマウスを押してもドラッグを始めない */}
        <button ref={deleteButton} type="button" className="icon-btn" aria-label={`カード「${card.title}」を削除`}
          title="削除" onPointerDown={(e) => e.stopPropagation()} onClick={() => setConfirming(true)}>×</button>
      </div>
      {confirming && (
        // 確認のダイアログ。中のどのボタンにフォーカスがあっても Esc で閉じる（WAI-ARIA のダイアログの決まり）。
        // eslint-plugin-jsx-a11y の recommended はダイアログのキー操作を許すが、oxlint はその設定にまだ対応していない
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div className="confirm" role="alertdialog" aria-labelledby={confirmId}
          onKeyDown={(e) => e.key === 'Escape' && cancelDelete()}>
          <span id={confirmId}>カード「{card.title}」を削除しますか？</span>
          <button type="button" className="danger-btn" autoFocus onClick={onDelete}>削除する</button>
          <button type="button" className="ghost-btn" onClick={cancelDelete}>キャンセル</button>
        </div>
      )}
      <div className="card-meta">
        <PriorityPicker name={`prio-${card.id}`} value={card.priority}
          onChange={(priority) => onUpdate({ priority })} />
        <span className={due.className}>{due.text}</span>
      </div>
    </article>
  )
}

type EditorProps = {
  card: Card
  onSave: (changes: Required<CardUpdateRequest>) => void
  onCancel: () => void
}

// カードの編集欄（タイトル・期限・優先順位）。Enter で保存、Esc で取り消し
function CardEditor({ card, onSave, onCancel }: EditorProps) {
  const [title, setTitle] = useState(card.title)
  const [due, setDue] = useState(card.due ?? '')
  const [priority, setPriority] = useState<Priority>(card.priority)
  const [error, setError] = useState<string | null>(null)

  const save = (e?: FormEvent) => {
    e?.preventDefault()
    const t = title.trim()
    if (!t) {
      setError('タイトルを入力してください')
      return
    }
    onSave({ title: t, due: due || null, priority })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) save(e)
    if (e.key === 'Escape') onCancel()
  }

  return (
    <form className="card editing composer" onSubmit={save}>
      <input className="edit-input" value={title} maxLength={200} aria-label="タイトル" autoFocus
        onFocus={(e) => e.target.select()} onChange={(e) => setTitle(e.target.value)} onKeyDown={onKeyDown} />
      {error && <div className="form-error">{error}</div>}
      <div className="field-row">
        <label className="field-label" htmlFor={`edit-due-${card.id}`}>期限</label>
        <input id={`edit-due-${card.id}`} type="date" value={due} onChange={(e) => setDue(e.target.value)}
          onKeyDown={onKeyDown} />
      </div>
      <div className="field-row">
        <span className="field-label">優先順位</span>
        <PriorityPicker name={`edit-prio-${card.id}`} value={priority} onChange={setPriority} />
      </div>
      <div className="composer-row">
        <button type="submit" className="primary-btn">保存</button>
        <button type="button" className="ghost-btn" onClick={onCancel}>キャンセル</button>
      </div>
    </form>
  )
}

export default CardView
