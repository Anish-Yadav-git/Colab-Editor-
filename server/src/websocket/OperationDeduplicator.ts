/**
 * OperationDeduplicator class with recent operations cache
 * Prevents duplicate operations from being applied
 */
export class OperationDeduplicator {
  private recentOps: Map<string, Set<string>> = new Map();
  private readonly TTL = 60000; // 1 minute in milliseconds

  /**
   * Check if an operation is a duplicate
   * @param documentId - The document ID
   * @param operationId - The operation ID (hash of the operation)
   * @returns true if duplicate, false otherwise
   */
  isDuplicate(documentId: string, operationId: string): boolean {
    const docOps = this.recentOps.get(documentId);

    if (!docOps) {
      // First operation for this document
      const newSet = new Set<string>();
      newSet.add(operationId);
      this.recentOps.set(documentId, newSet);

      // Schedule cleanup
      this.scheduleCleanup(documentId, operationId);

      return false;
    }

    if (docOps.has(operationId)) {
      // Duplicate operation
      return true;
    }

    // New operation
    docOps.add(operationId);

    // Schedule cleanup
    this.scheduleCleanup(documentId, operationId);

    return false;
  }

  /**
   * Schedule cleanup of an operation ID after TTL
   */
  private scheduleCleanup(documentId: string, operationId: string): void {
    setTimeout(() => {
      const docOps = this.recentOps.get(documentId);

      if (docOps) {
        docOps.delete(operationId);

        // If no more operations for this document, remove the document entry
        if (docOps.size === 0) {
          this.recentOps.delete(documentId);
        }
      }
    }, this.TTL);
  }

  /**
   * Generate operation ID from update data
   * Uses a simple hash of the update bytes
   */
  static generateOperationId(update: Uint8Array): string {
    // Simple hash function for operation ID
    let hash = 0;
    for (let i = 0; i < update.length; i++) {
      hash = (hash << 5) - hash + update[i];
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Clear all cached operations for a document
   */
  clearDocument(documentId: string): void {
    this.recentOps.delete(documentId);
  }

  /**
   * Clear all cached operations
   */
  clearAll(): void {
    this.recentOps.clear();
  }

  /**
   * Get the number of documents being tracked
   */
  getDocumentCount(): number {
    return this.recentOps.size;
  }

  /**
   * Get the number of operations being tracked for a document
   */
  getOperationCount(documentId: string): number {
    return this.recentOps.get(documentId)?.size || 0;
  }
}

// Export singleton instance
export const operationDeduplicator = new OperationDeduplicator();
