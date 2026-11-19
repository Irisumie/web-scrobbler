import { For, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { t } from '@/util/i18n';
import type { EditedFields, FieldType, RegexEdit } from '@/util/regex';
import {
	pascalCaseField,
	processRegexFlags,
	replaceFields,
	searchMatches,
} from '@/util/regex';
import {
	CaseSensitiveOutlined,
	CheckOutlined,
	CloseOutlined,
	RegexOutlined,
	SaveOutlined,
	WholeWordOutlined,
} from '@/ui/components/icons';
import styles from '../components.module.scss';

const FIELDS: FieldType[] = ['track', 'artist', 'album', 'albumArtist'];

/**
 * Sample metadata the rule being edited is tried against.
 *
 * Module level on purpose: it is scratch data for checking a regex, so it
 * should survive closing one rule and opening another, but it is never
 * written to storage.
 */
const [sample, setSample] = createStore<EditedFields>({
	track: '',
	artist: '',
	album: '',
	albumArtist: '',
});

/**
 * Empty rule, used as the starting point when adding one.
 *
 * @returns A rule with no searches, no replacements and default flags
 */
export function emptyRegexEdit(): RegexEdit {
	return {
		search: { track: null, artist: null, album: null, albumArtist: null },
		replace: { track: null, artist: null, album: null, albumArtist: null },
	};
}

/**
 * Form for a single regex edit, with a live preview against sample metadata.
 *
 * The draft is kept locally and only handed back on save, so cancelling
 * leaves the stored rule untouched. The component is recreated each time a
 * rule is opened, which resets the draft.
 */
export default function RegexEditForm(props: {
	initialEdit: RegexEdit;
	onSave: (edit: RegexEdit) => void;
	onCancel: () => void;
}) {
	const [edit, setEdit] = createStore<RegexEdit>({
		...props.initialEdit,
		search: { ...props.initialEdit.search },
		replace: { ...props.initialEdit.replace },
	});

	/*
	 * `replaceFields` mutates what it is given and only replaces anything when
	 * every field's search matches, which is the same rule the pipeline uses.
	 */
	const preview = () => replaceFields({ ...edit }, { ...sample });

	const flags = () =>
		processRegexFlags({
			isRegexDisabled: Boolean(edit.isRegexDisabled),
			isCaseInsensitive: Boolean(edit.isCaseInsensitive),
			isGlobal: Boolean(edit.isGlobal),
		});

	return (
		<div
			class={styles.regexEditForm}
			onKeyDown={(e) => {
				if (e.key === 'Enter' && !e.isComposing) {
					props.onSave(edit);
				}
				if (e.key === 'Escape') {
					props.onCancel();
				}
			}}
		>
			<span class={styles.regexEditFormHeader}>
				{t('infoSearchLabel')}
			</span>
			<span class={styles.regexEditFormHeader}>
				{t('infoReplaceLabel')}
			</span>
			<span class={styles.regexEditFormHeader}>
				{t('optionsRegexEditsTest')}
			</span>
			<span class={styles.regexEditFormHeader}>
				{t('infoPreviewLabel')}
			</span>
			<For each={FIELDS}>
				{(field) => (
					<>
						<label
							class={styles.regexEditFormLabel}
							for={`regex-edit-search-${field}`}
						>
							{t(`info${pascalCaseField(field)}Label`)}
						</label>
						<input
							id={`regex-edit-search-${field}`}
							type="text"
							value={edit.search[field] ?? ''}
							title={t('infoSearchLabel')}
							onInput={(e) =>
								setEdit(
									'search',
									field,
									e.currentTarget.value || null,
								)
							}
						/>
						<input
							type="text"
							value={edit.replace[field] ?? ''}
							title={t('infoReplaceLabel')}
							onInput={(e) =>
								setEdit(
									'replace',
									field,
									e.currentTarget.value || null,
								)
							}
						/>
						<div class={styles.regexEditFormSample}>
							<input
								type="text"
								value={sample[field]}
								title={t('optionsRegexEditsTest')}
								onInput={(e) =>
									setSample(field, e.currentTarget.value)
								}
							/>
							<Show when={edit.search[field] && sample[field]}>
								<Show
									when={searchMatches(
										edit.search[field],
										sample[field],
										flags(),
									)}
									fallback={
										<CloseOutlined
											class={styles.regexTestFailure}
										/>
									}
								>
									<CheckOutlined
										class={styles.regexTestSuccess}
									/>
								</Show>
							</Show>
						</div>
						<output title={t('infoPreviewLabel')}>
							{preview()[field]}
						</output>
					</>
				)}
			</For>
			<div class={styles.regexEditFormFooter}>
				<div
					class={styles.regexEditFormFlags}
					role="group"
					aria-label={t('optionsOptions')}
				>
					<FlagCheckbox
						i18nTitle="infoUseRegex"
						icon={RegexOutlined}
						isChecked={!edit.isRegexDisabled}
						onToggle={(checked) =>
							setEdit(
								'isRegexDisabled',
								checked ? undefined : true,
							)
						}
					/>
					<FlagCheckbox
						i18nTitle="infoMatchCase"
						icon={CaseSensitiveOutlined}
						isChecked={!edit.isCaseInsensitive}
						onToggle={(checked) =>
							setEdit(
								'isCaseInsensitive',
								checked ? undefined : true,
							)
						}
					/>
					<FlagCheckbox
						i18nTitle="infoMatchWholeTag"
						icon={WholeWordOutlined}
						isChecked={!edit.isGlobal}
						onToggle={(checked) =>
							setEdit('isGlobal', checked ? undefined : true)
						}
					/>
				</div>
				<div class={styles.regexEditFormButtons}>
					<button
						class={styles.button}
						onClick={() => props.onSave(edit)}
					>
						<SaveOutlined />
						{t('optionsRegexEditsSaveRule')}
					</button>
					<button class={styles.button} onClick={props.onCancel}>
						<CloseOutlined />
						{t('optionsRegexEditsCancel')}
					</button>
				</div>
			</div>
		</div>
	);
}

/**
 * Checkbox for a single regex flag.
 *
 * The stored flags are inverted - `isRegexDisabled` rather than "use regex" -
 * so the checkbox state is the opposite of the flag it writes.
 */
function FlagCheckbox(props: {
	i18nTitle: string;
	icon: typeof RegexOutlined;
	isChecked: boolean;
	onToggle: (isChecked: boolean) => void;
}) {
	return (
		<label title={t(props.i18nTitle)} class={styles.regexEditFormFlag}>
			<input
				type="checkbox"
				checked={props.isChecked}
				onChange={(e) => props.onToggle(e.currentTarget.checked)}
			/>
			<props.icon />
		</label>
	);
}
