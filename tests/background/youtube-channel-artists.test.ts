import type { ConnectorMeta } from '@/core/connectors';
import browserExtensionMock from '#/mocks/webextension-polyfill';
import { process } from '@/core/object/pipeline/youtube-channel-artist';
import Song from '@/core/object/song';
import * as channelArtists from '@/core/storage/youtube-channel-artists';
import { beforeEach, expect, it } from 'vitest';

const channel = { id: `UC${'a'.repeat(22)}`, label: 'Publishing channel' };
const otherChannel = { id: `UC${'b'.repeat(22)}`, label: channel.label };
const connector: ConnectorMeta = {
	id: 'youtube',
	label: 'YouTube',
	js: 'youtube.js',
	matches: [],
};

function makeSong({
	artistIsCredited = false,
	channelInfo = channel,
	source = connector,
} = {}) {
	const song = new Song(
		{ artist: 'Guessed artist', track: 'Song', artistIsCredited },
		source,
	);
	song.metadata.artistChannel = channelInfo;
	return song;
}

beforeEach(() => browserExtensionMock.reset());

it('remembers only the artist across videos of the same channel', async () => {
	await channelArtists.save(channel, ' 綿菓子かんろ ');
	const song = makeSong({
		channelInfo: { ...channel, label: 'Renamed channel' },
	});
	song.processed.track = 'Next song';
	await process(song);
	expect(song.getArtist()).toBe('綿菓子かんろ');
	expect(song.getTrack()).toBe('Next song');
	expect(song.flags.isCorrectedByUser).toBe(false);

	const unrelated = makeSong({ channelInfo: otherChannel });
	await process(unrelated);
	expect(unrelated.getArtist()).toBe('Guessed artist');
});

it('keeps single-track edits, regex edits and explicit credits ahead of the channel default', async () => {
	await channelArtists.save(channel, 'Default artist');
	const edited = makeSong();
	edited.flags.isCorrectedByUser = true;
	edited.processed.artist = 'Single-track edit';
	const regex = makeSong();
	regex.flags.isRegexEditedByUser.artist = true;
	regex.processed.artist = 'Regex artist';
	const credited = makeSong({ artistIsCredited: true });
	credited.processed.artist = 'Cover singer';
	await Promise.all([process(edited), process(regex), process(credited)]);
	expect([
		edited.getArtist(),
		regex.getArtist(),
		credited.getArtist(),
	]).toEqual(['Single-track edit', 'Regex artist', 'Cover singer']);
});

it('does not apply a stored default if a credit is confirmed during the storage read', async () => {
	await channelArtists.save(channel, 'Default artist');
	const song = makeSong();
	const processing = process(song);
	song.parsed.artistIsCredited = true;
	await processing;
	expect(song.getArtist()).toBe('Guessed artist');
});

it('isolates concurrent changes and removes defaults without touching another channel', async () => {
	await Promise.all([
		channelArtists.save(channel, 'A'),
		channelArtists.save(otherChannel, 'B'),
	]);
	await channelArtists.remove(channel.id);
	expect(await channelArtists.list()).toEqual([
		{ ...otherChannel, artist: 'B' },
	]);
	const otherPlatform = makeSong({
		channelInfo: otherChannel,
		source: { ...connector, id: 'bilibili' },
	});
	await process(otherPlatform);
	expect(otherPlatform.getArtist()).toBe('Guessed artist');
});

it('offers channel rules only for verified publishers on the YouTube watch connector', () => {
	expect(channelArtists.getChannelForSong(makeSong())).toEqual(channel);
	expect(
		channelArtists.getChannelForSong(
			makeSong({ channelInfo: { ...channel, id: '@handle' } }),
		),
	).toBeUndefined();
	for (const id of ['youtube-music', 'youtube-embed', 'bilibili']) {
		expect(
			channelArtists.getChannelForSong(
				makeSong({ source: { ...connector, id } }),
			),
		).toBeUndefined();
	}
});
