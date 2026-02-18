import {
  analyzeFace,
  analyzeFood,
  getDailyRoutine,
  type AnalyzeFaceParams,
  type AnalyzeFaceResponse,
  type AnalyzeFoodParams,
  type AnalyzeFoodResponse,
  type BridgeApiError,
  type BridgeLocale,
  type DailyRoutineParams,
  type DailyRoutineResponse,
} from '@/services/bridge-api';
import { useMutation, useQuery } from '@tanstack/react-query';

export const bridgeQueryKeys = {
  all: ['bridge'] as const,
  routine: (averageScore: number, locale: BridgeLocale) =>
    [...bridgeQueryKeys.all, 'routine', averageScore, locale] as const,
};

type DailyRoutineQueryParams = {
  averageScore: number;
  locale?: BridgeLocale;
  authToken?: string;
  enabled?: boolean;
};

export function useAnalyzeFaceMutation() {
  return useMutation<AnalyzeFaceResponse, BridgeApiError, AnalyzeFaceParams>({
    mutationFn: (params) => analyzeFace(params),
  });
}

export function useAnalyzeFoodMutation() {
  return useMutation<AnalyzeFoodResponse, BridgeApiError, AnalyzeFoodParams>({
    mutationFn: (params) => analyzeFood(params),
  });
}

export function useDailyRoutineQuery({
  averageScore,
  locale = 'en',
  authToken,
  enabled = true,
}: DailyRoutineQueryParams) {
  return useQuery<DailyRoutineResponse, BridgeApiError>({
    queryKey: bridgeQueryKeys.routine(averageScore, locale),
    queryFn: () => getDailyRoutine({ averageScore, locale, authToken } satisfies DailyRoutineParams),
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}
