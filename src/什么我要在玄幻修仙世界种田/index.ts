import './index.scss';
import { extractJsonFromStatusBar } from './parser';
import type { PokedexData, PokedexEntry, PokedexType, RemotePokedexData, ShareableType } from './pokedex';
import * as Pokedex from './pokedex';
import { renderSystem } from './systems';
import { checkForUpdates, showChangelogModal } from './version';

const triggerAction = async (text: string, index: number) => {
  if (!text || text.trim().length === 0) return;

  try {
    // 获取当前楼层的变量
    const messageId = getCurrentMessageId();
    const variables = getVariables({ type: 'message', message_id: messageId });

    // 将行动选择也添加到变量中
    variables['行动选择'] = index + 1;
    
    // 将变量转换为字符串
    const variablesString = JSON.stringify(variables, null, 2);

    // 准备发送给AI的引导文本
    const preamble = `[OOC: 以下是发送给你的、用于驱动剧情的完整游戏状态。请仔细阅读并依据此状态和我选择的行动来生成后续情节。]\n\n**当前游戏状态**:\n这是当前楼层的所有变量信息，它代表了游戏世界的完整快照，包括角色状态、物品、图鉴、系统进度等。请将这些信息作为你生成回应的唯一真实来源。`;
    
    // 将引导文本和变量JSON都包裹起来
    const wrappedContent = `<variables>\n${preamble}\n\n${variablesString}\n</variables>`;

    // 准备最终要发送的消息
    const messageToSend = `${wrappedContent}\n\n${text}`;

    // 使用 /send 命令发送消息
    const command = `/send ${messageToSend} | /trigger`;
    await triggerSlash(command);
    
    toastr.success(`已选择行动: ${text}`);
  } catch (error) {
    console.error("行动失败:", error);
    toastr.error("行动失败，请查看控制台日志。");
    // 如果失败，需要恢复选项列表
    const optionsList = $('#options-list');
    if (optionsList.hasClass('disabled')) {
      // 这里需要一个函数来重新渲染选项，暂时先移除disabled状态
      // 实际应用中可能需要调用 storyRenderer.renderActionOptions()
      optionsList.removeClass('disabled'); 
    }
  }
};

function initGlobalControls() {
  const bodyElement = document.body;
  const themeDropdownBtn = document.getElementById('theme-dropdown-btn');
  const themeOptions = document.getElementById('theme-options');
  const themeButtons = document.querySelectorAll('#theme-options .theme-btn');
  const savedTheme = localStorage.getItem('storyTheme') || 'night';

  const switchToTheme = (theme: string) => {
    bodyElement.classList.remove('day-mode', 'jade-mode', 'classic-mode');
    if (theme !== 'night') {
      bodyElement.classList.add(`${theme}-mode`);
    }
    localStorage.setItem('storyTheme', theme);
  };

  switchToTheme(savedTheme);

  themeDropdownBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    themeOptions?.classList.toggle('hidden');
  });

  themeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const theme = button.getAttribute('data-theme');
      if (theme) switchToTheme(theme);
      themeOptions?.classList.add('hidden');
    });
  });

  document.addEventListener('click', (e) => {
    const dropdownContainer = document.querySelector('.theme-switcher-dropdown');
    if (dropdownContainer && !dropdownContainer.contains(e.target as Node)) {
      themeOptions?.classList.add('hidden');
    }
  });
}

