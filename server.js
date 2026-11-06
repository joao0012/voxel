const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Serve os ficheiros estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Lista de jogadores conectados por sala
const players = {};

io.on('connection', (socket) => {
    console.log(`Jogador conectado: ${socket.id}`);

    // Jogador entra no jogo
    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name || 'HabboJovem',
            room: data.room || 'church',
            x: 0,
            y: 0.1,
            z: 4,
            shirtColor: Math.random() * 0xffffff
        };

        // Coloca o socket na sala correta
        socket.join(players[socket.id].room);

        // Envia a lista dos outros jogadores para quem acabou de entrar
        socket.emit('currentPlayers', getPlayersInRoom(players[socket.id].room));

        // Avisa os outros jogadores na sala que um novo jogador entrou
        socket.to(players[socket.id].room).emit('playerJoined', players[socket.id]);
    });

    // Mudança de sala
    socket.on('changeRoom', (newRoom) => {
        if (!players[socket.id]) return;

        const oldRoom = players[socket.id].room;
        socket.leave(oldRoom);
        socket.to(oldRoom).emit('playerLeft', socket.id);

        players[socket.id].room = newRoom;
        players[socket.id].x = 0;
        players[socket.id].z = 4;
        socket.join(newRoom);

        socket.emit('currentPlayers', getPlayersInRoom(newRoom));
        socket.to(newRoom).emit('playerJoined', players[socket.id]);
    });

    // Movimento do jogador
    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].z = data.z;
            socket.to(players[socket.id].room).emit('playerMoved', {
                id: socket.id,
                x: data.x,
                z: data.z
            });
        }
    });

    // Mensagens de Chat e Balões
    socket.on('sendSpeech', (text) => {
        if (players[socket.id]) {
            io.to(players[socket.id].room).emit('playerSpeaks', {
                id: socket.id,
                text: text
            });
        }
    });

    // Desconexão
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
    console.log(`Servidor Habbo Cristão a rodar na porta ${PORT}`);
});