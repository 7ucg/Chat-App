const socket = io();
const roomsList = document.getElementById('rooms');
const messagesList = document.getElementById('messages');
const inputField = document.getElementById('input');
const form = document.getElementById('form');
const userSearchInput = document.getElementById('userSearchInput');
userSearchInput.addEventListener('input', renderFriendsList);
document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Willst du dich wirklich ausloggen?')) {
      localStorage.clear();
      window.location.href = '/';
    }
  });
let onlineUsers = [];

socket.on('online users', (users) => {
  onlineUsers = users.filter(u => u !== currentUsername); // mich selbst ausfiltern
});


let currentUsername = localStorage.getItem('username') || "Unbekannt";
let currentRoom = null;

socket.emit('register user', currentUsername); // <-- JETZT hier, erst wenn currentUsername existiert
// Jedes Mal, wenn im Suchfeld getippt wird:
userSearchInput.addEventListener('input', (e) => {
    const searchQuery = e.target.value.trim().toLowerCase();
    socket.emit('search users', searchQuery);
  });
  
  // Server schickt Ergebnisse zurück:
  socket.on('search results', (users) => {
    userList.innerHTML = '';
    users.forEach(user => {
      const li = document.createElement('li');
      li.textContent = user;
      li.addEventListener('click', () => {
        startPrivateChat(user);
      });
      userList.appendChild(li);
    });
  });
  
// Username ins Profil setzen
document.getElementById('profileName').textContent = currentUsername;
socket.on('update user list', (users) => {
    onlineUsers = users;
    renderFriendsList();
  });
  
// Profilbild ändern
const fileInput = document.getElementById('fileInput');
const profilePic = document.getElementById('profilePic');

// Profilbild laden wenn vorhanden 🔥
const savedProfilePic = localStorage.getItem('profilePic');
if (savedProfilePic) {
  profilePic.src = savedProfilePic;
}

// Profilbild upload und speichern
fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      profilePic.src = e.target.result;

      // Profilbild im localStorage speichern 🔥
      localStorage.setItem('profilePic', e.target.result);

      // 📤 Bild an Server schicken
      socket.emit('update profile picture', {
        username: currentUsername,
        profilePic: e.target.result
      });
    }
    reader.readAsDataURL(file);
  }
});

document.getElementById('profile').addEventListener('click', () => {
  fileInput.click();
});

// Raum betreten
// roomsList.addEventListener('click', (event) => {
//   const room = event.target.getAttribute('data-room');
//   if (!room) return;

//   currentRoom = room;
//   messagesList.innerHTML = '';

//   socket.emit('join room', { username: currentUsername, room });

//   document.querySelectorAll('.room').forEach(r => r.classList.remove('active'));
//   event.target.classList.add('active');
// });

roomsList.addEventListener('click', (event) => {
    const room = event.target.getAttribute('data-room');
    if (!room) return;
  
    if (room === 'Friends') {
      toggleFriendsSection();
      return; // Nicht normalen Raum joinen
    }
  
    document.getElementById('friendsSection').style.display = 'none'; // Friends Bereich verstecken
    currentRoom = room;
    messagesList.innerHTML = '';
    socket.emit('join room', { username: currentUsername, room });
  
    document.querySelectorAll('.room').forEach(r => r.classList.remove('active'));
    event.target.classList.add('active');
  });
  
  
// Nachricht senden
// form.addEventListener('submit', (e) => {
//   e.preventDefault();
//   if (!currentRoom) {
//     alert('Bitte zuerst einen Raum betreten.');
//     return;
//   }

//   const messageText = inputField.value.trim();
//   if (messageText) {
//     socket.emit('chat message', {
//       username: currentUsername,
//       text: messageText,
//       profilePic: profilePic.src
//     });
//     inputField.value = '';
//     inputField.focus();
//   }
// });
form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentRoom) {
      alert('Bitte zuerst einen Raum betreten.');
      return;
    }
  
    let messageText = inputField.value.trim();
    
    // 🔥 Hier Begrenzung einbauen
    const maxLength = 500;
    if (messageText.length > maxLength) {
      messageText = messageText.substring(0, maxLength); // Zu lange Nachricht kürzen
    }
  
    if (messageText) {
      socket.emit('chat message', {
        username: currentUsername,
        text: messageText,
        profilePic: profilePic.src
      });
      inputField.value = '';
      inputField.focus();
    }
  });
  
