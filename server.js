const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 📁 Sicherstellen, dass "Databank" existiert
const databankDir = path.join(__dirname, 'Databank');
if (!fs.existsSync(databankDir)) fs.mkdirSync(databankDir);

const usersPath = path.join(__dirname, 'users.json');

// JSON-Dateien laden
let users = {};
if (fs.existsSync(usersPath)) {
  users = JSON.parse(fs.readFileSync(usersPath));
}

// Hilfsfunktion für Pfad zu Raumdatei
function getRoomFilePath(room) {
  const safeRoom = room.replace(/[^a-z0-9_\-]/gi, '_');
  return path.join(databankDir, `${safeRoom}.json`);
}

app.use(express.json());
app.use(session({
    secret: 'lol',
    resave: false,
    saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'Website')));

// Registrierung
app.post('/register', async (req, res) => {
    const { username, password, profilePic } = req.body;
    const registeredAt = new Date().toISOString();

    if (!username || !password) {
      return res.status(400).json({ message: 'Benutzername und Passwort sind erforderlich!' });
    }

    if (users[username]) {
      return res.status(400).json({ message: 'Benutzername bereits vergeben!' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    users[username] = { password: hashedPassword, profilePic: profilePic || '', registeredAt };
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    res.status(200).json({ message: 'Erfolgreich registriert!' });
});

// Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(400).json({ message: 'Falscher Benutzername oder Passwort!' });
    }

    req.session.username = username;
    res.status(200).json({ message: 'Erfolgreich eingeloggt!', username, profilePic: user.profilePic });
});

// Nur eingeloggte dürfen den Chat sehen
function authMiddleware(req, res, next) {
  if (!req.session.username) return res.redirect('/');
  next();
}

app.get('/chat.html', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

let onlineUsers = {};
const registeredUsers = [];

io.on('connection', (socket) => {
  console.log(`✅ Verbunden: ${socket.id}`);

  socket.on('register user', (username) => {
    if (!registeredUsers.includes(username)) registeredUsers.push(username);
    socket.username = username;
    onlineUsers[username] = { id: socket.id };
    io.emit('online users', Object.keys(onlineUsers));
  });

  socket.on('join room', ({ username, room }) => {
    socket.username = username;
    socket.room = room;
    socket.join(room);
    console.log(`📢 ${username} betritt Raum "${room}"`);

    const roomFile = getRoomFilePath(room);
    let roomMessages = [];

    if (fs.existsSync(roomFile)) {
      try {
        roomMessages = JSON.parse(fs.readFileSync(roomFile));
      } catch (err) {
        console.error('❌ Fehler beim Laden:', err);
      }
    }

    socket.emit('chat history', roomMessages);

    socket.to(room).emit('chat message', {
      username: 'System',
      text: `${username} ist dem Raum beigetreten.`,
      profilePic: 'default-avatar.png'
    });
  });

  socket.on('chat message', (data) => {
    const message = {
      username: data.username,
      text: data.text,
      profilePic: data.profilePic || 'default-avatar.png',
      media: data.media || null
    };

    io.to(socket.room).emit('chat message', message);

    const roomFile = getRoomFilePath(socket.room);
    let roomMessages = [];

    if (fs.existsSync(roomFile)) {
      try {
        roomMessages = JSON.parse(fs.readFileSync(roomFile));
      } catch (err) {
        console.error('❌ Fehler beim Lesen:', err);
      }
    }

    roomMessages.push(message);
    fs.writeFile(roomFile, JSON.stringify(roomMessages, null, 2), (err) => {
      if (err) console.error('❌ Fehler beim Speichern:', err);
    });
  });

  socket.on('update profile picture', ({ username, profilePic }) => {
    if (users[username]) {
      users[username].profilePic = profilePic;
      fs.writeFile(usersPath, JSON.stringify(users, null, 2), (err) => {
        if (err) console.error('Fehler beim Speichern des Profilbilds:', err);
        else console.log(`📸 Profilbild gespeichert für ${username}`);
      });
    }
  });

  socket.on('update profile', async ({ oldUsername, newUsername, newPassword }) => {
    if (!users[oldUsername]) return;
    if (newUsername && newUsername !== oldUsername) {
      users[newUsername] = { ...users[oldUsername] };
      delete users[oldUsername];
    }
    if (newPassword) {
      const hashed = await bcrypt.hash(newPassword, 10);
      users[newUsername || oldUsername].password = hashed;
    }
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  });

  socket.on('delete account', ({ username }) => {
    if (users[username]) delete users[username];
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    socket.emit('account deleted');
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      delete onlineUsers[socket.username];
      io.emit('online users', Object.keys(onlineUsers));
    }
    console.log(`❌ Getrennt: ${socket.id}`);
  });

  socket.on('search users', (query) => {
    const matched = registeredUsers.filter(u => u.toLowerCase().includes(query));
    socket.emit('search results', matched);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server läuft: http://localhost:${PORT}`);
});
