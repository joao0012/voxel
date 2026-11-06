const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

const players = {};

io.on('connection', (socket) => {
    console.log(`Jogador conectado: ${socket.id}`);

    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name || 'HabboJovem',
            room: data.room || 'church',
            x: 0,
            y: 0.1,
            z: 4,
            shirtColor: data.shirtColor || 0x2563eb,
            skinColor: data.skinColor || 0xfbcfe8,
            isSitting: false,
            seatPos: null
        };

        socket.join(players[socket.id].room);
        socket.emit('currentPlayers', getPlayersInRoom(players[socket.id].room));
        socket.to(players[socket.id].room).emit('playerJoined', players[socket.id]);
    });

    socket.on('changeRoom', (newRoom) => {
        if (!players[socket.id]) return;
        const oldRoom = players[socket.id].room;
        socket.leave(oldRoom);
        socket.to(oldRoom).emit('playerLeft', socket.id);

        players[socket.id].room = newRoom;
        players[socket.id].x = 0;
        players[socket.id].z = 4;
        players[socket.id].isSitting = false;
        socket.join(newRoom);

        socket.emit('currentPlayers', getPlayersInRoom(newRoom));
        socket.to(newRoom).emit('playerJoined', players[socket.id]);
    });

    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].z = data.z;
            players[socket.id].isSitting = false;
            socket.to(players[socket.id].room).emit('playerMoved', {
                id: socket.id,
                x: data.x,
                z: data.z
            });
        }
    });

    socket.on('playerSit', (data) => {
        if (players[socket.id]) {
            players[socket.id].isSitting = true;
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].z = data.z;
            io.to(players[socket.id].room).emit('playerSat', {
                id: socket.id,
                x: data.x,
                y: data.y,
                z: data.z
            });
        }
    });

    socket.on('sendSpeech', (text) => {
        if (players[socket.id]) {
            io.to(players[socket.id].room).emit('playerSpeaks', {
                id: socket.id,
                text: text
            });
        }
    });

    // WebRTC Sinalização para o Microfone entre Jogadores
    socket.on('语音-offer', (data) => {
        socket.to(data.target).emit('语音-offer', { sender: socket.id, offer: data.offer });
    });

    socket.on('语音-answer', (data) => {
        socket.to(data.target).emit('语音-answer', { sender: socket.id, answer: data.answer });
    });

    socket.on('语音-candidate', (data) => {
        socket.to(data.target).emit('语音-candidate', { sender: socket.id, candidate: data.candidate });
    });

    socket.on('disconnect', () => {
        console.log(`Jogador desconectado: ${socket.id}`);
        if (players[socket.id]) {
            io.to(players[socket.id].room).emit('playerLeft', socket.id);
            delete players[socket.id];
        }
    });
});

function getPlayersInRoom(room) {
    const roomPlayers = {};
    for (let id in players) {
        if (players[id].room === room) {
            roomPlayers[id] = players[id];
        }
    }
    return roomPlayers;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor a rodar na porta ${PORT}`);
});