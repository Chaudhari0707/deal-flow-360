export class HttpResponseError extends Error {
  readonly status: number;

  constructor(status: number, statusText: string) {
    super(`Request failed with ${status}${statusText ? ` ${statusText}` : ""}`);
    this.name = "HttpResponseError";
    this.status = status;
  }
}

export async function fetchJson<Data>(input: RequestInfo | URL, init?: RequestInit): Promise<Data> {
  const response = await fetch(input, init);
  if (!response.ok) throw new HttpResponseError(response.status, response.statusText);
  return response.json() as Promise<Data>;
}
