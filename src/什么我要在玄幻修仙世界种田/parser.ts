/**
 * 从完整的消息文本中严格提取 <statusbar>...</statusbar> 块内的 JSON 内容。
 * @param messageContent - 完整的聊天消息字符串。
 * @returns 清理后的 JSON 字符串，如果找不到或无效则返回空字符串。
 */
export function extractJsonFromStatusBar(messageContent: string): string {
  if (!messageContent) {
    return '';
  }

  // 第一层过滤: 严格查找并提取 <statusbar>...</statusbar> 之间的内容
  const startIndex = messageContent.indexOf('<statusbar>');
  const endIndex = messageContent.indexOf('</statusbar>');

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    console.error('未在消息中找到有效的 <statusbar>...</statusbar> 结构。');
    return '';
  }
  
  const contentToProcess = messageContent.substring(startIndex + '<statusbar>'.length, endIndex);

  // 从 <statusbar> 块内初步提取可能包含 JSON 的字符串
  let potentialJsonString;
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = contentToProcess.match(jsonRegex);

  if (match && match[1]) {
    potentialJsonString = match[1].trim();
  } else {
    potentialJsonString = contentToProcess.trim();
  }

  // 第二层保险: 从初步提取的字符串中，精确地只获取第一个 '{' 和最后一个 '}' 之间的内容
  const firstBracket = potentialJsonString.indexOf('{');
  const lastBracket = potentialJsonString.lastIndexOf('}');

  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    console.error('在 <statusbar> 块内未找到有效的JSON对象结构。内容:', contentToProcess);
    return '';
  }

  const finalJsonString = potentialJsonString.substring(firstBracket, lastBracket + 1);
  
  // 清理并返回最终的 JSON 字符串 (移除尾随逗号)
  return finalJsonString.replace(/,(?=\s*?[\]}])/g, '');
}
