import { Data } from "effect";

/**
 * リソースが存在しない (汎用 / errorCode 4040 / HTTP 404)。
 */
export class ResourceNotFoundError extends Data.TaggedError(
  "ResourceNotFoundError",
)<{
  readonly message: string;
}> {}
