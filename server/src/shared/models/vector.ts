import { SearchEntityType } from '@msdining/common/models/search';

export interface IFetchEmbeddingQueryResult {
    embedding: Float32Array;
}

export interface IVectorSearchResult {
    id: string;
    entity_type: number;
    distance: number;
}

export interface IEntityRef {
    entityType: SearchEntityType;
    id: string;
}