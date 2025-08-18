import { processFileUpdate } from '../update-script';
declare const marked: any;

// 请将这里的 URL 替换为你的 GitHub 仓库的 Raw 地址
const GITHUB_REPO_RAW_URL = 'https://raw.githubusercontent.com/HerSophia/Verdant-Spirit-Dao/main/';

// 当前版本号，需要与 version.json 保持一致
const LOCAL_VERSION = 'v0.3.1';

interface UpdateInfo {
  hasUpdate: boolean;
  remoteVersion: string;
  changelogHtml: string | null;
  filesToUpdate?: string[];
}

/**
 * 检查是否有新版本并获取更新日志
 * @returns {Promise<UpdateInfo | null>}
 */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
  try {
    // 从 GitHub 获取最新的 version.json
    const versionResponse = await fetch(`${GITHUB_REPO_RAW_URL}version.json`);
    if (!versionResponse.ok) {
      throw new Error(`无法获取 version.json: ${versionResponse.statusText}`);
    }
    const versionData = await versionResponse.json();
    const remoteVersion = `v${versionData.version}`;

    const hasUpdate = remoteVersion.localeCompare(LOCAL_VERSION, undefined, { numeric: true, sensitivity: 'base' }) > 0;

    let changelogHtml: string | null = null;
    // 无论是否有更新，都尝试获取更新日志
    try {
      const changelogResponse = await fetch(`${GITHUB_REPO_RAW_URL}changlog.md`);
      if (changelogResponse.ok) {
        const changelogMd = await changelogResponse.text();
        changelogHtml = marked.parse(changelogMd) as string;
      } else {
        changelogHtml = '<p>无法加载更新日志。</p>';
      }
    } catch (e) {
      console.error("获取更新日志失败:", e);
      changelogHtml = '<p>无法加载更新日志。</p>';
    }

    let filesToUpdate: string[] | undefined = undefined;
    if (hasUpdate) {
      filesToUpdate = versionData.files_to_update || [];
    }

    return {
      hasUpdate,
      remoteVersion,
      changelogHtml,
      filesToUpdate,
    };
  } catch (error) {
    console.error('检查更新失败:', error);
    toastr.error('检查更新失败，请查看控制台获取更多信息。');
    return null;
  }
}

/**
 * 创建并显示更新日志模态框
 * @param {string} contentHtml - 要显示的 HTML 内容
 * @param {boolean} hasUpdate - 是否有可用更新
 */
export function showChangelogModal(contentHtml: string, hasUpdate: boolean) {
  // 移除已存在的模态框，防止重复
  $('#changelog-modal-overlay').remove();

  const modalHtml = `
    <div id="changelog-modal-overlay" class="modal-overlay">
      <div class="modal-content">
        <button id="changelog-modal-close-btn" class="modal-close-btn">&times;</button>
        <div class="modal-body prose prose-invert max-w-none">
          ${contentHtml}
        </div>
        <div class="modal-footer" style="text-align: right; margin-top: 1rem;">
          ${hasUpdate ? '<button id="update-now-btn" class="btn-primary">立即更新</button>' : ''}
        </div>
      </div>
    </div>
  `;

  $('body').append(modalHtml);

  const $modalOverlay = $('#changelog-modal-overlay');
  $modalOverlay.removeClass('hidden');

  $('#changelog-modal-close-btn, #changelog-modal-overlay').on('click', function(e) {
    if (e.target === this) {
      $modalOverlay.addClass('hidden').remove();
    }
  });

  if (hasUpdate) {
    $('#update-now-btn').on('click', async function() {
      const btn = $(this);
      btn.prop('disabled', true).text('更新中...');
      try {
          const updateInfo = await checkForUpdates();
          if (updateInfo?.hasUpdate && updateInfo.filesToUpdate) {
              await updateCardFiles(updateInfo.filesToUpdate);
              toastr.success('所有文件更新完成！');
              $modalOverlay.addClass('hidden').remove();
          } else {
              toastr.warning('未找到需要更新的文件或版本已是最新。');
          }
      } catch (error: any) {
          toastr.error(`更新过程中发生错误: ${error.message}`);
          btn.prop('disabled', false).text('立即更新');
      }
    });
  }
}

/**
 * 从远程仓库获取并更新角色卡相关文件。
 * @param {string[]} filesToUpdate - 需要更新的文件路径列表。
 */
export async function updateCardFiles(filesToUpdate: string[]): Promise<void> {
    toastr.info(`开始更新 ${filesToUpdate.length} 个文件...`);
    
    for (const filePath of filesToUpdate) {
        try {
            const response = await fetch(`${GITHUB_REPO_RAW_URL}${filePath}`);
            if (!response.ok) {
                throw new Error(`下载文件失败 ${filePath}: ${response.statusText}`);
            }
            const fileContent = await response.text();
            await processFileUpdate(filePath, fileContent);
        } catch (error: any) {
            console.error(`更新文件 ${filePath} 失败:`, error);
            toastr.error(`更新文件 ${filePath} 失败: ${error.message}`);
            // 选择继续更新其他文件，而不是中断整个过程
        }
    }
}
