import type { REGEX_EDITS } from './browser-storage';
import { CustomStorage } from './custom-storage';
import type { DataModels } from './wrapper';
import type { RegexEdit } from '@/util/regex';
import { editSong, shouldApplyEdit } from '@/util/regex';
import type Song from '../object/song';

type K = typeof REGEX_EDITS;
type V = DataModels[K];
type T = Record<K, V>;

/**
 * An edit may come from a SolidJS store, which is a proxy. Firefox cannot
 * store those, so everything is copied into plain objects before it is
 * written. Removing this will break Firefox support.
 *
 * @param edit - Edit to copy
 * @returns The same edit as plain objects
 */
function plainRegexEdit(edit: RegexEdit): RegexEdit {
	return {
		...edit,
		search: { ...edit.search },
		replace: { ...edit.replace },
	};
}

export default abstract class RegexEditsModel extends CustomStorage<K> {
	public abstract getRegexEditStorage(): Promise<RegexEdit[] | null>;
	public abstract saveRegexEditToStorage(data: T[K]): Promise<void>;

	/**
	 * Apply regex edits to a given song object.
	 *
	 * @param song - Song instance
	 */
	async loadSongInfo(song: Song): Promise<void> {
		const storageData = await this.getRegexEditStorage();

		if (!storageData) {
			return;
		}

		for (let i = storageData.length - 1; i >= 0; i--) {
			if (!shouldApplyEdit(storageData[i], song)) {
				continue;
			}
			editSong(storageData[i], song);
		}
	}

	/**
	 * Save custom regex edit to the storage.
	 *
	 * @param newEdit - Edit to append
	 */
	async saveRegexEdit(newEdit: RegexEdit): Promise<void> {
		const storageData = await this.getRegexEditStorage();
		await this.saveRegexEditToStorage([
			...(storageData ?? []),
			plainRegexEdit(newEdit),
		]);
	}

	/**
	 * Replace the edit at the given position.
	 *
	 * @param index - Position of the edit to replace
	 * @param newEdit - Edit to store in its place
	 */
	async updateRegexEdit(index: number, newEdit: RegexEdit): Promise<void> {
		const storageData = await this.getRegexEditStorage();
		if (storageData === null || !(index in storageData)) {
			return;
		}

		storageData[index] = plainRegexEdit(newEdit);

		await this.saveRegexEditToStorage(storageData);
	}

	/**
	 * Move an edit to another position.
	 *
	 * Order is meaningful: {@link loadSongInfo} walks the list backwards and
	 * only the first edit to touch a field wins, so edits further down take
	 * precedence.
	 *
	 * @param from - Position of the edit to move
	 * @param to - Position to move it to, clamped to the list
	 */
	async moveRegexEdit(from: number, to: number): Promise<void> {
		const storageData = await this.getRegexEditStorage();
		if (storageData === null || !(from in storageData)) {
			return;
		}

		const target = Math.min(Math.max(to, 0), storageData.length - 1);
		if (target === from) {
			return;
		}

		const [moved] = storageData.splice(from, 1);
		storageData.splice(target, 0, moved);

		await this.saveRegexEditToStorage(storageData);
	}

	async deleteRegexEdit(index: number): Promise<void> {
		const storageData = await this.getRegexEditStorage();
		if (storageData === null) {
			return;
		}
		storageData.splice(index, 1);

		await this.saveRegexEditToStorage(storageData);
	}
}
