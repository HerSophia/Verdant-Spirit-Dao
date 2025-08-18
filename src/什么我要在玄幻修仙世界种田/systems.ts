import _ from 'lodash';

function initCustomSlider() {
  const slider = document.querySelector('.custom-slider') as HTMLElement;
  if (!slider) return;

  const track = slider.querySelector('.custom-slider-track') as HTMLElement;
  const slides = Array.from(track.children) as HTMLElement[];
  const nextButton = slider.querySelector('.slider-nav-btn.next') as HTMLButtonElement;
  const prevButton = slider.querySelector('.slider-nav-btn.prev') as HTMLButtonElement;
  const counter = slider.querySelector('.slider-counter') as HTMLElement;

  if (!track || slides.length === 0 || !nextButton || !prevButton || !counter) return;

  let currentIndex = 0;
  const totalSlides = slides.length;

  const updateSlider = () => {
    const slideWidth = slides[0].offsetWidth;
    track.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
    
    // Update counter
    counter.textContent = `${currentIndex + 1} / ${totalSlides}`;

    // Update button states
    prevButton.disabled = currentIndex === 0;
    nextButton.disabled = currentIndex === totalSlides - 1;
  };

  nextButton.addEventListener('click', () => {
    if (currentIndex < totalSlides - 1) {
      currentIndex++;
      updateSlider();
    }
  });

  prevButton.addEventListener('click', () => {
    if (currentIndex > 0) {
      currentIndex--;
      updateSlider();
    }
  });

  // Initial setup
  updateSlider();
  
  // Recalculate on resize
  new ResizeObserver(updateSlider).observe(slider);
}

/**
 * 渲染技能面板系统
 * @param systemData - 从变量中获取的系统数据
 * @param container - 用于渲染的HTML容器元素
 */
function renderSkillPanel(systemData: any, container: HTMLElement) {
  const skills = systemData['技能'] || [];
  let contentHtml = '';

  if (skills.length === 0) {
    contentHtml = `<p class="text-secondary text-sm italic">${systemData['提示'] || '尚未获得任何技能。'}</p>`;
  } else {
    contentHtml = '<ul class="space-y-3">';
    skills.forEach((skill: any) => {
      const name = skill['名称'] || '未知技能';
      const level = skill['等级'] || 1;
      const exp = skill['熟练度'] || { value: 0, max: 100 };
      const percentage = (exp.value / exp.max) * 100;

      contentHtml += `
        <li>
          <div class="flex justify-between items-center mb-1">
            <span class="font-semibold text-primary">${name}</span>
            <span class="text-sm font-mono text-secondary">Lv. ${level}</span>
          </div>
          <div class="progress-bar-bg w-full rounded-full h-2.5">
            <div class="progress-bar-fg bg-accent h-2.5 rounded-full" style="width: ${percentage}%"></div>
          </div>
          <div class="text-right text-xs font-mono text-secondary mt-1">${exp.value} / ${exp.max}</div>
        </li>
      `;
    });
    contentHtml += '</ul>';
  }

  container.innerHTML = `
    <div class="bg-main rounded-xl border border-dim p-3.5 shadow-sm card-hover theme-transition">
      <h3 class="font-bold text-lg mb-2 pb-1 border-b border-dim theme-transition">
        ⚙️ ${systemData['名称'] || '技能面板'}
      </h3>
      ${contentHtml}
    </div>
  `;
}

/**
 * 渲染成就系统
 * @param systemData - 从变量中获取的系统数据
 * @param container - 用于渲染的HTML容器元素
 */
function renderAchievementSystem(systemData: any, container: HTMLElement) {
  const points = systemData['成就点数'] || 0;
  const completed = systemData['已完成'] || [];
  
  let achievementsHtml = '';
  if (completed.length === 0) {
    achievementsHtml = `<p class="text-secondary text-sm italic">尚未解锁任何成就。</p>`;
  } else {
    achievementsHtml = '<ul class="space-y-3">';
    completed.forEach((ach: any) => {
      const name = ach['名称'] || '未知成就';
      const desc = ach['描述'] || '没有描述。';
      // 将整个成就对象字符串化以用于 data-details
      const details = JSON.stringify(ach);

      achievementsHtml += `
        <li class="clickable-item rounded-lg p-3 hover:bg-secondary transition-colors" data-details='${details}'>
          <div class="flex items-center">
            <i class="fas fa-trophy text-yellow-400 mr-3 fa-lg"></i>
            <p class="font-semibold text-primary">${name}</p>
          </div>
          <p class="text-sm text-secondary pl-8 mt-1">${desc}</p>
        </li>
      `;
    });
    achievementsHtml += '</ul>';
  }

  container.innerHTML = `
    <div class="bg-main rounded-xl border border-dim p-3.5 shadow-sm card-hover theme-transition">
      <div class="flex justify-between items-center mb-2 pb-1 border-b border-dim">
        <h3 class="font-bold text-lg theme-transition">
          🏆 ${systemData['名称'] || '成就系统'}
        </h3>
        <div class="font-bold text-accent text-lg" title="成就点数">
          ${points} <i class="fas fa-star text-xs"></i>
        </div>
      </div>
      ${achievementsHtml}
      <div class="mt-4 pt-3 border-t border-dim text-center">
        <button id="redeem-rewards-btn" class="btn-primary w-full sm:w-auto">
          <i class="fas fa-gift mr-2"></i>兑换奖励
        </button>
      </div>
    </div>
  `;
}

