const form = document.getElementById('chat-form');
const input = document.getElementById('message-input');
const messagesContainer = document.getElementById('chat-messages');
const sendButton = document.getElementById('send-button');

const conversation = [];

function addMessage(text, className) {
  const message = document.createElement('div');
  message.className = `message ${className}`;
  message.textContent = text;
  messagesContainer.appendChild(message);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return message;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || sendButton.disabled) return;

  addMessage(text, 'message-user');
  conversation.push({ role: 'user', content: text });
  input.value = '';
  input.focus();
  sendButton.disabled = true;

  const answer = addMessage('', 'message-assistant');
  let receivedContent = false;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversation })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Permintaan gagal (${response.status})`);
    }
    if (!response.body) throw new Error('Respons streaming tidak tersedia.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const eventText of events) {
        const dataLine = eventText.split('\n').find((line) => line.startsWith('data:'));
        if (!dataLine) continue;
        const data = JSON.parse(dataLine.slice(5).trim());
        if (data.error) throw new Error(data.error);
        if (data.content) {
          answer.textContent += data.content;
          receivedContent = true;
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }
    }

    if (receivedContent) {
      conversation.push({ role: 'assistant', content: answer.textContent });
    } else {
      answer.remove();
    }
  } catch (error) {
    answer.remove();
    addMessage(`Gagal mengirim pesan: ${error.message}`, 'message-error');
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
});
