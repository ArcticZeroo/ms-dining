export interface IFetchEmbeddingQueryResult {
    embedding: Float32Array;
}

export interface IVectorSearchResult {
    id: string;
    entity_type: number;
    distance: number;
}