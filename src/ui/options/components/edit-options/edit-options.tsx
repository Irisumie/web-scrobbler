import type { Setter } from 'solid-js';
import EditedTracks from './edited-tracks';
import RegexEdits from './regex-edits';
import { t } from '@/util/i18n';
import type { ModalType } from '../modal-type';
import BlockedTagsElement from './blocked-tags';
import YouTubeChannelArtists from './youtube-channel-artists';

export default function EditOptions(props: {
	setActiveModal: Setter<ModalType>;
	modal: HTMLDialogElement | undefined;
}) {
	return (
		<>
			<h1>{t('optionsEdits')}</h1>
			<EditedTracks
				setActiveModal={props.setActiveModal}
				modal={props.modal}
			/>
			<RegexEdits
				setActiveModal={props.setActiveModal}
				modal={props.modal}
			/>
			<YouTubeChannelArtists />
			<BlockedTagsElement
				setActiveModal={props.setActiveModal}
				modal={props.modal}
			/>
		</>
	);
}
