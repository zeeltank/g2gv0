import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { offboardingService } from '@/services/talent/offboarding-service'
import { useAuth } from '@/hooks/use-auth'
import { isLaravelContextReady, getLaravelContext } from '@/lib/laravel-context'

export function useOffboardingCases(params?: Record<string, string | number>) {
  const { user } = useAuth()
  const ready = isLaravelContextReady(getLaravelContext(user))

  return useQuery({
    queryKey: ['offboarding-cases', params],
    queryFn: () => offboardingService.getCases(params),
    enabled: ready,
  })
}

export function useOffboardingCase(id: number | null) {
  const { user } = useAuth()
  const ready = isLaravelContextReady(getLaravelContext(user)) && id !== null

  return useQuery({
    queryKey: ['offboarding-case', id],
    queryFn: () => id ? offboardingService.getCase(id) : Promise.reject('No ID'),
    enabled: ready,
  })
}

export function useOffboardingClearances(params?: Record<string, string | number>) {
  const { user } = useAuth()
  const ready = isLaravelContextReady(getLaravelContext(user))

  return useQuery({
    queryKey: ['offboarding-clearances', params],
    queryFn: () => offboardingService.getClearances(params),
    enabled: ready,
  })
}

export function useExitInterviews(params?: Record<string, string | number>) {
  const { user } = useAuth()
  const ready = isLaravelContextReady(getLaravelContext(user))

  return useQuery({
    queryKey: ['exit-interviews', params],
    queryFn: () => offboardingService.getInterviews(params),
    enabled: ready,
  })
}

export function useOffboardingMutations() {
  const queryClient = useQueryClient()

  const createCase = useMutation({
    mutationFn: (data: any) => offboardingService.createCase(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offboarding-cases'] })
    }
  })

  const updateCase = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => offboardingService.updateCase(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['offboarding-cases'] })
      queryClient.invalidateQueries({ queryKey: ['offboarding-case', variables.id] })
    }
  })

  const advanceCase = useMutation({
    mutationFn: ({ id, data }: { id: number, data: { status: string } }) => offboardingService.advanceCase(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['offboarding-cases'] })
      queryClient.invalidateQueries({ queryKey: ['offboarding-case', variables.id] })
    }
  })

  const deleteCase = useMutation({
    mutationFn: (id: number) => offboardingService.deleteCase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offboarding-cases'] })
    }
  })

  const clearClearance = useMutation({
    mutationFn: ({ id, data }: { id: number, data?: { remarks?: string } }) => offboardingService.clearClearance(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offboarding-clearances'] })
      queryClient.invalidateQueries({ queryKey: ['offboarding-case'] }) // Invalidate specific case if known, or all
    }
  })

  return {
    createCase,
    updateCase,
    advanceCase,
    deleteCase,
    clearClearance,
  }
}
