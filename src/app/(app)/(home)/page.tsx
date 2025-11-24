import type { SearchParams } from "nuqs/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { DEFAULT_LIMIT } from "@/constants";
import { trpc, getQueryClient } from "@/trpc/server";
import { loadProductFilters } from "@/modules/products/search-params";
import { ProductListView } from "@/modules/products/ui/views/product-list-view";

interface Props {
  searchParams: Promise<SearchParams>;
}

// strategy: RSC for prefetching products data (getMany) then suspense loading in the client component (ProductListView), To leverage RSC capabilities for improved initial load performance
const Page = async ({ searchParams }: Props) => {
  const filters = await loadProductFilters(searchParams);
  const queryClient = getQueryClient();

  void queryClient.prefetchInfiniteQuery(
    trpc.products.getMany.infiniteQueryOptions({
      ...filters,
      limit: DEFAULT_LIMIT,
    }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductListView />
    </HydrationBoundary>
  );
};

export default Page;

/* server usage example : trpc


import { getQueryClient, trpc } from "@/trpc/server";

export default async function Home() {
  const queryClient = getQueryClient();

  const categories = await queryClient.fetchQuery(
    trpc.categories.getMany.queryOptions(),
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F4F0] text-black">
      Home page
      {JSON.stringify(categories, null, 2)}
    </div>
  );
}
*/

/* client usage example : trpc

"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.auth.session.queryOptions());
  
  return (
    <div className="flex min-h-screen flex-col bg-[#F4F4F0] text-black">
    {JSON.stringify(data, null, 2)}
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export default function Home() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.auth.session.queryOptions());

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F4F0] text-black">
      {JSON.stringify(data?.user, null, 2)}
    </div>
  );
}

*/
