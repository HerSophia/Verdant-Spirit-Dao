import _ from 'lodash';

// 定义图鉴条目和类型的基本结构
export type PokedexEntry = { [key: string]: any; 名称: string };
export type PokedexType = '妖兽' | '植物' | '物品';
export type ShareableType = PokedexType | '成就';
export type PokedexData = {
  妖兽: PokedexEntry[];
  植物: PokedexEntry[];
  物品: PokedexEntry[];
};
export type RemotePokedexData = PokedexData & {
  成就: PokedexEntry[];
};

const POKEDEX_VARIABLE_PATH = '世界.图鉴';

/**
 * 从全局变量中获取完整的图鉴数据
 * @returns {Promise<PokedexData>}
 */
export async function getPokedexData(): Promise<PokedexData> {
  const variables = getVariables({ type: 'global' });
  return _.get(variables, POKEDEX_VARIABLE_PATH, { 妖兽: [], 植物: [], 物品: [] });
}

/**
 * 将完整的图鉴数据保存回全局变量
 * @param {PokedexData} data - The full pokedex data object.
 */
async function savePokedexData(data: PokedexData): Promise<void> {
  await insertOrAssignVariables({ [POKEDEX_VARIABLE_PATH]: data }, { type: 'global' });
}

/**
 * 创建一个新的图鉴条目
 * @param {PokedexType} type - The type of the entry ('妖兽', '植物', '物品').
 * @param {PokedexEntry} entryData - The data for the new entry.
 * @returns {Promise<boolean>} - True if creation was successful, false otherwise.
 */
export async function createPokedexEntry(type: PokedexType, entryData: PokedexEntry): Promise<boolean> {
  if (!entryData.名称) {
    toastr.error('创建失败：条目必须包含“名称”字段。');
    return false;
  }
  const pokedex = await getPokedexData();
  if (pokedex[type].some(entry => entry.名称 === entryData.名称)) {
    toastr.warning(`创建失败：名为“${entryData.名称}”的${type}已存在。`);
    return false;
  }
  pokedex[type].push(entryData);
  await savePokedexData(pokedex);
  toastr.success(`成功添加【${entryData.名称}】到${type}图鉴！`);
  return true;
}

/**
 * 根据名称读取一个特定的图鉴条目
 * @param {PokedexType} type - The type of the entry.
 * @param {string} name - The name of the entry to read.
 * @returns {Promise<PokedexEntry | undefined>}
 */
export async function readPokedexEntry(type: PokedexType, name: string): Promise<PokedexEntry | undefined> {
  const pokedex = await getPokedexData();
  return pokedex[type].find(entry => entry.名称 === name);
}

/**
 * 更新一个现有的图鉴条目
 * @param {PokedexType} type - The type of the entry.
 * @param {string} originalName - The original name of the entry to update.
 * @param {PokedexEntry} updatedData - The new data for the entry.
 * @returns {Promise<boolean>} - True if update was successful, false otherwise.
 */
export async function updatePokedexEntry(type: PokedexType, originalName: string, updatedData: PokedexEntry): Promise<boolean> {
  if (!updatedData.名称) {
    toastr.error('更新失败：条目必须包含“名称”字段。');
    return false;
  }
  const pokedex = await getPokedexData();
  const entryIndex = pokedex[type].findIndex(entry => entry.名称 === originalName);

  if (entryIndex === -1) {
    toastr.error(`更新失败：未找到名为“${originalName}”的${type}。`);
    return false;
  }

  // Check for name collision if the name is changed
  if (originalName !== updatedData.名称 && pokedex[type].some(entry => entry.名称 === updatedData.名称)) {
    toastr.warning(`更新失败：名为“${updatedData.名称}”的${type}已存在。`);
    return false;
  }

  pokedex[type][entryIndex] = updatedData;
  await savePokedexData(pokedex);
  toastr.success(`成功更新【${updatedData.名称}】！`);
  return true;
}

/**
 * 删除一个图鉴条目
 * @param {PokedexType} type - The type of the entry.
 * @param {string} name - The name of the entry to delete.
 * @returns {Promise<boolean>} - True if deletion was successful, false otherwise.
 */
