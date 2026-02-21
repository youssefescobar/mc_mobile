import React, { useEffect, useState, useRef } from 'react';
import { Animated, Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CallModalProps {
  visible: boolean;
  onClose: () => void;
  isCaller: boolean;
  remoteUser: { id: string; name: string; role?: string };
  active: boolean;
  incoming: boolean;
  webrtcAvailable: boolean;
  isSpeakerOn?: boolean;
  callStatus?: 'calling' | 'ringing' | 'connected' | 'declined' | 'unreachable' | 'ended' | null;
  onAnswer: () => void;
  onHangup: () => void;
  onDecline?: () => void;
  toggleMute?: () => boolean;
  toggleSpeaker?: () => void;
  localStream?: any;
  remoteStream?: any;
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
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Timer when call is connected
  useEffect(() => {
    if (active) {
      setCallDuration(0);
      timerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [active]);

  // Pulse animation while ringing
  useEffect(() => {
    if (incoming && !active) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 750, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [incoming, active]);

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

  const getStatusText = () => {
    if (callStatus === 'declined') return 'Call Declined';
    if (callStatus === 'unreachable') return 'Unreachable';
    if (callStatus === 'connected') return formatDuration(callDuration);
    if (callStatus === 'ringing' && incoming) return 'Incoming Call';
    if (callStatus === 'ringing') return 'Ringing...';
    return 'Calling...';
  };

  if (!visible) return null;

  const initials = remoteUser.name.charAt(0).toUpperCase();

  return (
    <Modal visible={visible} transparent={false} animationType="slide" statusBarTranslucent>
      <View style={styles.fullScreen}>

        {/* Top / Name Section */}
        <View style={styles.topSection}>
          {incoming && !active && (
            <Text style={styles.incomingLabel}>INCOMING CALL</Text>
          )}
          <Text style={styles.callerRole}>{remoteUser.role || 'Moderator'}</Text>

          {/* Avatar with pulse ring */}
          <View style={styles.avatarWrapper}>
            {incoming && !active && (
              <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
            )}
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{initials}</Text>
            </View>
          </View>

          <Text style={styles.callerName}>{remoteUser.name}</Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>

          {active && (
            <View style={styles.connectedBadge}>
              <View style={styles.connectedDot} />
              <Text style={styles.connectedText}>Connected</Text>
            </View>
          )}

          {!webrtcAvailable && (
            <View style={styles.warningBadge}>
              <Ionicons name="warning-outline" size={16} color="#F59E0B" />
              <Text style={styles.warningText}>Calls require a development build</Text>
            </View>
          )}
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomSection}>
          {incoming && !active ? (
            <View style={styles.incomingControls}>
              {/* Decline */}
              <View style={styles.actionGroup}>
                <TouchableOpacity style={styles.declineCircle} onPress={onDecline || onHangup} activeOpacity={0.8}>
                  <Ionicons name="call" size={30} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
                <Text style={styles.actionLabel}>Decline</Text>
              </View>

              {/* Answer */}
              <View style={styles.actionGroup}>
                <TouchableOpacity style={styles.answerCircle} onPress={onAnswer} activeOpacity={0.8}>
                  <Ionicons name="call" size={30} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.actionLabel}>Answer</Text>
              </View>
            </View>
          ) : (
            <View style={styles.activeControls}>
              {active && (
                <>
                  <View style={styles.actionGroup}>
                    <TouchableOpacity
                      style={[styles.controlCircle, isMuted && styles.controlActive]}
                      onPress={handleToggleMute}
                    >
                      <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={26} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.actionLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
                  </View>

                  <View style={styles.actionGroup}>
                    <TouchableOpacity
                      style={[styles.controlCircle, isSpeakerOn && styles.controlActive]}
                      onPress={toggleSpeaker}
                    >
                      <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-medium'} size={26} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.actionLabel}>Speaker</Text>
                  </View>
                </>
              )}

              <View style={styles.actionGroup}>
                <TouchableOpacity style={styles.endCircle} onPress={onHangup}>
                  <Ionicons name="call" size={30} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
                <Text style={styles.actionLabel}>End</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#0D1117',
    justifyContent: 'space-between',
  },
  topSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  incomingLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  callerRole: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
    marginBottom: 36,
  },
  avatarWrapper: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pulseRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  avatarInitial: {
    fontSize: 38,
    fontWeight: '700',
    color: 'white',
  },
  callerName: {
    color: 'white',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 17,
    fontWeight: '500',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 16,
    gap: 8,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  connectedText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  warningText: {
    color: '#F59E0B',
    fontSize: 13,
  },
  bottomSection: {
    paddingBottom: 64,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  incomingControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  activeControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    width: '100%',
  },
  actionGroup: {
    alignItems: 'center',
    gap: 10,
  },
  actionLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  declineCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  answerCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  controlCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlActive: {
    backgroundColor: '#F59E0B',
  },
  endCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
});

export default CallModal;
