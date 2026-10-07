import { useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, MouseEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cardKey } from './dndKeys'
import PriorityPicker from './PriorityPicker'
import type { Card, CardUpdateRequest, Priority } from './types'

const dayMs = 24 * 60 * 60 * 1000

// 期限の表示。2 日以内なら soon（黄色）、過ぎていたら over（赤）を付ける（F-08）
function dueLabel(due: string | null): { text: string; className: string } {
  if (!due) return { text: '期限なし', className: 'due' }
  const [y, m, d] = due.split('-').map(Number)
  const today = new Date()
  const diff = Math.round(
    (new Date(y, m - 1, d).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime())
      / dayMs)
  const md = `${m}/${d}`
  const text = diff < 0 ? `${md} 期限切れ` : diff === 0 ? `${md} 今日まで` : diff === 1 ? `${md} 明日まで` : `${md} まで`
  return { text: `期限 ${text}`, className: `due${diff < 0 ? ' over' : diff <= 2 ? ' soon' : ''}` }
}

type Props = {
  card: Card
  // false のときはドラッグで動かせない（検索結果の表示中）
  draggable: boolean
  onUpdate: (changes: CardUpdateRequest) => void
  onDelete: () => void
}

// リストの中のカード 1 枚。クリック（または Enter）で編集欄を開き、ドラッグで移動する。
// × で削除の確認を出し、「削除する」で削除する（F-06）
function CardView({ card, draggable, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const deleteButton = useRef<HTMLButtonElement>(null)
  // 確認を出している間はドラッグしない
  const canDrag = draggable && !editing && !confirming
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
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

  // 優先順位のラジオボタン・× を押したときや、削除の確認を出しているときは編集欄を開かない
  const onClick = (e: MouseEvent) => {
    if (!confirming && !(e.target as Element).closest('.prio-group, .icon-btn')) setEditing(true)
  }

  // 確認を閉じたら × にフォーカスを戻す（キーボードで続けて操作できるように）
  const cancelDelete = () => {
    setConfirming(false)
    deleteButton.current?.focus()
  }

  // ドラッグのキー操作（Space）はカード自体にフォーカスがあるときだけ。ラジオボタンの Space は選択に使う
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' && !isDragging && !confirming) {
      e.preventDefault()
      setEditing(true)
      return
    }
    listeners?.onKeyDown?.(e)
  }

  // ドラッグできないとき（検索結果の表示中・確認の表示中）は dnd-kit の属性を付けない。
  // 付けると aria-disabled が中の × やラジオボタンまで「使えない」扱いにしてしまう
  const dragAttributes = canDrag ? attributes : { tabIndex: 0 }

  const due = dueLabel(card.due)
  return (
    // カード全体をクリック・キー操作の対象にしている（ドラッグできるときは dnd-kit が role="button" を付ける）。
    // 中に × やラジオボタンがあり、作りを変えるときに見直す
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <article ref={setNodeRef} style={style} className={`card${isDragging ? ' dragging' : ''}${confirming ? ' confirming' : ''}`} data-card-id={card.id}
      {...dragAttributes} {...listeners} onKeyDown={onKeyDown} onClick={onClick}
      title={confirming ? undefined : draggable ? 'クリックで編集・ドラッグで移動' : 'クリックで編集'}>
      <div className="card-top">
        <div className="card-title">{card.title}</div>
        {/* × の上でマウスを押してもドラッグを始めない */}
        <button ref={deleteButton} type="button" className="icon-btn" aria-label={`カード「${card.title}」を削除`}
          title="削除" onPointerDown={(e) => e.stopPropagation()} onClick={() => setConfirming(true)}>×</button>
      </div>
      {confirming && (
        // 確認の中のどのボタンにフォーカスがあっても Esc で閉じられるようにする
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div className="confirm" role="alert" onKeyDown={(e) => e.key === 'Escape' && cancelDelete()}>
          <span>カード「{card.title}」を削除しますか？</span>
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
