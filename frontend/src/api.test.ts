import { describe, expect, it } from 'vitest'
import { ApiError, ensureOk } from './api'

const problem = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/problem+json' } })

describe('ensureOk', () => {
  it('200 番台ならそのまま返す', async () => {
    const res = new Response('{}', { status: 200 })
    await expect(ensureOk(res)).resolves.toBe(res)
  })

  it('Problem Details の detail を理由にする', async () => {
    const error = await ensureOk(problem(404, { status: 404, detail: 'カードが見つかりません（id: 5）' }))
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, message: 'カードが見つかりません（id: 5）' })
    // 画面では String(err) で出すので、「Error:」などを付けない
    expect(String(error)).toBe('カードが見つかりません（id: 5）')
  })

  it('本文が JSON でない・detail がないときはステータスだけ', async () => {
    await expect(ensureOk(new Response('Bad Gateway', { status: 502 }))).rejects.toThrow('HTTP 502')
    await expect(ensureOk(problem(500, { status: 500 }))).rejects.toThrow('HTTP 500')
  })
})
