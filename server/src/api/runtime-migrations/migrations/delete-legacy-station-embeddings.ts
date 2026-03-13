import { IRuntimeMigration } from '../types.js';
import { SearchEntityType } from '@msdining/common/models/search';
import { deleteAllByEntityType } from '../../storage/vector/client.js';

export const deleteLegacyStationEmbeddings: IRuntimeMigration = {
    name:        'delete-legacy-station-embeddings',
    description: 'Remove legacy static station embeddings (replaced by daily station embeddings)',
    runMode:     'blocking',
    run:         async () => {
        await deleteAllByEntityType(SearchEntityType.station);
    }
};
