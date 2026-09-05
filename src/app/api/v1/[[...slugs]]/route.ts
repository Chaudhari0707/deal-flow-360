import { api } from "@/server/api";

// Next.js derives HEAD from GET and provides the same-origin BFF OPTIONS response.
export const DELETE = api.fetch;
export const GET = api.fetch;
export const PATCH = api.fetch;
export const POST = api.fetch;
export const PUT = api.fetch;