export async function deletePokedexEntry(type: PokedexType, name: string): Promise<boolean> {
  let deleteOccurred = false;
  await updateVariablesWith(variables => {
    const pokedex = _.get(variables, POKEDEX_VARIABLE_PATH, { 妖兽: [], 植物: [], 物品: [] });
    const initialLength = pokedex[type].length;
    pokedex[type] = pokedex[type].filter((entry: PokedexEntry) => entry.名称 !== name);
    if (pokedex[type].length < initialLength) {
      deleteOccurred = true;
      _.set(variables, POKEDEX_VARIABLE_PATH, pokedex);
    }
    return variables;
  }, { type: 'global' });

  if (deleteOccurred) {
    toastr.success(`成功删除【${name}】！`);
  } else {
    toastr.warning(`删除失败：未找到名为“${name}”的${type}。`);
  }
  return deleteOccurred;
}

/**
 * 提交新条目到后端服务器
 * @param {PokedexType} type - The type of the entry.
 * @param {PokedexEntry} entryData - The data of the new entry.
 * @param {string} [provider] - Optional name of the provider.
 */
export async function submitToHuggingFace(type: ShareableType, entryData: PokedexEntry, provider?: string): Promise<void> {
  const HUGGING_FACE_API_ENDPOINT = 'https://www-api-forum.rc6s3wcue.nyat.app:59690/api/pokedex';

  try {
    // 如果有提供者，则添加到条目数据中
    const entryWithProvider = provider ? { ...entryData, '贡献者': provider } : entryData;

    // 构造与服务器Zod schema匹配的数据格式
    const payload = {
      type: type,
      entry: entryWithProvider,
    };

    console.log('[Pokedex] Submitting to server:', payload);

    const response = await fetch(HUGGING_FACE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server responded with an error:', errorData);
      throw new Error(`服务器返回错误: ${response.status} - ${errorData.message || '未知错误'}`);
    }

    const result = await response.json();
    console.log('[Pokedex] Submission successful:', result);
    toastr.info('新条目已成功分享到社区！');

  } catch (error) {
    console.error('[Pokedex] Failed to submit to server:', error);
    toastr.error(`分享新条目失败: ${error instanceof Error ? error.message : '请查看控制台'}`);
  }
}

/**
 * 从后端服务器获取完整的图鉴数据
 * @returns {Promise<RemotePokedexData | null>}
 */
export async function getRemotePokedex(): Promise<RemotePokedexData | null> {
  const HUGGING_FACE_API_ENDPOINT = 'https://www-api-forum.rc6s3wcue.nyat.app:59690/api/pokedex';

  try {
    const response = await fetch(HUGGING_FACE_API_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`服务器返回错误: ${response.status}`);
    }

    const data = await response.json();
    // 为空数据提供默认值
    const validatedData: RemotePokedexData = {
      妖兽: data['妖兽'] || [],
      植物: data['植物'] || [],
      物品: data['物品'] || [],
      成就: data['成就'] || [],
    };
    return validatedData;

  } catch (error) {
    console.error('[Pokedex] Failed to fetch from server:', error);
    toastr.error(`从社区获取数据失败: ${error instanceof Error ? error.message : '请查看控制台'}`);
    return null;
  }
}

const ACHIEVEMENT_VARIABLE_PATH = '世界.系统';

/**
 * 从全局变量中获取完整的系统数据
 * @returns {Promise<any>}
 */
export async function getSystemData(): Promise<any> {
  const variables = getVariables({ type: 'global' });
  return _.get(variables, ACHIEVEMENT_VARIABLE_PATH, { 已完成: [], 成就点数: 0 });
}

/**
 * 将完整的系统数据保存回全局变量
 * @param {any} data - The full system data object.
 */
async function saveSystemData(data: any): Promise<void> {
  await insertOrAssignVariables({ [ACHIEVEMENT_VARIABLE_PATH]: data }, { type: 'global' });
}

/**
 * 从全局变量中获取所有成就
 * @returns {Promise<PokedexEntry[]>}
 */
export async function getAchievements(): Promise<PokedexEntry[]> {
  const systemData = await getSystemData();
  return systemData.已完成 || [];
}

