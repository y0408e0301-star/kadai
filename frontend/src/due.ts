const dayMs = 24 * 60 * 60 * 1000

export type DueLabel = { text: string; className: string }

// 期限の表示。2 日以内なら soon（黄色）、過ぎていたら over（赤）を付ける（F-08）。
// due は YYYY-MM-DD。日付だけで比べ、時刻は見ない（today はテストで日付を決めるため）
export function dueLabel(due: string | null, today: Date = new Date()): DueLabel {
  if (!due) return { text: '期限なし', className: 'due' }
  const [y, m, d] = due.split('-').map(Number)
  const diff = Math.round(
    (new Date(y, m - 1, d).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime())
      / dayMs)
  const md = `${m}/${d}`
  const text = diff < 0 ? `${md} 期限切れ` : diff === 0 ? `${md} 今日まで` : diff === 1 ? `${md} 明日まで` : `${md} まで`
  return { text: `期限 ${text}`, className: `due${diff < 0 ? ' over' : diff <= 2 ? ' soon' : ''}` }
}
