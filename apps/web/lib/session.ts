'use client'

const NAME_KEY = 'slave:name'
const tokenKey = (roomCode: string) => `slave:token:${roomCode.toUpperCase()}`

/** localStorage throws in some privacy modes; a missing value is never fatal. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    /* ignore — the session simply will not survive a refresh */
  }
}

export const getName = (): string | null => read(NAME_KEY)
export const setName = (name: string): void => write(NAME_KEY, name)

/** The signed token that proves this browser owns a seat in a given room. */
export const getToken = (roomCode: string): string | null => read(tokenKey(roomCode))
export const setToken = (roomCode: string, token: string): void => write(tokenKey(roomCode), token)
export const clearToken = (roomCode: string): void => write(tokenKey(roomCode), null)