function renderBarterSystem(systemData: any, container: HTMLElement) {
  const myItems = systemData['我的物品'] || [];
  const availableItems = systemData['可换取的物品'] || [];
  const totalValue = _.sumBy(myItems, (item: any) => (item['数量'] || 0) * (item['价值'] || 0));

  // --- My Items Section ---
  let myItemsHtml = `<div class="bg-secondary/30 rounded-lg p-3 shadow-inner">`;
  if (myItems.length > 0) {
    myItemsHtml += `<ul class="space-y-2 text-sm">`;
    myItems.forEach((item: any) => {
      myItemsHtml += `
        <li class="flex justify-between items-center p-2 rounded-md bg-main/30">
          <div>
            <span class="font-semibold text-primary">${item['名称']}</span>
            <span class="text-xs text-secondary ml-2">(价值: ${item['价值']})</span>
          </div>
          <span class="font-mono text-accent font-semibold">x ${item['数量']}</span>
        </li>
      `;
    });
    myItemsHtml += `</ul>`;
  } else {
    myItemsHtml += `<p class="text-secondary text-sm italic text-center p-4">你没有可用于交换的物品。</p>`;
  }
  myItemsHtml += '</div>';

  // --- Available Items Section ---
  let availableItemsHtml = `
    <div class="custom-slider">
      <div class="custom-slider-track">
  `;
  if (availableItems.length > 0) {
    availableItems.forEach((item: any) => {
      const canAfford = totalValue >= (item['价值'] || 0);
      availableItemsHtml += `
        <div class="custom-slider-slide">
          <div class="bg-main rounded-xl border border-dim shadow-lg overflow-hidden flex flex-col h-full">
            <div class="p-4 bg-secondary/30 min-h-[8rem] flex items-center">
                <p class="text-secondary text-sm">${item['描述'] || '暂无描述'}</p>
            </div>
            <div class="p-4 flex flex-col flex-grow">
                <h5 class="font-bold text-primary text-lg flex-grow mb-2">${item['名称']}</h5>
                <div class="flex justify-between items-center mb-4">
                    <span class="text-2xl font-bold text-accent">${item['价值']} <i class="fas fa-coins text-lg"></i></span>
                    <span class="bg-accent/20 text-accent text-xs font-bold px-2 py-1 rounded-full">库存: ${item['库存']}</span>
                </div>
                <button 
                    class="barter-btn w-full mt-auto bg-accent hover:bg-accent-hover text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    data-name="${item['名称']}" 
                    data-cost="${item['价值']}"
                    ${!canAfford ? 'disabled' : ''}
                    title="${canAfford ? `兑换 ${item['名称']}` : `价值不足 (需要 ${item['价值']})`}"
                >
                    <i class="fas fa-exchange-alt"></i>
                    <span>${canAfford ? '兑换' : '价值不足'}</span>
                </button>
            </div>
          </div>
        </div>
      `;
    });
  } else {
    availableItemsHtml += `<div class="custom-slider-slide"><p class="text-secondary text-sm italic text-center p-4">当前没有可换取的物品。</p></div>`;
  }
  availableItemsHtml += `
      </div>
      <div class="slider-controls">
        <button class="slider-nav-btn prev"><i class="fas fa-chevron-left"></i></button>
        <span class="slider-counter"></span>
        <button class="slider-nav-btn next"><i class="fas fa-chevron-right"></i></button>
      </div>
    </div>
  `;

  container.innerHTML = `
    <div class="bg-main rounded-xl border border-dim p-4 shadow-sm card-hover theme-transition">
      <div class="flex justify-between items-center mb-3 pb-2 border-b border-dim">
        <h3 class="font-bold text-lg theme-transition flex items-center">
          <i class="fas fa-store mr-2 text-accent"></i> ${systemData['名称'] || '以物换物'}
        </h3>
        <div class="font-bold text-accent text-lg" title="我的总价值">
          ${totalValue} <i class="fas fa-coins text-xs"></i>
        </div>
      </div>
      <div class="space-y-6 mt-4">
        <div>
          <h4 class="font-semibold text-base mb-2 text-primary/80">我的物品</h4>
          ${myItemsHtml}
        </div>
        <div>
          <div class="flex justify-between items-center mb-2">
            <h4 class="font-semibold text-base text-primary/80">可换取的物品</h4>
            <button id="refresh-barter-btn" class="text-sm text-accent hover:text-accent-hover transition-colors p-1 rounded hover:bg-secondary" title="刷新可换取物品">
              <i class="fas fa-sync-alt"></i> 刷新
            </button>
          </div>
          ${availableItemsHtml}
        </div>
      </div>
      <div class="mt-4 pt-3 border-t border-dim text-center">
        <p class="text-xs text-secondary">${systemData['提示'] || '用你的物品积累价值，换取所需之物。'}</p>
      </div>
    </div>
  `;
  setTimeout(() => initCustomSlider(), 0);
}

