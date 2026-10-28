let ioInstance = null;

export function setSocketIO(io) {
  ioInstance = io;
}

export function getSocketIO() {
  return ioInstance;
}

export function broadcastToBoard(boardId, event, data) {
  if (ioInstance) {
    ioInstance.to(`board:${boardId}`).emit(event, data);
  }
}

