import { t } from '@/util/i18n';
import type { Setter } from 'solid-js';
import { For, Show, createResource, createSignal } from 'solid-js';
import * as BrowserStorage from '@/core/storage/browser-storage';
import regexEdits from '@/core/storage/regex-edits';
import styles from '../components.module.scss';
import {
	AddOutlined,
	CaseSensitiveOutlined,
	DeleteOutlined,
	EditOutlined,
	ExpandMoreOutlined,
	RegexOutlined,
	WholeWordOutlined,
} from '@/ui/components/icons';
import type { FieldType, RegexEdit } from '@/util/regex';
import { pascalCaseField } from '@/util/regex';
import { ExportEdits, ImportEdits, ViewEdits } from './util';
import type { ModalType } from '../modal-type';
import RegexEditForm, { emptyRegexEdit } from './regex-edit-form';

const regexEditsStorage = BrowserStorage.getStorage(BrowserStorage.REGEX_EDITS);

/** Index used to mark the "new rule" draft rather than an existing rule. */
const NEW_EDIT = -1;

/**
 * Component that allows the user to see, import, and export track metadata edits.
 */
export default function RegexEdits(props: {
	setActiveModal: Setter<ModalType>;
	modal: HTMLDialogElement | undefined;
}) {
	return (
		<>
			<h2>{t('optionsRegexEdits')}</h2>
			<p>{t('optionsRegexEditsDesc')}</p>
			<div
				class={styles.buttonContainer}
				role="group"
				aria-label={t('optionsRegexEdits')}
			>
				<ViewEdits
					setActiveModal={props.setActiveModal}
					modal={props.modal}
					type={'regexEdits'}
				/>
				<ExportEdits
					editWrapper={regexEditsStorage}
					filename="regex-edits.json"
				/>
				<ImportEdits editWrapper={regexEditsStorage} />
			</div>
		</>
	);
}

/**
 * Manager for the user's regex edits: add, edit, reorder and delete.
 * To be displayed in a modal.
 */
export function RegexEditsModal() {
	const [edits, { refetch }] = createResource(
		regexEditsStorage.get.bind(regexEditsStorage),
	);
	const [editingIndex, setEditingIndex] = createSignal<number | null>(null);

	const closeForm = () => setEditingIndex(null);

	const saveEdit = (index: number, edit: RegexEdit) => {
		void (async () => {
			if (index === NEW_EDIT) {
				await regexEdits.saveRegexEdit(edit);
			} else {
				await regexEdits.updateRegexEdit(index, edit);
			}
			closeForm();
			void refetch();
		})();
	};

	const runAndRefetch = (action: Promise<void>) => {
		void action.then(() => {
			closeForm();
			void refetch();
		});
	};

	return (
		<>
			<h1>
				{t(
					'optionsRegexEditsPopupTitle',
					(edits() ?? []).length.toString(),
				)}
			</h1>
			<div class={styles.buttonContainer}>
				<button
					class={`${styles.button} ${styles.shiftLeft}`}
					onClick={() => setEditingIndex(NEW_EDIT)}
				>
					<AddOutlined />
					{t('optionsRegexEditsAdd')}
				</button>
			</div>
			<Show when={editingIndex() === NEW_EDIT}>
				<RegexEditForm
					initialEdit={emptyRegexEdit()}
					onSave={(edit) => saveEdit(NEW_EDIT, edit)}
					onCancel={closeForm}
				/>
			</Show>
			<Show
				when={(edits() ?? []).length > 0}
				fallback={
					<p class={styles.muted}>{t('optionsRegexEditsEmpty')}</p>
				}
			>
				<p class={styles.muted}>{t('optionsRegexEditsPriorityNote')}</p>
			</Show>
			<ul class={styles.optionList}>
				<For each={[...(edits() ?? []).entries()]}>
					{([index, edit]) => (
						<li>
							<Show
								when={editingIndex() === index}
								fallback={
									<EditInfo
										index={index}
										edit={edit}
										total={(edits() ?? []).length}
										onEdit={() => setEditingIndex(index)}
										onDelete={() =>
											runAndRefetch(
												regexEdits.deleteRegexEdit(
													index,
												),
											)
										}
										onMove={(to) =>
											runAndRefetch(
												regexEdits.moveRegexEdit(
													index,
													to,
												),
											)
										}
									/>
								}
							>
								<RegexEditForm
									initialEdit={edit}
									onSave={(newEdit) =>
										saveEdit(index, newEdit)
									}
									onCancel={closeForm}
								/>
							</Show>
						</li>
					)}
				</For>
			</ul>
		</>
	);
}

