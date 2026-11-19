import browser from 'webextension-polyfill';
import type { ChannelInfo } from '@/core/content/util';
import type { BaseSong } from '@/core/object/song';
import { isYouTubeChannelId } from '@/util/youtube-channel-id';

const prefix = 'YouTubeChannelArtist:';
type ChannelArtist = ChannelInfo & { artist: string };

export function getChannelForSong(
	song: BaseSong | undefined,
): ChannelInfo | undefined {
	const channel = song?.metadata.artistChannel;
	if (
		song?.connector.id === 'youtube' &&
		channel &&
		isYouTubeChannelId(channel.id)
	) {
		return channel;
	}
}

export async function get(id: string): Promise<ChannelArtist | undefined> {
	const key = prefix + id;
	const data = await browser.storage.local.get(key);
	return data[key] as ChannelArtist | undefined;
}

export async function save(
	channel: ChannelInfo,
	artist: string,
): Promise<void> {
	const value = artist.trim();
	if (!isYouTubeChannelId(channel.id) || !value) {
		throw new Error('Invalid YouTube channel or artist');
	}
	// Separate keys let different channels be edited without a read-modify-write race.
	await browser.storage.local.set({
		[prefix + channel.id]: { ...channel, artist: value },
	});
}

export async function remove(id: string): Promise<void> {
	await browser.storage.local.remove(prefix + id);
}

export async function list(): Promise<ChannelArtist[]> {
	const data = await browser.storage.local.get();
	return Object.entries(data)
		.filter(([key]) => key.startsWith(prefix))
		.map(([, value]) => value as ChannelArtist);
}
