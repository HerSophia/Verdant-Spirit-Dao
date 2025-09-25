import $ from 'jquery';
import './FirstMes.scss';

import { initializeTabs } from './ui/tabs';
import { initializeCustomStart } from './core/main';
import { initializeCharacterNameEditor } from './ui/characterName';
import { initializeVersionChecker } from './ui/versionChecker';

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
