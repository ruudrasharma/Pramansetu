import { GraphQLClient } from 'graphql-request';

const endpoint = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || '';

export const graphQLClient = new GraphQLClient(endpoint, {
  headers: {
    // any necessary headers
  },
});
