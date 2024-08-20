const typingForm = document.querySelector(".typing-form");
const chatContainer = document.querySelector(".chat-list");
const suggestions = document.querySelectorAll(".suggestion");
const deleteChatButton = document.querySelector("#delete-chat-button");
const uploadImageButton = document.querySelector("#upload-image-button");
const voiceInputButton = document.querySelector("#voice-input-button");
const newChatButton = document.querySelector("#new-chat-button");
const sidebar = document.querySelector('.sidebar');
const sidebarToggle = document.querySelector('#sidebar-toggle');
const mainContent = document.querySelector('.main-content');
const previousChats = document.querySelector('.previous-chats');
const typingInput = document.querySelector('.typing-input');
const audioPreview = document.querySelector('#audio-preview');
const audioPlayer = document.querySelector('#audio-player');
const cancelAudioButton = document.querySelector('#cancel-audio');
const sendAudioButton = document.querySelector('#send-audio');

// State variables
let userMessage = null;
let isResponseGenerating = false;
let mediaRecorder;
let audioChunks = [];

// API configuration
const API_KEY = "AIzaSyC7rRzi3oeNbDPGr7g_-QyJVOHFwIDkZQo";
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${API_KEY}`;

// Load chat data from local storage on page load
const loadDataFromLocalstorage = () => {
  const savedChats = localStorage.getItem("saved-chats");

  // Restore saved chats or clear the chat container
  chatContainer.innerHTML = savedChats || '';
  document.body.classList.toggle("hide-header", savedChats);

  chatContainer.scrollTo(0, chatContainer.scrollHeight); // Scroll to the bottom
  
  // Load previous chats into sidebar
  const chatTitles = JSON.parse(localStorage.getItem("chat-titles")) || [];
  chatTitles.forEach(title => addChatToSidebar(title));
};

// Create a new message element and return it
const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

// Show typing effect by displaying words one by one
const showTypingEffect = (text, textElement, incomingMessageDiv) => {
  const words = text.split(' ');
  let currentWordIndex = 0;

  const typingInterval = setInterval(() => {
    // Append each word to the text element with a space
    textElement.innerText += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex++];
    incomingMessageDiv.querySelector(".icon").classList.add("hide");

    // If all words are displayed
    if (currentWordIndex === words.length) {
      clearInterval(typingInterval);
      isResponseGenerating = false;
      incomingMessageDiv.querySelector(".icon").classList.remove("hide");
      localStorage.setItem("saved-chats", chatContainer.innerHTML); // Save chats to local storage
    }
    chatContainer.scrollTo(0, chatContainer.scrollHeight); // Scroll to the bottom
  }, 75);
};

// Fetch response from the API based on user message
const generateAPIResponse = async (incomingMessageDiv) => {
  const textElement = incomingMessageDiv.querySelector(".text"); // Getting text element

  try {
    // Send a POST request to the API with the user's message
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: userMessage }]
        }]
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);

    // Get the API response text and remove asterisks from it
    const apiResponse = data?.candidates[0].content.parts[0].text.replace(/\*\*(.*?)\*\*/g, '$1');
    showTypingEffect(apiResponse, textElement, incomingMessageDiv); // Show typing effect
  } catch (error) { // Handle error
    isResponseGenerating = false;
    textElement.innerText = error.message;
    textElement.parentElement.closest(".message").classList.add("error");
  } finally {
    incomingMessageDiv.classList.remove("loading");
  }
};

// Show a loading animation while waiting for the API response
const showLoadingAnimation = () => {
  const html = `<div class="message-content">
                  <img class="avatar" src="static/images/ravenx.png" alt="Raven avatar">
                  <p class="text"></p>
                  <div class="loading-indicator">
                    <div class="loading-bar"></div>
                    <div class="loading-bar"></div>
                    <div class="loading-bar"></div>
                  </div>
                </div>
                <span onClick="copyMessage(this)" class="icon material-symbols-rounded">content_copy</span>`;

  const incomingMessageDiv = createMessageElement(html, "incoming", "loading");
  chatContainer.appendChild(incomingMessageDiv);

  chatContainer.scrollTo(0, chatContainer.scrollHeight); // Scroll to the bottom
  generateAPIResponse(incomingMessageDiv);
};

// Copy message text to the clipboard
const copyMessage = (copyButton) => {
  const messageText = copyButton.parentElement.querySelector(".text").innerText;

  navigator.clipboard.writeText(messageText);
  copyButton.innerText = "done"; // Show confirmation icon
  setTimeout(() => copyButton.innerText = "content_copy", 1000); // Revert icon after 1 second
};

// Handle sending outgoing chat messages
const handleOutgoingChat = () => {
  userMessage = typingInput.value.trim() || userMessage;
  if (!userMessage || isResponseGenerating) return; // Exit if there is no message or response is generating

  isResponseGenerating = true;

  const html = `<div class="message-content">
                  <img class="avatar" src="static/images/user.png" alt="User avatar">
                  <p class="text"></p>
                </div>
                <span onClick="editMessage(this)" class="icon material-symbols-rounded">edit</span>
                <span onClick="regenerateResponse(this)" class="icon material-symbols-rounded">refresh</span>`;

  const outgoingMessageDiv = createMessageElement(html, "outgoing");
  outgoingMessageDiv.querySelector(".text").innerText = userMessage;
  chatContainer.appendChild(outgoingMessageDiv);

  typingForm.reset(); // Clear input field
  document.body.classList.add("hide-header");
  chatContainer.scrollTo(0, chatContainer.scrollHeight); // Scroll to the bottom
  setTimeout(showLoadingAnimation, 500); // Show loading animation after a delay
};

// Function to handle image upload
const handleImageUpload = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.alt = 'Uploaded Image';
        userMessage = `<img src="${e.target.result}" alt="Uploaded Image">`;
        handleOutgoingChat();
      };
      reader.readAsDataURL(file);
    }
  };
  input.click();
};

// Function to handle voice input
const handleVoiceInput = () => {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(audioBlob);
          audioPlayer.src = audioUrl;
          audioPreview.classList.remove('hidden');
        };

        mediaRecorder.start();
        voiceInputButton.textContent = 'stop';
      })
      .catch(error => console.error('Error accessing microphone:', error));
  } else {
    console.log('getUserMedia not supported on your browser!');
  }
};

// Function to stop recording
const stopRecording = () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    voiceInputButton.textContent = 'mic';
  }
};

// Function to edit user message
const editMessage = (editButton) => {
  const messageDiv = editButton.parentElement;
  const textElement = messageDiv.querySelector('.text');
  const originalText = textElement.innerText;

  textElement.contentEditable = true;
  textElement.focus();

  const saveButton = document.createElement('span');
  saveButton.className = 'icon material-symbols-rounded';
  saveButton.textContent = 'save';
  saveButton.onclick = () => {
    textElement.contentEditable = false;
    userMessage = textElement.innerText;
    saveButton.remove();
    regenerateResponse(editButton);
  };

  messageDiv.appendChild(saveButton);
};

// Function to regenerate response
const regenerateResponse = (regenerateButton) => {
  const messageDiv = regenerateButton.parentElement;
  const nextMessage = messageDiv.nextElementSibling;

  if (nextMessage && nextMessage.classList.contains('incoming')) {
    nextMessage.remove();
  }

  showLoadingAnimation();
};

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('expanded');
});

// Function to add a chat to the sidebar
function addChatToSidebar(chatTitle) {
  const chatElement = document.createElement('div');
  chatElement.classList.add('previous-chat');
  chatElement.textContent = chatTitle;
  chatElement.addEventListener('click', () => loadChat(chatTitle));
  previousChats.appendChild(chatElement);
}

// Modify the startNewChat function
function startNewChat() {
  if (chatContainer.innerHTML.trim() !== '') {
    const chatTitle = userMessage ? userMessage.substring(0, 30) : `Chat ${previousChats.children.length + 1}`;
    addChatToSidebar(chatTitle);
    // Save current chat before clearing
    localStorage.setItem(chatTitle, chatContainer.innerHTML);
    
    // Update chat titles in local storage
    const chatTitles = JSON.parse(localStorage.getItem("chat-titles")) || [];
    chatTitles.push(chatTitle);
    localStorage.setItem("chat-titles", JSON.stringify(chatTitles));
  }

  chatContainer.innerHTML = '';
  userMessage = null;
  isResponseGenerating = false;
  document.body.classList.remove("hide-header");
}

// Function to load a previous chat
function loadChat(chatTitle) {
  const savedChat = localStorage.getItem(chatTitle);
  if (savedChat) {
    chatContainer.innerHTML = savedChat;
    document.body.classList.add("hide-header");
    chatContainer.scrollTo(0, chatContainer.scrollHeight);
  }
}

// Update delete functionality to clear sidebar as well
deleteChatButton.addEventListener("click", () => {
  if (confirm("Are you sure you want to delete all the chats?")) {
    localStorage.clear();
    chatContainer.innerHTML = '';
    previousChats.innerHTML = '';
    loadDataFromLocalstorage();
  }
});

// Set userMessage and handle outgoing chat when a suggestion is clicked
suggestions.forEach(suggestion => {
  suggestion.addEventListener("click", () => {
    userMessage = suggestion.querySelector(".text").innerText;
    handleOutgoingChat();
  });
});

// Event listeners for new buttons
uploadImageButton.addEventListener("click", handleImageUpload);
voiceInputButton.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording();
  } else {
    handleVoiceInput();
  }
});
newChatButton.addEventListener("click", startNewChat);

cancelAudioButton.addEventListener("click", () => {
  audioPreview.classList.add('hidden');
  audioPlayer.src = '';
});

sendAudioButton.addEventListener("click", () => {
  userMessage = `[Audio Message]`;
  handleOutgoingChat();
  audioPreview.classList.add('hidden');
  audioPlayer.src = '';
});

// Prevent default form submission and handle outgoing chat
typingForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleOutgoingChat();
});

// Save current chat to recent chats when the page is about to unload
window.addEventListener('beforeunload', () => {
  if (chatContainer.innerHTML.trim() !== '') {
    startNewChat();
  }
});

// Auto-expand textarea
typingInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';
});

loadDataFromLocalstorage();