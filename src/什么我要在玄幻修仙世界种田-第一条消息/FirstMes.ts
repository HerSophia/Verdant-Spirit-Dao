import $ from 'jquery';
import toastr from 'toastr';
import './FirstMes.scss';
import initialPokedex from '../什么我要在玄幻修仙世界种田/pokedex-data.json';
import _ from 'lodash';
import { checkForUpdates, showChangelogModal } from '../什么我要在玄幻修仙世界种田/version';

// --- Type Definitions ---
interface IPointOption {
    id: string;
    name: string;
    description: string;
    extraPoints: number;
}

interface IChoiceOption {
    id: string;
    name: string;
    description: string;
}

interface IItem {
    id: string;
    name: string;
    description: string;
    points: number;
}

interface ISystem extends IItem {}
interface ITrait extends IChoiceOption {}
interface ISeason extends IChoiceOption {}

// --- Data Definitions ---
let customCharacterName: string | null = null;

const farmlands: IPointOption[] = [
    { id: 'farmland-large', name: '十五亩', description: '一片广阔而完整的灵田，适宜规模化种植。', extraPoints: 0 },
    { id: 'farmland-medium', name: '十亩', description: '灵田被分割成数块，分布在不同区域。', extraPoints: 3 },
    { id: 'farmland-small', name: '三亩', description: '灵田细碎且分散，难以进行规模化种植。', extraPoints: 6 },
];

const waterSources: IPointOption[] = [
    { id: 'water-rich', name: '灵泉充沛', description: '岛上有多处蕴含灵气的淡水泉眼，取用方便。', extraPoints: 0 },
    { id: 'water-normal', name: '水源普通', description: '淡水资源充足，但灵气含量微乎其微。', extraPoints: 2 },
    { id: 'water-scarce', name: '水源稀缺', description: '需要净化海水或收集雨水才能获得淡水。', extraPoints: 4 },
];

const creatures: IPointOption[] = [
    { id: 'creature-peaceful', name: '生灵友好', description: '岛上生物大多性情温和，不会主动攻击你。', extraPoints: 0 },
    { id: 'creature-neutral', name: '中立观察', description: '生物们对你保持警惕，互不侵犯。', extraPoints: 1 },
    { id: 'creature-hostile', name: '危机四伏', description: '部分生物具有较强的领地意识和攻击性。', extraPoints: 3 },
];

const seabeds: IPointOption[] = [
    { id: 'seabed-calm', name: '浅海大陆架', description: '海底平坦，资源贫乏，但相对安全。', extraPoints: 0 },
    { id: 'seabed-trench', name: '深海海沟', description: '地形复杂，暗藏着古代遗迹和强大的海兽。', extraPoints: 2 },
    { id: 'seabed-volcano', name: '海底火山群', description: '灵气狂暴，盛产火属性与金石类天材地宝，但也极度危险。', extraPoints: 4 },
];

const storms: IPointOption[] = [
    { id: 'storm-rare', name: '风和日丽', description: '风暴罕见，大部分时间都适合出海。', extraPoints: 0 },
    { id: 'storm-common', name: '季节风暴', description: '特定季节会频繁出现风暴，限制出海时间。', extraPoints: 1 },
    { id: 'storm-frequent', name: '风暴频发', description: '天气变幻莫测，随时可能出现毁灭性的风暴。', extraPoints: 3 },
];

const islands: IPointOption[] = [
    { id: 'islands-five', name: '五座岛屿', description: '周边有五座大小不一的岛屿可供探索。', extraPoints: 0 },
    { id: 'islands-three', name: '三座岛屿', description: '周边有三座岛屿，探索范围有限。', extraPoints: 2 },
    { id: 'islands-solitary', name: '孤岛', description: '你所在的岛屿是这片海域唯一陆地。', extraPoints: 4 },
];

const mindsets: IChoiceOption[] = [
    { id: 'mindset-survivor', name: '求生者', description: '活下去是不变的真理。你对环境中的危险和机遇有更强的直觉。' },
    { id: 'mindset-explorer', name: '探究者', description: '解析世界是最大的乐趣。你更容易从未知事物中获得感悟。' },
    { id: 'mindset-returner', name: '归乡者', description: '这里只是垫脚石。你对空间、星辰相关的线索有特殊感应。' },
];

const defaultTrait: ITrait = { id: 'trait-farmer', name: '农学世家', description: '你出身于农业世家，对植物的习性有天生的亲和力。' };
const optionalTraits: ITrait[] = [
    { id: 'trait-athlete', name: '运动健将', description: '你曾是运动健将，拥有更强的体能和耐力。' },
    { id: 'trait-handy', name: '动手达人', description: '你热爱手工，能更快地制作和修复工具。' },
    { id: 'trait-chef', name: '厨艺特长', description: '你对烹饪有独到的见解，能更好地处理食材，制作美味佳肴。' },
    { id: 'trait-survivalist', name: '生存大师', description: '你拥有丰富的野外生存知识，能更好地辨识可食用植物和危险生物。' },
    { id: 'trait-scholar', name: '学霸', description: '你拥有过目不忘的记忆力和强大的逻辑思维能力，更容易学习和理解新知识。' },
    { id: 'trait-none', name: '无', description: '你没有其他特别的凡人特长。' },
];

