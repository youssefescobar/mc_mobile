import { io, Socket } from 'socket.io-client';
import { BASE_URL } from './api';
import { getUserId } from './user';

class SocketService {
    public socket: Socket | null = null;

    getSocket(): Socket | null {
        return this.socket;
    }

    async connect() {
        if (this.socket?.connected) return;

        // BASE_URL is likely http://IP:5000/api. Socket needs http://IP:5000
        const socketUrl = BASE_URL.replace('/api', '');

        this.socket = io(socketUrl, {
            transports: ['websocket'],
            forceNew: true,
        });

        this.socket.on('connect', async () => {
            console.log('[SocketService] Connected:', this.socket?.id);
            // Register userId for signaling
            const userId = await getUserId();
            if (userId) {
                this.socket?.emit('register-user', { userId });
            }
        });

        this.socket.on('disconnect', () => {
            console.log('[SocketService] Disconnected');
        });

        this.socket.on('connect_error', (err) => {
            console.log('[SocketService] Connect Error:', err);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
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

    onLocationUpdate(callback: (data: any) => void) {
        this.socket?.on('location_update', callback);
    }

    offLocationUpdate(callback?: (data: any) => void) {
        if (callback) {
            this.socket?.off('location_update', callback);
        } else {
            this.socket?.off('location_update');
        }
    }

    onSOSAlert(callback: (data: any) => void) {
        this.socket?.on('sos_alert', callback);
    }

    offSOSAlert(callback?: (data: any) => void) {
        if (callback) {
            this.socket?.off('sos_alert', callback);
        } else {
            this.socket?.off('sos_alert');
        }
    }

    private emit(event: string, data: any) {
        if (this.socket?.connected) {
            this.socket.emit(event, data);
        } else {
            console.log('[SocketService] Queueing emit (not connected):', event);
            // Could implement queuing logic here if needed
        }
    }
}

export const socketService = new SocketService();
