import { useState } from 'react'
import {
  closestCorners, DndContext, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragOverEvent, UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import AddCardForm from './AddCardForm'
import AddListForm from './AddListForm'
import CardView from './CardView'
import { cardIdOf, cardKey, listKey } from './dndKeys'
import ListHeader from './ListHeader'
import type { CardCreateRequest, CardUpdateRequest, List } from './types'

// id（カードでもリストでも）が入っているリストを探す
const findList = (lists: List[], key: UniqueIdentifier) =>
  lists.find((l) => listKey(l.id) === key || l.cards.some((c) => cardKey(c.id) === key))

const indexOf = (list: List, key: UniqueIdentifier) => list.cards.findIndex((c) => cardKey(c.id) === key)

type Props = {
  lists: List[]
  // 渡したときだけ各リストの下に「＋ カードを追加」を出す（検索結果の表示中は渡さない）
  onAddCard?: (listId: number, card: CardCreateRequest) => Promise<void>
  onUpdateCard: (cardId: number, changes: CardUpdateRequest) => void
  onDeleteCard: (cardId: number) => void
  // 渡したときだけカードをドラッグで移動できる（検索結果の表示中は渡さない）。
  // position は移動先リストでの 0 始まりの位置
  onMoveCard?: (cardId: number, listId: number, position: number) => void
  // 渡したときだけリストの追加・名前変更・削除ができる（検索結果の表示中は渡さない）
  onAddList?: (title: string) => Promise<void>
  onRenameList?: (listId: number, title: string) => void
  onDeleteList?: (listId: number) => void
}

// リストを列として並べる。通常のボードと検索結果の両方で使う
function BoardView({
  lists, onAddCard, onUpdateCard, onDeleteCard, onMoveCard, onAddList, onRenameList, onDeleteList,
}: Props) {
  // ドラッグ中の並び。別のリストの上に来たら、カードをそのリストへ移して見せる。ドラッグしていないときは null
  const [draft, setDraft] = useState<List[] | null>(null)
  const shown = draft ?? lists

  // 5px 動かすまではドラッグにしない（クリックで編集欄を開けるように）。
  // キーボードは Space でつかむ・置く、矢印で動かす、Esc で取り消し（Enter は編集に使う）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  )

  // 別のリストの上に来たら、そのリストの上に重なっているカードの位置（下半分なら次）へ移す
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    setDraft((d) => {
      if (!d) return d
      const from = findList(d, active.id)
      const to = findList(d, over.id)
      if (!from || !to || from.id === to.id) return d
      const card = from.cards[indexOf(from, active.id)]
      const overIndex = indexOf(to, over.id)
      const below = overIndex >= 0 && active.rect.current.translated !== null
        && active.rect.current.translated.top > over.rect.top + over.rect.height / 2
      const index = overIndex < 0 ? to.cards.length : overIndex + (below ? 1 : 0)
      return d.map((l) => {
        if (l.id === from.id) return { ...l, cards: l.cards.filter((c) => c.id !== card.id) }
        if (l.id === to.id) return { ...l, cards: [...l.cards.slice(0, index), card, ...l.cards.slice(index)] }
        return l
      })
    })
  }

  // 置いた場所（リストと位置）が元と違えば保存する
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const d = draft
    setDraft(null)
    if (!d || !over || !onMoveCard) return
    const list = findList(d, active.id)
    const original = findList(lists, active.id)
    if (!list || !original) return
    const overIndex = indexOf(list, over.id)
    const position = overIndex >= 0 ? overIndex : indexOf(list, active.id)
    if (list.id === original.id && position === indexOf(original, active.id)) return
    onMoveCard(cardIdOf(active.id), list.id, position)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners}
      onDragStart={() => setDraft(lists)} onDragOver={onDragOver} onDragEnd={onDragEnd}
      onDragCancel={() => setDraft(null)}>
      <main className="board">
        {shown.map((list) => (
          <ListColumn key={list.id} list={list} draggable={onMoveCard !== undefined} onUpdateCard={onUpdateCard}
            onDeleteCard={onDeleteCard}
            onAddCard={onAddCard && ((card) => onAddCard(list.id, card))}
            onRename={onRenameList && ((title) => onRenameList(list.id, title))}
            onDelete={onDeleteList && (() => onDeleteList(list.id))} />
        ))}
        {onAddList && <AddListForm onAdd={onAddList} />}
      </main>
    </DndContext>
  )
}

type ListProps = {
  list: List
  draggable: boolean
  onUpdateCard: (cardId: number, changes: CardUpdateRequest) => void
  onDeleteCard: (cardId: number) => void
  onAddCard?: (card: CardCreateRequest) => Promise<void>
  onRename?: (title: string) => void
  onDelete?: () => void
}

// リスト 1 列。カードが 0 枚でもドロップできるように、カードの入れ物をドロップ先にする
function ListColumn({ list, draggable, onUpdateCard, onDeleteCard, onAddCard, onRename, onDelete }: ListProps) {
  const { setNodeRef } = useDroppable({ id: listKey(list.id), disabled: !draggable })
  return (
    <section className="list" data-list-id={list.id} aria-label={list.title}>
      <ListHeader list={list} onRename={onRename} onDelete={onDelete} />
      <SortableContext id={listKey(list.id)} items={list.cards.map((c) => cardKey(c.id))}
        strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="cards">
          {list.cards.map((card) => (
            <CardView key={card.id} card={card} draggable={draggable}
              onUpdate={(changes) => onUpdateCard(card.id, changes)} onDelete={() => onDeleteCard(card.id)} />
          ))}
        </div>
      </SortableContext>
      {onAddCard && <AddCardForm listId={list.id} onAdd={onAddCard} />}
    </section>
  )
}

export default BoardView
