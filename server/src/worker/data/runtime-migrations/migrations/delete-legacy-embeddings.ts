import { IRuntimeMigration } from '../types.js';
import { SearchEntityType } from '@msdining/common/models/search';
import { deleteAllByEntityType } from '../../storage/vector/client.js';

export const deleteLegacyEmbeddings: IRuntimeMigration = {
    name:        'delete-all-station-embeddings',
    description: 'Remove all station, dailyStation, and cafe embeddings (station relevance is now derived from menu item matches)',
    runMode:     'blocking',
    run:         async () => {
        await deleteAllByEntityType(SearchEntityType.station);
        await deleteAllByEntityType(SearchEntityType.dailyStation);
        await deleteAllByEntityType(SearchEntityType.cafe);
    }
};
