import { createResource, createSignal, For, Show } from 'solid-js';
import * as channelArtists from '@/core/storage/youtube-channel-artists';
import { DeleteOutlined } from '@/ui/components/icons';
import { t } from '@/util/i18n';
import styles from '../components.module.scss';

export default function YouTubeChannelArtists() {
	const [artists, { refetch }] = createResource(channelArtists.list);
	const [removeFailed, setRemoveFailed] = createSignal(false);

	async function remove(id: string) {
		setRemoveFailed(false);
		try {
			await channelArtists.remove(id);
			await refetch();
		} catch {
			setRemoveFailed(true);
		}
	}

	return (
		<>
			<h2>{t('optionsYouTubeChannelArtists')}</h2>
			<p>{t('optionsYouTubeChannelArtistsDesc')}</p>
			<Show when={removeFailed()}>
				<p role="alert">{t('optionsChannelArtistRemoveFailed')}</p>
			</Show>
			<ul class={styles.optionList}>
				<For each={artists()}>
					{(entry) => (
						<li class={styles.deleteListing}>
							<button
								class={`${styles.button} ${styles.small} ${styles.marginRight}`}
								type="button"
								title={t('optionsDelete', entry.label)}
								onClick={() => void remove(entry.id)}
							>
								<DeleteOutlined />
							</button>
							<span>
								{entry.label} → {entry.artist}
							</span>
						</li>
					)}
				</For>
			</ul>
		</>
	);
}
