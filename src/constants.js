export const SELECTORS = {
  CLAUDE_MESSAGE: '[data-test-render-count]:has(div[data-is-streaming])',
  STREAMING_DIV: 'div[data-is-streaming]',
  RESPONSE_CONTENT: '.font-claude-message, .font-claude-response',
};

export const MOUNT_MARKER_ATTR = 'data-cwe-mounted';

export const ROOT_PARENT_UUID = '00000000-0000-4000-8000-000000000000';

export const OPENING_SPLITTER = '='.repeat(40);
export const SPLITTER = '-'.repeat(40);

export const FRAMING =
  "I'd like to continue from a previous conversation; here it is.";

export const MANIFEST_PREAMBLE =
  "Files that were part of this conversation but aren't included below.\n" +
  "Please ask me to share them if you need them:";

export const MANIFEST_USER_HEADING = 'Files I attached:';
export const MANIFEST_CLAUDE_HEADING = 'Files you (Claude) generated:';

export const API = {
  ORGS: '/api/organizations',
  conversation: (orgId, convId) =>
    `/api/organizations/${orgId}/chat_conversations/${convId}` +
    '?tree=True&rendering_mode=messages&render_all_tools=true&consistency=strong',
};
