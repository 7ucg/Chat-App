const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const ngrok = require('ngrok');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Pfade
const messagesPath = path.join(__dirname, 'messages.json');
const usersPath = path.join(__dirname, 'users.json');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Daten laden
let savedMessages = {};
if (fs.existsSync(messagesPath)) {
  savedMessages = JSON.parse(fs.readFileSync(messagesPath));
}

let users = {};
if (fs.existsSync(usersPath)) {
  users = JSON.parse(fs.readFileSync(usersPath));
}

// Registrierung
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Benutzername und Passwort sind erforderlich!' });
  }

  if (users[username]) {
    return res.status(400).json({ message: 'Benutzername bereits vergeben!' });
  }

  users[username] = { password };
  fs.writeFile(usersPath, JSON.stringify(users, null, 2), (err) => {
    if (err) console.error('Fehler beim Speichern der Benutzer:', err);
  });

  res.status(200).json({ message: 'Erfolgreich registriert!' });
});

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const user = users[username];
  if (!user || user.password !== password) {
    return res.status(400).json({ message: 'Falscher Benutzername oder Passwort!' });
  }

  res.status(200).json({ message: 'Erfolgreich eingeloggt!', username });
});

// Socket.IO
io.on('connection', (socket) => {
  console.log(`✅ Benutzer verbunden: ${socket.id}`);

  socket.on('join room', ({ username, room }) => {
    socket.username = username;
    socket.room = room;
    socket.join(room);
    console.log(`📢 ${username} hat Raum "${room}" betreten.`);

    if (savedMessages[room]) {
      savedMessages[room].forEach((msg) => {
        socket.emit('chat message', msg);
      });
    }

    socket.to(room).emit('chat message', {
      username: 'System',
      text: `${username} ist dem Raum beigetreten.`,
      profilePic: 'default-avatar.png',
    });
  });

  socket.on('chat message', (data) => {
    const message = {
      username: data.username,
      text: data.text,
      profilePic: data.profilePic || 'default-avatar.png',
    };

    io.to(socket.room).emit('chat message', message);

    if (!savedMessages[socket.room]) savedMessages[socket.room] = [];
    savedMessages[socket.room].push(message);
  });

  socket.on('disconnect', () => {
    if (socket.username && socket.room) {
      socket.to(socket.room).emit('chat message', {
        username: 'System',
        text: `${socket.username} hat den Raum verlassen.`,
        profilePic: 'default-avatar.png',
      });
    }
    console.log(`❌ Benutzer getrennt: ${socket.id}`);
  });
});

// Alle 5 Sekunden speichern
setInterval(() => {
  fs.writeFile(messagesPath, JSON.stringify(savedMessages, null, 2), (err) => {
    if (err) console.error('Fehler beim Speichern:', err);
  });
}, 5000);

// Start
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`🚀 Server läuft auf http://localhost:${PORT}`);
  const url = await ngrok.connect(PORT);
  console.log(`🌍 Öffentlich erreichbar unter: ${url}`);
});
