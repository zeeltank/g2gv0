/**
 * The deck WITH its presenter notes (say, ask, then, the "careful" cautions). Only the presenter window imports this.
 *
 * It must never be imported by anything the public share page (app/present) renders: this module pulls the full
 * scholarclone.deck.json into the JavaScript of every page that reaches it. deck.ts is the notes-free copy for everything else.
 */
import { parseDeck, withAtlas, type Deck } from './deck'
import fullJson from './generated/scholarclone.deck.json'
import tourNotesJson from './generated/atlas-presenter.json'

export const PRESENTER_DECKS: Record<string, Deck> = { scholarclone: withAtlas(parseDeck(fullJson)) }

/** What to say on each tab of a product tour, by product key then tab (docs/client-presentation/content/atlas/tour-<product>.json, "notes"). */
export const PRESENTER_TOUR_NOTES = tourNotesJson as Record<string, Record<string, string>>
