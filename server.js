const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const ngrok = require('ngrok');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Pfade
const messagesPath = path.join(__dirname, 'messages.json');
const usersPath = path.join(__dirname, 'users.json');

// Middleware
app.use(express.json());
app.use(session({
    secret: 'lol', // Geheimen Schlüssel benutzen
    resave: false,
    saveUninitialized: false
  }));
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
app.post('/register', async (req, res) => {
    const { username, password, profilePic } = req.body;
    const registeredAt = new Date().toISOString();
  
    if (!username || !password) {
      return res.status(400).json({ message: 'Benutzername und Passwort sind erforderlich!' });
    }
  
    if (users[username]) {
      return res.status(400).json({ message: 'Benutzername bereits vergeben!' });
    }
  
    const hashedPassword = await bcrypt.hash(password, 10); // Passwort verschlüsseln
  
    users[username] = { password: hashedPassword, profilePic: profilePic || '', registeredAt };
    
    fs.writeFile(usersPath, JSON.stringify(users, null, 2), (err) => {
      if (err) console.error('Fehler beim Speichern der Benutzer:', err);
    });
  
    res.status(200).json({ message: 'Erfolgreich registriert!' });
  });
  

  app.use(session({
    secret: 'lol',
    resave: false,
    saveUninitialized: false
  }));
  
  // Login speichern
  app.post('/login', (req, res) => {
    const { username, password } = req.body;
  
    const user = users[username];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(400).json({ message: 'Falscher Benutzername oder Passwort!' });
    }
  
    req.session.username = username;  // Save session!
  
    // res.status(200).json({ message: 'Erfolgreich eingeloggt!', username });
    res.status(200).json({ 
        message: 'Erfolgreich eingeloggt!', 
        username,
        profilePic: user.profilePic // direkt mitschicken!
      });
      
  });
  
  // Middleware für Schutz
  function authMiddleware(req, res, next) {
    if (!req.session.username) {
      return res.redirect('/');
    }
    next();
  }
  
  // Chat nur für eingeloggte User
  app.get('/chat.html', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
  });

// Socket.IO
io.on('connection', (socket) => {
  console.log(`✅ Benutzer verbunden: ${socket.id}`);

//   socket.on('join room', ({ username, room }) => {
//     socket.username = username;
//     socket.room = room;
//     socket.join(room);
//     console.log(`📢 ${username} hat Raum "${room}" betreten.`);

//     if (savedMessages[room]) {
//       savedMessages[room].forEach((msg) => {
//         socket.emit('chat message', msg);
//       });
//     }

//     socket.to(room).emit('chat message', {
//       username: 'System',
//       text: `${username} ist dem Raum beigetreten.`,
//       profilePic: 'default-avatar.png',
//     });
//   });
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
  
   if (savedMessages[room]) {
     socket.emit('chat history', savedMessages[room]);
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

  // Neues Event für Profilbild speichern
socket.on('update profile picture', ({ username, profilePic }) => {
    if (users[username]) {
      users[username].profilePic = profilePic;
      fs.writeFile(usersPath, JSON.stringify(users, null, 2), (err) => {
        if (err) console.error('Fehler beim Speichern des Profilbilds:', err);
        else console.log(`📸 Profilbild gespeichert für ${username}`);
      });
    }
  });
  socket.on('delete account', ({ username }) => {
    console.log(`🗑️ Lösche Account von ${username}`);
  
    // Benutzer löschen
    if (users[username]) {
      delete users[username];
      fs.writeFile(usersPath, JSON.stringify(users, null, 2), (err) => {
        if (err) console.error('Fehler beim Löschen des Benutzers:', err);
        else console.log(`✅ Benutzer ${username} gelöscht.`);
      });
    }
  
    // Nachrichten löschen
    for (const room in savedMessages) {
      savedMessages[room] = savedMessages[room].filter((msg) => msg.username !== username);
    }
    fs.writeFile(messagesPath, JSON.stringify(savedMessages, null, 2), (err) => {
      if (err) console.error('Fehler beim Löschen der Nachrichten:', err);
      else console.log(`✅ Nachrichten von ${username} gelöscht.`);
    });
  
    // Reload für alle im Raum
    if (socket.room) {
      io.to(socket.room).emit('reload messages');
    }
  
    // User rauswerfen
    socket.emit('account deleted');
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
//   const url =  await ngrok.connect({
//     addr: PORT,
//   });
//   console.log(`🌍 Öffentlich erreichbar unter: ${url}`);
});
