import { FRAMING, OPENING_SPLITTER, SPLITTER } from './constants.js';

function labelFor(sender, promptNumber) {
  return sender === 'user'
    ? `User Prompt ${promptNumber}:`
    : `Claude Response to User Prompt ${promptNumber}:`;
}

function renderTurn(sender, promptNumber, text) {
  return `${labelFor(sender, promptNumber)}\n${text}`;
}

export function build(conversation, sliceAtMessageUuid) {
  const sections = [FRAMING];

  const messages = conversation?.messages ?? [];
  if (messages.length === 0) {
    sections.push(OPENING_SPLITTER);
    return sections.join('\n\n');
  }

  let sliceIdx = messages.length - 1;
  if (sliceAtMessageUuid) {
    const found = messages.findIndex((m) => m.uuid === sliceAtMessageUuid);
    if (found >= 0) sliceIdx = found;
  }

  const turns = [];
  let promptNumber = 0;
  for (let i = 0; i <= sliceIdx; i++) {
    const msg = messages[i];
    if (msg.sender === 'user') {
      promptNumber += 1;
      turns.push({ leadingSplitter: OPENING_SPLITTER, body: renderTurn('user', promptNumber, msg.text) });
    } else {
      turns.push({ leadingSplitter: SPLITTER, body: renderTurn('claude', promptNumber || 1, msg.text) });
    }
  }

  for (const t of turns) {
    sections.push(t.leadingSplitter);
    sections.push(t.body);
  }

  return sections.join('\n\n');
}
