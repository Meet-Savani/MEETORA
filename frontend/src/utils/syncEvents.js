/**
 * Shared synchronization event emitter and subscriber.
 * Uses BroadcastChannel and window storage events to propagate real-time
 * mutation notifications across tabs and dashboard panels instantly without delays.
 */

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('meetora_realtime_sync') : null;

export const broadcastSync = (type, payload = {}) => {
    try {
        const eventData = { type, payload, timestamp: Date.now() };

        if (channel) {
            channel.postMessage(eventData);
        }

        // Trigger on current window for same-tab subscribers
        window.dispatchEvent(new CustomEvent('meetora_sync_event', { detail: eventData }));

        // Update localStorage to trigger 'storage' event across other tabs
        localStorage.setItem('meetora_sync_trigger', JSON.stringify(eventData));
    } catch (e) {
        // silent failover
    }
};

export const subscribeSync = (callback) => {
    const handleChannel = (e) => {
        if (e && e.data) callback(e.data);
    };

    const handleLocal = (e) => {
        if (e && e.detail) callback(e.detail);
    };

    const handleStorage = (e) => {
        if (e.key === 'meetora_sync_trigger' && e.newValue) {
            try {
                callback(JSON.parse(e.newValue));
            } catch {
                // ignore parse error
            }
        }
    };

    if (channel) {
        channel.addEventListener('message', handleChannel);
    }
    window.addEventListener('meetora_sync_event', handleLocal);
    window.addEventListener('storage', handleStorage);

    return () => {
        if (channel) {
            channel.removeEventListener('message', handleChannel);
        }
        window.removeEventListener('meetora_sync_event', handleLocal);
        window.removeEventListener('storage', handleStorage);
    };
};
