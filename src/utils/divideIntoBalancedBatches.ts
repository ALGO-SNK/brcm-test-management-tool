export function divideIntoBalancedBatches<T>(items: T[], maxItemsPerBatch = 10): T[][] {
  if (!Array.isArray(items)) {
    throw new Error('items must be an array');
  }

  if (maxItemsPerBatch <= 0) {
    throw new Error('maxItemsPerBatch must be greater than 0');
  }

  const totalItems = items.length;

  if (totalItems === 0) {
    return [];
  }

  // Decide how many batches are needed so that no batch exceeds maxItemsPerBatch.
  const numberOfBatches = Math.ceil(totalItems / maxItemsPerBatch);
  const baseSize = Math.floor(totalItems / numberOfBatches);
  const extraItems = totalItems % numberOfBatches;

  const result: T[][] = [];
  let startIndex = 0;

  for (let i = 0; i < numberOfBatches; i += 1) {
    let currentBatchSize = baseSize;

    // Distribute remaining items across the first few batches.
    if (i < extraItems) {
      currentBatchSize += 1;
    }

    const endIndex = startIndex + currentBatchSize;
    result.push(items.slice(startIndex, endIndex));
    startIndex = endIndex;
  }

  return result;
}
