import type { BaseState } from '@/core/types';
import type { ChannelInfo } from '@/core/content/util';
import * as MetadataFilter from '@web-scrobbler/metadata-filter';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '#/mocks/webextension-polyfill';

type PageMessage = Pick<MessageEvent<unknown>, 'data' | 'origin' | 'source'>;

const connector = {
	applyFilter: vi.fn<(filter: MetadataFilter.MetadataFilter) => void>(),
	getTrackInfo: vi.fn<() => BaseState>(),
	getArtistChannel: vi.fn<(url: string) => Promise<ChannelInfo | null>>(),
	injectScript: vi.fn(),
	onScriptEvent: vi.fn<(event: PageMessage) => void>(),
	onStateChanged: vi.fn(),
};

const youtubeOrigin = 'https://www.youtube.com';
let videoId: string;
let metadataId: string;
let title: string;
let channel: string | null;
let collaborationChannel: string | null;
let playerDetails:
	| { videoId: string; author: string; channelId?: string }
	| undefined;
const findCollaborationChannel = vi.fn(() =>
	collaborationChannel ? { textContent: collaborationChannel } : null,
);

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	videoId = metadataId = 'El2ulWpN-pk';
	title = '曲名 / 原曲者';
	channel = collaborationChannel = null;
	playerDetails = undefined;
});

