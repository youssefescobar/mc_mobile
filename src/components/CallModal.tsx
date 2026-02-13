import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Lazy-load react-native-webrtc to prevent Expo Go crashes
// These will be null in Expo Go, and the component shows a fallback message
let RTCView: any = null;
let mediaDevices: any = null;
let RTCPeerConnection: any = null;
let RTCSessionDescription: any = null;
let RTCIceCandidate: any = null;
let webrtcAvailable = false;

try {
  const webrtc = require('react-native-webrtc');
  RTCView = webrtc.RTCView;
  mediaDevices = webrtc.mediaDevices;
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  webrtcAvailable = true;
} catch (e) {
  console.log('[CallModal] react-native-webrtc not available (Expo Go). Calls require a development build.');
}

interface CallModalProps {
  visible: boolean;
  onClose: () => void;
  isCaller: boolean;
  remoteUser: { id: string; name: string };
  socket: any;
}

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const CallModal: React.FC<CallModalProps> = ({ visible, onClose, isCaller, remoteUser, socket }) => {
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const pc = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Call duration timer
  useEffect(() => {
    if (callActive) {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callActive]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  useEffect(() => {
    if (!visible) return;
    if (!webrtcAvailable) return;
    startCall();
    return () => cleanup();
    // eslint-disable-next-line
  }, [visible]);

  const startCall = async () => {
    if (!webrtcAvailable || !RTCPeerConnection || !mediaDevices) return;

    try {
      pc.current = new RTCPeerConnection(configuration);
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(stream);
      stream.getTracks().forEach((track: any) => pc.current?.addTrack(track, stream));

      // Use legacy event handlers for react-native-webrtc compatibility
      if ('onaddstream' in pc.current) {
        pc.current.onaddstream = (event: any) => {
          setRemoteStream(event.stream);
        };
      } else if ('ontrack' in pc.current) {
        pc.current.ontrack = (event: any) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
          }
        };
      }

      pc.current.onicecandidate = (event: any) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { to: remoteUser.id, candidate: event.candidate });
        }
      };

      if (isCaller) {
        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);
        socket.emit('call-offer', { to: remoteUser.id, offer });
      }
    } catch (error) {
      console.error('[CallModal] Error starting call:', error);
    }
  };

  const cleanup = () => {
    pc.current?.close();
    pc.current = null;
    localStream?.getTracks?.().forEach?.((track: any) => track.stop?.());
    setLocalStream(null);
    setRemoteStream(null);
    setCallActive(false);
    setCallDuration(0);
    setIsMuted(false);
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks?.()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const handleEndCall = () => {
    socket?.emit('call-end', { to: remoteUser.id });
    cleanup();
    onClose();
  };

  useEffect(() => {
    if (!socket) return;

    const handleAnswer = async ({ answer }: any) => {
      if (pc.current && RTCSessionDescription) {
        await pc.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCallActive(true);
      }
    };

    const handleOffer = async ({ offer, from }: any) => {
      if (pc.current && RTCSessionDescription) {
        await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);
        socket.emit('call-answer', { to: from, answer });
        setCallActive(true);
      }
    };

    const handleIceCandidate = async ({ candidate }: any) => {
      if (pc.current && candidate && RTCIceCandidate) {
        try {
          await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) { }
      }
    };

    const handleCallEnd = () => {
      cleanup();
      onClose();
    };

    socket.on('call-answer', handleAnswer);
    socket.on('call-offer', handleOffer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('call-end', handleCallEnd);

    return () => {
      socket.off('call-answer', handleAnswer);
      socket.off('call-offer', handleOffer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('call-end', handleCallEnd);
    };
  }, [socket]);

  // Fallback UI when WebRTC is not available (Expo Go)
  if (!webrtcAvailable) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.container}>
          <View style={styles.callCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{remoteUser.name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.userName}>{remoteUser.name}</Text>
            <View style={styles.unavailableBadge}>
              <Ionicons name="warning-outline" size={16} color="#F59E0B" />
              <Text style={styles.unavailableText}>Calls require a development build</Text>
            </View>
            <Text style={styles.unavailableHint}>
              This feature uses WebRTC which is not supported in Expo Go.
              Please create a development build to use voice calls.
            </Text>
            <TouchableOpacity style={styles.endButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="white" />
              <Text style={styles.endButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.container}>
        <View style={styles.callCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{remoteUser.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.userName}>{remoteUser.name}</Text>
          <Text style={styles.statusText}>
            {callActive ? formatDuration(callDuration) : isCaller ? 'Calling...' : 'Incoming Call'}
          </Text>

          {callActive && (
            <View style={styles.callIndicator}>
              <View style={styles.callDot} />
              <Text style={styles.callIndicatorText}>Connected</Text>
            </View>
          )}

          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.controlButton, isMuted && styles.controlButtonActive]}
              onPress={toggleMute}
            >
              <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="white" />
              <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.endButton} onPress={handleEndCall}>
              <Ionicons name="call" size={28} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  callCard: {
    alignItems: 'center',
    width: '100%',
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: 'white',
  },
  userName: {
    color: 'white',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 16,
    marginBottom: 16,
  },
  callIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 40,
  },
  callDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  callIndicatorText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
    marginTop: 20,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  controlButtonActive: {
    backgroundColor: '#F59E0B',
  },
  controlLabel: {
    color: 'white',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  endButton: {
    backgroundColor: '#EF4444',
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  endButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
    marginTop: 4,
  },
  unavailableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  unavailableText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
  },
  unavailableHint: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
});

export default CallModal;
