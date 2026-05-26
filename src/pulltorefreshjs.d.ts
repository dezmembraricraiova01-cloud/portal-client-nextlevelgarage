declare module 'pulltorefreshjs' {
	interface Options {
		mainElement?: string;
		triggerElement?: string;
		distThreshold?: number;
		distMax?: number;
		distReload?: number;
		instructionsPullToRefresh?: string;
		instructionsReleaseToRefresh?: string;
		instructionsRefreshing?: string;
		onRefresh?: () => void | Promise<void>;
		shouldPullToRefresh?: () => boolean;
	}
	export function init(options?: Options): { destroy(): void };
	export function destroyAll(): void;
}
