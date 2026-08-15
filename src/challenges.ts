import data from './data/photo-challenges.json'

export type PhotoChallenge = {
  id: string
  text: string
}

export const PHOTO_CHALLENGES: PhotoChallenge[] = data.photo_challenges

export const PHOTO_CHALLENGE_ACHIEVEMENT = {
  id: 'hodovy-nezmar',
  name: 'Hodový nezmar',
  description: 'Splnil aspoň polovinu hodových foto výzev.',
  needed: Math.ceil(PHOTO_CHALLENGES.length / 2),
} as const
