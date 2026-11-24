/**
 * The seven ways a piece of Intelligence can be unavailable or incomplete. Each has its OWN wording, tone and icon so that none can be mistaken for
 * another (or for "nothing is wrong"):
 *
 *   partial            a check exists for a slice of it; the rest is not assessed
 *   not_enough_data    a check exists but the data recorded so far is too thin
 *   data_unavailable   a check exists but its data could not be read (an API/source failure: never zero, never healthy)
 *   access_restricted  the server says this person may not see it: nothing is shown and nothing is implied
 *   not_connected      no source is connected to it
 *   not_assessed       no check exists yet (data may well exist)
 *   excluded           deliberately kept out of Intelligence pending separate approval and security review
 */
export type AvailabilityState = 'partial' | 'not_enough_data' | 'data_unavailable' | 'access_restricted' | 'not_connected' | 'not_assessed' | 'excluded'

export type AvailabilityIcon = 'circle-dashed' | 'hourglass' | 'database-zap' | 'lock' | 'unplug' | 'circle-help' | 'shield-off'

export const EXCLUDED_LABEL = 'Excluded — pending separate approval and security review'

export const AVAILABILITY: Record<AvailabilityState, { label: string; meaning: string; icon: AvailabilityIcon }> = {
  partial: {
    label: 'Partially covered',
    meaning: 'A check assesses a slice of this. The rest is not assessed, so this is not a full picture.',
    icon: 'circle-dashed',
  },
  not_enough_data: {
    label: 'Not enough data',
    meaning: 'The checks could not fully assess this yet. That is not the same as everything being fine.',
    icon: 'hourglass',
  },
  data_unavailable: {
    label: 'Data unavailable',
    meaning: 'The data this check needs could not be read. Nothing was assessed: this is not zero records and not an all-clear.',
    icon: 'database-zap',
  },
  access_restricted: {
    label: 'Access restricted',
    meaning: 'The server reported that you may not see this. Nothing is shown here and nothing is implied about it.',
    icon: 'lock',
  },
  not_connected: {
    label: 'Not connected',
    meaning: 'No intelligence source is connected to this yet.',
    icon: 'unplug',
  },
  not_assessed: {
    label: 'Not yet assessed',
    meaning: 'No check exists for this yet. Data may exist; it has simply not been assessed.',
    icon: 'circle-help',
  },
  excluded: {
    label: EXCLUDED_LABEL,
    meaning: 'This is deliberately kept out of Intelligence, including aggregates and summaries, until it is separately approved and security reviewed. No access to it is implied.',
    icon: 'shield-off',
  },
}
