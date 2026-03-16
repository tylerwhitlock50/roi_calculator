import { NextResponse } from 'next/server'

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function badRequest(message: string) {
  return new HttpError(400, message)
}

export function unauthorized(message = 'Unauthorized') {
  return new HttpError(401, message)
}

export function forbidden(message = 'Forbidden') {
  return new HttpError(403, message)
}

export function notFound(message = 'Not found') {
  return new HttpError(404, message)
}

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  console.error(error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
