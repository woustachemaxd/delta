export const SELECTORS = {
  CLAUDE_MESSAGE: '[data-test-render-count]:has(div[data-is-streaming])',
  STREAMING_DIV: 'div[data-is-streaming]',
  RESPONSE_CONTENT: '.font-claude-message, .font-claude-response',
};

export const MOUNT_MARKER_ATTR = 'data-delta-mounted';

export const ROOT_PARENT_UUID = '00000000-0000-4000-8000-000000000000';

export const OPENING_SPLITTER = '='.repeat(40);
export const SPLITTER = '-'.repeat(40);

export const FRAMING =
  "I'd like to continue from a previous conversation; here it is.";

export const MANIFEST_USER_HEADING = 'Files I attached:';
export const MANIFEST_CLAUDE_HEADING = 'Files you (Claude) generated:';
export const MANIFEST_TRAILING_INSTRUCTION =
  "Ask the user to share any specific file if you need its contents — they aren't included here.";

export const INLINE_TEXT_THRESHOLD_BYTES = 20480;

export const API = {
  ORGS: '/api/organizations',
  conversation: (orgId, convId) =>
    `/api/organizations/${orgId}/chat_conversations/${convId}` +
    '?tree=True&rendering_mode=messages&render_all_tools=true&consistency=strong',
};
