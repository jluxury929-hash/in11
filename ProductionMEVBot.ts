// ProductionMEVBot.ts (Updated setupWsConnectionListeners)

private setupWsConnectionListeners(): void {
    if (!this.wsProvider) return;

    // We must ensure the error handler is attached first
    this.wsProvider.on('error', (error: Error) => {
        logger.error(`[WSS] Provider Event Error: ${error.message}`);
        // Consider destroying the provider here if the error is fatal
    });
    
    this.wsProvider.on('open', () => {
        logger.info("WSS Connection established successfully! Monitoring mempool...");
    });
    
    // Attach the pending listener once the connection is open
    this.wsProvider.on('pending', this.handlePendingTransaction.bind(this));
    
    this.wsProvider.on('close', (code: number, reason: string) => {
        logger.warn(`[WSS] Connection closed. Code: ${code}, Reason: ${reason}`);
        // Add reconnection logic here if needed
    });
}