function initPokedexManager(storyRenderer: StoryRenderer, showModalWithData: (data: any) => void) {
  const managerBtn = document.getElementById('manage-pokedex-btn');
  const modal = document.getElementById('pokedex-manager-modal');
  const closeModalBtn = document.getElementById('pokedex-manager-close-btn');
  const mainTabs = modal?.querySelectorAll('.main-tab-btn');
  const viewTabContent = document.getElementById('pokedex-view-tab');
  const addTabContent = document.getElementById('pokedex-add-tab');
  const injectBtn = document.getElementById('inject-pokedex-btn');
  const submitEntryBtn = document.getElementById('submit-entry-btn') as HTMLButtonElement;
  const helpBtn = document.getElementById('pokedex-help-btn');
  const helpContent = document.getElementById('pokedex-help-content');

  const formModeContent = document.getElementById('form-mode-content');
  const jsonModeContent = document.getElementById('json-mode-content');
  const addTabModeButtons = addTabContent?.querySelectorAll('.tab-btn');
  let currentAddMode = 'form';

  const formFieldsContainer = document.getElementById('form-fields-container');
  const addFieldBtn = document.getElementById('add-field-btn');
  const entryTypeRadios = document.querySelectorAll('input[name="entryType"]');
  const jsonInput = document.getElementById('json-input') as HTMLTextAreaElement;

  const createFormFieldRow = (key = '', value = ''): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'form-field-row';
    row.innerHTML = `
      <input type="text" class="form-key-input" placeholder="属性" value="${key}">
      <input type="text" class="form-value-input" placeholder="值" value="${value}">
      <button class="remove-field-btn" title="移除此字段"><i class="fas fa-times"></i></button>
    `;
    row.querySelector('.remove-field-btn')?.addEventListener('click', () => row.remove());
    return row;
  };

  const addField = (key = '', value = '') => {
    formFieldsContainer?.appendChild(createFormFieldRow(key, value));
  };

  const updateFormFields = (type: string) => {
    if (!formFieldsContainer) return;
    formFieldsContainer.innerHTML = '';
    switch (type) {
      case '妖兽': addField('名称', ''); addField('等级', ''); addField('习性', ''); break;
      case '植物': addField('名称', ''); addField('品阶', ''); addField('功效', ''); break;
      case '物品': addField('名称', ''); addField('品阶', ''); addField('描述', ''); break;
      case '成就': addField('名称', ''); addField('描述', ''); addField('日期', ''); addField('点数', '0'); break;
      default: addField('名称', ''); break;
    }
  };

  const resetAddForm = () => {
    if (!submitEntryBtn) return;
    submitEntryBtn.innerHTML = '<i class="fas fa-plus mr-2"></i>确认添加';
    delete submitEntryBtn.dataset.updateMode;
    delete submitEntryBtn.dataset.originalName;
    delete submitEntryBtn.dataset.originalType;
    const checkedRadio = document.querySelector('input[name="entryType"]:checked') as HTMLInputElement;
    if (checkedRadio) updateFormFields(checkedRadio.value);
  };

  const populateViewTab = async () => {
    if (!viewTabContent) return;
    
    const discoveriesSection = document.getElementById('new-discoveries-section');
    const discoveriesList = document.getElementById('new-discoveries-list');

    // 1. Populate New Discoveries
    if (discoveriesList && discoveriesSection) {
      discoveriesList.innerHTML = `<p class="text-center text-secondary p-4 text-sm">正在检查新发现...</p>`;
      const messageId = getCurrentMessageId();
      const messageVars = getVariables({ type: 'message', message_id: messageId });
      const messagePokedex = _.get(messageVars, '世界.图鉴', {});
      const globalPokedex = await Pokedex.getPokedexData();
      
      let diffHtml = '';
      let diffCount = 0;
      const types: PokedexType[] = ['妖兽', '植物', '物品'];

      types.forEach(type => {
        const messageEntries = messagePokedex[type] || [];
        const globalNames = new Set(globalPokedex[type].map(e => e.名称));
        const diffEntries = messageEntries.filter((e: PokedexEntry) => e.名称 && !globalNames.has(e.名称));

        if (diffEntries.length > 0) {
          diffCount += diffEntries.length;
          diffHtml += `<h4 class="font-semibold text-primary/90 mt-2 first:mt-0">${type}</h4><ul>`;
          diffEntries.forEach((entry: PokedexEntry) => {
            diffHtml += `<li class="p-2 rounded-lg bg-main/50"><label class="flex items-center cursor-pointer"><input type="checkbox" class="mr-3" data-type="${type}" data-name="${entry.名称}" checked><span>${entry.名称}</span></label></li>`;
          });
          diffHtml += `</ul>`;
        }
      });

      if (diffCount === 0) {
        discoveriesSection.style.display = 'none';
      } else {
        discoveriesSection.style.display = 'block';
        discoveriesList.innerHTML = diffHtml;
      }
    }

    // 2. Populate Existing Pokedex
    const existingPokedexContainer = document.getElementById('existing-pokedex-list');
    if (!existingPokedexContainer) return;
    existingPokedexContainer.innerHTML = `<div class="flex justify-center items-center p-4"><div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-400"></div></div>`;
    const pokedexData = await Pokedex.getPokedexData();
    let html = '';
    const types: PokedexType[] = ['妖兽', '植物', '物品'];
    
    types.forEach(type => {
      const entries = pokedexData[type];
      html += `<details class="group" open><summary class="font-bold text-lg cursor-pointer hover:text-accent transition-colors theme-transition flex justify-between items-center py-2">${type}图鉴 (${entries.length})<i class="fas fa-chevron-down transition-transform duration-300 group-open:rotate-180"></i></summary><ul class="space-y-2 mt-2">`;
      if (entries.length > 0) {
        entries.forEach(entry => {
          html += `
            <li class="p-2 rounded-lg bg-secondary/50 flex justify-between items-center">
              <label class="flex items-center cursor-pointer flex-grow mr-4">
                <input type="checkbox" class="mr-3" data-type="${type}" data-name="${entry.名称}">
                <span class="truncate" title="${entry.名称}">${entry.名称}</span>
              </label>
              <div class="space-x-2 flex-shrink-0">
                <button class="pokedex-view-btn text-sm text-blue-400 hover:text-blue-300 transition-colors p-1" data-type="${type}" data-name="${entry.名称}" title="查看"><i class="fas fa-eye"></i></button>
                <button class="pokedex-edit-btn text-sm text-accent hover:text-accent-hover transition-colors p-1" data-type="${type}" data-name="${entry.名称}" title="编辑"><i class="fas fa-pencil-alt"></i></button>
                <button class="pokedex-delete-btn text-sm text-red-500 hover:text-red-400 transition-colors p-1" data-type="${type}" data-name="${entry.名称}" title="删除"><i class="fas fa-trash"></i></button>
              </div>
            </li>`;
        });
      } else {
        html += `<li class="text-secondary text-sm italic p-2">暂无条目</li>`;
      }
      html += `</ul></details>`;
    });
    existingPokedexContainer.innerHTML = html;

    // 3. Populate Achievements
    const achievementsContainer = document.getElementById('achievements-pokedex-list');
    if (achievementsContainer) {
      const systemData = await Pokedex.getSystemData();
      const achievements = systemData.已完成 || [];
      const points = systemData.成就点数 || 0;

      let achievementsHtml = `
        <details class="group" open>
          <summary class="font-bold text-lg cursor-pointer hover:text-accent transition-colors theme-transition flex justify-between items-center py-2">
            成就图鉴 (已解锁 ${achievements.length}, 共 ${points} 点)
            <i class="fas fa-chevron-down transition-transform duration-300 group-open:rotate-180"></i>
          </summary>
          <ul class="space-y-2 mt-2">
      `;

      if (achievements.length > 0) {
        achievements.forEach((ach: any) => {
          const achName = ach['名称'];
          achievementsHtml += `
            <li class="p-3 rounded-lg bg-secondary/50 border border-dim flex justify-between items-center">
              <div class="flex-grow">
                <p class="font-semibold text-primary flex justify-between items-center">
                  <span><i class="fas fa-trophy mr-2 text-yellow-400"></i>${achName}</span>
                  <span class="text-xs font-normal text-secondary">${ach['日期'] || ''}</span>
                </p>
                <p class="text-sm text-secondary mt-1 pl-6">${ach['描述'] || '没有描述。'}</p>
              </div>
              <div class="space-x-2 flex-shrink-0 ml-4">
                <button class="pokedex-edit-btn text-sm text-accent hover:text-accent-hover transition-colors p-1" data-type="成就" data-name="${achName}" title="编辑"><i class="fas fa-pencil-alt"></i></button>
                <button class="pokedex-delete-btn text-sm text-red-500 hover:text-red-400 transition-colors p-1" data-type="成就" data-name="${achName}" title="删除"><i class="fas fa-trash"></i></button>
              </div>
            </li>
          `;
        });
      } else {
        achievementsHtml += `<li class="text-secondary text-sm italic p-2">尚未解锁任何成就</li>`;
      }

      achievementsHtml += `</ul></details>`;
      achievementsContainer.innerHTML = achievementsHtml;
    }
  };

  const showModal = async () => {
    await populateViewTab();
    modal?.classList.remove('hidden');
  };
  const hideModal = () => modal?.classList.add('hidden');

  managerBtn?.addEventListener('click', showModal);
  closeModalBtn?.addEventListener('click', hideModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) hideModal();
  });

  helpBtn?.addEventListener('click', () => {
    helpContent?.classList.toggle('hidden');
    helpBtn.classList.toggle('active');
  });

  document.getElementById('approve-discoveries-btn')?.addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll<HTMLInputElement>('#new-discoveries-list input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
      toastr.warning('请至少选择一个要收录的条目。');
      return;
    }

    const messageId = getCurrentMessageId();
    const messageVars = getVariables({ type: 'message', message_id: messageId });
    const messagePokedex = _.get(messageVars, '世界.图鉴', {});
    let successCount = 0;

    for (const cb of checkboxes) {
      const type = cb.dataset.type as PokedexType;
      const name = cb.dataset.name;
      if (type && name && messagePokedex[type]) {
        const entry = messagePokedex[type].find((e: PokedexEntry) => e.名称 === name);
        if (entry) {
          if (await Pokedex.createPokedexEntry(type, entry)) {
            successCount++;
          }
        }
      }
    }

    if (successCount > 0) {
      toastr.success(`成功收录了 ${successCount} 个新条目！`);
      await populateViewTab();
    }
  });

  mainTabs?.forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.getAttribute('data-tab');
      mainTabs.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      resetAddForm();

      viewTabContent?.classList.add('hidden');
      addTabContent?.classList.add('hidden');
      injectBtn?.classList.add('hidden');
      submitEntryBtn?.classList.add('hidden');

      if (tab === 'view') {
        viewTabContent?.classList.remove('hidden');
        injectBtn?.classList.remove('hidden');
      } else if (tab === 'add') {
        addTabContent?.classList.remove('hidden');
        submitEntryBtn?.classList.remove('hidden');
      }
    });
  });

  injectBtn?.addEventListener('click', async () => {
    const selectedEntries: { [key in PokedexType]?: PokedexEntry[] } = {};
    const checkboxes = modal?.querySelectorAll<HTMLInputElement>('#pokedex-view-tab input[type="checkbox"]:checked');
    
    if (!checkboxes || checkboxes.length === 0) {
      toastr.warning('请至少选择一个要注入的条目。');
      return;
    }

    const pokedexData = await Pokedex.getPokedexData();

    checkboxes.forEach(cb => {
      const type = cb.dataset.type as PokedexType;
      const name = cb.dataset.name;
      if (type && name) {
        const entry = pokedexData[type].find(e => e.名称 === name);
        if (entry) {
          if (!selectedEntries[type]) {
            selectedEntries[type] = [];
          }
          selectedEntries[type]!.push(entry);
        }
      }
    });

    if (_.isEmpty(selectedEntries)) return;

    const messageId = getCurrentMessageId();
    const currentVars = getVariables({ type: 'message', message_id: messageId });
    
    const updates = {};
    for (const [type, entries] of Object.entries(selectedEntries)) {
        const path = `世界.图鉴.${type}`;
        const existingEntries = _.get(currentVars, path, []);
        const newEntries = _.unionBy(existingEntries, entries, '名称');
        _.set(updates, path, newEntries);
    }

    await insertOrAssignVariables(updates, { type: 'message', message_id: messageId });
    toastr.success('成功注入图鉴到当前楼层！');
    hideModal();
    storyRenderer.init();
  });

  addTabModeButtons?.forEach(button => {
    button.addEventListener('click', () => {
      const mode = button.getAttribute('data-mode');
      if (!mode || mode === currentAddMode) return;
      currentAddMode = mode;
      addTabModeButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      if (mode === 'form') {
        formModeContent?.classList.remove('hidden');
        jsonModeContent?.classList.add('hidden');
      } else {
        formModeContent?.classList.add('hidden');
        jsonModeContent?.classList.remove('hidden');
      }
    });
  });
  
  const checkedRadio = document.querySelector('input[name="entryType"]:checked') as HTMLInputElement;
  if (checkedRadio) updateFormFields(checkedRadio.value);

  addFieldBtn?.addEventListener('click', () => addField());
  entryTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      updateFormFields((e.target as HTMLInputElement).value)
    });
  });

  submitEntryBtn?.addEventListener('click', async () => {
    const isUpdate = submitEntryBtn.dataset.updateMode === 'true';

    if (currentAddMode === 'form') {
      const type = (document.querySelector('input[name="entryType"]:checked') as HTMLInputElement)?.value;
      const newEntry: PokedexEntry = { '名称': '' };
      const rows = formFieldsContainer?.querySelectorAll('.form-field-row');
      rows?.forEach(row => {
        const key = (row.querySelector('.form-key-input') as HTMLInputElement)?.value.trim();
        const value = (row.querySelector('.form-value-input') as HTMLInputElement)?.value.trim();
        if (key) newEntry[key] = value;
      });

      if (!newEntry.名称) {
        toastr.warning('“名称”是必填字段！');
        return;
      }

      if (isUpdate) {
        const originalName = submitEntryBtn.dataset.originalName;
        const originalType = submitEntryBtn.dataset.originalType;

        if (!originalName || !originalType || !type) {
          toastr.error('更新失败：缺少必要信息。');
          return;
        }

        if (originalType === type) {
          // Type hasn't changed, just update
          if (type === '成就') {
            await Pokedex.updateAchievement(originalName, newEntry);
          } else {
            await Pokedex.updatePokedexEntry(type as PokedexType, originalName, newEntry);
          }
        } else {
          // Type has changed, so we delete the old and create a new one
          if (originalType === '成就') {
            await Pokedex.deleteAchievement(originalName);
          } else {
            await Pokedex.deletePokedexEntry(originalType as PokedexType, originalName);
          }

          if (type === '成就') {
            await Pokedex.createAchievement(newEntry);
          } else {
            await Pokedex.createPokedexEntry(type as PokedexType, newEntry);
          }
          toastr.info(`条目已从“${originalType}”移动到“${type}”`);
        }
        resetAddForm();
      } else {
        // Create new entry
        if (!type) {
          toastr.warning('请选择条目类型！');
          return;
        }
        if (type === '成就') {
          const success = await Pokedex.createAchievement(newEntry);
          if (success) updateFormFields(type);
        } else {
          const success = await Pokedex.createPokedexEntry(type as PokedexType, newEntry);
          if (success) {
            updateFormFields(type);
          }
        }
      }
    } else if (currentAddMode === 'json') { // JSON mode
      const type = (document.querySelector('input[name="jsonEntryType"]:checked') as HTMLInputElement)?.value as PokedexType | '成就';
      const jsonString = jsonInput?.value.trim();
      if (!jsonString) {
        toastr.warning('请输入JSON数据！');
        return;
      }
      try {
        const data = JSON.parse(jsonString);
        const entries = Array.isArray(data) ? data : [data];
        let successCount = 0;

        if (type === '成就') {
          for (const entry of entries) {
            if (await Pokedex.createAchievement(entry)) {
              successCount++;
            }
          }
          if (successCount > 0) {
            toastr.success(`成功处理 ${successCount} 个新成就！`);
            jsonInput.value = '';
          }
        } else {
          for (const entry of entries) {
            if (await Pokedex.createPokedexEntry(type, entry)) {
              successCount++;
            }
          }
          if (successCount > 0) jsonInput.value = '';
        }
      } catch (error) {
        toastr.error('JSON解析失败，请检查格式！');
        console.error("JSON parsing failed:", error);
      }
    }
    await populateViewTab();
  });

  viewTabContent?.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const deleteButton = target.closest('.pokedex-delete-btn');
    const editButton = target.closest('.pokedex-edit-btn');
    const viewButton = target.closest('.pokedex-view-btn');

    if (viewButton) {
      const type = viewButton.getAttribute('data-type') as PokedexType | '成就';
      const name = viewButton.getAttribute('data-name');
      if (type && name) {
        if (type === '成就') {
          const achievements = await Pokedex.getAchievements();
          const entry = achievements.find((ach: any) => ach['名称'] === name);
          if (entry) showModalWithData(entry);
        } else {
          const entry = await Pokedex.readPokedexEntry(type, name);
          if (entry) {
            showModalWithData(entry);
          }
        }
      }
    }

    if (deleteButton) {
      const type = deleteButton.getAttribute('data-type') as PokedexType | '成就';
      const name = deleteButton.getAttribute('data-name');
      if (type && name) {
        if (confirm(`确定要删除 ${type} 图鉴中的 “${name}” 吗？此操作不可撤销。`)) {
          let success = false;
          if (type === '成就') {
            success = await Pokedex.deleteAchievement(name);
          } else {
            success = await Pokedex.deletePokedexEntry(type, name);
          }
          if (success) {
            await populateViewTab();
          }
        }
      }
    }

    if (editButton) {
      const type = editButton.getAttribute('data-type') as PokedexType | '成就';
      const name = editButton.getAttribute('data-name');
      if (type && name) {
        let entry: PokedexEntry | null = null;
        if (type === '成就') {
          const achievements = await Pokedex.getAchievements();
          entry = achievements.find((ach: any) => ach['名称'] === name) ?? null;
        } else {
          entry = (await Pokedex.readPokedexEntry(type as PokedexType, name)) ?? null;
        }

        if (entry) {
          mainTabs?.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-tab') === 'add'));
          viewTabContent?.classList.add('hidden');
          addTabContent?.classList.remove('hidden');
          injectBtn?.classList.add('hidden');
          submitEntryBtn?.classList.remove('hidden');

          addTabModeButtons?.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-mode') === 'form'));
          formModeContent?.classList.remove('hidden');
          jsonModeContent?.classList.add('hidden');
          currentAddMode = 'form';

          (document.querySelector(`input[name="entryType"][value="${type}"]`) as HTMLInputElement).checked = true;
          
          if (formFieldsContainer) formFieldsContainer.innerHTML = '';
          Object.entries(entry).forEach(([key, value]) => {
            addField(key, String(value));
          });

          submitEntryBtn.innerHTML = '<i class="fas fa-check mr-2"></i>确认更新';
          submitEntryBtn.dataset.updateMode = 'true';
          submitEntryBtn.dataset.originalName = name;
          submitEntryBtn.dataset.originalType = type;
        }
      }
    }
  });
}

