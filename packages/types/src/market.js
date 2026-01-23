const MS_PER_SECOND = 1000;
export class BaseMarketProvider {
    config;
    lastRequestTime = 0;
    requestCount = 0;
    constructor(config) {
        this.config = config;
    }
    async rateLimitedFetch(fetcher) {
        if (!this.config.rateLimit)
            return fetcher();
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minInterval = MS_PER_SECOND / this.config.rateLimit;
        if (timeSinceLastRequest < minInterval) {
            const delay = minInterval - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        this.lastRequestTime = Date.now();
        this.requestCount++;
        return fetcher();
    }
    handleError(error, context) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw {
            provider: this.config.name,
            message: `${context}: ${errorMessage}`,
            code: error?.code,
            statusCode: error?.response?.status,
        };
    }
    get name() {
        return this.config.name;
    }
    get type() {
        return this.config.type;
    }
    get isEnabled() {
        return this.config.enabled;
    }
}
