/**
 * Offline Cache Service for Sherlock Requests
 * 
 * Caches requests when offline and syncs when back online
 */

interface CachedRequest {
  id: string;
  type: 'case' | 'update' | 'location';
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
}

const CACHE_KEY = 'kumbh_offline_cache';
const MAX_RETRY = 3;

class OfflineCacheService {
  private cache: CachedRequest[] = [];
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;

  constructor() {
    this.loadCache();
    this.setupEventListeners();
  }

  /**
   * Load cache from localStorage
   */
  private loadCache() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        this.cache = JSON.parse(cached);
        console.log(`📦 Loaded ${this.cache.length} cached requests`);
      }
    } catch (error) {
      console.error('Failed to load cache:', error);
      this.cache = [];
    }
  }

  /**
   * Save cache to localStorage
   */
  private saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(this.cache));
    } catch (error) {
      console.error('Failed to save cache:', error);
    }
  }

  /**
   * Setup online/offline event listeners
   */
  private setupEventListeners() {
    window.addEventListener('online', () => {
      console.log('🌐 Network back online!');
      this.isOnline = true;
      this.syncCachedRequests();
    });

    window.addEventListener('offline', () => {
      console.log('📴 Network went offline!');
      this.isOnline = false;
    });
  }

  /**
   * Add request to cache
   */
  addToCache(request: {
    type: 'case' | 'update' | 'location';
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    data: any;
  }): string {
    const cachedRequest: CachedRequest = {
      id: `cache-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...request,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    this.cache.push(cachedRequest);
    this.saveCache();

    console.log(`💾 Cached ${request.type} request:`, cachedRequest.id);

    // If online, try to sync immediately
    if (this.isOnline) {
      this.syncCachedRequests();
    }

    return cachedRequest.id;
  }

  /**
   * Get all cached requests
   */
  getCachedRequests(): CachedRequest[] {
    return [...this.cache];
  }

  /**
   * Get pending requests count
   */
  getPendingCount(): number {
    return this.cache.filter(r => r.status === 'pending').length;
  }

  /**
   * Sync all cached requests
   */
  async syncCachedRequests(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;
    console.log(`🔄 Syncing ${this.cache.length} cached requests...`);

    const pendingRequests = this.cache.filter(r => r.status === 'pending');

    for (const request of pendingRequests) {
      try {
        request.status = 'syncing';
        this.saveCache();

        const response = await fetch(request.endpoint, {
          method: request.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: request.method !== 'GET' ? JSON.stringify(request.data) : undefined,
        });

        if (response.ok) {
          request.status = 'synced';
          console.log(`✅ Synced request ${request.id}`);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error(`❌ Failed to sync request ${request.id}:`, error);
        request.retryCount++;

        if (request.retryCount >= MAX_RETRY) {
          request.status = 'failed';
          console.error(`🚫 Request ${request.id} failed after ${MAX_RETRY} retries`);
        } else {
          request.status = 'pending';
        }
      }

      this.saveCache();
    }

    // Clean up synced requests (keep failed ones for inspection)
    this.cache = this.cache.filter(r => r.status !== 'synced');
    this.saveCache();

    this.syncInProgress = false;
    console.log(`✅ Sync complete. ${this.cache.length} requests remaining in cache.`);
  }

  /**
   * Clear all cached requests
   */
  clearCache() {
    this.cache = [];
    this.saveCache();
    console.log('🗑️ Cache cleared');
  }

  /**
   * Clear only synced requests
   */
  clearSyncedRequests() {
    this.cache = this.cache.filter(r => r.status !== 'synced');
    this.saveCache();
  }

  /**
   * Retry a failed request
   */
  async retryRequest(requestId: string): Promise<boolean> {
    const request = this.cache.find(r => r.id === requestId);
    if (!request) {
      return false;
    }

    request.status = 'pending';
    request.retryCount = 0;
    this.saveCache();

    await this.syncCachedRequests();
    return true;
  }

  /**
   * Get network status
   */
  isNetworkOnline(): boolean {
    return this.isOnline;
  }
}

export const offlineCacheService = new OfflineCacheService();

/**
 * Wrapper for fetch that automatically caches when offline
 */
export async function cachedFetch(
  url: string,
  options: RequestInit & { cacheType?: 'case' | 'update' | 'location' } = {}
): Promise<Response> {
  const { cacheType, ...fetchOptions } = options;

  // Try to make the request
  if (navigator.onLine) {
    try {
      const response = await fetch(url, fetchOptions);
      return response;
    } catch (error) {
      console.warn('Fetch failed, falling back to cache:', error);
    }
  }

  // If offline or fetch failed, cache the request
  if (cacheType && fetchOptions.method && fetchOptions.method !== 'GET') {
    offlineCacheService.addToCache({
      type: cacheType,
      endpoint: url,
      method: fetchOptions.method as any,
      data: fetchOptions.body ? JSON.parse(fetchOptions.body as string) : null,
    });

    // Return a mock successful response
    return new Response(
      JSON.stringify({
        success: true,
        cached: true,
        message: 'Request cached and will sync when online',
      }),
      {
        status: 202, // Accepted
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  throw new Error('Network unavailable and request cannot be cached');
}