async function loadConnector({
	readYouTubeMusic = false,
	japaneseTitleOrder = true,
} = {}) {
	const util = await import('@/core/content/util');
	const getOption = vi.spyOn(util, 'getOption');
	getOption.mockImplementation(
		async (_, option) =>
			(option === 'japaneseTitleOrder' && japaneseTitleOrder) ||
			(readYouTubeMusic && option === 'enableGetTrackInfoFromYtMusic'),
	);

	vi.stubGlobal('Connector', connector);
	vi.stubGlobal('Util', util);
	vi.stubGlobal('MetadataFilter', MetadataFilter);
	vi.stubGlobal('window', {
		postMessage: (data: unknown, origin: string) => {
			queueMicrotask(() => {
				connector.onScriptEvent({
					data,
					origin,
					source: window,
				});
			});
		},
	});
	vi.stubGlobal('location', { origin: youtubeOrigin });
	vi.stubGlobal(
		'document',
		Object.assign(new EventTarget(), {
			querySelector: (selector: string) => {
				switch (selector) {
					case 'ytd-watch-metadata':
						return {
							getAttribute: () => metadataId,
							querySelector: findCollaborationChannel,
						};
					case '#movie_player':
						return {
							getPlayerResponse: () => ({
								videoDetails: playerDetails,
							}),
						};
					default:
						return null;
				}
			},
			querySelectorAll: (selector: string) => {
				switch (selector) {
					case '.html5-video-player .ytp-title-link':
						return [{ innerText: title }];
					case '#top-row .ytd-channel-name a':
						return channel ? [{ innerText: channel }] : [];
					case 'ytd-watch-flexy':
						return [{ getAttribute: () => videoId }];
					default:
						return [];
				}
			},
		}),
	);
	await import('@/connectors/youtube');
	await vi.waitFor(() => {
		expect(getOption).toHaveBeenCalledWith('YouTube', 'japaneseTitleOrder');
	});
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it('uses the ordinary channel or the song artist before looking up a player author', async () => {
	await loadConnector();
	channel = '鏑木ろこ / Kaburaki Roco【にじさんじ】';
	expect(connector.getTrackInfo()).toMatchObject({
		artist: '鏑木ろこ',
		track: '曲名',
	});

	channel = null;
	collaborationChannel = 'Collaborating channel';
	title = 'Artist - Track';
	expect(connector.getTrackInfo()).toMatchObject({
		artist: 'Artist',
		track: 'Track',
	});
	expect(connector.injectScript).not.toHaveBeenCalled();
});

it('uses the direct channel link in the current video collaboration byline', async () => {
	await loadConnector();
	collaborationChannel = '鏑木ろこ / Kaburaki Roco【にじさんじ】';

	expect(connector.getTrackInfo()).toMatchObject({
		artist: '鏑木ろこ',
		track: '曲名',
	});
	expect(findCollaborationChannel).toHaveBeenCalledWith(
		expect.stringContaining('#attributed-channel-name a:is('),
	);
	expect(connector.injectScript).not.toHaveBeenCalled();
});

it.each([true, false])(
	'separates the trailing artist and preserves the song punctuation with Japanese title order %s (UmSQgsqDb5g)',
	async (japaneseTitleOrder) => {
		await loadConnector({ japaneseTitleOrder });
		title = '無重力で（ね！）- 惑世いと (Music Video)';
		channel = '惑世いと - wakuse ito';
		const trackInfo = connector.getTrackInfo();
		const [[filter]] = connector.applyFilter.mock.calls;

		expect(trackInfo).toMatchObject({
			artist: '惑世いと',
			track: '無重力で（ね！）',
		});
		expect(filter.filterField('track', trackInfo.track ?? '')).toBe(
			'無重力で（ね！）',
		);
		expect(
			filter.filterField('track', '無重力で（ね！）（Music Video）'),
		).toBe('無重力で（ね！）');
		expect(
			filter.filterField('track', '無重力で（ね！）（歌ってみた）'),
		).toBe('無重力で（ね！）');
	},
);

it('credits the cover singer of a quoted song (H4sEqC6Glo0)', async () => {
	await loadConnector();
	title = '『芽吹くとき / yonige』- covered by kaza';
	channel = 'Another uploader';

	expect(connector.getTrackInfo()).toMatchObject({
		artist: 'kaza',
		track: '芽吹くとき',
		artistIsCredited: true,
	});
});

it('distinguishes title guesses from explicit credits', async () => {
	await loadConnector();
	channel = 'Publishing channel';
	title = 'Guessed artist - Song';
	expect(connector.getTrackInfo().artistIsCredited).toBeUndefined();
	title = 'Artist「Song」';
	expect(connector.getTrackInfo().artistIsCredited).toBe(true);
});

it('gets the stable publishing channel from the player for the specified video', async () => {
	await loadConnector();
	const id = `UC${'a'.repeat(22)}`;
	const firstUrl = `https://youtu.be/${videoId}`;
	playerDetails = { videoId, author: 'Uploader', channelId: id };
	await import('@/connectors/youtube-dom-inject');
	expect(await connector.getArtistChannel(firstUrl)).toEqual({
		id,
		label: 'Uploader',
	});
	videoId = 'WA3hL4hDx9c';
	expect(await connector.getArtistChannel(firstUrl)).toBeNull();
	const nextChannel = `UC${'b'.repeat(22)}`;
	playerDetails = {
		videoId,
		author: 'Collaborative uploader',
		channelId: nextChannel,
	};
	expect(
		await connector.getArtistChannel(`https://youtu.be/${videoId}`),
	).toEqual({
		id: nextChannel,
		label: 'Collaborative uploader',
	});
});

it.each([true, false])(
	'uses the credited artist from a bilingual channel with Japanese title order %s',
	async (japaneseTitleOrder) => {
		await loadConnector({ japaneseTitleOrder });
		title = '【歌ってみた】出来心 / 綿菓子かんろ';
		channel = 'Watakan Ch. 綿菓子かんろ';

		expect(connector.getTrackInfo()).toMatchObject({
			artist: '綿菓子かんろ',
			track: '出来心',
		});
	},
);

it('uses the artist channel when the slash credits the original singer', async () => {
	await loadConnector();
	title = '【歌ってみた】出来心 / 原曲者';
	channel = 'Watakan Ch. 綿菓子かんろ';

	expect(connector.getTrackInfo()).toMatchObject({
		artist: '綿菓子かんろ',
		track: '出来心',
	});
});

it.each([
	{
		title: '無重力で（ね！）- 惑世いと (Music Video)',
		author: '惑世いと - wakuse ito',
		expected: { track: '無重力で（ね！）', artist: '惑世いと' },
	},
	{
		title: 'Song - Live Version',
		author: 'Official Artist Name',
		expected: {
			track: 'Song - Live Version',
			artist: 'Official Artist Name',
		},
	},
])('handles YouTube Music metadata for "$title"', async (sample) => {
	await loadConnector({ readYouTubeMusic: true });
	const fetch = vi.fn().mockResolvedValue({
		json: async () => ({
			videoDetails: {
				title: sample.title,
				author: sample.author,
				musicVideoType: 'MUSIC_VIDEO_TYPE_OMV',
			},
		}),
	});
	vi.stubGlobal('fetch', fetch);
	connector.getTrackInfo();
	await vi.waitFor(() => {
		expect(connector.getTrackInfo()).toMatchObject(sample.expected);
	});
});

it('uses only the current video player author when the byline has no channel link', async () => {
	await loadConnector();
	playerDetails = { videoId, author: 'First uploader' };
	expect(connector.getTrackInfo().artist).toBeNull();
	expect(connector.injectScript).toHaveBeenCalledWith(
		'connectors/youtube-dom-inject.js',
	);
	await import('@/connectors/youtube-dom-inject');
	expect(connector.getTrackInfo().artist).toBe('First uploader');

	videoId = 'WA3hL4hDx9c';
	collaborationChannel = 'Stale byline';
	expect(connector.getTrackInfo().artist).toBeNull();
	await Promise.resolve();
	expect(connector.onStateChanged).toHaveBeenCalledTimes(1);

	playerDetails = { videoId, author: 'Second uploader' };
	expect(connector.getTrackInfo().artist).toBeNull();
	await Promise.resolve();
	expect(connector.getTrackInfo().artist).toBe('Second uploader');
	expect(connector.onStateChanged).toHaveBeenCalledTimes(2);
});
