'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const status = error && typeof error === 'object' && 'status' in error
            ? Number(error.status)
            : 0
          return ![401, 403, 404, 422].includes(status) && failureCount < 2
        },
      },
    },
  }))

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
