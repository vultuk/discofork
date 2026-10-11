export type LatestRequestHandle = {
  id: number
  signal: AbortSignal
  isAborted: () => boolean
  isCurrent: () => boolean
}

type AbortControllerLike = {
  abort: () => void
  signal: AbortSignal
}

type ActiveRequest = {
  controller: AbortControllerLike
  aborted: boolean
  id: number
}

export function createLatestRequestGuard(): {
  begin: () => LatestRequestHandle
  invalidate: () => void
} {
  let activeRequest: ActiveRequest | null = null
  let latestRequestId = 0

  const abortActiveRequest = () => {
    if (!activeRequest || activeRequest.aborted) {
      return
    }

    activeRequest.aborted = true
    activeRequest.controller.abort()
  }

  const invalidate = () => {
    latestRequestId += 1
    abortActiveRequest()
    activeRequest = null
  }

  const begin = (): LatestRequestHandle => {
    latestRequestId += 1
    abortActiveRequest()

    const request: ActiveRequest = {
      controller: new AbortController() as unknown as AbortControllerLike,
      aborted: false,
      id: latestRequestId,
    }

    activeRequest = request

    return {
      id: request.id,
      signal: request.controller.signal,
      isAborted: () => request.aborted,
      isCurrent: () => latestRequestId === request.id && activeRequest === request && !request.aborted,
    }
  }

  return {
    begin,
    invalidate,
  }
}