// Nachricht empfangen
// socket.on('chat message', (message) => {
//   const li = document.createElement('li');
//   li.classList.add('message-item');

// //   li.innerHTML = `
// //     <div class="message-line">
// //       <img src="${message.profilePic || 'default-avatar.png'}" class="message-pic">
// //       <span class="message-name">${message.username}:</span>
// //       <span class="message-text">${message.text}</span>
// //     </div>
// //   `;
//   messagesList.appendChild(li);
//   messagesList.scrollTop = messagesList.scrollHeight;

//   setTimeout(() => {
//     li.classList.add('fade-in');
//   }, 10);
// });
socket.on('chat message', (message) => {
    const li = document.createElement('li');
    li.classList.add('message-item');
  
    const messageLine = document.createElement('div');
    messageLine.classList.add('message-line');
  
    const img = document.createElement('img');
    img.src = message.profilePic || 'default-avatar.png';
    img.classList.add('message-pic');
  
    const usernameSpan = document.createElement('span');
    usernameSpan.classList.add('message-name', 'username-click');
    usernameSpan.dataset.username = message.username;
    usernameSpan.textContent = `${message.username}:`; // <- SAFE Text!
  
    const textSpan = document.createElement('span');
    textSpan.classList.add('message-text');
    textSpan.textContent = message.text; // <- SAFE Text!
  
    messageLine.appendChild(img);
    messageLine.appendChild(usernameSpan);
    messageLine.appendChild(textSpan);
    li.appendChild(messageLine);
  
    messagesList.appendChild(li);
    messagesList.scrollTop = messagesList.scrollHeight;
  
    usernameSpan.addEventListener('click', (e) => {
      const targetUser = e.target.dataset.username;
      if (targetUser && targetUser !== currentUsername) {
        openPrivateChatConfirm(targetUser);
      }
    });
  
    setTimeout(() => {
      li.classList.add('fade-in');
    }, 10);
  });
  
  
  
  socket.on('chat history', (messages) => {
    messagesList.innerHTML = ''; // Leeren
    messages.forEach((message) => {
      const li = document.createElement('li');
      li.classList.add('message-item');
  
      const messageLine = document.createElement('div');
      messageLine.classList.add('message-line');
  
      const img = document.createElement('img');
      img.src = message.profilePic || 'default-avatar.png';
      img.classList.add('message-pic');
  
      const usernameSpan = document.createElement('span');
      usernameSpan.classList.add('message-name');
      usernameSpan.textContent = `${message.username}:`; // Sicherer Text
  
      const textSpan = document.createElement('span');
      textSpan.classList.add('message-text');
      textSpan.textContent = message.text; // Sicherer Text
  
      messageLine.appendChild(img);
      messageLine.appendChild(usernameSpan);
      messageLine.appendChild(textSpan);
      li.appendChild(messageLine);
  
      messagesList.appendChild(li);
    });
  
    messagesList.scrollTop = messagesList.scrollHeight;
  });
  
  document.getElementById('deleteAccountBtn').addEventListener('click', () => {
    if (confirm('Willst du wirklich deinen Account und alle deine Nachrichten löschen? Diese Aktion ist unwiderruflich!')) {
      socket.emit('delete account', { username: currentUsername });
    }
  });
  socket.on('account deleted', () => {
    alert('Dein Account wurde gelöscht. Du wirst ausgeloggt.');
    localStorage.clear(); // Alles vom User löschen (username, profilbild)
    window.location.href = '/'; // Zurück zur Startseite
  });
  socket.on('reload messages', () => {
    if (currentRoom) {
      // Raum neu joinen, um Messages neu zu laden
      messagesList.innerHTML = '';
      socket.emit('join room', { username: currentUsername, room: currentRoom });
    }
  });
  

  function renderFriendsList() {
    const userSearchInput = document.getElementById('userSearchInput');
    const friendsList = document.getElementById('friendsList');
  
    // Lösche alte Listeneinträge
    friendsList.innerHTML = '';
  
    // Filter die onlineUsers
    const searchTerm = userSearchInput.value.toLowerCase();
  
    onlineUsers
      .filter(user => user.toLowerCase().includes(searchTerm) && user !== currentUsername) // sich selbst rausfiltern
      .forEach(user => {
        const li = document.createElement('li');
        li.style.cursor = 'pointer';
        li.style.padding = '5px 0';
        li.textContent = user;
        li.addEventListener('click', () => {
          startPrivateChat(user);
          document.getElementById('friendsSection').style.display = 'none';
        });
        friendsList.appendChild(li);
      });
  }
  
  function openFriendsSection() {
    const friendsSection = document.getElementById('friendsSection');
    const userSearchInput = document.getElementById('userSearchInput');
    const friendsList = document.getElementById('friendsList');
  
    friendsSection.style.display = 'block'; // Zeigen!
  
    // Suche aktualisieren
    userSearchInput.addEventListener('input', () => {
      renderFriendsList(userSearchInput.value);
    });
  
    renderFriendsList();
  }
  

  function toggleFriendsSection() {
    const friendsSection = document.getElementById('friendsSection');
    const isVisible = friendsSection.style.display === 'block';
    friendsSection.style.display = isVisible ? 'none' : 'block';
  
    if (!isVisible) {
      renderFriendsList();
    }
  }
  function renderPrivateRooms() {
    const privateRoomsList = document.getElementById('privateRoomsList');
    privateRoomsList.innerHTML = '';
  
    let privateRooms = JSON.parse(localStorage.getItem('privateRooms')) || [];
  
    privateRooms.forEach(room => {
      const otherUser = room.split('-').filter(name => name !== currentUsername)[0] || room; // Zeige den anderen User
  
      const li = document.createElement('li');
      li.classList.add('room');
      li.style.cursor = 'pointer';
      li.textContent = otherUser;
      li.addEventListener('click', () => {
        currentRoom = room;
        messagesList.innerHTML = '';
        socket.emit('join room', { username: currentUsername, room });
        document.querySelectorAll('.room').forEach(r => r.classList.remove('active'));
        li.classList.add('active');
      });
  
      privateRoomsList.appendChild(li);
    });
  }
  
  function startPrivateChat(otherUser) {
    const privateRoomName = [currentUsername, otherUser].sort().join('-');
    currentRoom = privateRoomName;
    messagesList.innerHTML = '';
    
    socket.emit('join room', { username: currentUsername, room: privateRoomName });
  
    // Speichere private Rooms im localStorage
    let privateRooms = JSON.parse(localStorage.getItem('privateRooms')) || [];
    if (!privateRooms.includes(privateRoomName)) {
      privateRooms.push(privateRoomName);
      localStorage.setItem('privateRooms', JSON.stringify(privateRooms));
    }
  
    renderPrivateRooms();
  }
  
  document.addEventListener('DOMContentLoaded', () => {
    renderPrivateRooms();
  });



  function openPrivateChatConfirm(otherUser) {
    const popup = document.createElement('div');
    popup.classList.add('popup-confirm');
  
    popup.innerHTML = `
      <div class="popup-inner">
        <p>Mit <b>${otherUser}</b> privat chatten?</p>
        <button id="startPrivateChat">Chat starten</button>
        <button id="cancelPrivateChat">Abbrechen</button>
      </div>
    `;
  
    document.body.appendChild(popup);
  
    document.getElementById('startPrivateChat').addEventListener('click', () => {
      startPrivateChat(otherUser);
      popup.remove();
    });
  
    document.getElementById('cancelPrivateChat').addEventListener('click', () => {
      popup.remove();
    });
  }
  



