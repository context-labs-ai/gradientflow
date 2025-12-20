import jwt from 'jsonwebtoken';

/**
 * Setup Socket.IO server with JWT authentication
 * @param {import('socket.io').Server} io - Socket.IO server instance
 * @param {import('lowdb').Low} db - LowDB database instance
 * @param {string} JWT_SECRET - JWT secret for token verification
 */
export function setupSocketIO(io, db, JWT_SECRET) {
    // JWT authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }

        try {
            const payload = jwt.verify(token, JWT_SECRET);
            const user = db.data.users.find((u) => u.id === payload.id);
            if (!user) {
                return next(new Error('User not found'));
            }
            socket.user = { id: user.id, name: user.name };
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] Connected: ${socket.user.name} (${socket.user.id})`);

        // Join user-specific room for targeted messages
        socket.join(`user:${socket.user.id}`);

        socket.on('disconnect', (reason) => {
            console.log(`[Socket] Disconnected: ${socket.user.name} (${reason})`);
        });

        // Client can request sync state on connect/reconnect
        socket.on('sync:request', () => {
            const typingUsers = Object.keys(db.data.typing || {}).filter((userId) => {
                return db.data.typing[userId] > Date.now();
            });

            const lookingAgents = getAgentLookingList(db);

            socket.emit('sync:state', {
                typingUsers,
                lookingAgents,
            });
        });
    });
}

/**
 * Get list of agents currently looking at the conversation
 * @param {import('lowdb').Low} db - LowDB database instance
 * @returns {Array} List of looking agents with details
 */
function getAgentLookingList(db) {
    const now = Date.now();
    const lookingAgentIds = Object.keys(db.data.agentLooking || {}).filter(
        (agentId) => db.data.agentLooking[agentId] > now
    );

    return lookingAgentIds
        .map((agentId) => {
            const agentConfig = db.data.agentConfigs?.find((a) => a.id === agentId);
            if (!agentConfig) return null;

            const agentUser = db.data.users.find((u) => u.agentId === agentId);

            return {
                agentId,
                agentName: agentConfig.name,
                userName: agentUser?.name || agentConfig.name,
                avatar: agentUser?.avatar || agentConfig.avatar,
            };
        })
        .filter(Boolean);
}

/**
 * Broadcast helper functions for Socket.IO events
 * Each function emits an event to all connected clients
 */
export const broadcast = {
    /**
     * Broadcast when a new message is created
     * @param {import('socket.io').Server} io
     * @param {object} message - The created message
     * @param {Array} users - Related users (sender info)
     */
    messageCreated: (io, message, users = []) => {
        io.emit('message:created', { message, users });
    },

    /**
     * Broadcast when a message is updated (e.g., reaction changes)
     * @param {import('socket.io').Server} io
     * @param {object} message - The updated message
     */
    messageUpdated: (io, message) => {
        io.emit('message:updated', { message });
    },

    /**
     * Broadcast when message(s) are deleted
     * @param {import('socket.io').Server} io
     * @param {string[]} messageIds - Array of deleted message IDs
     */
    messageDeleted: (io, messageIds) => {
        io.emit('message:deleted', { messageIds });
    },

    /**
     * Broadcast typing status update
     * @param {import('socket.io').Server} io
     * @param {string[]} typingUsers - Array of user IDs currently typing
     */
    typingUpdate: (io, typingUsers) => {
        io.emit('typing:update', { typingUsers });
    },

    /**
     * Broadcast agent looking status update
     * @param {import('socket.io').Server} io
     * @param {Array} lookingAgents - Array of looking agent details
     */
    agentsLooking: (io, lookingAgents) => {
        io.emit('agents:looking', { lookingAgents });
    },
};