class StoryRenderer {
  private yamlData: any;
  private rawYamlContent: string;
  private rootNodeKey: string | null;
  private elements: {
    statusBarTitle: HTMLElement | null;
    timeDisplay: HTMLElement | null;
    locationDisplay: HTMLElement | null;
    charactersContainer: HTMLElement | null;
    actionOwner: HTMLElement | null;
    optionsList: HTMLElement | null;
    systemContainer: HTMLElement | null;
    shelterContainer: HTMLElement | null;
    bestiaryContainer: HTMLElement | null;
    herbologyContainer: HTMLElement | null;
    inventoryContainer: HTMLElement | null;
  };
  private rawJsonContent: any = null;
  private jsonData: any = null;
  private globalPokedex: PokedexData | null = null;

  constructor() {
    this.yamlData = null;
    this.rawYamlContent = "";
    this.rootNodeKey = null;
    this.elements = {
      statusBarTitle: document.getElementById('status-bar-title'),
      timeDisplay: document.getElementById('time-display'),
      locationDisplay: document.getElementById('location-display'),
      charactersContainer: document.getElementById('characters-container'),
      actionOwner: document.getElementById('action-owner'),
      optionsList: document.getElementById('options-list'),
    systemContainer: document.getElementById('system-container'),
    shelterContainer: document.getElementById('shelter-container'),
    bestiaryContainer: document.getElementById('bestiary-container'),
    herbologyContainer: document.getElementById('herbology-container'),
    inventoryContainer: document.getElementById('inventory-container')
    };
  }

  private handleCompatibility() {
    if (!this.rootNodeKey || !this.jsonData) return;
    const rootData = this.jsonData[this.rootNodeKey];
    let modified = false;

    if (!this.findFieldByKeywords(rootData, ['庇护所'])) {
      rootData['🏡 庇护所'] = {};
      modified = true;
    }
    if (!this.findFieldByKeywords(rootData, ['妖兽图鉴'])) {
      rootData['🐾 妖兽图鉴'] = { '已发现': 0, '已收录': [] };
      modified = true;
    }
    if (!this.findFieldByKeywords(rootData, ['植物图鉴'])) {
      rootData['🌿 植物图鉴'] = { '已发现': 0, '已种植': [] };
      modified = true;
    }
    if (modified) {
      toastr.info('检测到旧版状态栏，已自动补充缺失的字段以兼容。');
    }
  }

  async init() {
    console.log('[StoryRenderer] Initializing...');
    this.setLoadingState();
    try {
      this.rawJsonContent = this.getRawContentFromChatMessage();
      console.log('[StoryRenderer] Raw JSON content loaded:', this.rawJsonContent);

      if (!this.rawJsonContent) {
        toastr.error('未能在最新消息中找到JSON数据。');
        return;
      }

      let parsedJson;
      try {
        parsedJson = JSON.parse(this.rawJsonContent);
      } catch (error) {
        console.error('JSON parsing failed:', error);
        this.handleParsingFailure(this.rawJsonContent, error as Error);
        return;
      }

      this.jsonData = parsedJson;
      if (!this.jsonData) {
          toastr.error('JSON数据格式不正确');
          return;
      }

      this.findRootNodeKey();
      this.handleCompatibility();
      this.globalPokedex = await Pokedex.getPokedexData(); // Cache the pokedex
      await this.syncVariables();
      this.renderAll();

      const savedTheme = localStorage.getItem('storyTheme') || 'night';
      const themeButton = document.querySelector(`.theme-btn[data-theme="${savedTheme}"]`) as HTMLElement;
      if (themeButton) themeButton.click();

      toastr.success('状态栏已成功加载并渲染！');
    } catch (error) {
      console.error('渲染失败:', error);
      this.handleError(error as Error);
    }
  }

  getRawContentFromChatMessage() {
    try {
      const messageId = getCurrentMessageId();
      if (messageId === null || messageId === undefined) {
        toastr.error('无法获取当前消息 ID。');
        return '';
      }
      const message = getChatMessages(messageId)[0];
      if (!message || !message.message) return '';
      return extractJsonFromStatusBar(message.message);
    } catch (e) {
      console.error("获取聊天消息失败:", e);
      toastr.error('获取或处理聊天消息时出错，请检查控制台。');
      return '';
    }
  }

  setLoadingState() {
    if (this.elements.charactersContainer) this.elements.charactersContainer.innerHTML = this.createSpinner();
    if (this.elements.optionsList) this.elements.optionsList.innerHTML = `<li>${this.createSpinner()}</li>`;
  }

  createSpinner() {
    return `<div class="flex justify-center items-center p-4"><div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-400"></div></div>`;
  }

  findRootNodeKey() {
    const keys = Object.keys(this.jsonData);
    this.rootNodeKey = keys.find(key => key.includes('状态总览') || key.includes('角色状态总览')) || keys[0];
    if (!this.rootNodeKey) {
        toastr.error('未找到根节点');
        return;
    }
    if (this.elements.statusBarTitle) this.elements.statusBarTitle.textContent = "状态总览";
  }

  findFieldByKeywords(data: any, keywords: string[]) {
    if (!data || typeof data !== 'object') return null;
    const fields = Object.keys(data);
    for (const field of fields) {
      for (const keyword of keywords) {
        if (field.toLowerCase().includes(keyword.toLowerCase())) return field;
      }
    }
    return null;
  }

  renderAll() {
    if (!this.rootNodeKey) return;
    const rootData = this.jsonData[this.rootNodeKey];
    this.renderHeaderInfo(rootData);
    this.renderCharacters(rootData);
    this.renderShelter(rootData);
    this.renderPokedexFromMessageVars();
    this.renderSystem(rootData);
    this.renderActionOptions(rootData);
  }

  renderHeaderInfo(data: any) {
    const dateTimeField = this.findFieldByKeywords(data, ['日期', '时间']);
    const locationField = this.findFieldByKeywords(data, ['地点', '环境']);
    const timeDisplayParent = this.elements.timeDisplay?.parentNode;
    const locationDisplayParent = this.elements.locationDisplay?.parentNode;

    if (dateTimeField && this.elements.timeDisplay && timeDisplayParent) {
      this.elements.timeDisplay.textContent = this.formatNodeName(data[dateTimeField], true);
      const emojiEl = timeDisplayParent.querySelector('.emoji');
      if (emojiEl) emojiEl.textContent = this.extractEmojis(data[dateTimeField])[0] || '🗓️';
    }
    if (locationField && this.elements.locationDisplay && locationDisplayParent) {
      this.elements.locationDisplay.textContent = this.formatNodeName(data[locationField], true);
      const emojiEl = locationDisplayParent.querySelector('.emoji');
      if (emojiEl) emojiEl.textContent = this.extractEmojis(data[locationField])[0] || '🏞️';
    }
  }

  renderCharacters(data: any) {
    const charListKey = this.findFieldByKeywords(data, ['角色', '列表', '人物']);
    if (this.elements.charactersContainer) {
      this.elements.charactersContainer.innerHTML = '';
      if (charListKey && Array.isArray(data[charListKey])) {
        data[charListKey].forEach((charData: any) => {
          const card = this.createCharacterCard(charData);
          if (card) this.elements.charactersContainer!.appendChild(card);
        });
      } else {
        this.elements.charactersContainer.innerHTML = this.createEmptyState('没有角色数据');
      }
    }
  }

  renderSystem(data: any) {
    const systemContainer = this.elements.systemContainer;
    if (systemContainer) {
      const messageId = getCurrentMessageId();
      const variables = getVariables({ type: 'message', message_id: messageId });
      const systemData = _.get(variables, '世界.系统', null);
      renderSystem(systemData, systemContainer);
    }
  }

  renderShelter(data: any) {
    const shelterKey = this.findFieldByKeywords(data, ['庇护所']);
    if (this.elements.shelterContainer) {
      this.elements.shelterContainer.innerHTML = '';
      if (shelterKey && typeof data[shelterKey] === 'object' && data[shelterKey] !== null) {
        const shelterData = data[shelterKey];
        const card = this.createCharacterCard({ [shelterKey]: shelterData });
        if (card) this.elements.shelterContainer.appendChild(card);
      } else {
        this.elements.shelterContainer.innerHTML = this.createEmptyState('暂无庇护所信息');
      }
    }
  }

