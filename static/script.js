const typingForm = document.querySelector(".typing-form");
const chatContainer = document.querySelector(".chat-list");
const suggestions = document.querySelectorAll(".suggestion");
const toggleThemeButton = document.querySelector("#theme-toggle-button");
const deleteChatButton = document.querySelector("#delete-chat-button");
const uploadImageButton = document.querySelector("#upload-image-button");
const voiceInputButton = document.querySelector("#voice-input-button");
const newChatButton = document.querySelector("#new-chat-button");
const sidebar = document.querySelector('.sidebar');
const sidebarToggle = document.querySelector('#sidebar-toggle');
const mainContent = document.querySelector('.main-content');
const previousChats = document.querySelector('.previous-chats');

// State variables
let userMessage = null;
let isResponseGenerating = false;

// API configuration
const API_KEY = "AIzaSyBq1y6wzpMaOwunDUDNtq058aq_tggjTYE"; // Your API key here
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${API_KEY}`;

// Load theme and chat data from local storage on page load
const loadDataFromLocalstorage = () => {
  const savedChats = localStorage.getItem("saved-chats");
  const isLightMode = (localStorage.getItem("themeColor") === "light_mode");

  // Apply the stored theme
  document.body.classList.toggle("light_mode", isLightMode);
  toggleThemeButton.innerText = isLightMode ? "dark_mode" : "light_mode";

  // Restore saved chats or clear the chat container
  chatContainer.innerHTML = savedChats || '';
  document.body.classList.toggle("hide-header", savedChats);

  chatContainer.scrollTo(0, chatContainer.scrollHeight); // Scroll to the bottom
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
  userMessage = typingForm.querySelector(".typing-input").value.trim() || userMessage;
  if (!userMessage || isResponseGenerating) return; // Exit if there is no message or response is generating

  isResponseGenerating = true;

  const html = `<div class="message-content">
                  <img class="avatar" src="static/images/user.png" alt="User avatar">
                  <p class="text"></p>
                </div>`;

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
          // TODO: Handle image upload to server and response here
          console.log(`Image selected: ${file.name}`);
      }
  };
  input.click();
};

// Function to handle voice input
const handleVoiceInput = () => {
  if ('webkitSpeechRecognition' in window) {
      const recognition = new webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          typingForm.querySelector(".typing-input").value = transcript;
      };

      recognition.start();
  } else {
      console.log('Speech recognition not supported');
  }
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
    const chatTitle = `Chat ${previousChats.children.length + 1}`;
    addChatToSidebar(chatTitle);
    // Save current chat before clearing
    localStorage.setItem(chatTitle, chatContainer.innerHTML);
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

// Move theme toggle and delete buttons to sidebar
const sidebarBottom = document.querySelector('.sidebar-bottom');
sidebarBottom.appendChild(toggleThemeButton);
sidebarBottom.appendChild(deleteChatButton);

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
voiceInputButton.addEventListener("click", handleVoiceInput);
newChatButton.addEventListener("click", startNewChat);

// Prevent default form submission and handle outgoing chat
typingForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleOutgoingChat();
});

loadDataFromLocalstorage();
