/**
 * Test for a canonical YouTube channel ID.
 * @param id - Candidate from the current player response
 * @returns Whether the ID identifies a YouTube channel
 */
export function isYouTubeChannelId(id: unknown): id is string {
	return typeof id === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(id);
}