const inventoryItems: IItem[] = [
  { id: 'item-ju-ling-ping', name: '初级聚灵瓶', description: '可自动地缓慢聚集灵气，放水进去可让水携带灵气。', points: 5 },
  { id: 'item-chang-chun-jue', name: '《长春诀》拓本', description: '一部完整的炼气期木系功法，中正平和。', points: 4 },
  { id: 'item-bi-shui-zhu', name: '避水珠', description: '能让人在水里自由呼吸的珠子，可由水性灵兽孕育。', points: 4 },
  { id: 'item-yang-yan-jingshi', name: '阳炎晶石', description: '一块能持续散发温暖热量的暖黄色晶石，小块，可当暖手宝。', points: 4 },
  { id: 'item-cao-mu-tu-jian', name: '《元初草木图鉴》残本', description: '记录了大量海滨灵植的图鉴，灵植师的宝贵参考。', points: 3 },
  { id: 'item-nuan-yang-guo', name: '暖阳果', description: '生于背阴潮湿之地，果实性温，凡人食之可驱寒充饥,修士食之可略补真元。其核饱满，遇土即生。', points: 3 },
  { id: 'item-pigu-dan', name: '一瓶辟谷丹', description: '十颗装，让你在前期无需为食物发愁。', points: 2 },
  { id: 'item-duan-jian', name: '断裂的飞剑（剑尖）', description: '由青玉精钢制成，可打造成锋利的小刀或箭头。', points: 2 },
  { id: 'item-chu-wu-dai', name: '失效的储物袋', description: '空间已失，但可研究其符文结构，有修复的可能。', points: 2 },
];

const bagItems: IItem[] = [
  { id: 'item-solar-charger', name: '太阳能充电器', description: '一块折叠式太阳能充电板，或许能让你那块板砖重新开机。', points: 5 },
  { id: 'item-multi-tool', name: '多功能军刀', description: '瑞士军刀，集成了小刀、锯子、开罐器等多种工具。', points: 3 },
  { id: 'item-antibiotics', name: '广谱抗生素', description: '一小瓶阿莫西林，用于紧急情况下的抗感染治疗。', points: 3 },
  { id: 'item-seeds', name: '高产作物种子', description: '一小包精选的杂交水稻和土豆种子。', points: 2 },
  { id: 'item-fire-starter', name: '打火石', description: '镁条打火石，在潮湿环境下也能生火。', points: 2 },
  { id: 'item-fish-line', name: '高强度鱼线和鱼钩', description: '专业的钓鱼工具，让你更容易获取食物。', points: 1 },
];

const defaultBagItems: string[] = ['没电的手机', '一套换洗衣物'];

const seasons: ISeason[] = [
    { id: 'season-spring', name: '春', description: '万物复苏，生机盎然，适合播种与培育灵植。' },
    { id: 'season-summer', name: '夏', description: '烈日炎炎，灵气充裕，但需注意防暑与应对风暴。' },
    { id: 'season-autumn', name: '秋', description: '天高气爽，硕果累累，是收获的季节，也是储备资源的良机。' },
    { id: 'season-winter', name: '冬', description: '寒风凛冽，万物蛰伏，考验着你的生存智慧。' },
];

const systems: ISystem[] = [
    { id: 'system-none', name: '无系统', description: '依靠自己的智慧和努力，走出一条独一无二的道路。', points: 0 },
    { id: 'system-sign-in', name: '签到系统', description: '每日签到即可获得随机奖励，轻松获取资源。', points: 9 },
    { id: 'system-barter', name: '以物换物', description: '可以与神秘商人进行交易，换取你需要的物品。', points: 8 },
    { id: 'system-achievement', name: '成就系统', description: '完成特定挑战可获得成就点数，兑换特殊奖励。', points: 7 },
    { id: 'system-skill-panel', name: '技能面板', description: '可以将重复的劳动转化为熟练度，解锁专属技能。', points: 5 },
];

// --- Tab 功能 ---
function showTab(tabId: string) {
  $('.tab-content, .tab-button').removeClass('active');
  $(`#${tabId}, [data-tab="${tabId}"]`).addClass('active');
}

function initializeTabs() {
  $('.tab-button').on('click', function() {
    const tabId = $(this).data('tab');
    if (tabId) showTab(tabId);
  });
}

// --- 渲染函数 ---
function renderOptions(containerId: string, items: (IPointOption | IChoiceOption | IItem | ISystem | ITrait | ISeason)[], type: 'radio' | 'checkbox', name: string, pointClass: string, pointPrefix = '+') {
    const container = $(`#${containerId}`);
    if (!container.length) return;
    let html = '';
    items.forEach((item, index) => {
        const hasPoints = ('points' in item && item.points !== undefined && item.points > 0) || ('extraPoints' in item && item.extraPoints !== undefined);
        let pointText = '';
        if (hasPoints) {
            if ('extraPoints' in item && item.extraPoints !== undefined) {
                pointText = `<span class="${pointClass} font-bold">(+${item.extraPoints}额外点数)</span>`;
            } else if ('points' in item && item.points !== undefined) {
                pointText = `<span class="${pointClass} font-bold">(${pointPrefix}${item.points}点)</span>`;
            }
        }

        html += `
            <div class="card rounded-lg p-4 border border-gray-700 hover:border-purple-500 transition">
                <label for="${item.id}" class="flex items-start cursor-pointer">
                    <input type="${type}" id="${item.id}" name="${name}" value="${'points' in item ? item.points : ('extraPoints' in item ? item.extraPoints : 0)}" class="${name}-input mt-1 mr-3 h-4 w-4" ${type === 'radio' && index === 0 ? 'checked' : ''}>
                    <div>
                        <span class="font-semibold text-gray-200">${item.name}</span>
                        ${pointText}
                        <p class="text-xs text-gray-400 mt-1">${item.description}</p>
                    </div>
                </label>
            </div>`;
    });
    container.html(html);
}