  renderPokedexFromMessageVars() {
    const messageId = getCurrentMessageId();
    const variables = getVariables({ type: 'message', message_id: messageId });
    const pokedexData = _.get(variables, '世界.图鉴', {});

    const renderSinglePokedex = (container: HTMLElement | null, data: any, name: string, emptyText: string) => {
      if (container) {
        container.innerHTML = '';
        if (data && data.length > 0) {
          const card = this.createCharacterCard({ [`${name}图鉴 (已发现 ${data.length})`]: data });
          if (card) container.appendChild(card);
        } else {
          container.innerHTML = this.createEmptyState(emptyText);
        }
      }
    };

    renderSinglePokedex(this.elements.bestiaryContainer, pokedexData['妖兽'], '妖兽', '妖兽图鉴待解锁');
    renderSinglePokedex(this.elements.herbologyContainer, pokedexData['植物'], '植物', '植物图鉴待解锁');
    renderSinglePokedex(this.elements.inventoryContainer, pokedexData['物品'], '物品', '物品图鉴是空的');
  }

  private async syncVariables() {
    if (!this.rootNodeKey || !this.jsonData) return;

    try {
      const currentMessageId = getCurrentMessageId();
      if (currentMessageId === null) {
        console.warn('[StoryRenderer] 无法获取当前消息ID，跳过同步。');
        return;
      }

      const rootData = this.jsonData[this.rootNodeKey];
      const currentVars = getVariables({ type: 'message', message_id: currentMessageId });
      const lastSyncId = _.get(currentVars, '世界.lastSyncMessageId', -1);

      // 核心逻辑：只有当当前消息ID大于等于最后同步ID时才执行更新
      if (currentMessageId >= lastSyncId) {
        const updates: Record<string, any> = {};

        const sectionsToSync = [
          { keyWords: ['庇护所'], varPath: '世界.庇护所' },
          { keyWords: ['妖兽图鉴'], varPath: '世界.图鉴.妖兽' },
          { keyWords: ['植物图鉴'], varPath: '世界.图鉴.植物' },
          { keyWords: ['物品图鉴'], varPath: '世界.图鉴.物品' }
        ];

        // 单独处理系统，确保它只在变量不存在时从JSON初始化一次
        const systemDataInJson = this.findFieldByKeywords(rootData, ['系统']);
        if (systemDataInJson && rootData[systemDataInJson]) {
          const newSystemData = rootData[systemDataInJson];
          const currentSystemData = _.get(currentVars, '世界.系统', {});

          // 检查是否有新成就解锁
          if (newSystemData['新成就']) {
            const newAchievements = Array.isArray(newSystemData['新成就']) ? newSystemData['新成就'] : [newSystemData['新成就']];
            
            const updatedAchievements = _.cloneDeep(_.get(currentSystemData, '已完成', []));
            let updatedPoints = _.get(currentSystemData, '成就点数', 0);

            newAchievements.forEach((ach: any) => {
              // 避免重复添加
              if (!updatedAchievements.some((existingAch: any) => existingAch['名称'] === ach['名称'])) {
                // 动态地将所有字段添加进去，除了点数
                const achievementData: Record<string, any> = { ...ach };
                delete achievementData['点数'];
                updatedAchievements.push(achievementData);
                
                updatedPoints += ach['点数'] || 0;
                toastr.success(`解锁新成就：${ach['名称']}`, '恭喜！');
              }
            });

            // 更新系统数据
            currentSystemData['已完成'] = updatedAchievements;
            currentSystemData['成就点数'] = updatedPoints;
            if(newSystemData['提示']) currentSystemData['提示'] = newSystemData['提示'];
            updates['世界.系统'] = currentSystemData;
            console.log(`[StoryRenderer] 检测到新成就，已合并并更新系统变量。`);

          } else if (newSystemData['今日已签到'] === true) {
            const today = new Date().getDate();
            const yesterday = new Date();
            yesterday.setDate(today - 1);

            const signedInDays = _.cloneDeep(_.get(currentSystemData, '已签到', []));
            if (!signedInDays.includes(today)) {
              signedInDays.push(today);
            }

            let consecutiveDays = _.get(currentSystemData, '连续签到', 0);
            if (signedInDays.includes(yesterday.getDate())) {
              consecutiveDays++;
            } else {
              consecutiveDays = 1;
            }
            
            currentSystemData['已签到'] = signedInDays;
            currentSystemData['连续签到'] = consecutiveDays;
            if(newSystemData['提示']) currentSystemData['提示'] = newSystemData['提示'];

            // 处理签到奖励
            if (newSystemData['奖励']) {
              const rewardText = newSystemData['奖励'];
              const match = rewardText.match(/【(.+?)】x(\d+)/);
              if (match) {
                const itemName = match[1];
                const itemAmount = parseInt(match[2], 10);
                
                // 假设只有一个角色，找到角色数据并更新物品
                const charListKey = this.findFieldByKeywords(rootData, ['角色', '列表', '人物']);
                if (charListKey && Array.isArray(rootData[charListKey]) && rootData[charListKey].length > 0) {
                  const charContainer = rootData[charListKey][0];
                  const charDataKey = Object.keys(charContainer)[0];
                  const charData = charContainer[charDataKey];
                  const nameKey = this.findFieldByKeywords(charData, ['姓名', '名称']);
                  
                  if (nameKey) {
                    const charName = this.formatNodeName(charData[nameKey], true);
                    const itemsVarPath = `角色.${charName}.物品`;
                    const currentItems = _.cloneDeep(_.get(currentVars, itemsVarPath, []));
                    
                    // 检查物品是否已存在
                    const existingItemIndex = currentItems.findIndex((item: string) => item.includes(itemName));
                    if (existingItemIndex > -1) {
                      // 更新数量
                      const existingItemText = currentItems[existingItemIndex];
                      const existingAmountMatch = existingItemText.match(/x(\d+)/);
                      const existingAmount = existingAmountMatch ? parseInt(existingAmountMatch[1], 10) : 1;
                      const newAmount = existingAmount + itemAmount;
                      currentItems[existingItemIndex] = `【${itemName}】x${newAmount}`;
                    } else {
                      // 添加新物品
                      currentItems.push(`【${itemName}】x${itemAmount}`);
                    }
                    updates[itemsVarPath] = currentItems;
                    console.log(`[StoryRenderer] 已将签到奖励“${rewardText}”添加到角色“${charName}”的物品变量中。`);
                  }
                }
              }
            }
            
            updates['世界.系统'] = currentSystemData;
            console.log(`[StoryRenderer] 检测到签到事件，已更新签到数据。`);

          } else if (newSystemData['技能提升']) {
            const skillUpdates = Array.isArray(newSystemData['技能提升']) ? newSystemData['技能提升'] : [newSystemData['技能提升']];
            const currentSkills = _.cloneDeep(_.get(currentSystemData, '技能', []));

            skillUpdates.forEach((update: any) => {
              const skillIndex = currentSkills.findIndex((s: any) => s['名称'] === update['名称']);
              if (skillIndex > -1) {
                // 更新现有技能
                const skill = currentSkills[skillIndex];
                const currentExp = skill['熟练度'] || { value: 0, max: 100 };
                currentExp.value += update['熟练度增加'] || 0;

                // 处理升级
                while (currentExp.value >= currentExp.max) {
                  currentExp.value -= currentExp.max;
                  skill['等级'] = (skill['等级'] || 1) + 1;
                  // 升级后熟练度上限可能会增加，这里简化处理，实际可扩展
                  currentExp.max = Math.floor(currentExp.max * 1.5); 
                  toastr.success(`你的技能【${skill['名称']}】升级了！`, '恭喜！');
                }
                skill['熟练度'] = currentExp;
              } else {
                // 添加新技能
                currentSkills.push({
                  '名称': update['名称'],
                  '等级': 1,
                  '熟练度': { value: update['熟练度增加'] || 0, max: 100 }
                });
                toastr.info(`你学会了新技能：【${update['名称']}】！`);
              }
            });
            
            currentSystemData['技能'] = currentSkills;
            if(newSystemData['提示']) currentSystemData['提示'] = newSystemData['提示'];
            updates['世界.系统'] = currentSystemData;
            console.log(`[StoryRenderer] 检测到技能提升事件，已更新技能数据。`);

          } else if (newSystemData['物品交换']) {
            const exchange = newSystemData['物品交换'];
            if (exchange['成功']) {
              const charListKey = this.findFieldByKeywords(rootData, ['角色', '列表', '人物']);
              if (charListKey && Array.isArray(rootData[charListKey]) && rootData[charListKey].length > 0) {
                const charContainer = rootData[charListKey][0];
                const charDataKey = Object.keys(charContainer)[0];
                const charData = charContainer[charDataKey];
                const nameKey = this.findFieldByKeywords(charData, ['姓名', '名称']);
                
                if (nameKey) {
                  const charName = this.formatNodeName(charData[nameKey], true);
                  const itemsVarPath = `角色.${charName}.物品`;
                  const currentItems = _.cloneDeep(_.get(currentVars, itemsVarPath, []));

                  // 处理失去的物品
                  (exchange['交换物品']['失去'] || []).forEach((itemText: string) => {
                    const match = itemText.match(/【(.+?)】x(\d+)/);
                    if (match) {
                      const itemName = match[1];
                      const amountToRemove = parseInt(match[2], 10);
                      const existingItemIndex = currentItems.findIndex((item: string) => item.includes(itemName));
                      if (existingItemIndex > -1) {
                        const existingItemText = currentItems[existingItemIndex];
                        const existingAmountMatch = existingItemText.match(/x(\d+)/);
                        const existingAmount = existingAmountMatch ? parseInt(existingAmountMatch[1], 10) : 1;
                        const newAmount = existingAmount - amountToRemove;
                        if (newAmount > 0) {
                          currentItems[existingItemIndex] = `【${itemName}】x${newAmount}`;
                        } else {
                          currentItems.splice(existingItemIndex, 1);
                        }
                      }
                    }
                  });

                  // 处理获得的物品
                  (exchange['交换物品']['获得'] || []).forEach((itemText: string) => {
                    const match = itemText.match(/【(.+?)】x(\d+)/);
                    if (match) {
                      const itemName = match[1];
                      const amountToAdd = parseInt(match[2], 10);
                      const existingItemIndex = currentItems.findIndex((item: string) => item.includes(itemName));
                      if (existingItemIndex > -1) {
                        const existingItemText = currentItems[existingItemIndex];
                        const existingAmountMatch = existingItemText.match(/x(\d+)/);
                        const existingAmount = existingAmountMatch ? parseInt(existingAmountMatch[1], 10) : 1;
                        const newAmount = existingAmount + amountToAdd;
                        currentItems[existingItemIndex] = `【${itemName}】x${newAmount}`;
                      } else {
                        currentItems.push(`【${itemName}】x${amountToAdd}`);
                      }
                    }
                  });
                  updates[itemsVarPath] = currentItems;
                }
              }
              toastr.success(exchange['提示'] || '交换成功！');
            } else {
              toastr.warning(exchange['提示'] || '交换失败。');
            }
            // 不管成功与否，都更新系统提示
            if(newSystemData['提示']) currentSystemData['提示'] = newSystemData['提示'];
            updates['世界.系统'] = currentSystemData;
            console.log(`[StoryRenderer] 检测到物品交换事件，已处理。`);

          } else if (newSystemData['物品变化']) {
            const change = newSystemData['物品变化'];
            const charListKey = this.findFieldByKeywords(rootData, ['角色', '列表', '人物']);
            if (charListKey && Array.isArray(rootData[charListKey]) && rootData[charListKey].length > 0) {
              const charContainer = rootData[charListKey][0];
              const charDataKey = Object.keys(charContainer)[0];
              const charData = charContainer[charDataKey];
              const nameKey = this.findFieldByKeywords(charData, ['姓名', '名称']);
              
              if (nameKey) {
                const charName = this.formatNodeName(charData[nameKey], true);
                const itemsVarPath = `角色.${charName}.物品`;
                const currentItems = _.cloneDeep(_.get(currentVars, itemsVarPath, []));

                // 统一处理物品数量变化的函数
                const updateItemCount = (itemList: string[], amountModifier: number) => {
                  (itemList || []).forEach((itemText: string) => {
                    const match = itemText.match(/【(.+?)】x(\d+)/);
                    if (match) {
                      const itemName = match[1];
                      const amount = parseInt(match[2], 10) * amountModifier;
                      const existingItemIndex = currentItems.findIndex((item: string) => item.includes(`【${itemName}】`));

                      if (existingItemIndex > -1) {
                        const existingItemText = currentItems[existingItemIndex];
                        const existingAmountMatch = existingItemText.match(/x(\d+)/);
                        const existingAmount = existingAmountMatch ? parseInt(existingAmountMatch[1], 10) : 1;
                        const newAmount = existingAmount + amount;
                        if (newAmount > 0) {
                          currentItems[existingItemIndex] = `【${itemName}】x${newAmount}`;
                        } else {
                          currentItems.splice(existingItemIndex, 1);
                        }
                      } else if (amount > 0) {
                        currentItems.push(`【${itemName}】x${amount}`);
                      }
                    }
                  });
                };

                updateItemCount(change['失去'], -1);
                updateItemCount(change['获得'], 1);
                
                updates[itemsVarPath] = currentItems;
              }
            }
            toastr.info(change['提示'] || '物品发生了变化。');
            if(newSystemData['提示']) currentSystemData['提示'] = newSystemData['提示'];
            updates['世界.系统'] = currentSystemData;
            console.log(`[StoryRenderer] 检测到物品变化事件，已处理。`);

          } else if (newSystemData['庇护所升级']) {
            const upgrade = newSystemData['庇护所升级'];
            const shelterVarPath = '世界.庇护所';
            const currentShelter = _.cloneDeep(_.get(currentVars, shelterVarPath, {}));

            // 合并新旧数据
            Object.keys(upgrade).forEach(key => {
              if (key === '新增功能') {
                const newFeatures = Array.isArray(upgrade[key]) ? upgrade[key] : [upgrade[key]];
                const existingFeatures = currentShelter['功能'] || [];
                currentShelter['功能'] = _.union(existingFeatures, newFeatures);
              } else if (key !== '提示') {
                currentShelter[key] = upgrade[key];
              }
            });
            
            updates[shelterVarPath] = currentShelter;
            toastr.success(upgrade['提示'] || '庇护所已更新！', '家园新貌');
            if(newSystemData['提示']) currentSystemData['提示'] = newSystemData['提示'];
            updates['世界.系统'] = currentSystemData;
            console.log(`[StoryRenderer] 检测到庇护所升级事件，已处理。`);

          } else if (newSystemData['新物品发现']) {
            const newItems = Array.isArray(newSystemData['新物品发现']) ? newSystemData['新物品发现'] : [newSystemData['新物品发现']];
            const currentPokedex = _.cloneDeep(_.get(currentVars, '世界.图鉴.物品', []));

            newItems.forEach((item: any) => {
              if (!currentPokedex.some((existing: any) => existing['名称'] === item['名称'])) {
                currentPokedex.push(item);
                toastr.info(`新的物品“${item['名称']}”已添加到图鉴！`);
              }
            });
            updates['世界.图鉴.物品'] = currentPokedex;
            console.log(`[StoryRenderer] 检测到新物品发现事件，已更新物品图鉴。`);

          } else if (!_.has(currentVars, '世界.系统')) {
            // 如果变量中没有系统数据，则尝试从JSON进行初始化
            const systemDataInJson = this.findFieldByKeywords(rootData, ['系统']);
            if (systemDataInJson && rootData[systemDataInJson]) {
                updates['世界.系统'] = rootData[systemDataInJson];
                console.log(`[StoryRenderer] '世界.系统' 变量不存在，从JSON进行初始化。`);
            }
          }
        }

        for (const section of sectionsToSync) {
          const dataKey = this.findFieldByKeywords(rootData, section.keyWords);
          if (dataKey && rootData[dataKey]) {
            const newData = rootData[dataKey];
            // For pokedex, we need to merge arrays, not replace them
            if (section.varPath.includes('图鉴')) {
                const oldData = _.get(currentVars, section.varPath, []);
                const combinedData = _.unionBy(oldData, newData['已收录'] || [], '名称');
                if (!_.isEqual(oldData, combinedData)) {
                    _.set(updates, section.varPath, combinedData);
                }
            } else {
                const oldData = _.get(currentVars, section.varPath);
                if (!_.isEqual(newData, oldData)) {
                    _.set(updates, section.varPath, newData);
                }
            }
          }
        }

        // 同步角色物品
        const charListKey = this.findFieldByKeywords(rootData, ['角色', '列表', '人物']);
        if (charListKey && Array.isArray(rootData[charListKey])) {
          rootData[charListKey].forEach((charContainer: any) => {
            const charDataKey = Object.keys(charContainer)[0];
            const charData = charContainer[charDataKey];

            if (charData && typeof charData === 'object') {
              const nameKey = this.findFieldByKeywords(charData, ['姓名', '名称']);
              const itemsKey = this.findFieldByKeywords(charData, ['物品', '核心物品']);

              if (nameKey && itemsKey && charData[nameKey] && Array.isArray(charData[itemsKey])) {
                const charName = this.formatNodeName(charData[nameKey], true);
                const newItems = charData[itemsKey];
                const varPath = `角色.${charName}.物品`;
                const oldItems = _.get(currentVars, varPath);

                if (!_.isEqual(newItems, oldItems)) {
                  _.set(updates, varPath, newItems);
                }
              }
            }
          });
        }

        if (!_.isEmpty(updates)) {
          console.log(`[StoryRenderer] Message ${currentMessageId} > ${lastSyncId}. 检测到变量变化，正在更新:`, updates);
          // 将 lastSyncMessageId 也加入到更新中
          updates['世界.lastSyncMessageId'] = currentMessageId;
          await insertOrAssignVariables(updates, { type: 'message', message_id: currentMessageId });
          toastr.info(`状态栏(M${currentMessageId})已同步楼层变量。`);
        } else {
          console.log(`[StoryRenderer] Message ${currentMessageId} >= ${lastSyncId}. 未检测到变量变化。`);
        }
      } else {
        console.log(`[StoryRenderer] 跳过旧的状态栏(M${currentMessageId})同步，最新记录为 M${lastSyncId}。`);
      }
    } catch (error) {
      console.error('变量同步失败:', error);
      toastr.error('变量同步失败，请查看控制台。');
    }
  }

