import { debugLog } from '@/core/content/util';
import type Song from '@/core/object/song';
import * as channelArtists from '@/core/storage/youtube-channel-artists';

export async function process(song: Song): Promise<void> {
	const channel = channelArtists.getChannelForSong(song);
	if (
		!channel ||
		song.flags.isCorrectedByUser ||
		song.flags.isRegexEditedByUser.artist ||
		song.parsed.artistIsCredited
	) {
		return;
	}

	try {
		const saved = await channelArtists.get(channel.id);
		if (saved?.artist && !song.parsed.artistIsCredited) {
			song.processed.artist = saved.artist;
			song.noRegex.artist = saved.artist;
			song.metadata.channelArtistApplied = true;
		}
	} catch (err) {
		debugLog(err, 'error');
	}
}
