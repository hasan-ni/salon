import { io } from 'socket.io-client';
export const socket = io({ path: '/socket.io' }); // same origin; Vite forwards it to the server