  createCharacterCard(charData: any) {
    const titleKey = Object.keys(charData)[0];
    const attributes = charData[titleKey];
    if (!titleKey || !attributes) return null;

    const card = document.createElement('div');
    card.className = 'bg-main rounded-xl border border-dim p-3.5 shadow-sm card-hover theme-transition';

    const h3 = document.createElement('h3');
    h3.className = 'font-bold text-lg mb-2 pb-1 border-b border-dim theme-transition';
    h3.innerHTML = `${this.extractEmojis(titleKey)[0] || ''} ${this.formatNodeName(titleKey, true)}`;
    card.appendChild(h3);

    const list = document.createElement('ul');
    list.className = 'space-y-2 text-sm';
    card.appendChild(list);

    if (typeof attributes === 'object' && attributes !== null && !Array.isArray(attributes)) {
      Object.entries(attributes).forEach(([key, value]) => {
        list.appendChild(this.createAttributeItem(key, value));
      });
    } else if (Array.isArray(attributes)) { // Handle case where attributes is an array of entries
        attributes.forEach(entry => {
            const entryName = entry['名称'] || '未知条目';
            const li = document.createElement('li');
            li.className = 'clickable-item';
            li.dataset.details = JSON.stringify(entry);
            li.innerHTML = `• ${this.formatNodeName(entryName)}`;
            list.appendChild(li);
        });
    }
    return card;
  }

