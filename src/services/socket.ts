import { io, Socket } from 'socket.io-client';
import { BASE_URL } from './api';
import { getUserId, getUserRole } from './user';

class SocketService {
    public socket: Socket | null = null;
    private pendingListeners: { event: string; callback: any }[] = [];

    getSocket(): Socket | null {
        return this.socket;
    }

    async connect() {
        if (this.socket?.connected) {
            console.log('[SocketService] Already connected, skipping reconnect');
            return;
        }

        const socketUrl = BASE_URL.replace('/api', '');

        this.socket = io(socketUrl, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        this.socket.on('connect', async () => {
            console.log('[SocketService] Connected:', this.socket?.id);
            await this.registerUser();

            // Attach pending listeners ONCE only, then clear the queue.
            // Do NOT also attach them in the immediate block below — that causes
            // every listener to be registered twice, leading to duplicate events.
            this.pendingListeners.forEach(({ event, callback }) => {
                this.socket?.on(event, callback);
            });
            this.pendingListeners = [];
        });

        // Re-register user identity on reconnect (socket id changes)
        this.socket.on('reconnect', async () => {
            console.log('[SocketService] Reconnected, re-registering user');
            await this.registerUser();
        });

        this.socket.on('disconnect', () => {
            console.log('[SocketService] Disconnected');
        });

        this.socket.on('connect_error', (err) => {
            console.log('[SocketService] Connect Error:', err);
        });

        // NOTE: We intentionally do NOT attach pendingListeners here synchronously.
        // The 'connect' event handler above is the single authoritative place they
        // get attached. Doing both causes every listener to be registered twice.
    }

    async registerUser() {
        const userId = await getUserId();
        const role = await getUserRole();
        console.log('[SocketService] Got userId/role for registration:', userId, role);
        if (userId) {
            console.log('[SocketService] Emitting register-user event with userId/role:', userId, role);
            this.socket?.emit('register-user', { userId, role });
        } else {
            console.log('[SocketService] WARNING: No userId available for registration!');
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    // Generic listener attacher — queues if socket not yet connected
    private on(event: string, callback: (data: any) => void) {
        if (this.socket) {
            this.socket.on(event, callback);
        } else {
            console.log(`[SocketService] Queuing listener for ${event}`);
            this.pendingListeners.push({ event, callback });
        }
    }

    private off(event: string, callback?: (data: any) => void) {
        if (this.socket) {
            if (callback) this.socket.off(event, callback);
            else this.socket.off(event);
        }
        this.pendingListeners = this.pendingListeners.filter(
            l => l.event !== event || (callback && l.callback !== callback)
        );
    }

    joinGroup(groupId: string) { this.emit('join_group', groupId); }
    leaveGroup(groupId: string) { this.emit('leave_group', groupId); }

    sendLocation(data: { groupId: string; pilgrimId: string; lat: number; lng: number; isSos?: boolean }) {
        if (!this.socket) return;
        this.socket.emit('update_location', data);
    }

    sendSOS(data: { groupId: string; pilgrimId: string; lat: number; lng: number; message?: string }) {
        this.emit('sos_alert', data);
    }

    // ── Event wrappers (all using the queueing `on/off`) ─────────────────────

    onLocationUpdate(callback: (data: any) => void) { this.on('location_update', callback); }
    offLocationUpdate(callback?: (data: any) => void) { this.off('location_update', callback); }

    onSOSAlert(callback: (data: any) => void) { this.on('sos_alert', callback); }
    offSOSAlert(callback?: (data: any) => void) { this.off('sos_alert', callback); }

    onStatusUpdate(callback: (data: any) => void) { this.on('status_update', callback); }
    offStatusUpdate(callback?: (data: any) => void) { this.off('status_update', callback); }

    onNewMessage(callback: (data: any) => void) { this.on('new_message', callback); }
    offNewMessage(callback?: (data: any) => void) { this.off('new_message', callback); }

    onMissedCallReceived(callback: (data: any) => void) { this.on('missed-call-received', callback); }
    offMissedCallReceived(callback?: (data: any) => void) { this.off('missed-call-received', callback); }

    onBatteryUpdate(callback: (data: any) => void) { this.on('battery-update', callback); }
    offBatteryUpdate(callback?: (data: any) => void) { this.off('battery-update', callback); }

    onSOSAlertReceived(callback: (data: any) => void) { this.on('sos-alert-received', callback); }
    offSOSAlertReceived(callback?: (data: any) => void) { this.off('sos-alert-received', callback); }

    // Call signaling
    onCallOffer(callback: (data: any) => void) { this.on('call-offer', callback); }
    offCallOffer(callback?: (data: any) => void) { this.off('call-offer', callback); }

    onCallAnswer(callback: (data: any) => void) { this.on('call-answer', callback); }
    offCallAnswer(callback?: (data: any) => void) { this.off('call-answer', callback); }

    onIceCandidate(callback: (data: any) => void) { this.on('ice-candidate', callback); }
    offIceCandidate(callback?: (data: any) => void) { this.off('ice-candidate', callback); }

    onCallEnd(callback: (data: any) => void) { this.on('call-end', callback); }
    offCallEnd(callback?: (data: any) => void) { this.off('call-end', callback); }

    onCallDeclined(callback: (data: any) => void) { this.on('call-declined', callback); }
    offCallDeclined(callback?: (data: any) => void) { this.off('call-declined', callback); }

    onCallBusy(callback: (data: any) => void) { this.on('call-busy', callback); }
    offCallBusy(callback?: (data: any) => void) { this.off('call-busy', callback); }

    onCallCancel(callback: (data: any) => void) { this.on('call-cancel', callback); }
    offCallCancel(callback?: (data: any) => void) { this.off('call-cancel', callback); }

    private emit(event: string, data: any) {
        if (this.socket) {
            this.socket.emit(event, data);
        } else {
            console.log('[SocketService] Socket not initialized, cannot emit:', event);
        }
    }
}

export const socketService = new SocketService();
