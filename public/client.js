const socket = io();
const roomsList = document.getElementById('rooms');
const messagesList = document.getElementById('messages');
const inputField = document.getElementById('input');
const form = document.getElementById('form');

let currentUsername = localStorage.getItem('username') || "Unbekannt";
let currentRoom = null;

// Username ins Profil setzen
document.getElementById('profileName').textContent = currentUsername;

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
roomsList.addEventListener('click', (event) => {
  const room = event.target.getAttribute('data-room');
  if (!room) return;

  currentRoom = room;
  messagesList.innerHTML = '';

  socket.emit('join room', { username: currentUsername, room });

  document.querySelectorAll('.room').forEach(r => r.classList.remove('active'));
  event.target.classList.add('active');
});

// Nachricht senden
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentRoom) {
    alert('Bitte zuerst einen Raum betreten.');
    return;
  }

  const messageText = inputField.value.trim();
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
socket.on('chat message', (message) => {
  const li = document.createElement('li');
  li.classList.add('message-item');

  li.innerHTML = `
    <div class="message-line">
      <img src="${message.profilePic || 'default-avatar.png'}" class="message-pic">
      <span class="message-name">${message.username}:</span>
      <span class="message-text">${message.text}</span>
    </div>
  `;

  messagesList.appendChild(li);
  messagesList.scrollTop = messagesList.scrollHeight;

  setTimeout(() => {
    li.classList.add('fade-in');
  }, 10);
});
