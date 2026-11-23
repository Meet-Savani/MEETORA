export const normalizeAmenities = (rawAmenities) => {
    if (!rawAmenities) return [];
    let list = [];
    if (Array.isArray(rawAmenities)) {
        list = rawAmenities.flatMap((a) => {
            if (typeof a === 'string') {
                const trimmed = a.trim();
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    try {
                        const parsed = JSON.parse(trimmed);
                        return Array.isArray(parsed) ? parsed : [trimmed];
                    } catch {
                        return trimmed.split(',');
                    }
                }
                return trimmed.split(',');
            }
            return a ? [String(a)] : [];
        });
    } else if (typeof rawAmenities === 'string') {
        const trimmed = rawAmenities.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed);
                list = Array.isArray(parsed) ? parsed : [trimmed];
            } catch {
                list = trimmed.split(',');
            }
        } else {
            list = trimmed.split(',');
        }
    }
    return list
        .map((item) => String(item || '').trim())
        .filter(Boolean);
};