function renderItems(containerId: string, items: IItem[], itemClass: string) {
  const container = $(`#${containerId}`);
  if (!container.length) return;
  let html = '';
  items.forEach(item => {
    html += `
      <div class="item-card p-3 rounded-lg border border-gray-700 hover:border-blue-500 transition">
        <label for="${item.id}" class="flex items-start cursor-pointer">
          <input type="checkbox" id="${item.id}" data-points="${item.points}" class="${itemClass} mt-1 mr-3 h-4 w-4 rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-600">
          <div>
            <span class="font-semibold text-gray-200">${item.name}</span>
            <span class="text-yellow-400 font-bold">(-${item.points}点)</span>
            <p class="text-xs text-gray-400 mt-1">${item.description}</p>
          </div>
        </label>
      </div>`;
  });
  container.html(html);
}

// --- 自定义开局主逻辑 ---
function initializeCustomStart() {
  const UIElements = {
    sliders: $('.talent-slider'),
    confirmButton: $('#confirm-start-button'),
    loadPreviousButton: $('#load-previous-button'),
    points: {
      talentRemaining: $('#points-talent-remaining'),
      inventoryRemaining: $('#points-inventory-remaining'),
      bagRemaining: $('#points-bag-remaining'),
      extraRemaining: $('#points-extra-remaining'),
    },
  };

  const basePoints = { talent: 10, inventory: 5, bag: 5 };

  function updatePoints() {
    // 1. 计算花费
    let talentSpent = 0;
    UIElements.sliders.each(function() {
      const val = parseInt($(this).val() as string, 10);
      talentSpent += val;
      $(`#${this.id}-value`).text(val);
    });
    let inventorySpent = 0;
    $('.inventory-item-checkbox:checked').each(function() {
      inventorySpent += parseInt($(this).data('points'), 10);
    });
    let bagSpent = 0;
    $('.bag-item-checkbox:checked').each(function() {
      bagSpent += parseInt($(this).data('points'), 10);
    });
    let systemSpent = 0;
    const selectedSystemPoints = $('input[name="system"]:checked').val();
    if (selectedSystemPoints) {
        systemSpent = parseInt(selectedSystemPoints as string, 10);
    }

    // 2. 计算剩余与超支
    const talentLeft = basePoints.talent - talentSpent;
    const inventoryLeft = basePoints.inventory - inventorySpent;
    const bagLeft = basePoints.bag - bagSpent;
    
    // 3. 获取额外点数
    let extraPoints = 0;
    $('input[name="farmland"]:checked, input[name="water"]:checked, input[name="creature"]:checked, input[name="seabed"]:checked, input[name="storm"]:checked, input[name="islands"]:checked').each(function() {
        extraPoints += parseInt($(this).val() as string, 10);
    });
    const totalOverdraft = Math.max(0, -talentLeft) + Math.max(0, -inventoryLeft) + Math.max(0, -bagLeft) + systemSpent;
    const finalExtraLeft = extraPoints - totalOverdraft;

    // 4. 更新UI
    UIElements.points.talentRemaining.text(Math.max(0, talentLeft));
    UIElements.points.inventoryRemaining.text(Math.max(0, inventoryLeft));
    UIElements.points.bagRemaining.text(Math.max(0, bagLeft));
    UIElements.points.extraRemaining.text(finalExtraLeft);

    // 5. 处理UI警告和按钮状态
    $('.font-bold').removeClass('text-red-500');
    if (finalExtraLeft < 0) {
      UIElements.confirmButton.prop('disabled', true);
      UIElements.points.extraRemaining.addClass('text-red-500');
    } else {
      UIElements.confirmButton.prop('disabled', false);
    }
    if (talentLeft < 0) UIElements.points.talentRemaining.addClass('text-red-500');
    if (inventoryLeft < 0) UIElements.points.inventoryRemaining.addClass('text-red-500');
    if (bagLeft < 0) UIElements.points.bagRemaining.addClass('text-red-500');
  }

  // 初始化渲染
  renderOptions('seasons-container', seasons, 'radio', 'season', 'text-gray-500');
  renderOptions('farmland-container', farmlands, 'radio', 'farmland', 'text-yellow-400');
  renderOptions('water-container', waterSources, 'radio', 'water', 'text-yellow-400');
  renderOptions('creature-container', creatures, 'radio', 'creature', 'text-yellow-400');
  renderOptions('seabed-container', seabeds, 'radio', 'seabed', 'text-yellow-400');
  renderOptions('storm-container', storms, 'radio', 'storm', 'text-yellow-400');
  renderOptions('islands-container', islands, 'radio', 'islands', 'text-yellow-400');
  renderOptions('mindsets-container', mindsets, 'radio', 'mindset', 'text-gray-500');
  renderOptions('traits-container', optionalTraits, 'radio', 'trait', 'text-gray-500');
  renderOptions('systems-container', systems, 'radio', 'system', 'text-red-400', '-');
  renderItems('inventory-items-container', inventoryItems, 'inventory-item-checkbox');
  renderItems('bag-items-container', bagItems, 'bag-item-checkbox');
  
  // 绑定事件
  $('input').on('change input', updatePoints);

  // --- 读取上次设定 ---
  async function loadPreviousSettings() {
    const bookName = "什么？我要在玄幻修仙世界种田？";
    const entryKey = "自定义开局";
    toastr.info('正在读取上次的开局设定...');

    try {
      const worldbook = await getWorldbook(bookName);
      const entry = worldbook.find(e => e.name === entryKey);
      const worldbookContent = entry?.content;

      if (worldbookContent) {
        parseAndApplySettings(worldbookContent);
        updatePoints(); // 更新点数显示
        toastr.success('已成功加载上次的开局设定！');
        //console.log("已成功加载上次的开局设定:",worldbookContent);
      } else {
        toastr.warning('未找到上次的开局设定。');
      }
    } catch (error) {
      console.error('读取世界书失败:', error);
      toastr.error('读取设定失败，请查看控制台。');
    }
  }

  function parseAndApplySettings(content: string) {
    const getVal = (regex: RegExp) => content.match(regex)?.[1].trim() || null;

    // 角色姓名
    const characterName = getVal(/- \*\*【角色姓名】(.*?)\*\*:/);
    if (characterName) {
      $('#character-name-display h3').text(characterName);
      customCharacterName = characterName;
    }

    // 环境
    const getEnvVal = (category: string, collection: (IPointOption | ISeason)[]) => {
        const name = getVal(new RegExp(`- \\*\\*【${category}】(.*?)\\*\\*:`));
        const data = collection.find(e => e.name === name);
        if (data) $(`#${data.id}`).prop('checked', true);
    };
    getEnvVal('开局时间', seasons);
    getEnvVal('息壤灵田', farmlands);
    getEnvVal('淡水资源', waterSources);
    getEnvVal('生物环境', creatures);
    getEnvVal('海底状况', seabeds);
    getEnvVal('风暴频率', storms);
    getEnvVal('周边岛屿', islands);

    // 心态
    const mindsetName = getVal(/- \*\*【心态】(.*?)\*\*:/);
    const mindsetData = mindsets.find(m => m.name === mindsetName);
    if (mindsetData) $(`#${mindsetData.id}`).prop('checked', true);

    // 系统
    const systemName = getVal(/- \*\*【绑定系统】(.*?)\*\*:/);
    const systemData = systems.find(s => s.name === systemName);
    if (systemData) {
        $(`#${systemData.id}`).prop('checked', true);
    } else {
        $('#system-none').prop('checked', true);
    }

    // 天赋
    const genGu = getVal(/-\s*\*\*根骨\*\*:\s*(\d+)\/10/);
    const wuXing = getVal(/-\s*\*\*悟性\*\*:\s*(\d+)\/10/);
    const qiYun = getVal(/-\s*\*\*气运\*\*:\s*(\d+)\/10/);
    if (genGu) {
      $('#talent-gen-gu').val(genGu);
      $('#talent-gen-gu-value').text(genGu);
    }
    if (wuXing) {
      $('#talent-wu-xing').val(wuXing);
      $('#talent-wu-xing-value').text(wuXing);
    }
    if (qiYun) {
      $('#talent-qi-yun').val(qiYun);
      $('#talent-qi-yun-value').text(qiYun);
    }

    // 特长
    const traitsBlock = getVal(/- \*\*【凡人特长】\*\*:\s*([\s\S]*?)(?=\n\s*- \*\*【修仙天赋】|$)/);
    const selectedTrait = optionalTraits.find(t => traitsBlock?.includes(`**${t.name}**`));
    $(`input[name="trait"]`).prop('checked', false);
    if (selectedTrait && selectedTrait.id !== 'trait-none') {
      $(`#${selectedTrait.id}`).prop('checked', true);
    } else {
      $('#trait-none').prop('checked', true);
    }

    // 物品
    const inventoryBlock = getVal(/- \*\*【修仙者行囊】\*\*:\s*([\s\S]*?)(?=\n- \*\*【穿越者帆布包】|$)/);
    const bagBlock = getVal(/- \*\*【穿越者帆布包】\*\*:\s*([\s\S]*)/);

    $('.inventory-item-checkbox, .bag-item-checkbox').prop('checked', false);
    inventoryItems.forEach(item => {
      if (inventoryBlock?.includes(`**${item.name}**`)) $(`#${item.id}`).prop('checked', true);
    });
    bagItems.forEach(item => {
      if (bagBlock?.includes(`**${item.name}**`)) $(`#${item.id}`).prop('checked', true);
    });
  }

  UIElements.loadPreviousButton.on('click', loadPreviousSettings);

  // 确认按钮逻辑
  UIElements.confirmButton.on('click', async () => {
    updatePoints();
    if (UIElements.confirmButton.is(':disabled')) {
      toastr.error('点数分配超出上限！');
      return;
    }

    const getSelectionData = <T extends { id: string }>(selector: string, collection: T[]): T | null => {
      const selectedId = $(selector).attr('id');
      return collection.find(item => item.id === selectedId) || null;
    };
    const getSelectionsData = <T extends { id: string }>(selector: string, collection: T[]): T[] => {
      const selectedIds = $(selector).map((_, el) => $(el).attr('id')).get();
      return collection.filter(item => selectedIds.includes(item.id));
    };

    const selectedFarmland = getSelectionData('input[name="farmland"]:checked', farmlands);
    const selectedWater = getSelectionData('input[name="water"]:checked', waterSources);
    const selectedCreature = getSelectionData('input[name="creature"]:checked', creatures);
    const selectedSeabed = getSelectionData('input[name="seabed"]:checked', seabeds);
    const selectedStorm = getSelectionData('input[name="storm"]:checked', storms);
    const selectedIslands = getSelectionData('input[name="islands"]:checked', islands);
    const selectedMindset = getSelectionData('input[name="mindset"]:checked', mindsets);
    const selectedTrait = getSelectionData('input[name="trait"]:checked', optionalTraits);
    const selectedSeason = getSelectionData('input[name="season"]:checked', seasons);
    const selectedSystem = getSelectionData('input[name="system"]:checked', systems);

    const finalTraits = [defaultTrait];
    if (selectedTrait && selectedTrait.id !== 'trait-none') {
        finalTraits.push(selectedTrait);
    }

    const finalCharacterName = customCharacterName || $('#character-name-display h3').text().trim();

    const selections = {
      characterName: finalCharacterName,
      farmland: selectedFarmland,
      water: selectedWater,
      creature: selectedCreature,
      seabed: selectedSeabed,
      storm: selectedStorm,
      islands: selectedIslands,
      mindset: selectedMindset,
      season: selectedSeason,
      system: selectedSystem,
      traits: finalTraits,
      talents: {
        genGu: $('#talent-gen-gu').val() as string,
        wuXing: $('#talent-wu-xing').val() as string,
        qiYun: $('#talent-qi-yun').val() as string,
      },
      inventory: getSelectionsData('.inventory-item-checkbox:checked', inventoryItems),
      bag: getSelectionsData('.bag-item-checkbox:checked', bagItems),
    };

    // 构建更详细、结构化的条目内容
    let systemContent = '';
    if (selections.system && selections.system.id !== 'system-none') {
        systemContent = `- **【绑定系统】${selections.system.name}**: ${selections.system.description}`;
    }

    const entryContent = `
# 玩家自定义开局设定
以下是玩家为本次游戏选择的初始配置，请在后续的剧情生成中严格参考这些设定。

## 核心设定
- **【角色姓名】**: ${selections.characterName}
- **【开局时间】${selections.season?.name}**: ${selections.season?.description}
- **【心态】${selections.mindset?.name}**: ${selections.mindset?.description}
${systemContent ? systemContent + '\n' : ''}
## 环境设定
- **【息壤灵田】${selections.farmland?.name}**: ${selections.farmland?.description}
- **【淡水资源】${selections.water?.name}**: ${selections.water?.description}
- **【生物环境】${selections.creature?.name}**: ${selections.creature?.description}
- **【海底状况】${selections.seabed?.name}**: ${selections.seabed?.description}
- **【风暴频率】${selections.storm?.name}**: ${selections.storm?.description}
- **【周边岛屿】${selections.islands?.name}**: ${selections.islands?.description}

## 天赋根基
- **【凡人特长】**: 
${selections.traits.map(t => `  - **${t.name}**: ${t.description}`).join('\n')}
- **【修仙天赋】**:
  - **根骨**: ${selections.talents.genGu}/10
  - **悟性**: ${selections.talents.wuXing}/10
  - **气运**: ${selections.talents.qiYun}/10

## 初始携带
- **【修仙者行囊】**:
${selections.inventory.length > 0 ? selections.inventory.map(item => `  - **${item.name}**: ${item.description}`).join('\n') : '  - 无'}
- **【穿越者帆布包】**:
${[...defaultBagItems.map(name => `  - ${name}`), ...selections.bag.map(item => `  - **${item.name}**: ${item.description}`)].join('\n')}
`.trim();

    const bookName = "什么？我要在玄幻修仙世界种田？";
    const entryKey = "自定义开局";

    try {
      await updateWorldbookWith(bookName, (worldbook) => {
        const entryIndex = worldbook.findIndex(entry => entry.name === entryKey);

        if (entryIndex !== -1) {
          // 更新现有条目
          worldbook[entryIndex].content = entryContent;
          toastr.success('自定义开局已更新！', '设置已保存');
        } else {
          // 创建新条目
          worldbook.push({
            name: entryKey,
            content: entryContent,
            enabled: true,
            strategy: {
              type: 'constant',
              keys: [],
              keys_secondary: { logic: 'and_any', keys: [] },
              scan_depth: 'same_as_global',
            },
            position: {
              type: 'before_character_definition',
              role: 'system',
              depth: 4,
              order: 0,
            },
            probability: 100,
            recursion: {
              prevent_incoming: false,
              prevent_outgoing: false,
              delay_until: null,
            },
            effect: {
              sticky: null,
              cooldown: null,
              delay: null,
            },
          } as any);
          toastr.success('自定义开局成功！', '设置已保存');
        }
        return worldbook;
      });

      UIElements.confirmButton.text('已确认').prop('disabled', true);
      $('input').prop('disabled', true);

      // Call the new function to update the first message's second swipe
      await updateFirstMessageSwipeWithItems(entryContent, selections.system);

      // 清空旧变量并保存新的开局信息
      const allItemsForVars = [
        ...selections.inventory.map(item => item.name),
        ...defaultBagItems,
        ...selections.bag.map(item => item.name)
      ];

      const newVariables: any = {
        '开局设定': {
          '角色姓名': selections.characterName,
          '核心设定': {
            '开局时间': selections.season?.name,
            '心态': selections.mindset?.name,
            '绑定系统': selections.system?.id === 'system-none' ? '无' : selections.system?.name,
          },
          '环境设定': {
            '息壤灵田': selections.farmland?.name,
            '淡水资源': selections.water?.name,
            '生物环境': selections.creature?.name,
            '海底状况': selections.seabed?.name,
            '风暴频率': selections.storm?.name,
            '周边岛屿': selections.islands?.name,
          },
          '天赋根基': {
            '凡人特长': selections.traits.map(t => t.name),
            '修仙天赋': {
              '根骨': selections.talents.genGu,
              '悟性': selections.talents.wuXing,
              '气运': selections.talents.qiYun,
            }
          },
          '初始携带': {
            '修仙者行囊': selections.inventory.map(item => item.name),
            '穿越者帆布包': [...defaultBagItems, ...selections.bag.map(item => item.name)],
          }
        },
        '世界': {
          '庇护所': { '状态': '尚未建立' },
          '妖兽图鉴': { '已发现': 0, '已收录': [] },
          '植物图鉴': { '已发现': 0, '已种植': [] },
          '核心物品': allItemsForVars,
          'lastSyncMessageId': 0
        }
      };

      // Add system data based on selection
      if (selections.system) {
        if (selections.system.id === 'system-skill-panel') {
          (newVariables['世界'] as any)['系统'] = {
            '名称': '技能面板',
            '技能': []
          };
        } else if (selections.system.id === 'system-achievement') {
          (newVariables['世界'] as any)['系统'] = {
            '名称': '成就系统',
            '成就点数': 0,
            '已完成': []
          };
          // Hardcode the rewards into a worldbook entry
          const achievementRewards = {
            "description": "这些奖励只能使用【成就点数】兑换，它们独一无二，无法通过其他途径获取。",
            "tiers": [
              {
                "tier_name": "第一层：初窥门径",
                "cost_range": "10-30点",
                "rewards": [
                  { "name": "灵田扩增图纸", "description": "一张记录了如何安全开垦并激活新灵田的图纸。需要消耗一定的体力和材料。", "cost": 15 },
                  { "name": "储物袋修复套组", "description": "包含一小撮“虚空尘晶”和详细的修复图解，足以修复一个标准储物袋。", "cost": 20 },
                  { "name": "《基础剑招详解》", "description": "一本凡俗武学典籍，但其中蕴含的剑理，或许能帮你更好地理解《断潮剑经》。", "cost": 25 }
                ]
              },
              {
                "tier_name": "第二层：登堂入室",
                "cost_range": "30-60点",
                "rewards": [
                  { "name": "甘霖泉升级", "description": "你的甘霖泉得到了一次升华，现在泉水中蕴含的灵气浓度提升了。", "cost": 40 },
                  { "name": "不枯草的祝福", "description": "你的某株灵植获得了不枯草的一丝特性，现在它的某个部位可以重复采摘了。", "cost": 50 },
                  { "name": "守护兽的亲近", "description": "你与岛屿守护兽的关系变得更加融洽，它们偶尔会为你带来一些小礼物。", "cost": 60 }
                ]
              }
            ]
          };
          await updateWorldbookWith(bookName, (worldbook) => {
            const entryKey = "成就系统的奖励";
            const entryIndex = worldbook.findIndex(entry => entry.name === entryKey);
            const content = JSON.stringify(achievementRewards, null, 2);
            if (entryIndex !== -1) {
              worldbook[entryIndex].content = content;
            } else {
              worldbook.push({
                name: entryKey,
                content: content,
                enabled: true,
                strategy: { type: 'constant', keys: [], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' },
                position: { type: 'before_character_definition', role: 'system', depth: 4, order: 0 },
                probability: 100,
                recursion: { prevent_incoming: false, prevent_outgoing: false, delay_until: null },
                effect: { sticky: null, cooldown: null, delay: null },
              } as any);
            }
            return worldbook;
          });
          toastr.info('成就系统奖励已初始化。');
        } else if (selections.system.id === 'system-barter') {
          (newVariables['世界'] as any)['系统'] = {
            '名称': '以物换物系统',
            '提示': '神秘商人留下的临时交换点，物品每日刷新。',
            '我的物品': [],
            '可换取的物品': []
          };
        } else if (selections.system.id === 'system-sign-in') {
            (newVariables['世界'] as any)['系统'] = {
                '名称': '签到系统',
                '提示': '每日签到可获得奖励，连续签到有惊喜。',
                '已签到': [],
                '连续签到': 0,
                '月卡': '未激活'
            };
        }
      }

      await updateVariablesWith(vars => {
        // Unset the keys to ensure a clean replacement, not a deep merge.
        _.unset(vars, '开局设定');
        _.unset(vars, '世界');
        // Merge the new, complete objects back in.
        return _.merge(vars, newVariables);
      }, { type: 'message', message_id: 0 });
      toastr.success('开局设定已成功存入变量！');

      // Initialize global pokedex from the new JSON file
      try {
        await updateVariablesWith(globalVars => {
            const existingPokedex = _.get(globalVars, '世界.图鉴', { '妖兽': [], '植物': [], '物品': [] });

            // Merge, preferring existing data to not overwrite player progress if any
            const finalPokedex = _.mergeWith({}, existingPokedex, initialPokedex, (objValue, srcValue) => {
                if (_.isArray(objValue)) {
                    // objValue is from existingPokedex, srcValue is from initialPokedex
                    // We want to add new items from initial without duplicating.
                    return _.unionBy(objValue, srcValue, '名称');
                }
            });

            _.set(globalVars, '世界.图鉴', finalPokedex);
            return globalVars;
        }, { type: 'global' });

        toastr.success('全局图鉴已初始化！');
      } catch (pokedexError) {
        console.error('初始化全局图鉴失败:', pokedexError);
        toastr.error('初始化全局图鉴失败，请查看控制台。');
      }

    } catch (error) {
      console.error('操作世界书条目或更新首楼消息失败:', error);
      toastr.error('自定义开局失败，请检查控制台日志。', '错误');
    }
  });

  updatePoints(); // 初始计算
}

// --- 角色姓名编辑功能 ---
function initializeCharacterNameEditor() {
  const nameDisplayContainer = $('#character-name-display');
  const nameEditContainer = $('#character-name-edit');
  const nameDisplay = nameDisplayContainer.find('h3');
  const nameInput = $('#character-name-input');
  const editButton = $('#edit-name-button');
  const confirmButton = $('#confirm-name-button');
  const cancelButton = $('#cancel-name-button');

  const switchToEditMode = () => {
    nameInput.val(nameDisplay.text());
    nameDisplayContainer.addClass('hidden');
    nameEditContainer.removeClass('hidden');
    nameInput.trigger('focus');
  };

  const switchToDisplayMode = () => {
    nameEditContainer.addClass('hidden');
    nameDisplayContainer.removeClass('hidden');
  };

  editButton.on('click', switchToEditMode);
  cancelButton.on('click', switchToDisplayMode);

  confirmButton.on('click', () => {
    const newName = (nameInput.val() as string).trim();
    if (!newName) {
      toastr.warning('角色姓名不能为空！');
      return;
    }

    const oldName = nameDisplay.text().trim();
    if (newName === oldName) {
      switchToDisplayMode();
      return;
    }

    nameDisplay.text(newName);
    customCharacterName = newName;
    toastr.success(`角色姓名已暂存为 "${newName}"`, '将在确认开局时生效');
    switchToDisplayMode();
  });
}


// --- 版本检查功能 ---
async function initializeVersionChecker() {
  const $versionChecker = $('#version-checker');
  const updateInfo = await checkForUpdates();

  if (updateInfo) {
    // 始终为版本区域绑定点击事件
    $versionChecker.on('click', () => {
      if (updateInfo.changelogHtml) {
        showChangelogModal(updateInfo.changelogHtml, updateInfo.hasUpdate);
      } else {
        toastr.warning('无法获取更新日志。');
      }
    });

    if (updateInfo.hasUpdate) {
      $versionChecker
        .html(`<i class="fas fa-arrow-up text-green-400 mr-1"></i><span class="text-green-400 hover:underline">发现新版本 (${updateInfo.remoteVersion})</span>`);
    } else {
      $versionChecker.html(`<i class="fas fa-check-circle text-gray-500 mr-1"></i><span class="hover:underline">已是最新版本</span>`);
    }
  } else {
    $versionChecker.html(`<i class="fas fa-exclamation-triangle text-red-500 mr-1"></i><span class="text-red-500">检查更新失败</span>`);
  }
}

// DOM加载完成后执行
$(() => {
  initializeTabs();
  initializeCustomStart();
  initializeCharacterNameEditor();
  initializeVersionChecker();

  // On mobile, close all collapsible sections by default
  if (window.innerWidth < 768) {
    $('.collapsible-section').removeAttr('open');
  }
});

async function updateFirstMessageSwipeWithItems(worldbookContent: string, selectedSystem: ISystem | null) {
  try {
    // 1. 从世界书内容中解析物品
    const inventoryRegex = /-\s\*\*【修仙者行囊】\*\*:\s*([\s\S]*?)(?=\n- \*\*【穿越者帆布包】\*\*|$)/;
    const bagRegex = /-\s\*\*【穿越者帆布包】\*\*:\s*([\s\S]*)/;

    const inventoryMatch = worldbookContent.match(inventoryRegex);
    const bagMatch = worldbookContent.match(bagRegex);

    const parseSelectedItems = (match: RegExpMatchArray | null): string[] => {
      if (!match || !match[1] || match[1].trim().includes('无')) return [];
      return match[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('- **')) // 只匹配玩家选择的加粗项目
        .map(line => {
            const itemName = line.replace(/^- \*\*/, '').split('**:')[0].trim();
            return `🎒 ${itemName}`;
        });
    };

    const inventoryItems = parseSelectedItems(inventoryMatch);

    // 从旅行包部分解析所有物品（包括默认和选择的）
    const allBagItems: string[] = [];
    if (bagMatch && bagMatch[1]) {
      const itemLines = bagMatch[1].split('\n').map(line => line.trim()).filter(line => line.startsWith('- '));
      for (const line of itemLines) {
        if (line.startsWith('- **')) {
          // 玩家选择的物品
          const itemName = line.replace(/^- \*\*/, '').split('**:')[0].trim();
          allBagItems.push(`🎒 ${itemName}`);
        } else {
          // 默认物品
          const itemName = line.replace(/^-/, '').trim();
          allBagItems.push(`🎒 - ${itemName}`);
        }
      }
    }

    // 2. 构建新的、结构正确的物品列表
    const allItems = [
      ...inventoryItems,
      '👜 【穿越者帆布包】',
      ...allBagItems,
    ];

    // 2. 获取首楼的所有消息页
    const firstMessageSwipes = getChatMessages(0, { include_swipes: true })[0];
    if (!firstMessageSwipes || !firstMessageSwipes.swipes || firstMessageSwipes.swipes.length < 2) {
      toastr.error('无法获取到首楼的第二个消息页（游戏开局页）。');
      return;
    }

    const gameStartSwipeContent = firstMessageSwipes.swipes[1];

    // 3. 使用 jQuery 解析第二个消息页的HTML内容
    const $parsedContent = $(`<div>${gameStartSwipeContent}</div>`);
    const $statusBar = $parsedContent.find('statusbar'); // jQuery is case-insensitive for tag names

    if ($statusBar.length === 0) {
        toastr.error('游戏开局页中未找到 <statusbar> 标签。');
        return;
    }
    const statusBarJsonContent = $statusBar.text().trim();

    let statusBarData: any;
    try {
      statusBarData = JSON.parse(statusBarJsonContent);
    } catch (e) {
      toastr.error('解析游戏开局页中 <statusbar> 内的JSON失败。');
      console.error("JSON Parsing Error:", e, "Content:", statusBarJsonContent);
      return;
    }

    // 4. 更新核心物品 (使用更稳健的查找方式)
    const rootKey = Object.keys(statusBarData)[0];
    const characterList = statusBarData[rootKey]['角色列表'];
    if (characterList && Array.isArray(characterList) && characterList.length > 0) {
        const mainCharacter = characterList[0]['👤 角色'];
        if (mainCharacter) {
            mainCharacter['🎒 核心物品'] = allItems;
        }
    }

    // 4.5. 清空/初始化图鉴和庇护所信息
    statusBarData[rootKey]['🏡 庇护所'] = { "状态": "尚未建立" };
    statusBarData[rootKey]['🐾 妖兽图鉴'] = { "已发现": 0, "已收录": [] };
    statusBarData[rootKey]['🌿 植物图鉴'] = { "已发现": 0, "已种植": [] };

    // 4.6. 根据所选系统更新状态栏
    const systemKey = Object.keys(statusBarData[rootKey]).find(k => k.includes('系统'));

    // First, remove any existing system key to ensure a clean slate
    if (systemKey) {
        delete statusBarData[rootKey][systemKey];
    }

    // Then, add the new system if one was selected
    if (selectedSystem && selectedSystem.id !== 'system-none') {
      if (selectedSystem.id === 'system-skill-panel') {
        statusBarData[rootKey]['⚙️ 系统'] = {
          "名称": "技能面板",
          "提示": "重复行动可提升技能熟练度。",
          "技能": []
        };
      } else if (selectedSystem.id === 'system-achievement') {
        statusBarData[rootKey]['🏆 系统'] = {
          "名称": "成就系统",
          "成就点数": 0,
          "已完成": []
        };
      } else if (selectedSystem.id === 'system-barter') {
        statusBarData[rootKey]['🔄 系统'] = {
          "名称": "以物换物系统",
          "提示": "神秘商人留下的临时交换点，物品每日刷新。",
          "我的物品": [],
          "可换取的物品": []
        };
      } else if (selectedSystem.id === 'system-sign-in') {
        statusBarData[rootKey]['🗓️ 系统'] = {
          "名称": "签到系统",
          "提示": "每日签到可获得奖励，连续签到有惊喜。",
          "已签到": [],
          "连续签到": 0,
          "月卡": "未激活"
        };
      }
      // (Future systems can be added here with else if)
    }

    // 5. 构建新的消息页数组并保存
    const updatedJsonString = JSON.stringify(statusBarData, null, 2);
    $statusBar.text(`\n${updatedJsonString}\n`);
    const updatedSwipeContent = $parsedContent.html();

    const newSwipes = [...firstMessageSwipes.swipes];
    newSwipes[1] = updatedSwipeContent;

    await setChatMessages([{ message_id: 0, swipes: newSwipes }], { refresh: 'none' });

    toastr.success('已成功更新游戏开局的核心物品！');

  } catch (error) {
    console.error('更新游戏开局消息失败:', error);
    toastr.error('更新游戏开局状态失败，请查看控制台。');
  }
}
