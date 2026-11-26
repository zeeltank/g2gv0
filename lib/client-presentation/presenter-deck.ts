/**
 * The deck WITH its presenter notes (say, ask, then, the "careful" cautions). Only the presenter window imports this.
 *
 * It must never be imported by anything the public share page (app/present) renders: this module pulls the full
 * scholarclone.deck.json into the JavaScript of every page that reaches it. deck.ts is the notes-free copy for everything else.
 */
import { parseDeck, withAtlas, type Deck } from './deck'
import fullJson from './generated/scholarclone.deck.json'

export const PRESENTER_DECKS: Record<string, Deck> = { scholarclone: withAtlas(parseDeck(fullJson)) }
