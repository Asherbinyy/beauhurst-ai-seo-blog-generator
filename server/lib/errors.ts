export class InputError extends Error {}
export class GenerationError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 502,
  ) {
    super(message)
  }
}
