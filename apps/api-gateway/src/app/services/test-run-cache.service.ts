import { Injectable } from '@nestjs/common';
import NodeCache from 'node-cache';
import { TestRunFileResultDto } from '@project-bubble/shared';

export interface CachedTestRunResult {
  sessionId: string;
  templateId: string;
  templateName: string;
  inputs: Record<string, unknown>;
  results: TestRunFileResultDto[];
  createdAt: Date;
}

/**
 * Singleton in-memory cache for ephemeral test run results.
 * TTL: 5 minutes (300 seconds)
 * Storage: NodeCache (in-memory, single-process)
 */
@Injectable()
export class TestRunCacheService {
  private readonly cache: NodeCache;

  constructor() {
    // Initialize with 5-minute TTL
    this.cache = new NodeCache({
      stdTTL: 300, // 5 minutes in seconds
      checkperiod: 60, // Check for expired keys every 60 seconds
      useClones: false, // Don't clone objects (performance optimization)
    });
  }

  /**
   * Store test run results in cache with sessionId as key.
   */
  set(sessionId: string, results: CachedTestRunResult): void {
    this.cache.set(sessionId, results);
  }

  /**
   * Retrieve test run results from cache.
   * Returns undefined if sessionId not found or expired.
   */
  get(sessionId: string): CachedTestRunResult | undefined {
    return this.cache.get<CachedTestRunResult>(sessionId);
  }

  /**
   * Delete test run results from cache (manual cleanup, not required with TTL).
   */
  delete(sessionId: string): void {
    this.cache.del(sessionId);
  }

  /**
   * Get cache statistics (for debugging/monitoring).
   */
  getStats(): NodeCache.Stats {
    return this.cache.getStats();
  }
}