/**
 * 渲染签到系统
 * @param systemData - 从变量中获取的系统数据
 * @param container - 用于渲染的HTML容器元素
 */
function renderSignInSystem(systemData: any, container: HTMLElement) {
  const today = new Date().getDate();
  const signedInDays = systemData['已签到'] || [];
  const canSignIn = !signedInDays.includes(today);
  const consecutiveDays = systemData['连续签到'] || 0;
  const monthlyCard = systemData['月卡'] || '未激活';
  const monthlyCardHTML = monthlyCard === '未激活'
    ? `${monthlyCard} <button id="activate-monthly-card-btn" class="text-xs ml-2 px-2 py-0.5 rounded bg-accent/20 hover:bg-accent/40 text-accent transition-colors" title="向AI询问激活月卡的条件">激活</button>`
    : monthlyCard;

  let calendarHtml = '<div id="calendar-grid" class="grid grid-cols-7 gap-1 text-center text-xs">';
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  for (let i = 1; i <= daysInMonth; i++) {
    const isToday = i === today;
    const isSignedIn = signedInDays.includes(i);
    let dayClass = 'w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-300 ';

    if (isToday && !isSignedIn) { // Only apply special style if it's today AND not signed in yet
      dayClass += 'bg-accent/30 text-accent font-bold ring-2 ring-accent ';
    } else {
      dayClass += 'bg-secondary/50 ';
    }

    if (isSignedIn) {
      dayClass += 'bg-green-500/50 text-white';
      calendarHtml += `<div class="${dayClass}" title="第${i}天：已签到" data-day="${i}"><i class="fas fa-check"></i></div>`;
    } else {
      calendarHtml += `<div class="${dayClass}" title="第${i}天：未签到" data-day="${i}">${i}</div>`;
    }
  }
  calendarHtml += '</div>';

  container.innerHTML = `
    <div class="bg-main rounded-xl border border-dim p-3.5 shadow-sm card-hover theme-transition">
      <h3 class="font-bold text-lg mb-3 pb-2 border-b border-dim theme-transition">
        🗓️ ${systemData['名称'] || '签到系统'}
      </h3>
      <div class="space-y-4">
        ${calendarHtml}
        <div class="text-center text-sm text-secondary space-y-1 pt-2">
            <p>连续签到: <span class="font-bold text-accent">${consecutiveDays}</span> 天</p>
            <p>月卡状态: <span class="font-bold text-accent">${monthlyCardHTML}</span></p>
        </div>
        <button id="sign-in-btn" class="btn-primary w-full" ${!canSignIn ? 'disabled' : ''}>
          <i class="fas fa-calendar-check mr-2"></i>${canSignIn ? '今日签到' : '今日已签到'}
        </button>
      </div>
    </div>
  `;
}


/**
 * 系统渲染的主函数
 * @param systemData - 从变量中获取的系统数据
 * @param container - 用于渲染的HTML容器元素
 */
export function renderSystem(systemData: any, container: HTMLElement) {
  if (!systemData || _.isEmpty(systemData)) {
    container.innerHTML = `
      <div class="text-center py-4 text-secondary theme-transition italic">
        <i class="fas fa-info-circle mr-1"></i>未绑定系统
      </div>
    `;
    return;
  }

  const systemName = systemData['名称'];
  switch (systemName) {
    case '技能面板':
      renderSkillPanel(systemData, container);
      break;
    case '成就系统':
      renderAchievementSystem(systemData, container);
      break;
    case '以物换物系统':
      renderBarterSystem(systemData, container);
      break;
    case '签到系统':
      renderSignInSystem(systemData, container);
      break;
    // 在这里可以为其他系统添加 case
    default:
      container.innerHTML = `
        <div class="text-center py-4 text-secondary theme-transition italic">
          <i class="fas fa-question-circle mr-1"></i>未知的系统类型: ${systemName}
        </div>
      `;
      break;
  }
}
