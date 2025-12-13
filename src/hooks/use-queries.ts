import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { FoodListItem, FoodDetail } from '@/lib/types';

interface FoodPageResponse {
  success: boolean;
  data: {
    items: FoodListItem[];
    nextCursor: string | null;
    prevCursor: string | null;
  };
}

export const useFoodList = () => {
  return useInfiniteQuery<FoodPageResponse>({
    queryKey: ['foods'],
    queryFn: ({ pageParam }) => api.foods.list({ pageParam: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      return lastPage.data.nextCursor ?? undefined;
    },
  });
};

export const useFoodDetail = (foodId: string | null) => {
  return useQuery({
    queryKey: ['food', foodId],
    queryFn: () => api.foods.details(foodId!),
    enabled: !!foodId,
    select: (data) => data.data as FoodDetail,
  });
};