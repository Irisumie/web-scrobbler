import { exec } from 'child_process';
import type { PluginOption } from 'vite';
import fs from 'fs-extra';
import colorLog from './log';
import { getBrowser } from './util';
import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';

/**
 * Sends the actual command to typescript to compile connectors, and places them where they should be.
 *
 * @returns A promise that resolves when the connectors are compiled
 */
function generateConnectors() {
	return new Promise<void>((resolve, reject) => {
		fs.ensureDirSync('build/connectorraw');
		exec(
			'esbuild src/connectors/*.ts --bundle --outdir=build/connectorraw --tsconfig=tsconfig.connectors.json',
			(err, stdout, stderr) => {
				if (err) {
					colorLog(err, 'error');
					colorLog(stdout, 'info');
					colorLog(stderr, 'error');
					reject(new Error());
					return;
				}
				colorLog('Connector file compilation complete', 'success');

				try {
					fs.removeSync(`build/${getBrowser()}/connectors`);
					fs.moveSync(
						'build/connectorraw',
						`build/${getBrowser()}/connectors`,
					);
					fs.removeSync('build/connectorraw');
					colorLog('Connector files moved', 'success');
					resolve();
				} catch (err) {
					colorLog(err, 'error');
					reject(new Error());
				}
			},
		);
	});
}

/**
 * Tail of the connector build queue.
 *
 * {@link generateConnectors} moves `build/connectorraw` into place and then
 * deletes it, so two overlapping runs make the second one fail on a directory
 * the first already moved. Watch mode fires one run per file change, so a
 * couple of quick edits in a row is enough to trigger it - the runs are queued
 * rather than started concurrently.
 */
let connectorBuildQueue: Promise<void> = Promise.resolve();

/**
 * Queue a connector build behind any already in flight.
 *
 * @returns A promise that resolves when this build is done
 */
function queueGenerateConnectors(): Promise<void> {
	connectorBuildQueue = connectorBuildQueue
		// A failed build must not wedge every later one.
		.catch(() => undefined)
		.then(() => generateConnectors());
	return connectorBuildQueue;
}

/**
 * chokidar watcher used for HMR purposes
 */
const watcher: FSWatcher | null = null;

/**
 * Vite plugin that compiles the connector .ts files, and moves them to the correct folder
 * for the browser that is currently the build target
 */
export default function compileConnectors(options: {
	watchDirectory: string;
	isDev: boolean;
}): PluginOption {
	return {
		name: 'compile-connectors',
		buildStart: async () => {
			await queueGenerateConnectors();
			if (!options.isDev) {
				return;
			}

			/**
			 * HMR if dev
			 */
			const watcher = chokidar.watch(options.watchDirectory, {
				ignoreInitial: true,
			});

			watcher.on('add', () => {
				colorLog('Connector addition detected, rebuilding...', 'info');
				void queueGenerateConnectors();
			});
			watcher.on('change', () => {
				colorLog('Connector change detected, rebuilding...', 'info');
				void queueGenerateConnectors();
			});
			watcher.on('unlink', () => {
				colorLog('Connector deletion detected, rebuilding...', 'info');
				void queueGenerateConnectors();
			});
			watcher.on('error', (err) => {
				colorLog(err, 'error');
			});
		},
		buildEnd: (err?: Error) => {
			watcher?.close();
			if (err) {
				colorLog(err, 'error');
			}
		},
	};
}