  createAttributeItem(key: string, value: any): HTMLLIElement {
    const item = document.createElement('li');
    const emoji = this.extractEmojis(key)[0] || '🔸';
    const keyHtml = `<span class="font-medium text-accent">${emoji} ${this.formatNodeName(key, true)}:</span>`;
    const isCoreItems = key.includes('核心物品');

    if (typeof value === 'object' && value !== null && !Array.isArray(value) && 'value' in value && 'max' in value && typeof value.value === 'number' && typeof value.max === 'number') {
      item.innerHTML = keyHtml;
      const percentage = (value.value / value.max) * 100;
      const container = document.createElement('div');
      container.className = 'flex items-center space-x-2 mt-1';
      const progressBarWrapper = document.createElement('div');
      progressBarWrapper.className = 'progress-bar-bg w-full rounded-full h-2.5';
      const progressBar = document.createElement('div');
      progressBar.className = 'progress-bar-fg h-2.5 rounded-full';
      progressBar.style.width = `${percentage}%`;
      if (percentage < 25) progressBar.classList.add('bg-red-500');
      else if (percentage < 50) progressBar.classList.add('bg-yellow-500');
      else progressBar.classList.add('bg-green-500');
      progressBarWrapper.appendChild(progressBar);
      const progressText = document.createElement('span');
      progressText.className = 'text-xs text-secondary font-mono';
      progressText.textContent = `${value.value} / ${value.max}`;
      container.appendChild(progressBarWrapper);
      container.appendChild(progressText);
      item.appendChild(container);
    } else if (typeof value === 'object' && value !== null) {
      item.innerHTML = keyHtml;
      const subList = document.createElement('ul');
      subList.className = 'list-disc list-inside ml-4 mt-1 space-y-1';
      if (Array.isArray(value)) {
        value.forEach(subValue => {
          const subItem = document.createElement('li');
          let text;
          
          if (isCoreItems && typeof subValue === 'string') {
            const itemName = this.formatNodeName(subValue, true).replace(/【|】|x\d+/g, '').trim();
            const pokedexEntry = this.globalPokedex?.['物品']?.find(e => e.名称 === itemName);
            if (pokedexEntry) {
              subItem.classList.add('clickable-item');
              subItem.dataset.details = JSON.stringify(pokedexEntry);
            }
            text = this.formatNodeName(String(subValue));
          } else if (typeof subValue === 'object' && subValue !== null) {
            subItem.classList.add('clickable-item');
            subItem.dataset.details = JSON.stringify(subValue);
            const nameKey = Object.keys(subValue).find(k => k.includes('名称') || k.includes('姓名'));
            text = nameKey ? this.formatNodeName(String(subValue[nameKey])) : '点击查看详情';
          } else {
            text = this.formatNodeName(String(subValue));
          }
          subItem.innerHTML = `${this.extractEmojis(text)[0] || '•'} ${this.formatNodeName(text, true)}`;
          subList.appendChild(subItem);
        });
      } else {
        Object.entries(value).forEach(([subKey, subValue]) => {
          const subItem = this.createAttributeItem(subKey, subValue);
          subList.appendChild(subItem);
        });
      }
      item.appendChild(subList);
    } else {
      item.innerHTML = `${keyHtml} ${this.formatNodeName(String(value))}`;
    }
    return item;
  }

  renderActionOptions(data: any) {
    const actionKey = this.findFieldByKeywords(data, ['行动']);
    if (this.elements.optionsList) {
      this.elements.optionsList.innerHTML = '';
      if (actionKey && data[actionKey]) {
        const actionData = data[actionKey];
        const ownerKey = this.findFieldByKeywords(actionData, ['行动人', '角色']);
        const optionsKey = this.findFieldByKeywords(actionData, ['可选行动', '选项']);

        if (ownerKey && this.elements.actionOwner) {
          this.elements.actionOwner.textContent = this.formatNodeName(actionData[ownerKey]);
        }
        if (optionsKey && Array.isArray(actionData[optionsKey])) {
          actionData[optionsKey].forEach((optionText: string, index: number) => {
            const item = document.createElement('li');
            item.className = 'pl-2 py-1 border-l-2 border-dim ml-1 hover:border-indigo-400/70 transition-colors theme-transition';
            const cleanText = this.formatNodeName(optionText, true);
            item.innerHTML = `${this.extractEmojis(optionText)[0] || '▶️'} ${cleanText}`;
            item.dataset.optionIndex = index.toString();
            item.dataset.optionText = cleanText;
            this.elements.optionsList!.appendChild(item);
          });
        }
        
        const customActionItem = document.createElement('li');
        customActionItem.className = 'pl-2 py-1 border-l-2 border-dim ml-1 hover:border-indigo-400/70 transition-colors theme-transition mt-4';
        customActionItem.innerHTML = `<i class="fas fa-pen-nib mr-2 text-accent"></i> 自定义行动...`;
        customActionItem.dataset.actionType = 'custom';
        this.elements.optionsList!.appendChild(customActionItem);

      } else {
        this.elements.optionsList.innerHTML = this.createEmptyState('没有可用行动');
      }
    }
  }

  createEmptyState(message: string) {
    return `<li class="text-center py-4 text-secondary theme-transition"><i class="fas fa-info-circle mr-1"></i>${message}</li>`;
  }

  handleError(error: Error) {
    console.error('渲染错误:', error);
    const errorHtml = `<div class="bg-red-900/20 border border-red-800/30 text-red-400 px-4 py-3 rounded relative" role="alert">
            <strong class="font-bold">加载失败: </strong>
            <span class="block sm:inline">${error.message}</span>
        </div>`;
    if (this.elements.charactersContainer) this.elements.charactersContainer.innerHTML = errorHtml;
    if (this.elements.optionsList) this.elements.optionsList.innerHTML = `<li>${errorHtml}</li>`;
    const actionOwnerParent = this.elements.actionOwner?.parentElement;
    if (actionOwnerParent) actionOwnerParent.style.display = 'none';
  }
  handleParsingFailure(rawText: string, error: unknown) {
    if (this.elements.statusBarTitle) this.elements.statusBarTitle.textContent = 'JSON解析失败';
    const safeRawText = String(rawText || '');
    
    let errorMessage = "未知错误";
    if (error instanceof Error) {
        errorMessage = error.message;
    } else {
        errorMessage = String(error);
    }

    const errorHtml = `
            <div class="bg-orange-800/20 border border-orange-700/30 text-orange-300 px-4 py-3 rounded-lg relative" role="alert">
                <strong class="font-bold">解析失败:</strong>
                <span class="block sm:inline">${errorMessage}</span>
                <p class="mt-2 text-sm">已为您显示原始输出内容，请检查格式：</p>
            </div>
            <pre class="bg-gray-900/50 text-white p-4 rounded-lg mt-2 whitespace-pre-wrap text-xs leading-relaxed"><code>${safeRawText.replace(/</g, '<').replace(/>/g, '>')}</code></pre>
        `;
    if (this.elements.charactersContainer) {
      this.elements.charactersContainer.innerHTML = errorHtml;
      this.elements.charactersContainer.classList.remove('md:grid-cols-2');
    }
    if (this.elements.optionsList) this.elements.optionsList.innerHTML = '';
    const actionOwnerParent = this.elements.actionOwner?.parentElement;
    if (actionOwnerParent) actionOwnerParent.style.display = 'none';
  }

  extractEmojis(text: any): string[] {
    if (!_.isString(text)) {
      return [];
    }
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    return text.match(emojiRegex) || [];
  }

  formatNodeName(name: any, removeAllEmoji = false): string {
    if (!_.isString(name) && !_.isNumber(name)) {
      return '';
    }
    let cleanName = _.toString(name);
    cleanName = _.replace(cleanName, /^\d+\.\s*/, '');
    if (removeAllEmoji) {
      const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
      cleanName = _.replace(cleanName, emojiRegex, '');
    }
    return _.trim(cleanName);
  }
}

function initCustomActionModal() {
  const modal = $('#custom-action-modal');
  const input = $('#custom-action-input');
  const confirmBtn = $('#confirm-action-btn');
  const cancelBtn = $('#cancel-action-btn');
  const optionsList = $('#options-list');
  let currentTarget: JQuery<HTMLElement> | null = null;

  const showModal = (target: JQuery<HTMLElement>) => {
    currentTarget = target;
    modal.insertAfter(target);
    modal.removeClass('hidden').addClass('is-open');
    input.val('').trigger('focus');
  };

  const hideModal = () => {
    if (currentTarget) {
      modal.removeClass('is-open').addClass('hidden');
      optionsList.append(modal);
      currentTarget = null;
    }
  };

  const confirmAction = async () => {
    const userInput = (input.val() as string).trim();
    if (userInput) {
      hideModal();
      const messageId = getCurrentMessageId();
      const variables = getVariables({ type: 'message', message_id: messageId });
      const variablesString = JSON.stringify(variables, null, 2);
      const command = `/send ${userInput}\n\n<variables>\n${variablesString}\n</variables> | /trigger`;
      
      toastr.info('正在执行自定义行动...');
      await triggerSlash(command);
      toastr.success('自定义行动已发送！');
    } else {
      toastr.warning('请输入行动内容。');
    }
  };

  cancelBtn.on('click', hideModal);
  confirmBtn.on('click', confirmAction);

  return { showModal };
}

function initDetailsModal(): { showModalWithData: (data: any) => void } {
  const modalOverlay = document.getElementById('details-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const closeModalBtn = document.getElementById('modal-close-btn');

  if (!modalOverlay || !modalTitle || !modalBody || !closeModalBtn) {
    throw new Error('详情模态框的必要DOM元素未找到！');
  }

  const hideModal = () => modalOverlay.classList.add('hidden');

  closeModalBtn.addEventListener('click', hideModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) hideModal();
  });

  const showModalWithData = (data: any) => {
    if (typeof data === 'object' && data !== null) {
      const titleKey = Object.keys(data).find(k => k.includes('名称') || k.includes('姓名'));
      modalTitle.textContent = titleKey ? data[titleKey] : '详情';
      
      let bodyHtml = '<ul>';
      for (const [key, value] of Object.entries(data)) {
        bodyHtml += `<li><span class="item-key">${key}:</span> ${value}</li>`;
      }
      bodyHtml += '</ul>';
      modalBody.innerHTML = bodyHtml;

    } else {
      modalTitle.textContent = '详情';
      modalBody.textContent = String(data);
    }
    modalOverlay.classList.remove('hidden');
  };

  document.body.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const clickableItem = target.closest('.clickable-item');
    if (clickableItem) {
      const dataString = (clickableItem as HTMLElement).dataset.details;
      if (dataString) {
        try {
          const data = JSON.parse(dataString);
          showModalWithData(data);
        } catch (err) {
          console.error("解析详情数据失败:", err);
          toastr.error("无法显示详情。");
        }
      }
    }
  });

  return { showModalWithData };
}

