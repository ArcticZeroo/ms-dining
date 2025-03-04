export interface IFetchEmbeddingQueryResult {
    embedding: number[];
}

export interface IVectorSearchResult {
    id: string;
    entity_type: number;
    distance: number;
}