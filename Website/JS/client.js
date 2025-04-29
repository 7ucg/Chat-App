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
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.querySelector('.sidebar');

  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
let onlineUsers = [];

socket.on('online users', (users) => {
  onlineUsers = users.filter(u => u !== currentUsername); // mich selbst ausfiltern
});


let currentUsername = localStorage.getItem('username');
let currentRoom = null;
if (!localStorage.getItem("username")) {
    window.location.href = "/";
  }
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
  
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentRoom) return alert('Bitte wähle einen Raum.');
  
    const messageText = inputField.value.trim();
    const file = mediaInput.files[0];
  
    if (!messageText && !file) {
      alert('Bitte gib eine Nachricht ein oder wähle ein Medium.');
      return;
    }
  
    const message = {
      username: currentUsername,
      text: messageText,
      profilePic: profilePic.src
    };
  
    // Cleanup-Funktion nach dem Senden
    const resetAfterSend = () => {
      inputField.value = '';
      mediaInput.value = '';
      mediaPreview.innerHTML = '';
    };
  
    // Nur Textnachricht senden
    if (!file) {
      socket.emit('chat message', message);
      resetAfterSend();
      return;
    }
  
    // Mit Medium (Bild/Video)
    const allowedTypes = ['image/png', 'image/jpeg', 'video/mp4'];
    if (!allowedTypes.includes(file.type)) {
      alert('Nur PNG, JPG oder MP4 erlaubt!');
      mediaInput.value = '';
      return;
    }
  
    if (file.size > 10 * 1024 * 1024) {
      alert('Datei zu groß! Maximal 10MB.');
      mediaInput.value = '';
      return;
    }
  
    const reader = new FileReader();
    reader.onload = function (event) {
      message.media = {
        type: file.type,
        data: event.target.result
      };
  
      socket.emit('chat message', message);
      resetAfterSend();
    };
  
    reader.onerror = function () {
      alert('Fehler beim Lesen der Datei.');
      mediaInput.value = '';
    };
  
    reader.readAsDataURL(file);
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
  usernameSpan.classList.add('message-name');
  usernameSpan.textContent = `${message.username}:`;

  const textSpan = document.createElement('span');
  textSpan.classList.add('message-text');
  textSpan.textContent = message.text;

  messageLine.appendChild(img);
  messageLine.appendChild(usernameSpan);
  if (message.text) messageLine.appendChild(textSpan);
  li.appendChild(messageLine);

  // ✅ Medien anzeigen und klickbar machen
  if (message.media) {
    const mediaWrapper = document.createElement('div');
    mediaWrapper.classList.add('media-message');

    const type = message.media.type;
    const src = message.media.data;

    const media = document.createElement(type.startsWith('image/') ? 'img' : 'video');
    media.src = src;
    if (type.startsWith('video/')) media.controls = true;

    media.style.cursor = 'pointer';
    media.addEventListener('click', () => openFullscreen(src, type));

    mediaWrapper.appendChild(media);
    li.appendChild(mediaWrapper);
  }

  messagesList.appendChild(li);
  messagesList.scrollTop = messagesList.scrollHeight;
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
    usernameSpan.textContent = `${message.username}:`;

    const textSpan = document.createElement('span');
    textSpan.classList.add('message-text');
    textSpan.textContent = message.text;

    messageLine.appendChild(img);
    messageLine.appendChild(usernameSpan);
    if (message.text) messageLine.appendChild(textSpan);
    li.appendChild(messageLine);

    // ✅ Medien (Bild/Video) anzeigen & klickbar
    if (message.media) {
      const mediaWrapper = document.createElement('div');
      mediaWrapper.classList.add('media-message');

      const type = message.media.type;
      const src = message.media.data;

      const media = document.createElement(type.startsWith('image/') ? 'img' : 'video');
      media.src = src;
      if (type.startsWith('video/')) media.controls = true;

      media.style.cursor = 'pointer';
      media.addEventListener('click', () => openFullscreen(src, type));

      mediaWrapper.appendChild(media);
      li.appendChild(mediaWrapper);
    }

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
  



  function setAppHeight() {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  }
  window.addEventListener('resize', setAppHeight);
  window.addEventListener('load', setAppHeight);


  
  document.getElementById('saveProfileChanges').addEventListener('click', () => {
    const newUsername = document.getElementById('editUsername').value.trim();
    const newPassword = document.getElementById('editPassword').value.trim();
    const profilePicInput = document.getElementById('editProfilePic');
    const file = profilePicInput.files[0];
  
    const updateAndNotify = () => {
      socket.emit('update profile', {
        oldUsername: currentUsername,
        newUsername,
        newPassword
      });
  
      if (newUsername) {
        localStorage.setItem('username', newUsername);
        document.getElementById('profileName').textContent = newUsername;
      }
  
      showNotification("Profil erfolgreich aktualisiert!");
      document.getElementById('profileDialog').style.display = 'none';
    };
  
    if (file) {
      const allowedTypes = ['image/png', 'image/jpeg'];
      if (!allowedTypes.includes(file.type)) {
        alert('Nur PNG und JPG Dateien sind erlaubt!');
        profilePicInput.value = '';
        return;
      }
  
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          if (img.width > 10000 || img.height > 10000) {
            alert('Das Bild ist zu groß! Maximal 10000x10000 Pixel.');
            profilePicInput.value = '';
            return;
          }
  
          const imageData = e.target.result;
          profilePic.src = imageData;
          localStorage.setItem('profilePic', imageData);
          socket.emit('update profile picture', {
            username: currentUsername,
            profilePic: imageData
          });
  
          updateAndNotify();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      updateAndNotify();
    }
  });
  
  // ✅ Push-Noti oben Mitte
  function showNotification(text) {
    const notif = document.createElement('div');
    notif.textContent = text;
    Object.assign(notif.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#4caf50',
      color: 'white',
      padding: '12px 24px',
      borderRadius: '8px',
      boxShadow: '0 0 10px rgba(0,0,0,0.3)',
      zIndex: '9999',
      fontSize: '16px',
      fontWeight: 'bold'
    });
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
  }
  
  
  document.getElementById('profile').addEventListener('click', () => {
    document.getElementById('profileDialog').style.display = 'flex';
  });
  document.getElementById('cancelProfileDialog').addEventListener('click', () => {
    document.getElementById('profileDialog').style.display = 'none';
  });
  
  const mediaInput = document.getElementById('mediaInput');
  const mediaPreview = document.getElementById('mediaPreview');
  
  mediaInput.addEventListener('change', () => {
    mediaPreview.innerHTML = '';
    const file = mediaInput.files[0];
    if (!file) return;
  
    const allowedTypes = ['image/png', 'image/jpeg', 'video/mp4'];
    if (!allowedTypes.includes(file.type)) {
      alert('Nur PNG, JPG oder MP4 erlaubt!');
      mediaInput.value = '';
      return;
    }
  
    if (file.size > 60 * 1024 * 1024) {
      alert('Datei zu groß! Maximal 5MB.');
      mediaInput.value = '';
      return;
    }
  
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewEl = document.createElement(file.type.startsWith('image/') ? 'img' : 'video');
      previewEl.src = e.target.result;
      if (previewEl.tagName === 'VIDEO') previewEl.controls = true;
      previewEl.addEventListener('click', () => openFullscreen(previewEl.src, file.type));
      mediaPreview.appendChild(previewEl);
    };
    reader.readAsDataURL(file);
  });
  
  function openFullscreen(src, type) {
    const overlay = document.createElement('div');
    overlay.className = 'media-fullscreen-overlay';
  
    const media = document.createElement(type.startsWith('image/') ? 'img' : 'video');
    media.src = src;
    if (type.startsWith('video/')) media.controls = true;
  
    overlay.appendChild(media);
    document.body.appendChild(overlay);
  
    overlay.addEventListener('click', () => overlay.remove());
  }
  