async function requestSystemRefresh(systemName: string, button: JQuery<HTMLElement>) {
  const originalContent = button.html();
  button.prop('disabled', true).find('i').addClass('fa-spin');
  
  const command = `/send [SYSTEM] 【${systemName}系统】：“让我看看……有什么新东西可以给你……”（玩家请求刷新${systemName}列表） | /trigger`;
  toastr.info(`正在请求刷新${systemName}...`);
  try {
    await triggerSlash(command);
    toastr.success(`刷新请求已发送！`);
  } catch (error) {
    console.error(`刷新${systemName}失败:`, error);
    toastr.error("请求失败，请查看控制台。");
  } finally {
    setTimeout(() => {
      button.prop('disabled', false).html(originalContent);
    }, 1000);
  }
}

function initRewardsModal() {
  const modal = document.getElementById('rewards-modal');
  const closeModalBtn = document.getElementById('rewards-modal-close-btn');
  const modalBody = document.getElementById('rewards-modal-body');
  const refreshBtn = document.getElementById('refresh-rewards-btn');

  const hideModal = () => modal?.classList.add('hidden');

  closeModalBtn?.addEventListener('click', hideModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) hideModal();
  });

  refreshBtn?.addEventListener('click', (e) => {
    requestSystemRefresh('成就奖励', $(e.currentTarget as HTMLElement));
  });

  const showModalWithRewards = (rewardsJsonString: string, currentPoints: number) => {
    if (!modalBody) return;

    try {
      const rewardsData = JSON.parse(rewardsJsonString);
      let html = `<p class="text-sm text-secondary mb-4">${rewardsData.description || ''}</p>`;
      const isMobile = window.innerWidth < 768;

      rewardsData.tiers?.forEach((tier: any) => {
        html += `
          <details class="group border-t border-dim mt-4 pt-2" ${isMobile ? '' : 'open'}>
            <summary class="font-bold text-lg cursor-pointer hover:text-accent transition-colors theme-transition flex justify-between items-center py-2">
              <span>${tier.tier_name || '奖励'} <span class="text-sm text-secondary font-normal">(${tier.cost_range || ''})</span></span>
              <i class="fas fa-chevron-down transition-transform duration-300 group-open:rotate-180"></i>
            </summary>
            <ul class="space-y-3 mt-2">
        `;
        
        tier.rewards?.forEach((reward: any) => {
          const canAfford = currentPoints >= reward.cost;
          html += `
            <li class="p-4 rounded-lg bg-secondary border border-dim">
              <div class="flex justify-between items-start">
                <div>
                  <p class="font-semibold text-primary">${reward.name || '未知奖励'}</p>
                  <p class="text-xs text-secondary mt-1">${reward.description || ''}</p>
                </div>
                <button 
                  class="btn-primary redeem-btn whitespace-nowrap ml-4 text-sm"
                  data-name="${reward.name}" 
                  data-cost="${reward.cost}"
                  ${!canAfford ? 'disabled' : ''}
                >
                  ${reward.cost} <i class="fas fa-star text-xs"></i>
                </button>
              </div>
            </li>
          `;
        });
        html += '</ul></details>';
      });

      modalBody.innerHTML = html;
    } catch (error) {
      console.error("解析奖励JSON失败:", error);
      toastr.error("无法解析奖励列表。");
      modalBody.innerHTML = `<p class="text-red-400">加载奖励失败，请检查世界书条目格式。</p>`;
    }
    
    modal?.classList.remove('hidden');
  };

  modalBody?.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('redeem-btn')) {
      const itemName = target.dataset.name;
      const itemCost = parseInt(target.dataset.cost || '0', 10);
      
      const command = `/send [SYSTEM] Player wants to redeem the reward: "${itemName}" (Cost: ${itemCost} points). | /trigger`;
      toastr.info(`正在尝试兑换: ${itemName}...`);
      try {
        await triggerSlash(command);
        toastr.success(`兑换请求已发送！`);
        hideModal();
      } catch (error) {
        console.error("兑换失败:", error);
        toastr.error("兑换失败，请查看控制台。");
      }
    }
  });

  return { showModalWithRewards };
}

function initRemoteSyncModal(showModalWithData: (data: any) => void) {
  const openModalBtn = document.getElementById('remote-sync-btn');
  const modal = document.getElementById('remote-sync-modal');
  const closeModalBtn = document.getElementById('remote-sync-close-btn');
  
  const tabs = modal?.querySelectorAll('.main-tab-btn');
  const submitTab = document.getElementById('remote-submit-tab');
  const fetchTab = document.getElementById('remote-fetch-tab');
  
  const localDiffList = document.getElementById('local-diff-list');
  const remoteDiffList = document.getElementById('remote-diff-list');

  const fetchRemoteBtn = document.getElementById('fetch-from-remote-btn');
  const submitControls = document.getElementById('submit-to-remote-controls');
  const importControls = document.getElementById('import-from-remote-controls');
  const submitToRemoteBtn = document.getElementById('submit-to-remote-btn');
  const importFromRemoteBtn = document.getElementById('import-from-remote-btn');

  let remoteDataCache: RemotePokedexData | null = null;

  const showModal = async () => {
    modal?.classList.remove('hidden');
    // Default to submit tab
    tabs?.forEach(t => t.getAttribute('data-tab') === 'submit' ? t.classList.add('active') : t.classList.remove('active'));
    submitTab?.classList.remove('hidden');
    fetchTab?.classList.add('hidden');
    submitControls?.classList.remove('hidden');
    importControls?.classList.add('hidden');
    fetchRemoteBtn?.classList.add('hidden');
    await populateSubmitList();
  };

  const hideModal = () => modal?.classList.add('hidden');

  const populateSubmitList = async () => {
    if (!localDiffList) return;
    localDiffList.innerHTML = `<p class="text-center text-secondary p-4">正在计算差异...</p>`;
    
    const localPokedex = await Pokedex.getPokedexData();
    const localAchievements = await Pokedex.getAchievements();
    const remote = remoteDataCache || await Pokedex.getRemotePokedex();
    if (remote) remoteDataCache = remote;

    let diffHtml = '';
    let diffCount = 0;
    const types: ShareableType[] = ['妖兽', '植物', '物品', '成就'];

    types.forEach(type => {
      const localEntries = type === '成就' ? localAchievements : localPokedex[type];
      const remoteEntries = remote ? (remote[type as keyof RemotePokedexData] || []) : [];
      const remoteNames = new Set(remoteEntries.map(e => e.名称));
      const diffEntries = localEntries.filter(e => !remoteNames.has(e.名称));
      
      if (diffEntries.length > 0) {
        diffCount += diffEntries.length;
        diffHtml += `<h4 class="font-semibold text-primary/90 mt-2 first:mt-0">${type}</h4><ul>`;
        diffEntries.forEach(entry => {
          diffHtml += `
            <li class="p-2 rounded-lg bg-main/50 flex justify-between items-center">
              <label class="flex items-center cursor-pointer flex-grow mr-4">
                <input type="checkbox" class="mr-3" data-type="${type}" data-name="${entry.名称}">
                <span class="truncate" title="${entry.名称}">${entry.名称}</span>
              </label>
              <div class="space-x-2 flex-shrink-0">
                <button class="pokedex-view-btn text-sm text-blue-400 hover:text-blue-300 transition-colors p-1" data-type="${type}" data-name="${entry.名称}" data-source="local" title="查看"><i class="fas fa-eye"></i></button>
              </div>
            </li>`;
        });
        diffHtml += `</ul>`;
      }
    });

    if (diffCount === 0) {
      localDiffList.innerHTML = `<p class="text-center text-secondary p-4">恭喜！您的本地图鉴已全部同步至社区。</p>`;
    } else {
      localDiffList.innerHTML = diffHtml;
    }
  };

  openModalBtn?.addEventListener('click', showModal);
  closeModalBtn?.addEventListener('click', hideModal);
  modal?.addEventListener('click', async (e) => {
    if (e.target === modal) {
      hideModal();
      return;
    }

    const target = e.target as HTMLElement;
    const viewButton = target.closest('.pokedex-view-btn');

    if (viewButton) {
      const type = viewButton.getAttribute('data-type') as ShareableType;
      const name = viewButton.getAttribute('data-name');
      const source = viewButton.getAttribute('data-source');

      if (type && name && source) {
        let entry: PokedexEntry | undefined;
        if (source === 'local') {
          if (type === '成就') {
            const localAchievements = await Pokedex.getAchievements();
            entry = localAchievements.find(e => e.名称 === name);
          } else {
            const localPokedex = await Pokedex.getPokedexData();
            entry = localPokedex[type as PokedexType]?.find(e => e.名称 === name);
          }
        } else if (source === 'remote' && remoteDataCache) {
          entry = (remoteDataCache[type as keyof RemotePokedexData] || []).find(e => e.名称 === name);
        }

        if (entry) {
          showModalWithData(entry);
        } else {
          toastr.warning('无法找到该条目的详细信息。');
        }
      }
    }
  });

  tabs?.forEach(button => {
    button.addEventListener('click', () => {
      tabs.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      const tab = button.getAttribute('data-tab');
      if (tab === 'submit') {
        submitTab?.classList.remove('hidden');
        fetchTab?.classList.add('hidden');
        submitControls?.classList.remove('hidden');
        importControls?.classList.add('hidden');
        fetchRemoteBtn?.classList.add('hidden');
        populateSubmitList();
      } else {
        submitTab?.classList.add('hidden');
        fetchTab?.classList.remove('hidden');
        submitControls?.classList.add('hidden');
        importControls?.classList.remove('hidden');
        fetchRemoteBtn?.classList.remove('hidden');
        if(remoteDiffList) remoteDiffList.innerHTML = `<p class="text-center text-secondary p-4">请先点击下方按钮从社区获取列表。</p>`;
      }
    });
  });

  fetchRemoteBtn?.addEventListener('click', async () => {
    if (!remoteDiffList) return;
    remoteDiffList.innerHTML = `<p class="text-center text-secondary p-4">正在从社区获取...</p>`;
    
    const localPokedex = await Pokedex.getPokedexData();
    const localAchievements = await Pokedex.getAchievements();
    const remote = await Pokedex.getRemotePokedex();
    if (!remote) {
      remoteDiffList.innerHTML = `<p class="text-center text-red-400 p-4">获取失败，请检查服务器连接或查看控制台。</p>`;
      return;
    }
    remoteDataCache = remote;

    let diffHtml = '';
    let diffCount = 0;
    const types: ShareableType[] = ['妖兽', '植物', '物品', '成就'];

    types.forEach(type => {
      const localEntries = type === '成就' ? localAchievements : localPokedex[type];
      const localNames = new Set(localEntries.map(e => e.名称));
      const remoteEntries = remote[type as keyof RemotePokedexData] || [];
      const diffEntries = remoteEntries.filter(e => !localNames.has(e.名称));
      
      if (diffEntries.length > 0) {
        diffCount += diffEntries.length;
        diffHtml += `<h4 class="font-semibold text-primary/90 mt-2 first:mt-0">${type}</h4><ul>`;
        diffEntries.forEach(entry => {
          diffHtml += `
            <li class="p-2 rounded-lg bg-main/50 flex justify-between items-center">
              <label class="flex items-center cursor-pointer flex-grow mr-4">
                <input type="checkbox" class="mr-3" data-type="${type}" data-name="${entry.名称}">
                <span class="truncate" title="${entry.名称}">${entry.名称}</span>
              </label>
              <div class="space-x-2 flex-shrink-0">
                <button class="pokedex-view-btn text-sm text-blue-400 hover:text-blue-300 transition-colors p-1" data-type="${type}" data-name="${entry.名称}" data-source="remote" title="查看"><i class="fas fa-eye"></i></button>
              </div>
            </li>`;
        });
        diffHtml += `</ul>`;
      }
    });

    if (diffCount === 0) {
      remoteDiffList.innerHTML = `<p class="text-center text-secondary p-4">恭喜！您的本地图鉴与社区保持同步。</p>`;
    } else {
      remoteDiffList.innerHTML = diffHtml;
    }
  });

  submitToRemoteBtn?.addEventListener('click', async () => {
    const checkboxes = localDiffList?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked');
    if (!checkboxes || checkboxes.length === 0) {
      toastr.warning('请至少选择一个要分享的条目。');
      return;
    }
    
    const providerInput = document.getElementById('provider-name-input') as HTMLInputElement;
    const providerName = providerInput?.value.trim() || undefined; // Use undefined if empty

    const localPokedex = await Pokedex.getPokedexData();
    const localAchievements = await Pokedex.getAchievements();
    let successCount = 0;

    for (const cb of checkboxes) {
      const type = cb.dataset.type as ShareableType;
      const name = cb.dataset.name;
      if (type && name) {
        const entry = type === '成就'
          ? localAchievements.find(e => e.名称 === name)
          : localPokedex[type].find(e => e.名称 === name);
        
        if (entry) {
          await Pokedex.submitToHuggingFace(type, entry, providerName);
          successCount++;
        }
      }
    }
    
    if (successCount > 0) {
      toastr.success(`成功分享了 ${successCount} 个条目！`);
      remoteDataCache = null; // Invalidate cache
      await populateSubmitList();
    }
  });

  importFromRemoteBtn?.addEventListener('click', async () => {
    const checkboxes = remoteDiffList?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked');
    if (!checkboxes || checkboxes.length === 0 || !remoteDataCache) {
      toastr.warning('请至少选择一个要导入的条目。');
      return;
    }

    let successCount = 0;
    for (const cb of checkboxes) {
      const type = cb.dataset.type as ShareableType;
      const name = cb.dataset.name;
      if (type && name) {
        const entry = (remoteDataCache[type as keyof RemotePokedexData] || []).find(e => e.名称 === name);
        if (entry) {
          let success = false;
          if (type === '成就') {
            success = await Pokedex.createAchievement(entry);
          } else {
            success = await Pokedex.createPokedexEntry(type, entry);
          }
          if (success) {
            successCount++;
          }
        }
      }
    }

    if (successCount > 0) {
      toastr.success(`成功导入了 ${successCount} 个新条目到您的本地图鉴！`);
      hideModal();
    }
  });

}

