export interface IRuntimeMigration {
	name: string;
	description: string;
	runMode: 'blocking' | 'background';
	run: () => Promise<void>;
}
