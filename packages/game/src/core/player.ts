export type PlayerId = string

export interface Player {
  readonly id: PlayerId
  readonly name: string
  readonly isBot: boolean
  readonly connected: boolean
}
