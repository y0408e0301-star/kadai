import type { Priority } from './types'

const priorities: { value: Priority; label: string }[] = [
  { value: 'high', label: '高' },
  { value: 'mid', label: '中' },
  { value: 'low', label: '低' },
]

type Props = {
  // ラジオボタンのグループ名。ページの中で重ならないようにカードやリストの id を入れる
  name: string
  value: Priority
  onChange: (priority: Priority) => void
}

// 優先順位の「高・中・低」ラジオボタン（カードの追加・編集とカード上の切り替えで使う）
function PriorityPicker({ name, value, onChange }: Props) {
  return (
    <span className="prio-group" role="radiogroup" aria-label="優先順位">
      {priorities.map((p) => (
        <label key={p.value} className={`prio-opt opt-${p.value}`} title={`優先順位：${p.label}`}>
          <input type="radio" name={name} value={p.value} checked={value === p.value}
            onChange={() => onChange(p.value)} />
          <span>{p.label}</span>
        </label>
      ))}
    </span>
  )
}

export default PriorityPicker
