import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { unwrapProxyUrl } from '../utils/proxy';
import type { PlaybackDebugEntry } from '../hooks/useVideoPlayer';

interface DevStreamDebugOverlayProps {
    playerName: string;
    requestUrl: string;
    sourceLabel?: string;
    isBuffering: boolean;
    isReconnecting: boolean;
    reconnectAttempt: number;
    lastFailureReason: string | null;
    debugEntries: PlaybackDebugEntry[];
}

const getStatusColor = (status: PlaybackDebugEntry['status']) => {
    switch (status) {
        case 'loaded':
            return '#4ade80';
        case 'failed':
            return '#f87171';
        default:
            return '#facc15';
    }
};

const DevStreamDebugOverlay: React.FC<DevStreamDebugOverlayProps> = ({
    playerName,
    requestUrl,
    sourceLabel,
    isBuffering,
    isReconnecting,
    reconnectAttempt,
    lastFailureReason,
    debugEntries,
}) => {
    const upstreamUrl = unwrapProxyUrl(requestUrl);
    const isProxied = upstreamUrl !== requestUrl;

    return (
        <View pointerEvents="none" style={styles.container}>
            <Text style={styles.title}>DEV STREAM DEBUG</Text>
            <Text style={styles.meta}>
                {playerName}
                {sourceLabel ? ` | ${sourceLabel}` : ''}
                {isBuffering ? ' | buffering' : ''}
                {isReconnecting ? ` | reconnecting #${reconnectAttempt + 1}` : ''}
            </Text>

            <Text style={styles.label}>Requested URL</Text>
            <Text selectable style={styles.value}>
                {requestUrl}
            </Text>

            {isProxied && (
                <>
                    <Text style={styles.label}>Upstream URL</Text>
                    <Text selectable style={styles.value}>
                        {upstreamUrl}
                    </Text>
                </>
            )}

            <Text style={styles.label}>Last Failure</Text>
            <Text style={[styles.value, lastFailureReason ? styles.failedText : styles.okText]}>
                {lastFailureReason || 'No failure recorded'}
            </Text>

            <Text style={styles.label}>Recent Requests</Text>
            <ScrollView style={styles.log} contentContainerStyle={styles.logContent}>
                {debugEntries.length === 0 ? (
                    <Text style={styles.value}>No requests logged yet</Text>
                ) : (
                    debugEntries.map(entry => (
                        <View key={entry.id} style={styles.entry}>
                            <Text style={[styles.entryStatus, { color: getStatusColor(entry.status) }]}>
                                [{entry.status.toUpperCase()}]
                            </Text>
                            <Text style={styles.entryMeta}>
                                {entry.label} | try {entry.reconnectAttempt + 1}
                            </Text>
                            <Text selectable style={styles.entryUrl}>
                                {entry.uri}
                            </Text>
                            {entry.error ? (
                                <Text style={styles.entryError}>{entry.error}</Text>
                            ) : null}
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
};

export default React.memo(DevStreamDebugOverlay);

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        maxHeight: '48%',
        padding: 12,
        borderRadius: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
    },
    title: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 4,
    },
    meta: {
        color: '#cbd5e1',
        fontSize: 11,
        marginBottom: 10,
    },
    label: {
        color: '#94a3b8',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 6,
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    value: {
        color: '#e2e8f0',
        fontSize: 11,
    },
    okText: {
        color: '#4ade80',
    },
    failedText: {
        color: '#fda4af',
    },
    log: {
        marginTop: 6,
        maxHeight: 180,
    },
    logContent: {
        gap: 8,
        paddingBottom: 4,
    },
    entry: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255, 255, 255, 0.12)',
        paddingTop: 8,
    },
    entryStatus: {
        fontSize: 10,
        fontWeight: '700',
    },
    entryMeta: {
        color: '#cbd5e1',
        fontSize: 10,
        marginTop: 2,
    },
    entryUrl: {
        color: '#e2e8f0',
        fontSize: 10,
        marginTop: 2,
    },
    entryError: {
        color: '#fda4af',
        fontSize: 10,
        marginTop: 2,
    },
});
