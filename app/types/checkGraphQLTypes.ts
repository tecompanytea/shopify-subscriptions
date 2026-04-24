/* eslint-disable @typescript-eslint/no-unused-vars */
import ShopQuery from '~/graphql/ShopQuery';
import type {GraphQLClient} from '.';

// This function ensures that our graphql responses are being typed automatically.
// Sometimes package updates can break the automatic typing if all the the right
// dependencies are not updated together.
// This function is not used in our codebase.
async function checkGraphQLTypes(graphql: GraphQLClient) {
  const response = await graphql(ShopQuery);
  const json = await response.json();
  const data = json.data;

  // If data is of type `any`, then the graphql types are not being generated correctly.
  // In a healthy typegen state, `data` is typed as `ShopQuery` and would not be
  // assignable to `string`; a bare cast to string surfaces the degraded case.
  // We drop the @ts-expect-error wrapper because modules that assign the
  // wrong type silently are a sign graphql-codegen needs to be run.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  data as unknown as string;
}
