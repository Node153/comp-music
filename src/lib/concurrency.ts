// 크론이 지울 대상이 한 번에 많이 쌓였을 때(오래 방치 후 첫 실행 등) Promise.all로 전부 한
// 번에 쏘면 R2 요청이 몰려 실패/재시도가 늘 수 있어, 정해진 동시성 안에서만 처리한다.
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<unknown>,
): Promise<void> {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const item = items[index++];
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
