import { describe, expect, it } from 'vitest'
import { dueLabel } from './due'

// 2026-10-07 の 23:30。時刻があっても日付だけで比べることを確かめる
const today = new Date(2026, 9, 7, 23, 30)

describe('dueLabel', () => {
  it('期限がなければ「期限なし」', () => {
    expect(dueLabel(null, today)).toEqual({ text: '期限なし', className: 'due' })
  })

  it('過ぎていたら赤（over）', () => {
    expect(dueLabel('2026-10-06', today)).toEqual({ text: '期限 10/6 期限切れ', className: 'due over' })
  })

  it('今日・明日・あさってまでは黄色（soon）', () => {
    expect(dueLabel('2026-10-07', today)).toEqual({ text: '期限 10/7 今日まで', className: 'due soon' })
    expect(dueLabel('2026-10-08', today)).toEqual({ text: '期限 10/8 明日まで', className: 'due soon' })
    expect(dueLabel('2026-10-09', today)).toEqual({ text: '期限 10/9 まで', className: 'due soon' })
  })

  it('3 日以上先は色を付けない', () => {
    expect(dueLabel('2026-10-10', today)).toEqual({ text: '期限 10/10 まで', className: 'due' })
  })

  it('月や年をまたいでも日数で比べる', () => {
    expect(dueLabel('2026-11-01', new Date(2026, 9, 31))).toEqual({ text: '期限 11/1 明日まで', className: 'due soon' })
    expect(dueLabel('2026-12-31', new Date(2027, 0, 1))).toEqual({ text: '期限 12/31 期限切れ', className: 'due over' })
  })
})
