import React, { useEffect, useState, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Props updated to be presentational
interface CallModalProps {
  visible: boolean;
  onClose: () => void;
  isCaller: boolean;
  remoteUser: { id: string; name: string; role?: string };

  // State from Context
  active: boolean;
  incoming: boolean;
  webrtcAvailable: boolean;
  isSpeakerOn?: boolean;
  callStatus?: 'calling' | 'ringing' | 'connected' | 'declined' | 'unreachable' | 'ended' | null;

  // Actions
  onAnswer: () => void;
  onHangup: () => void;
  onDecline?: () => void;
  toggleMute?: () => boolean;
  toggleSpeaker?: () => void;

  // Streams
  localStream?: any;
  remoteStream?: any;

  // Legacy prop for compatibility
  startCall?: () => void;
}

const CallModal: React.FC<CallModalProps> = ({
  visible,
  onClose,
  isCaller,
  remoteUser,
  active,
  incoming,
  webrtcAvailable,
  isSpeakerOn = false,
  callStatus = null,
  onAnswer,
  onHangup,
  onDecline,
  toggleMute,
  toggleSpeaker,
  localStream,
  remoteStream,
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer logic
  useEffect(() => {
    if (active) {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleToggleMute = () => {
    if (toggleMute) {
      const newMuted = toggleMute();
      setIsMuted(newMuted);
    }
  };

  if (!visible) return null;

  // Fallback if WebRTC not available
  if (!webrtcAvailable) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.container}>
          <View style={styles.callCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{remoteUser.name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.userName}>{remoteUser.name}</Text>
            {remoteUser.role && <Text style={styles.userRole}>{remoteUser.role}</Text>}
            <View style={styles.unavailableBadge}>
              <Ionicons name="warning-outline" size={16} color="#F59E0B" />
              <Text style={styles.unavailableText}>Calls require a development build</Text>
            </View>
            <TouchableOpacity style={styles.endButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="white" />
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
          {/* AVATAR */}
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{remoteUser.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.userName}>{remoteUser.name}</Text>
          {remoteUser.role && <Text style={styles.userRole}>{remoteUser.role}</Text>}

          {/* STATUS TEXT */}
          <Text style={styles.statusText}>
            {callStatus === 'declined'
              ? 'Call Declined'
              : callStatus === 'unreachable'
                ? 'Unreachable'
                : callStatus === 'connected'
                  ? formatDuration(callDuration)
                  : callStatus === 'ringing'
                    ? 'Ringing...'
                    : incoming
                      ? 'Incoming Call...'
                      : 'Calling...'}
          </Text>

          {/* CONNECTED INDICATOR */}
          {active && (
            <View style={styles.callIndicator}>
              <View style={styles.callDot} />
              <Text style={styles.callIndicatorText}>Connected</Text>
            </View>
          )}

          {/* CONTROLS */}
          {incoming && !active ? (
            // INCOMING CALL ACTION BUTTONS - MODERN DESIGN
            <View style={styles.incomingControls}>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={onDecline || onHangup}
                activeOpacity={0.8}
              >
                <View style={styles.declineIconCircle}>
                  <Ionicons name="close" size={28} color="#FFF" />
                </View>
                <Text style={styles.actionLabel}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.answerButton}
                onPress={onAnswer}
                activeOpacity={0.8}
              >
                <View style={styles.answerIconCircle}>
                  <Ionicons name="call" size={28} color="#FFF" />
                </View>
                <Text style={styles.actionLabel}>Answer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // ACTIVE OR OUTGOING CONTROLS
            <View style={styles.controls}>
              {active && (
                <>
                  <TouchableOpacity
                    style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                    onPress={handleToggleMute}
                  >
                    <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="white" />
                    <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
                    onPress={toggleSpeaker}
                  >
                    <Ionicons name={isSpeakerOn ? "volume-high" : "volume-medium"} size={24} color="white" />
                    <Text style={styles.controlLabel}>Speaker</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.endButton} onPress={onHangup}>
                <Ionicons name="call" size={28} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
            </View>
          )}
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
    marginBottom: 4,
  },
  userRole: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'capitalize',
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
  incomingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 40,
    marginTop: 60,
  },
  declineButton: {
    alignItems: 'center',
    gap: 12,
  },
  answerButton: {
    alignItems: 'center',
    gap: 12,
  },
  declineIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  answerIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  actionLabel: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 40,
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
    elevation: 6,
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
  },
});

export default CallModal;

