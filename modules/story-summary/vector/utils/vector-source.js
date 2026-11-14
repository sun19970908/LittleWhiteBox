// Daily checks accept older records without input digests. A recorded digest
// must agree with its source; never invent one for an existing vector on read.
export function matchesVectorSource(record, source) {
    return Boolean(record && source)
        && (!record.sourceHash || record.sourceHash === source.sourceHash)
        && (source.floor === undefined || record.floor === source.floor)
        && (source.relationHash === undefined || !record.relationHash || record.relationHash === source.relationHash);
}

export function orphanVectorIds(vectors, sourceIds, key) {
    return vectors.filter(vector => !sourceIds.has(vector[key])).map(vector => vector[key]);
}
