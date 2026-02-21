/**
 * CallKeepService.ts
 *
 * Bridges react-native-callkeep (native call UI) with the app's WebRTC call flow.
 *
 * Flow:
 *  - Incoming call → callkeep.displayIncomingCall() → system shows native ringing screen
 *  - User answers natively → callkeep 'answerCall' event → we trigger WebRTC answer
 *  - User declines natively → callkeep 'endCall' event → we trigger decline flow
 *  - Call connected → callkeep.setCurrentCallActive()
 *  - Call ended → callkeep.endCall()
 */

import RNCallKeep from 'react-native-callkeep';
import { Platform } from 'react-native';

let currentCallUUID: string | null = null;

// ─── Setup ────────────────────────────────────────────────────────────────────

export function setupCallKeep() {
    const options = {
        ios: {
            appName: 'Munawwara Care',
        },
        android: {
            alertTitle: 'Permissions Required',
            alertDescription:
                'Munawwara Care needs access to your phone accounts to make and receive calls.',
            cancelButton: 'Cancel',
            okButton: 'OK',
            imageName: 'phone_account_icon',
            additionalPermissions: [],
            foregroundService: {
                channelId: 'incoming_call',
                channelName: 'Incoming Calls',
                notificationTitle: 'Munawwara Care is running in the background',
                notificationIcon: 'Path to the resource icon of the notification',
            },
        },
    };

    try {
        RNCallKeep.setup(options);
        RNCallKeep.setAvailable(true);
        console.log('[CallKeep] Setup complete');
    } catch (e) {
        console.error('[CallKeep] Setup failed:', e);
    }
}

// ─── Incoming Call ─────────────────────────────────────────────────────────────

/**
 * Call this when you receive an incoming call signal (socket or FCM).
 * Shows the native system call screen.
 */
export function displayIncomingCall(callerName: string, callerId: string): string {
    const callUUID = generateUUID();
    currentCallUUID = callUUID;

    console.log(`[CallKeep] Displaying incoming call from ${callerName} (${callerId}), UUID: ${callUUID}`);

    RNCallKeep.displayIncomingCall(
        callUUID,
        callerId,    // Handle (shown as phone number or ID)
        callerName,  // Caller name
        'generic',   // Handle type: 'number' | 'email' | 'generic'
        false        // hasVideo: false (audio only)
    );

    return callUUID;
}

// ─── Call Lifecycle ────────────────────────────────────────────────────────────

export function reportCallConnected() {
    if (currentCallUUID) {
        RNCallKeep.setCurrentCallActive(currentCallUUID);
        console.log('[CallKeep] Call marked as active:', currentCallUUID);
    }
}

export function endNativeCall() {
    if (currentCallUUID) {
        RNCallKeep.endCall(currentCallUUID);
        console.log('[CallKeep] Ended native call:', currentCallUUID);
        currentCallUUID = null;
    }
}

export function getCurrentCallUUID() {
    return currentCallUUID;
}

export function clearCurrentCall() {
    currentCallUUID = null;
}

// ─── Event Listeners ───────────────────────────────────────────────────────────

/**
 * Register all callkeep event handlers.
 * Pass your CallContext callbacks here.
 */
export function registerCallKeepListeners(callbacks: {
    onAnswer: (callUUID: string) => void;
    onDecline: (callUUID: string) => void;
    onEnd: (callUUID: string) => void;
}) {
    RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
        console.log('[CallKeep] Native answer:', callUUID);
        callbacks.onAnswer(callUUID);
    });

    RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
        console.log('[CallKeep] Native end/decline:', callUUID);
        // If call was never connected, it's a decline
        if (callUUID === currentCallUUID) {
            callbacks.onDecline(callUUID);
        } else {
            callbacks.onEnd(callUUID);
        }
    });

    RNCallKeep.addEventListener('didPerformDTMFAction', () => { }); // required stub
    RNCallKeep.addEventListener('didReceiveStartCallAction', () => { }); // required stub

    console.log('[CallKeep] Listeners registered');
}

export function removeCallKeepListeners() {
    RNCallKeep.removeEventListener('answerCall');
    RNCallKeep.removeEventListener('endCall');
    RNCallKeep.removeEventListener('didPerformDTMFAction');
    RNCallKeep.removeEventListener('didReceiveStartCallAction');
}

// ─── Utils ─────────────────────────────────────────────────────────────────────

function generateUUID(): string {
    // Simple UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
