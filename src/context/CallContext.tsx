import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { Alert, AppState, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CallModal from '../components/CallModal';
import { socketService } from '../services/socket';
import InCallManager from 'react-native-incall-manager';
import notifee from '@notifee/react-native';
import { showIncomingCallNotification, dismissCallNotification } from '../services/BackgroundNotificationTask';

// WebRTC imports (conditional for expo go)
let mediaDevices: any = null;
let RTCPeerConnection: any = null;
let RTCSessionDescription: any = null;
let RTCIceCandidate: any = null;
let webrtcAvailable = false;

try {
    const webrtc = require('react-native-webrtc');
    mediaDevices = webrtc.mediaDevices;
    RTCPeerConnection = webrtc.RTCPeerConnection;
    RTCSessionDescription = webrtc.RTCSessionDescription;
    RTCIceCandidate = webrtc.RTCIceCandidate;
    webrtcAvailable = true;
} catch (e) {
    console.log('[CallContext] WebRTC not available (Expo Go?)');
}

interface CallContextType {
    startCall: (userId: string, userName: string, userRole?: string) => void;
    endCall: () => void;
    answerCall: () => void;
    declineCall: () => void;
    toggleSpeaker: () => void;
    handleIncomingCallFromNotification: (callerInfo: { id: string; name: string; role: string }, offer: any) => void;
    callState: {
        isActive: boolean;
        isIncoming: boolean;
        isOutgoing: boolean;
        isSpeakerOn: boolean;
        callStatus: 'calling' | 'ringing' | 'connected' | 'declined' | 'unreachable' | 'ended' | null;
        remoteUser: { id: string; name: string; role?: string } | null;
    };
    webrtcAvailable: boolean;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) throw new Error('useCall must be used within a CallProvider');
    return context;
};

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [callState, setCallState] = useState({
        isActive: false,
        isIncoming: false,
        isOutgoing: false,
        isSpeakerOn: false,
        callStatus: null as 'calling' | 'ringing' | 'connected' | 'declined' | 'unreachable' | 'ended' | null,
        remoteUser: null as { id: string; name: string; role?: string } | null,
    });

    const pc = useRef<any>(null);
    const [localStream, setLocalStream] = useState<any>(null);
    const [remoteStream, setRemoteStream] = useState<any>(null);

    // Call state refs — used in event handlers (closures) to avoid stale state
    const pendingOffer = useRef<any>(null);
    const remoteDescriptionSet = useRef(false);
    const iceCandidateQueue = useRef<any[]>([]);
    // Mirrors callState.remoteUser so answerCall/declineCall always have the current value
    const remoteUserRef = useRef<{ id: string; name: string; role?: string } | null>(null);

    // Guard: prevents double-handling a single call offer (socket + FCM race)
    const isHandlingCall = useRef(false);

    // ── Socket event handlers (mount once, use refs for state) ─────────────────
    useEffect(() => {
        const handleCallOffer = async ({
            offer,
            from,
            callerInfo,
        }: {
            offer: any;
            from: string;
            callerInfo?: { id: string; name: string; role: string };
        }) => {
            // Deduplication guard — ignore if already handling a call
            if (isHandlingCall.current) {
                console.log('[CallContext] Already handling a call — ignoring duplicate call-offer');
                socketService.getSocket()?.emit('call-busy', { to: from });
                return;
            }

            console.log('[CallContext] Incoming call-offer from:', from, callerInfo);

            isHandlingCall.current = true;
            const resolvedCaller = callerInfo || { id: from, name: 'Caller', role: 'Unknown' };

            pendingOffer.current = offer;
            remoteDescriptionSet.current = false;
            iceCandidateQueue.current = [];
            remoteUserRef.current = resolvedCaller;

            setCallState({
                isActive: false,
                isIncoming: true,
                isOutgoing: false,
                isSpeakerOn: false,
                callStatus: 'ringing',
                remoteUser: resolvedCaller,
            });

            // If app is backgrounded, show a Notifee notification so the user
            // can Answer / Decline without opening the app first.
            // When the app is in the foreground, the CallModal will appear instead.
            const appState = AppState.currentState;
            if (appState !== 'active') {
                console.log('[CallContext] App is backgrounded — showing Notifee incoming call notification');
                try {
                    await showIncomingCallNotification(
                        resolvedCaller.name,
                        resolvedCaller.role,
                        resolvedCaller.id,
                        typeof offer === 'string' ? offer : JSON.stringify(offer)
                    );
                } catch (e) {
                    console.error('[CallContext] Failed to show Notifee notification:', e);
                }
            }
        };

        const handleCallAnswer = async ({ answer }: { answer: any }) => {
            if (!pc.current) return;

            // Guard: only process answer when we're in have-local-offer state.
            // This prevents the "Called in wrong state: stable" error caused by
            // stale duplicate listeners firing a second time after the call is established.
            const sigState = pc.current.signalingState;
            if (sigState !== 'have-local-offer') {
                console.log(`[CallContext] Ignoring call-answer in wrong signaling state: ${sigState}`);
                return;
            }
            try {
                await pc.current.setRemoteDescription(new RTCSessionDescription(answer));
                remoteDescriptionSet.current = true;

                for (const candidate of iceCandidateQueue.current) {
                    try {
                        await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.error('[CallContext] Error adding queued ice candidate:', e);
                    }
                }
                iceCandidateQueue.current = [];

                setCallState(prev => ({
                    ...prev,
                    isActive: true,
                    isOutgoing: false,
                    isIncoming: false,
                    callStatus: 'connected',
                }));
            } catch (e) {
                console.error('[CallContext] Error setting remote description:', e);
            }
        };

        const handleIceCandidate = async ({ candidate }: { candidate: any }) => {
            if (pc.current) {
                if (!remoteDescriptionSet.current) {
                    iceCandidateQueue.current.push(candidate);
                } else {
                    try {
                        await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.error('[CallContext] Error adding ice candidate:', e);
                    }
                }
            }
        };

        const handleCallEnd = () => {
            console.log('[CallContext] Received call-end');
            cleanupCall();
        };

        const handleCallBusy = () => {
            console.log('[CallContext] Call busy');
            setCallState(prev => ({ ...prev, callStatus: 'declined', isOutgoing: false }));
            setTimeout(() => cleanupCall(), 2000);
        };

        const handleCallDeclined = () => {
            console.log('[CallContext] Call declined');
            setCallState(prev => ({ ...prev, callStatus: 'declined', isOutgoing: false }));
            setTimeout(() => cleanupCall(), 2000);
        };

        // call-cancel: caller hung up while ringing — dismiss notification + cleanup
        const handleCallCancel = () => {
            console.log('[CallContext] Call cancelled by caller');
            dismissCallNotification();
            cleanupCall();
        };

        socketService.onCallOffer(handleCallOffer);
        socketService.onCallAnswer(handleCallAnswer);
        socketService.onIceCandidate(handleIceCandidate);
        socketService.onCallEnd(handleCallEnd);
        // These three use the queue-aware wrappers so they register even if
        // socket is null at mount time (which it almost always is).
        socketService.onCallBusy(handleCallBusy);
        socketService.onCallDeclined(handleCallDeclined);
        socketService.onCallCancel(handleCallCancel);

        return () => {
            socketService.offCallOffer(handleCallOffer);
            socketService.offCallAnswer(handleCallAnswer);
            socketService.offIceCandidate(handleIceCandidate);
            socketService.offCallEnd(handleCallEnd);
            socketService.offCallBusy(handleCallBusy);
            socketService.offCallDeclined(handleCallDeclined);
            socketService.offCallCancel(handleCallCancel);
        };
    }, []); // ← mount once — handlers use refs, NOT state

    // ── Background decline recovery ────────────────────────────────────────────
    // When the user taps "Decline" on a Notifee notification while the app is
    // backgrounded, the background event handler (index.ts) stores DECLINED_CALL
    // in AsyncStorage but cannot reset CallContext state (different execution context).
    // This effect watches for the app returning to foreground and cleans up.
    useEffect(() => {
        const sub = AppState.addEventListener('change', async (nextState) => {
            if (nextState === 'active') {
                try {
                    const declinedCallerId = await AsyncStorage.getItem('DECLINED_CALL');
                    if (declinedCallerId) {
                        await AsyncStorage.removeItem('DECLINED_CALL');
                        console.log('[CallContext] Background decline detected — cleaning up call state');
                        // Also emit via socket so the caller sees declined (belt + suspenders
                        // alongside the REST call already made by the background handler).
                        socketService.getSocket()?.emit('call-declined', { to: declinedCallerId });
                        cleanupCall();
                    }
                } catch (e) {
                    console.error('[CallContext] Error checking DECLINED_CALL:', e);
                }
            }
        });
        return () => sub.remove();
    }, []); // mount once — cleanupCall uses refs, safe

    // ── Call actions ───────────────────────────────────────────────────────────

    const startCall = async (userId: string, userName: string, userRole?: string) => {
        if (!webrtcAvailable) {
            Alert.alert('Not Supported', 'Calls require a development build.');
            return;
        }

        console.log('[CallContext] Starting call to:', userId, userName);
        isHandlingCall.current = true;

        setCallState({
            isActive: false,
            isIncoming: false,
            isOutgoing: true,
            isSpeakerOn: false,
            callStatus: 'calling',
            remoteUser: { id: userId, name: userName, role: userRole },
        });

        remoteDescriptionSet.current = false;
        iceCandidateQueue.current = [];
        remoteUserRef.current = { id: userId, name: userName, role: userRole };

        // Timeout: 30 s with no answer → unreachable
        const callTimeoutId = setTimeout(() => {
            setCallState(prev => {
                if (prev.isOutgoing && !prev.isActive) {
                    console.log('[CallContext] Call timeout — unreachable');
                    // Signal cancel to recipient so their notification can be dismissed
                    socketService.getSocket()?.emit('call-cancel', { to: userId });
                    setTimeout(() => cleanupCall(), 2000);
                    return { ...prev, callStatus: 'unreachable', isOutgoing: false };
                }
                return prev;
            });
        }, 30000);

        // Store the timeout ref so we can clear it on answer/decline
        timeoutRef.current = callTimeoutId;

        setupPeerConnection(userId, true);
    };

    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const answerCall = async () => {
        if (!pendingOffer.current) {
            console.warn('[CallContext] answerCall called but no pending offer');
            return;
        }
        // Dismiss any Notifee notification (if answered via in-app button)
        await dismissCallNotification();

        // Use ref to get the current remote user (avoids stale closure issue)
        const remoteUserId = remoteUserRef.current?.id;
        setCallState(prev => ({ ...prev, isActive: true, isIncoming: false, callStatus: 'connected' }));

        if (remoteUserId) {
            await setupPeerConnection(remoteUserId, false);
        }
    };

    const declineCall = () => {
        const socket = socketService.getSocket();
        const remoteId = remoteUserRef.current?.id;
        if (socket && remoteId) {
            socket.emit('call-declined', { to: remoteId });
        }
        dismissCallNotification();
        setCallState(prev => ({ ...prev, callStatus: 'declined', isIncoming: false }));
        setTimeout(() => cleanupCall(), 2000);
    };

    // Called by App.tsx Notifee foreground handler (answer tap from notification)
    // or from index.ts when restoring a pending call after app launch from killed
    const handleIncomingCallFromNotification = (
        callerInfo: { id: string; name: string; role: string },
        offer: any
    ) => {
        if (isHandlingCall.current) {
            console.log('[CallContext] handleIncomingCallFromNotification — already handling, ignoring');
            return;
        }
        console.log('[CallContext] Restoring incoming call from notification:', callerInfo);
        isHandlingCall.current = true;

        const parsedOffer = typeof offer === 'string' ? JSON.parse(offer) : offer;
        pendingOffer.current = parsedOffer;
        remoteDescriptionSet.current = false;
        iceCandidateQueue.current = [];
        remoteUserRef.current = callerInfo;

        setCallState({
            isActive: false,
            isIncoming: true,
            isOutgoing: false,
            isSpeakerOn: false,
            callStatus: 'ringing',
            remoteUser: callerInfo,
        });
    };

    const endCall = () => {
        const socket = socketService.getSocket();
        if (socket && remoteUserRef.current) {
            socket.emit('call-end', { to: remoteUserRef.current.id });
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        cleanupCall();
    };

    const cleanupCall = () => {
        try { (InCallManager as any).stopRingtone(); } catch (_) { }
        Vibration.cancel();
        dismissCallNotification();

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (pc.current) {
            pc.current.close();
            pc.current = null;
        }
        remoteUserRef.current = null;
        if (localStream) {
            localStream.getTracks().forEach((t: any) => t.stop());
            setLocalStream(null);
        }
        setRemoteStream(null);
        isHandlingCall.current = false;
        pendingOffer.current = null;
        remoteDescriptionSet.current = false;
        iceCandidateQueue.current = [];

        setCallState({
            isActive: false,
            isIncoming: false,
            isOutgoing: false,
            isSpeakerOn: false,
            callStatus: 'ended',
            remoteUser: null,
        });
    };

    const setupPeerConnection = async (remoteId: string, isCaller: boolean) => {
        try {
            pc.current = new RTCPeerConnection(configuration);

            const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
            setLocalStream(stream);
            stream.getTracks().forEach((track: any) => pc.current.addTrack(track, stream));

            pc.current.onicecandidate = (event: any) => {
                const socket = socketService.getSocket();
                if (event.candidate && socket) {
                    socket.emit('ice-candidate', { to: remoteId, candidate: event.candidate });
                }
            };

            if ('onaddstream' in pc.current) {
                pc.current.onaddstream = (event: any) => setRemoteStream(event.stream);
            } else if ('ontrack' in pc.current) {
                pc.current.ontrack = (event: any) => {
                    if (event.streams?.[0]) setRemoteStream(event.streams[0]);
                };
            }

            if (isCaller) {
                const offer = await pc.current.createOffer();
                await pc.current.setLocalDescription(offer);
                console.log('[CallContext] Emitting call-offer to:', remoteId);
                socketService.getSocket()?.emit('call-offer', { to: remoteId, offer });
                setCallState(prev => ({ ...prev, callStatus: 'ringing' }));
            } else {
                if (pendingOffer.current) {
                    console.log('[CallContext] Answering call from:', remoteId);
                    await pc.current.setRemoteDescription(new RTCSessionDescription(pendingOffer.current));
                    remoteDescriptionSet.current = true;

                    for (const candidate of iceCandidateQueue.current) {
                        try {
                            await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (e) {
                            console.error('[CallContext] Error adding queued candidate (answer side):', e);
                        }
                    }
                    iceCandidateQueue.current = [];

                    const answer = await pc.current.createAnswer();
                    await pc.current.setLocalDescription(answer);
                    console.log('[CallContext] Emitting call-answer to:', remoteId);
                    socketService.getSocket()?.emit('call-answer', { to: remoteId, answer });
                } else {
                    console.error('[CallContext] No pending offer found when trying to answer');
                    cleanupCall();
                }
            }
        } catch (e) {
            console.error('[CallContext] setupPeerConnection error:', e);
            cleanupCall();
        }
    };

    const toggleMute = () => {
        if (localStream) {
            const track = localStream.getAudioTracks()[0];
            if (track) track.enabled = !track.enabled;
            return !track?.enabled;
        }
        return false;
    };

    const toggleSpeaker = () => {
        const newVal = !callState.isSpeakerOn;
        setCallState(prev => ({ ...prev, isSpeakerOn: newVal }));
        InCallManager.setForceSpeakerphoneOn(newVal);
    };

    // ── Ringtone + vibration ────────────────────────────────────────────────────
    useEffect(() => {
        if (callState.isIncoming && !callState.isActive) {
            // Only ring locally when app is in foreground
            // (backgrounded → ringtone comes from the Notifee notification sound)
            const appState = AppState.currentState;
            if (appState === 'active') {
                try {
                    (InCallManager as any).startRingtone('_BUNDLE_', false, '', 'alert');
                } catch (e) {
                    console.log('[CallContext] startRingtone not supported:', e);
                }
                Vibration.vibrate([0, 1000, 1000], true);
            }
        } else {
            try { (InCallManager as any).stopRingtone(); } catch (_) { }
            Vibration.cancel();
        }
    }, [callState.isIncoming, callState.isActive]);

    // ── InCallManager lifecycle ─────────────────────────────────────────────────
    useEffect(() => {
        if (callState.isActive) {
            InCallManager.start({ media: 'audio' });
            InCallManager.setForceSpeakerphoneOn(false);
        } else if (!callState.isIncoming && !callState.isOutgoing) {
            InCallManager.stop();
        }
    }, [callState.isActive, callState.isIncoming, callState.isOutgoing]);

    return (
        <CallContext.Provider value={{
            startCall,
            endCall,
            answerCall,
            declineCall,
            toggleSpeaker,
            handleIncomingCallFromNotification,
            callState,
            webrtcAvailable,
        }}>
            {children}
            {(callState.isIncoming || callState.isOutgoing || callState.isActive ||
                callState.callStatus === 'declined' || callState.callStatus === 'unreachable') && (
                    <CallModal
                        visible={true}
                        onClose={endCall}
                        isCaller={callState.isOutgoing}
                        remoteUser={callState.remoteUser || { id: 'unknown', name: 'Unknown' }}
                        active={callState.isActive}
                        incoming={callState.isIncoming}
                        isSpeakerOn={callState.isSpeakerOn}
                        callStatus={callState.callStatus}
                        onAnswer={answerCall}
                        onHangup={endCall}
                        onDecline={declineCall}
                        localStream={localStream}
                        remoteStream={remoteStream}
                        webrtcAvailable={webrtcAvailable}
                        toggleMute={toggleMute}
                        toggleSpeaker={toggleSpeaker}
                        startCall={() => { }}
                    />
                )}
        </CallContext.Provider>
    );
};