/**
 * 创建一个新成就
 * @param {PokedexEntry} entryData - The data for the new achievement.
 * @returns {Promise<boolean>} - True if creation was successful, false otherwise.
 */
export async function createAchievement(entryData: PokedexEntry): Promise<boolean> {
  if (!entryData.名称) {
    toastr.error('创建失败：成就必须包含“名称”字段。');
    return false;
  }
  const systemData = await getSystemData();
  const achievements = systemData.已完成 || [];

  if (achievements.some((ach: PokedexEntry) => ach.名称 === entryData.名称)) {
    toastr.warning(`创建失败：名为“${entryData.名称}”的成就已存在。`);
    return false;
  }
  
  achievements.push(entryData);
  systemData.已完成 = achievements;
  
  // 如果条目数据中有点数，则增加总点数
  const pointsToAdd = Number(entryData['点数'] || 0);
  if (!isNaN(pointsToAdd)) {
      systemData.成就点数 = (systemData.成就点数 || 0) + pointsToAdd;
  }

  await saveSystemData(systemData);
  toastr.success(`成功添加新成就【${entryData.名称}】！`);
  return true;
}

/**
 * 更新一个现有的成就
 * @param {string} originalName - The original name of the achievement to update.
 * @param {PokedexEntry} updatedData - The new data for the achievement.
 * @returns {Promise<boolean>} - True if update was successful, false otherwise.
 */
export async function updateAchievement(originalName: string, updatedData: PokedexEntry): Promise<boolean> {
  if (!updatedData.名称) {
    toastr.error('更新失败：成就必须包含“名称”字段。');
    return false;
  }
  const systemData = await getSystemData();
  const achievements = systemData.已完成 || [];
  const entryIndex = achievements.findIndex((ach: PokedexEntry) => ach.名称 === originalName);

  if (entryIndex === -1) {
    toastr.error(`更新失败：未找到名为“${originalName}”的成就。`);
    return false;
  }

  if (originalName !== updatedData.名称 && achievements.some((ach: PokedexEntry) => ach.名称 === updatedData.名称)) {
    toastr.warning(`更新失败：名为“${updatedData.名称}”的成就已存在。`);
    return false;
  }
  
  const oldEntry = achievements[entryIndex];
  const oldPoints = Number(oldEntry['点数'] || 0);
  const newPoints = Number(updatedData['点数'] || 0);

  achievements[entryIndex] = updatedData;
  systemData.已完成 = achievements;
  
  // 更新总点数
  if (!isNaN(oldPoints) && !isNaN(newPoints)) {
      systemData.成就点数 = (systemData.成就点数 || 0) - oldPoints + newPoints;
  }

  await saveSystemData(systemData);
  toastr.success(`成功更新成就【${updatedData.名称}】！`);
  return true;
}

/**
 * 删除一个成就
 * @param {string} name - The name of the achievement to delete.
 * @returns {Promise<boolean>} - True if deletion was successful, false otherwise.
 */
export async function deleteAchievement(name: string): Promise<boolean> {
  let deleteOccurred = false;
  await updateVariablesWith(variables => {
    const systemData = _.get(variables, ACHIEVEMENT_VARIABLE_PATH, { 已完成: [], 成就点数: 0 });
    const achievements = systemData.已完成 || [];
    const initialLength = achievements.length;
    
    const entryToDelete = achievements.find((ach: PokedexEntry) => ach.名称 === name);
    if (!entryToDelete) {
      return variables; // No change
    }

    systemData.已完成 = achievements.filter((ach: PokedexEntry) => ach.名称 !== name);
    
    if (systemData.已完成.length < initialLength) {
      deleteOccurred = true;
      const pointsToRemove = Number(entryToDelete['点数'] || 0);
      if (!isNaN(pointsToRemove)) {
        systemData.成就点数 = (systemData.成就点数 || 0) - pointsToRemove;
      }
      _.set(variables, ACHIEVEMENT_VARIABLE_PATH, systemData);
    }
    return variables;
  }, { type: 'global' });

  if (deleteOccurred) {
    toastr.success(`成功删除成就【${name}】！`);
  } else {
    toastr.warning(`删除失败：未找到名为“${name}”的成就。`);
  }
  return deleteOccurred;
}
