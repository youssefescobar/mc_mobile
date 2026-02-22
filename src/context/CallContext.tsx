import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { Alert, Vibration } from 'react-native';
import CallModal from '../components/CallModal';
import { socketService } from '../services/socket';
import InCallManager from 'react-native-incall-manager';
import notifee from '@notifee/react-native';

// WebRTC imports (conditional for expo go)
let mediaDevices: any = null;
let RTCPeerConnection: any = null;
let RTCSessionDescription: any = null;
let RTCIceCandidate: any = null;
let MediaStream: any = null;
let webrtcAvailable = false;

try {
    const webrtc = require('react-native-webrtc');
    mediaDevices = webrtc.mediaDevices;
    RTCPeerConnection = webrtc.RTCPeerConnection;
    RTCSessionDescription = webrtc.RTCSessionDescription;
    RTCIceCandidate = webrtc.RTCIceCandidate;
    MediaStream = webrtc.MediaStream;
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
    if (!context) {
        throw new Error('useCall must be used within a CallProvider');
    }
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

    // WebRTC connection state refs
    const remoteDescriptionSet = useRef(false);
    const iceCandidateQueue = useRef<any[]>([]);
    const pendingOffer = useRef<any>(null);

    // Socket listeners setup
    useEffect(() => {
        // We no longer rely on getSocket() being non-null here.
        // socketService will queue these listeners if socket isn't ready.

        const handleCallOffer = async ({ offer, from, callerInfo }: { offer: any; from: string; callerInfo?: { id: string; name: string; role: string } }) => {
            // Check if already in a call
            if (callState.isActive || callState.isIncoming || callState.isOutgoing) {
                console.log('Received call offer while busy');
                socketService.getSocket()?.emit('call-busy', { to: from });
                return;
            }

            console.log('Incoming call from:', from, callerInfo);
            const resolvedCaller = callerInfo || { id: from, name: 'Caller', role: 'Unknown' };

            setCallState({
                isActive: false,
                isIncoming: true,
                isOutgoing: false,
                isSpeakerOn: false,
                callStatus: 'ringing',
                remoteUser: resolvedCaller,
            });

            pendingOffer.current = offer;
            remoteDescriptionSet.current = false; // Reset for new call
            iceCandidateQueue.current = [];
        };

        const handleCallAnswer = async ({ answer }: { answer: any }) => {
            if (pc.current && callState.isOutgoing) {
                try {
                    await pc.current.setRemoteDescription(new RTCSessionDescription(answer));
                    remoteDescriptionSet.current = true;

                    // Process queued candidates
                    if (iceCandidateQueue.current.length > 0) {
                        console.log(`[CallContext] Processing ${iceCandidateQueue.current.length} queued candidates`);
                        for (const candidate of iceCandidateQueue.current) {
                            try {
                                await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                            } catch (e) {
                                console.error('Error adding queued ice candidate:', e);
                            }
                        }
                        iceCandidateQueue.current = [];
                    }

                    setCallState(prev => ({ ...prev, isActive: true, isOutgoing: false, isIncoming: false, callStatus: 'connected' }));
                } catch (e) {
                    console.error('Error setting remote description:', e);
                }
            }
        };

        const handleIceCandidate = async ({ candidate }: { candidate: any }) => {
            if (pc.current) {
                if (!remoteDescriptionSet.current) {
                    console.log('[CallContext] Queueing ICE candidate (remote description not set)');
                    iceCandidateQueue.current.push(candidate);
                } else {
                    try {
                        await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.error('Error adding ice candidate:', e);
                    }
                }
            }
        };

        const handleCallEnd = () => {
            cleanupCall();
        };

        const handleCallBusy = () => {
            console.log('Call declined - user is busy');
            setCallState(prev => ({ ...prev, callStatus: 'declined', isOutgoing: false }));
            setTimeout(() => cleanupCall(), 2000); // Show "declined" for 2 seconds
        };

        const handleCallDeclined = () => {
            console.log('Call declined by user');
            setCallState(prev => ({ ...prev, callStatus: 'declined', isOutgoing: false }));
            setTimeout(() => cleanupCall(), 2000);
        };

        socketService.onCallOffer(handleCallOffer);
        socketService.onCallAnswer(handleCallAnswer);
        socketService.onIceCandidate(handleIceCandidate);
        socketService.onCallEnd(handleCallEnd);

        // Listen for busy/declined events
        const socket = socketService.getSocket();
        if (socket) {
            socket.on('call-busy', handleCallBusy);
            socket.on('call-declined', handleCallDeclined);
        }

        return () => {
            socketService.offCallOffer(handleCallOffer);
            socketService.offCallAnswer(handleCallAnswer);
            socketService.offIceCandidate(handleIceCandidate);
            socketService.offCallEnd(handleCallEnd);

            const socket = socketService.getSocket();
            if (socket) {
                socket.off('call-busy', handleCallBusy);
                socket.off('call-declined', handleCallDeclined);
            }
        };
    }, [callState.isActive, callState.isIncoming, callState.isOutgoing]);

    const startCall = async (userId: string, userName: string, userRole?: string) => {
        if (!webrtcAvailable) {
            Alert.alert('Not Supported', 'Calls verify development build.');
            return;
        }

        console.log('[CallContext] Starting call to:', userId, userName);
        setCallState({
            isActive: false,
            isIncoming: false,
            isOutgoing: true,
            isSpeakerOn: false,
            callStatus: 'calling',
            remoteUser: { id: userId, name: userName, role: userRole },
        });

        // Reset refs for new call
        remoteDescriptionSet.current = false;
        iceCandidateQueue.current = [];

        // Set timeout for unreachable (30 seconds)
        const callTimeout = setTimeout(() => {
            if (callState.isOutgoing && !callState.isActive) {
                console.log('Call timeout - user unreachable');
                setCallState(prev => ({ ...prev, callStatus: 'unreachable', isOutgoing: false }));
                setTimeout(() => cleanupCall(), 2000);
            }
        }, 30000);

        setupPeerConnection(userId, true); // true = isCaller

        // Clear timeout if call connects
        return () => clearTimeout(callTimeout);
    };

    const answerCall = async () => {
        if (!callState.remoteUser) return;
        // Dismiss the Notifee incoming call notification
        notifee.cancelAllNotifications().catch(() => { });
        setCallState(prev => ({ ...prev, isActive: true, isIncoming: false, callStatus: 'connected' }));
        await setupPeerConnection(callState.remoteUser!.id, false);
    };

    const declineCall = () => {
        const socket = socketService.getSocket();
        if (socket && callState.remoteUser && callState.isIncoming) {
            // Emit call-declined event to notify the caller
            socket.emit('call-declined', { to: callState.remoteUser.id });
        }

        // Show declined status before cleaning up
        setCallState(prev => ({ ...prev, callStatus: 'declined', isIncoming: false }));
        setTimeout(() => cleanupCall(), 2000); // Show "declined" for 2 seconds
    };

    const handleIncomingCallFromNotification = (callerInfo: { id: string; name: string; role: string }, offer: any) => {
        console.log('[CallContext] Handling incoming call from notification:', callerInfo);
        setCallState({
            isActive: false,
            isIncoming: true,
            isOutgoing: false,
            isSpeakerOn: false,
            callStatus: 'ringing',
            remoteUser: callerInfo,
        });
        pendingOffer.current = offer;
    };

    const endCall = () => {
        const socket = socketService.getSocket();
        if (socket && callState.remoteUser) {
            socket.emit('call-end', { to: callState.remoteUser.id });
        }
        cleanupCall();
    };

    const cleanupCall = () => {
        try { (InCallManager as any).stopRingtone(); } catch (e) { /* ignore */ }
        Vibration.cancel(); // Stop background vibration
        // Dismiss any lingering Notifee call notification
        notifee.cancelAllNotifications().catch(() => { });
        if (pc.current) {
            pc.current.close();
            pc.current = null;
        }
        if (localStream) {
            localStream.getTracks().forEach((t: any) => t.stop());
            setLocalStream(null);
        }
        setRemoteStream(null);
        setCallState({
            isActive: false,
            isIncoming: false,
            isOutgoing: false,
            isSpeakerOn: false,
            callStatus: 'ended',
            remoteUser: null,
        });
        pendingOffer.current = null;
    };

    const setupPeerConnection = async (remoteId: string, isCaller: boolean) => {
        try {
            pc.current = new RTCPeerConnection(configuration);

            // Get Local Stream
            const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
            setLocalStream(stream);
            stream.getTracks().forEach((track: any) => pc.current.addTrack(track, stream));

            // Candidate handling
            pc.current.onicecandidate = (event: any) => {
                const socket = socketService.getSocket();
                if (event.candidate && socket) {
                    socket.emit('ice-candidate', { to: remoteId, candidate: event.candidate });
                }
            };

            // Stream handling
            if ('onaddstream' in pc.current) {
                pc.current.onaddstream = (event: any) => setRemoteStream(event.stream);
            } else if ('ontrack' in pc.current) {
                pc.current.ontrack = (event: any) => {
                    if (event.streams && event.streams[0]) setRemoteStream(event.streams[0]);
                };
            }

            if (isCaller) {
                const offer = await pc.current.createOffer();
                await pc.current.setLocalDescription(offer);
                console.log('[CallContext] Emitting call-offer to:', remoteId);
                socketService.getSocket()?.emit('call-offer', { to: remoteId, offer });

                // Update status to 'ringing' after call offer is sent
                setCallState(prev => ({ ...prev, callStatus: 'ringing' }));
            } else {
                // We are answering. We should have a pending offer.
                if (pendingOffer.current) {
                    console.log('[CallContext] Answering call from:', remoteId);
                    await pc.current.setRemoteDescription(new RTCSessionDescription(pendingOffer.current));
                    remoteDescriptionSet.current = true; // Mark remote description as set

                    // Process any queued candidates that arrived while processing offer
                    if (iceCandidateQueue.current.length > 0) {
                        console.log(`[CallContext] Processing ${iceCandidateQueue.current.length} queued candidates (Answer Side)`);
                        for (const candidate of iceCandidateQueue.current) {
                            try {
                                await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                            } catch (e) {
                                console.error('Error adding queued ice candidate:', e);
                            }
                        }
                        iceCandidateQueue.current = [];
                    }

                    const answer = await pc.current.createAnswer();
                    await pc.current.setLocalDescription(answer);
                    console.log('[CallContext] Emitting call-answer to:', remoteId);
                    socketService.getSocket()?.emit('call-answer', { to: remoteId, answer });
                }
            }

        } catch (e) {
            console.error('Setup peer connection error:', e);
            cleanupCall();
        }
    };

    // Toggle Mute Helper
    const toggleMute = () => {
        if (localStream) {
            const track = localStream.getAudioTracks()[0];
            if (track) track.enabled = !track.enabled;
            return !track.enabled; // returns isMuted
        }
        return false;
    };

    // Toggle Speaker
    const toggleSpeaker = () => {
        const newSpeakerState = !callState.isSpeakerOn;
        setCallState(prev => ({ ...prev, isSpeakerOn: newSpeakerState }));

        // Use InCallManager to actually route audio
        if (newSpeakerState) {
            InCallManager.setForceSpeakerphoneOn(true);
        } else {
            InCallManager.setForceSpeakerphoneOn(false);
        }
    };

    // Ringtone + Vibration: play when incoming, stop when no longer incoming
    useEffect(() => {
        if (callState.isIncoming && !callState.isActive) {
            console.log('[CallContext] Starting ringtone + vibration');
            try {
                (InCallManager as any).startRingtone('_BUNDLE_', false, '', 'alert');
            } catch (e) {
                console.log('[CallContext] startRingtone not supported:', e);
            }
            // Explicit vibration — InCallManager vibrate flag is unreliable on Android
            // Pattern: wait 0ms, vibrate 1s, pause 1s, repeat
            Vibration.vibrate([0, 1000, 1000], true);
        } else {
            try {
                (InCallManager as any).stopRingtone();
            } catch (e) { /* ignore */ }
            Vibration.cancel();
        }
    }, [callState.isIncoming, callState.isActive]);

    // Manage InCallManager lifecycle
    useEffect(() => {
        if (callState.isActive) {
            // Start audio session when call becomes active
            InCallManager.start({ media: 'audio' });
            // Default to earpiece
            InCallManager.setForceSpeakerphoneOn(false);
        } else if (!callState.isIncoming && !callState.isOutgoing) {
            // Stop audio session when call ends
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
            {/* Global Call UI */}
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
