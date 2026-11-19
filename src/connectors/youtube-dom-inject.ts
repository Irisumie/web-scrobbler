export {};

type YouTubePlayer = HTMLElement & {
	getPlayerResponse?: () => {
		videoDetails?: {
			videoId?: string;
			author?: string;
			channelId?: string;
		};
	};
};

function sendPlayerAuthor() {
	const player =
		document.querySelector<YouTubePlayer>('#movie_player') ??
		document.querySelector<YouTubePlayer>('.html5-video-player');
	const details = player?.getPlayerResponse?.()?.videoDetails;
	const author = details?.author?.trim();
	if (details?.videoId && author) {
		window.postMessage(
			{
				sender: 'web-scrobbler',
				type: 'YOUTUBE_PLAYER_AUTHOR',
				videoId: details.videoId,
				channelId: details.channelId,
				author,
			},
			location.origin,
		);
	}
}

const requestEvent = 'web-scrobbler-request-youtube-author';
const pageWindow = window as Window & {
	webScrobblerYouTubeAuthorListener?: () => void;
};
const previousListener = pageWindow.webScrobblerYouTubeAuthorListener;
if (previousListener) {
	document.removeEventListener(requestEvent, previousListener);
}
pageWindow.webScrobblerYouTubeAuthorListener = sendPlayerAuthor;
document.addEventListener(requestEvent, sendPlayerAuthor);

// Cover the first request, which can arrive before the injected script loads.
sendPlayerAuthor();