/**
 * Component that shows a single regex edit along with its row actions.
 */
function EditInfo(props: {
	index: number;
	edit: RegexEdit;
	total: number;
	onEdit: () => void;
	onDelete: () => void;
	onMove: (to: number) => void;
}) {
	return (
		<div class={styles.deleteListing}>
			<div class={styles.regexRowButtons}>
				<button
					class={`${styles.button} ${styles.small}`}
					title={t('optionsRegexEditsEditRule')}
					onClick={(event) => {
						event.stopPropagation();
						props.onEdit();
					}}
				>
					<EditOutlined />
				</button>
				<button
					class={`${styles.button} ${styles.small}`}
					title={t('optionsRegexEditsMoveUp')}
					disabled={props.index === 0}
					onClick={(event) => {
						event.stopPropagation();
						props.onMove(props.index - 1);
					}}
				>
					<ExpandMoreOutlined class={styles.regexArrowUp} />
				</button>
				<button
					class={`${styles.button} ${styles.small}`}
					title={t('optionsRegexEditsMoveDown')}
					disabled={props.index === props.total - 1}
					onClick={(event) => {
						event.stopPropagation();
						props.onMove(props.index + 1);
					}}
				>
					<ExpandMoreOutlined />
				</button>
				<button
					class={`${styles.button} ${styles.small}`}
					title={t('infoDeleteLabel')}
					onClick={(event) => {
						event.stopPropagation();
						props.onDelete();
					}}
				>
					<DeleteOutlined />
				</button>
			</div>
			<div class={styles.regexDeleteContent}>
				<span class={styles.regexDeleteSearchLabel}>
					{t('infoSearchLabel')}
				</span>
				<span class={styles.regexDeleteReplaceLabel}>
					{t('infoReplaceLabel')}
				</span>
				<Entry edit={props.edit} type={'track'} />
				<Entry edit={props.edit} type={'artist'} />
				<Entry edit={props.edit} type={'album'} />
				<Entry edit={props.edit} type={'albumArtist'} />
				<Flags edit={props.edit} />
			</div>
		</div>
	);
}

/**
 * Component that returns the grid entry for regex flags
 */
function Flags(props: { edit: RegexEdit }) {
	return (
		<div class={styles.regexDeleteFlags}>
			<Show when={!props.edit.isRegexDisabled}>
				<RegexOutlined
					title={t('infoUseRegex')}
					class={styles.regexEditEntry}
				/>
			</Show>
			<Show when={!props.edit.isCaseInsensitive}>
				<CaseSensitiveOutlined
					title={t('infoMatchCase')}
					class={styles.regexEditEntry}
				/>
			</Show>
			<Show when={!props.edit.isGlobal}>
				<WholeWordOutlined
					title={t('infoMatchWholeTag')}
					class={styles.regexEditEntry}
				/>
			</Show>
		</div>
	);
}

/**
 * Component that returns the grid entries for a single field of regex search/replace
 */
function Entry(props: { edit: RegexEdit; type: FieldType }) {
	return (
		<>
			<span
				class={`${
					styles[`regexDelete${pascalCaseField(props.type)}Label`]
				} ${styles.regexEditEntry}`}
			>
				{t(`info${pascalCaseField(props.type)}Label`)}
			</span>
			<span
				class={`${
					styles[`regexDelete${pascalCaseField(props.type)}Search`]
				} ${styles.regexEditEntry}`}
			>
				{props.edit.search[props.type]}
			</span>
			<span
				class={`${
					styles[`regexDelete${pascalCaseField(props.type)}Replace`]
				} ${styles.regexEditEntry}`}
			>
				{props.edit.replace[props.type]}
			</span>
		</>
	);
}
