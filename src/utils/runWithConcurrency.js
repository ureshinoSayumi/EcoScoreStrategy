/**
 * 以固定上限併發執行任務（完成一筆再從佇列取下一筆）
 * @param {Array} items
 * @param {number} limit 同時進行上限
 * @param {(item: any, index: number) => Promise<void>} taskFn
 * @param {{ shouldStop?: () => boolean, delayMs?: number, onTaskComplete?: (done: number, total: number, item: any) => void }} [options]
 */
export async function runWithConcurrency(items, limit, taskFn, options = {}) {
  const { shouldStop = () => false, delayMs = 0, onTaskComplete } = options
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  if (!items.length) return

  let nextIndex = 0
  let completed = 0
  const total = items.length
  const workerCount = Math.min(Math.max(1, Math.floor(limit) || 1), total)

  async function worker() {
    while (true) {
      if (shouldStop()) return

      const index = nextIndex
      nextIndex += 1
      if (index >= total) return

      await taskFn(items[index], index)
      completed += 1
      onTaskComplete?.(completed, total, items[index])

      if (delayMs > 0 && !shouldStop() && completed < total) {
        await delay(delayMs)
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
}
