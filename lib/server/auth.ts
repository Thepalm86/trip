import type { NextRequest } from 'next/server'
import { supabaseAdmin } from './supabase-admin'

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export async function requireAuthenticatedUser(request: NextRequest | Request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')

  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    throw new UnauthorizedError('Missing bearer token')
  }

  const accessToken = authHeader.slice('bearer '.length).trim()

  if (!accessToken) {
    throw new UnauthorizedError('Invalid bearer token')
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken)

  if (error || !data?.user) {
    throw new UnauthorizedError('Invalid or expired session token')
  }

  return data.user
}

export function isUserAdmin(user: { app_metadata?: Record<string, unknown> }) {
  const role = user.app_metadata?.role
  if (typeof role === 'string') {
    return role.toLowerCase() === 'admin'
  }

  const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata?.roles : []
  return roles.some((value: unknown) => typeof value === 'string' && value.toLowerCase() === 'admin')
}
