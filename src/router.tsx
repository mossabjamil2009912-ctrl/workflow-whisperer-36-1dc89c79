import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 30 * 24 * 60 * 60_000, // kept long so the on-device copy survives offline
        networkMode: "offlineFirst",
        refetchOnWindowFocus: false,
        refetchIntervalInBackground: false,
        placeholderData: (prev: unknown) => prev,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
