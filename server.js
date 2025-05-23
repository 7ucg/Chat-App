const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { exec } = require('child_process');
const fs = require("fs");
const bcrypt = require("bcrypt");
const session = require("express-session");
const multer = require("multer");
const auth = require("basic-auth");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const databankDir = path.join(__dirname, "Databank");
if (!fs.existsSync(databankDir)) fs.mkdirSync(databankDir);

const usersPath = path.join(__dirname, "users.json");
let users = fs.existsSync(usersPath)
  ? JSON.parse(fs.readFileSync(usersPath))
  : {};

// function getRoomFilePath(room) {
//   const safeRoom = room.replace(/[^a-z0-9_\-]/gi, "_");
//   return path.join(databankDir, `${safeRoom}.json`);
// }
function getRoomFilePath(room) {
  if (!room || typeof room !== "string") room = "Allgemein";
  const safeRoom = room.replace(/[^a-z0-9_\-]/gi, "_");
  return path.join(databankDir, `${safeRoom}.json`);
}

app.use(express.json());
app.use(session({ secret: "lol", resave: false, saveUninitialized: false }));
app.use(express.static(path.join(__dirname, "Website")));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = req.query.username;
    let targetDir;

    if (req.query.profile === "true" && username) {
      targetDir = path.join(uploadDir, "User", username);
    } else {
      targetDir = path.join(uploadDir, "media");
    }

    fs.mkdirSync(targetDir, { recursive: true });
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const safeName = file.originalname
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    cb(null, `${timestamp}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "video/mp4"];
    cb(null, allowed.includes(file.mimetype));
  },
});

app.post("/upload", upload.single("media"), (req, res) => {
  if (!req.file)
    return res.status(400).json({ message: "Keine Datei hochgeladen" });

  const username = req.query.username;
  const isProfile = req.query.profile === "true";

  const basePath =
    isProfile && username ? `/uploads/User/${username}` : `/uploads/media`;

  const mediaUrl = `${basePath}/${req.file.filename}`;

  res.status(200).json({ mediaUrl, type: req.file.mimetype });
});

app.use("/uploads", express.static(uploadDir));

app.post("/register", async (req, res) => {
  const { username, password, profilePic } = req.body;
  if (!username || !password)
    return res
      .status(400)
      .json({ message: "Benutzername und Passwort sind erforderlich!" });
  if (users[username])
    return res.status(400).json({ message: "Benutzername bereits vergeben!" });

  const hashedPassword = await bcrypt.hash(password, 10);
  users[username] = {
    password: hashedPassword,
    profilePic: profilePic || "",
    registeredAt: new Date().toISOString(),
  };
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  res.status(200).json({ message: "Erfolgreich registriert!" });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  let oo = bcrypt.compareSync(password, user.password)
  console.log(oo)
  if (!user || !oo) {
    
    return res
      .status(400)
      .json({ message: "Falscher Benutzername oder Passwort!" });
  }
  req.session.username = username;
  res
    .status(200)
    .json({
      message: "Erfolgreich eingeloggt!",
      username,
      profilePic: user.profilePic,
    });
});

const reportsPath = path.join(__dirname, "bug_reports.json");

app.post("/report-bug", (req, res) => {
  const { username, message } = req.body;
  if (!message || message.length > 500) {
    return res
      .status(400)
      .json({ message: "Nachricht ungültig oder zu lang." });
  }

  const report = {
    username: username || "Unbekannt",
    message,
    timestamp: new Date().toISOString(),
  };

  let reports = [];
  if (fs.existsSync(reportsPath)) {
    reports = JSON.parse(fs.readFileSync(reportsPath));
  }
  reports.push(report);
  fs.writeFileSync(reportsPath, JSON.stringify(reports, null, 2));

  res.status(200).json({ message: "Report gespeichert!" });
});
// Admin-Zugangsdaten für reports
const adminUser = "admin";
const adminPass = "1234";

function requireAuth(req, res, next) {
  const user = auth(req);
  if (!user || user.name !== adminUser || user.pass !== adminPass) {
    res.set("WWW-Authenticate", 'Basic realm="Adminbereich"');
    return res.status(401).send("Zugriff verweigert");
  }
  next();
}

// Admin-Seite und Reports nur mit Auth
app.use("/admin", requireAuth, express.static(path.join(__dirname, "admin")));
app.use("/chat", express.static(path.join(__dirname, "chat")));
app.get("/bug_reports.json", requireAuth, (req, res) => {
  res.sendFile(reportsPath);
});

function authMiddleware(req, res, next) {
  if (!req.session.username) return res.redirect("/");
  next();
}

app.get("/chat", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat"));
});

let onlineUsers = {};
const registeredUsers = [];

io.on("connection", (socket) => {
  console.log(`✅ Verbunden: ${socket.id}`);

  socket.on("register user", (username) => {
    if (!registeredUsers.includes(username)) registeredUsers.push(username);
    socket.username = username;
    onlineUsers[username] = { id: socket.id };
    io.emit("online users", Object.keys(onlineUsers));
  });

  socket.on("join room", ({ username, room }) => {
    socket.username = username;
    socket.room = room;
    socket.join(room);
    console.log(`📢 ${username} betritt Raum "${room}"`);

    const roomFile = getRoomFilePath(room);
    let roomMessages = fs.existsSync(roomFile)
      ? JSON.parse(fs.readFileSync(roomFile))
      : [];
    socket.emit("chat history", roomMessages);

    socket.to(room).emit("chat message", {
      username: "System",
      text: `${username} ist dem Raum beigetreten.`,
      profilePic: "default-avatar.png",
    });
  });

  socket.on("chat message", (data) => {
    const id = Date.now().toString();
    const message = {
      id,
      username: data.username,
      text: data.text,
      profilePic: data.profilePic || "default-avatar.png",
      media: data.media || null,
    };

    io.to(socket.room).emit("chat message", message);

    const roomFile = getRoomFilePath(socket.room);
    const roomMessages = fs.existsSync(roomFile)
      ? JSON.parse(fs.readFileSync(roomFile))
      : [];
    roomMessages.push(message);
    fs.writeFile(roomFile, JSON.stringify(roomMessages, null, 2), (err) => {
      if (err) console.error("❌ Fehler beim Speichern:", err);
    });
  });

  socket.on("update profile picture", ({ username, profilePic }) => {
    if (users[username]) {
      users[username].profilePic = profilePic;
      fs.writeFile(usersPath, JSON.stringify(users, null, 2), (err) => {
        if (err) console.error("Fehler beim Speichern des Profilbilds:", err);
        else console.log(`📸 Profilbild gespeichert für ${username}`);
      });
    }
  });

  socket.on(
    "update profile",
    async ({ oldUsername, newUsername, newPassword }) => {
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
    }
  );

  // socket.on("delete account", ({ username }) => {
  //   if (users[username]) delete users[username];
  //   fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  //   socket.emit("account deleted");
  // });
  socket.on("delete account", ({ username }) => {
    if (users[username]) delete users[username];
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  
    // Nachrichten des Benutzers aus allen Räumen löschen
    fs.readdir(databankDir, (err, files) => {
      if (err) {
        console.error("Fehler beim Lesen des Databank-Ordners:", err);
        return;
      }
  
      files.forEach((file) => {
        const filePath = path.join(databankDir, file);
        let messages = fs.existsSync(filePath)
          ? JSON.parse(fs.readFileSync(filePath))
          : [];
  
        const filteredMessages = messages.filter(
          (msg) => msg.username !== username
        );
  
        if (filteredMessages.length !== messages.length) {
          fs.writeFileSync(filePath, JSON.stringify(filteredMessages, null, 2));
        }
      });
    });
  
    socket.emit("account deleted");
  });
  
  socket.on("edit message", ({ id, newText, room }) => {
    const file = getRoomFilePath(room);
    const messages = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file))
      : [];
    const msg = messages.find((m) => m.id === id);
    if (msg && msg.username === socket.username) {
      msg.text = newText;
      fs.writeFileSync(file, JSON.stringify(messages, null, 2));
      io.to(room).emit("message edited", { id, newText });
    }
  });

  socket.on("delete message", ({ id, room }) => {
    const file = getRoomFilePath(room);
    let messages = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
    const index = messages.findIndex((m) => m.id === id);
    if (index !== -1 && messages[index].username === socket.username) {
      messages.splice(index, 1);
      fs.writeFileSync(file, JSON.stringify(messages, null, 2));
      io.to(room).emit("message deleted", { id });
    }
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      delete onlineUsers[socket.username];
      io.emit("online users", Object.keys(onlineUsers));
    }
    console.log(`❌ Getrennt: ${socket.id}`);
  });

  socket.on("search users", (query) => {
    const matched = registeredUsers.filter((u) =>
      u.toLowerCase().includes(query)
    );
    socket.emit("search results", matched);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server läuft: http://localhost:${PORT}`);
});

function startBackup() {
  console.log('Starte Backup...');

  exec('node backup.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`Fehler beim Ausführen von backup.js: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
  });
}


setInterval(startBackup, 300000); // 5 Minuten