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

            // Attach pending listeners
            this.pendingListeners.forEach(({ event, callback }) => {
                this.socket?.on(event, callback);
            });
            this.pendingListeners = []; // Clear queue
        });

        // Re-register on reconnect
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

        // Also attach pending listeners if socket object exists but not connected yet
        // (Though usually 'connect' event is safer, we can try attaching immediately if socket instance exists)
        if (this.socket) {
            this.pendingListeners.forEach(({ event, callback }) => {
                // Check if already has listener to avoid dupes? 
                // socket.io allows multiple, but we probably want one.
                // For simplicity, just attach.
                if (!this.socket?.hasListeners(event)) {
                    this.socket?.on(event, callback);
                }
            });
        }
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

    // Generic listener attacher
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
        // Also remove from pending if present
        this.pendingListeners = this.pendingListeners.filter(l => l.event !== event || (callback && l.callback !== callback));
    }

    joinGroup(groupId: string) {
        this.emit('join_group', groupId);
    }

    leaveGroup(groupId: string) {
        this.emit('leave_group', groupId);
    }

    sendLocation(data: { groupId: string; pilgrimId: string; lat: number; lng: number; isSos?: boolean }) {
        if (!this.socket) return;
        this.socket.emit('update_location', data);
    }

    sendSOS(data: { groupId: string; pilgrimId: string; lat: number; lng: number; message?: string }) {
        this.emit('sos_alert', data);
    }

    // Event Wrappers
    onLocationUpdate(callback: (data: any) => void) { this.on('location_update', callback); }
    offLocationUpdate(callback?: (data: any) => void) { this.off('location_update', callback); }

    onSOSAlert(callback: (data: any) => void) {
        this.socket?.on('sos_alert', callback);
    }

    offSOSAlert(callback: (data: any) => void) {
        this.socket?.off('sos_alert', callback);
    }

    onStatusUpdate(callback: (data: any) => void) {
        this.socket?.on('status_update', callback);
    }

    offStatusUpdate(callback: (data: any) => void) {
        this.socket?.off('status_update', callback);
    }

    onNewMessage(callback: (data: any) => void) { this.on('new_message', callback); }
    offNewMessage(callback?: (data: any) => void) { this.off('new_message', callback); }

    // Call Events
    onCallOffer(callback: (data: any) => void) { this.on('call-offer', callback); }
    offCallOffer(callback?: (data: any) => void) { this.off('call-offer', callback); }

    onCallAnswer(callback: (data: any) => void) { this.on('call-answer', callback); }
    offCallAnswer(callback?: (data: any) => void) { this.off('call-answer', callback); }

    onIceCandidate(callback: (data: any) => void) { this.on('ice-candidate', callback); }
    offIceCandidate(callback?: (data: any) => void) { this.off('ice-candidate', callback); }

    onCallEnd(callback: (data: any) => void) { this.on('call-end', callback); }
    offCallEnd(callback?: (data: any) => void) { this.off('call-end', callback); }


    private emit(event: string, data: any) {
        if (this.socket) {
            this.socket.emit(event, data);
        } else {
            console.log('[SocketService] Socket not initialized, cannot emit:', event);
        }
    }
}

export const socketService = new SocketService();