async function initVersionChecker() {
  const $versionBtn = $('#version-info-btn');
  if (!$versionBtn.length) return;

  const updateInfo = await checkForUpdates();

  if (updateInfo) {
    if (updateInfo.hasUpdate) {
      // Add a small notification dot
      $versionBtn.append('<span class="absolute top-0 right-0 block h-2 w-2 rounded-full ring-2 ring-white bg-red-500"></span>');
    }

    $versionBtn.on('click', () => {
      if (updateInfo.changelogHtml) {
        showChangelogModal(updateInfo.changelogHtml, updateInfo.hasUpdate);
      } else {
        toastr.warning('无法获取更新日志。');
      }
    });
  } else {
    $versionBtn.on('click', () => {
        toastr.error('检查更新失败，无法显示日志。');
    });
  }
}

$(() => {
  initGlobalControls();
  const storyRenderer = new StoryRenderer();
  const { showModalWithData } = initDetailsModal();
  initVersionChecker();
  initPokedexManager(storyRenderer, showModalWithData);
  initRemoteSyncModal(showModalWithData);
  storyRenderer.init();
  const customActionModal = initCustomActionModal();
  const rewardsModal = initRewardsModal();

  $(document).on('click', '#redeem-rewards-btn', async () => {
    try {
      toastr.info('正在获取奖励列表...');
      const bookName = "什么？我要在玄幻修仙世界种田？";
      const entryKey = "成就系统的奖励";
      const worldbook = await getWorldbook(bookName);
      const entry = worldbook.find(e => e.name === entryKey);
      
      if (entry && entry.content) {
        const messageId = getCurrentMessageId();
        const currentVars = getVariables({ type: 'message', message_id: messageId });
        const currentPoints = _.get(currentVars, '世界.系统.成就点数', 0);
        rewardsModal.showModalWithRewards(entry.content, currentPoints);
      } else {
        toastr.warning('未找到可兑换的奖励信息。');
      }
    } catch (error) {
      console.error("获取奖励失败:", error);
      toastr.error("获取奖励列表失败，请查看控制台。");
    }
  });

  $(document).on('click', '#sign-in-btn', async (e) => {
    const target = $(e.currentTarget);
    target.prop('disabled', true);

    const messageId = getCurrentMessageId();
    const variables = getVariables({ type: 'message', message_id: messageId });
    const systemData = _.get(variables, '世界.系统', {});
    const consecutiveDays = systemData['连续签到'] || 0;
    const monthlyCard = systemData['月卡'] || '未激活';

    let signInMessage = `[SYSTEM] 玩家要进行每日签到。`;
    if (monthlyCard !== '未激活') {
        signInMessage += `\n当前月卡状态: ${monthlyCard}。`;
    }
    signInMessage += `\n当前已连续签到: ${consecutiveDays}天。`;

    const command = `/send ${signInMessage} | /trigger`;
    
    try {
      await triggerSlash(command);
      toastr.success(`签到请求已发送！`);
      
      const today = new Date().getDate();
      const calendarGrid = $('#calendar-grid');
      const todayCell = calendarGrid.find(`[data-day="${today}"]`);
      
      if (todayCell.length) {
        todayCell.removeClass('bg-accent/30 text-accent font-bold ring-2 ring-accent')
                 .addClass('bg-green-500/50 text-white')
                 .html('<i class="fas fa-check"></i>')
                 .attr('title', `第${today}天：已签到`);
      }
      target.html('<i class="fas fa-calendar-check mr-2"></i>今日已签到');

    } catch (error) {
      console.error("签到失败:", error);
      toastr.error("签到失败，请查看控制台。");
      target.prop('disabled', false);
    }
  });

  $(document).on('click', '#activate-monthly-card-btn', async (e) => {
    const target = $(e.currentTarget);
    target.prop('disabled', true).text('询问中...');

    const command = `/send [SYSTEM] 玩家想要激活签到系统的月卡，请告知激活条件和效果。 | /trigger`;
    toastr.info(`正在询问激活条件...`);
    try {
      await triggerSlash(command);
      toastr.success(`请求已发送！`);
    } catch (error) {
      console.error("激活月卡失败:", error);
      toastr.error("请求失败，请查看控制台。");
      target.prop('disabled', false).text('激活');
    }
  });

  $('#options-list').on('click', async (e) => {
    const targetLi = $(e.target).closest('li');
    if (!targetLi.length) return;

    const optionsList = $('#options-list');
    if (optionsList.hasClass('disabled')) {
      toastr.info('正在等待回应，请稍后...');
      return;
    }

    const actionType = targetLi.data('actionType');

    if (actionType === 'custom') {
      customActionModal.showModal(targetLi);
    } else {
      const optionText = targetLi.data('optionText');
      const optionIndex = parseInt(targetLi.data('optionIndex'), 10);

      if (optionText && !isNaN(optionIndex)) {
        // 禁用所有选项并显示加载状态
        optionsList.addClass('disabled').html(`
          <li class="text-center py-4 text-secondary theme-transition">
            <div class="flex justify-center items-center">
              <div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-400 mr-3"></div>
              <span>等待彼界的回应...</span>
            </div>
          </li>
        `);
        
        await triggerAction(optionText, optionIndex);
        // 此时不需要做任何事，因为界面将随新消息一起重新渲染
      }
    }
  });

  $(document).on('click', '.barter-btn', async (e) => {
    const target = $(e.currentTarget);
    target.prop('disabled', true);
    const originalText = target.html();
    target.html('<i class="fas fa-spinner fa-spin"></i>');

    const itemName = target.data('name');
    const itemCost = parseInt(target.data('cost') || '0', 10);

    if (!itemName || isNaN(itemCost)) {
      toastr.error('无法获取物品信息。');
      target.prop('disabled', false).html(originalText);
      return;
    }

    const messageId = getCurrentMessageId();
    const variables = getVariables({ type: 'message', message_id: messageId });
    const myItems = _.get(variables, '世界.系统.我的物品', []);
    const totalValue = _.sumBy(myItems, (item: any) => (item['数量'] || 0) * (item['价值'] || 0));

    const command = `/send [SYSTEM] 【以物换物系统】：“嘿，朋友！我看到你想用你那堆价值 ${totalValue} 的宝贝，来换我的【${itemName}】（价值 ${itemCost}）。让我想想……” | /trigger`;
    toastr.info(`正在尝试换取: ${itemName}...`);
    try {
      await triggerSlash(command);
      toastr.success(`换取请求已发送！`);
    } catch (error) {
      console.error("换取失败:", error);
      toastr.error("换取失败，请查看控制台。");
      target.prop('disabled', false).html(originalText);
    }
  });

  $(document).on('click', '#refresh-barter-btn', async (e) => {
    requestSystemRefresh('以物换物', $(e.currentTarget as HTMLElement));
  });
});
