import { GraphQLClient } from 'graphql-request';

const endpoint = process.env.NEXT_PUBLIC_SUBGRAPH_URL;

/**
 * Throws if the subgraph endpoint isn't configured, instead of silently querying an empty
 * string (which would fail with an opaque fetch error) or a hardcoded fallback URL. Callers
 * (react-query `queryFn`s) surface this as a normal error state so the UI can render a clear
 * "not configured" message — see app/audit/page.tsx.
 */
export function getGraphQLClient(): GraphQLClient {
  if (!endpoint) {
    throw new Error(
      'NEXT_PUBLIC_SUBGRAPH_URL is not configured — set it in .env.local (see docs/ENVIRONMENT.md).'
    );
  }
  return new GraphQLClient(endpoint, {
    headers: {},
  });
}
