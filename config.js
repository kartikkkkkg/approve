// config.js – reads settings.txt and exposes cfg used by approve.js

import { loadSettings } from "./utils.js";

const s = loadSettings();

function num(val, fallback) {
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? fallback : n;
}

export const cfg = {
  urls: {
    // main portal URL – can be overridden via settings.txt
    home: s.url || "https://<portal-url-here>"
  },

  sel: {
    // SWITCH USER
    activeUserText: "You are viewing Workforce Management as",
    switchLink: "text=Switch",
    switchDialogTitle: "Switch View",
    switchOption: (who) => `text="${who}"`,
    switchConfirm: 'button:has-text("Switch")',

    // SEARCH (we still auto-detect input in approve.js, this is mostly legacy)
    searchInput: 'input[placeholder*="Search by request ID"]',
    searchBtn: 'button:has(svg)',

    // kept from original config for compatibility / future use
    rowById: (id) => `tr:has(a:has-text("${id}")), li:has-text("${id}")`,
    rowCheckbox: (id) =>
      `tr:has(a:has-text("${id}")) input[type="checkbox"], li:has-text("${id}") input[type="checkbox"]`,

    bulkApproveBtn: 'button:has-text("Approve")',
    approveConfirmBtn: 'button:has-text("Confirm")',
    successToast:
      'div[role="status"], div.toast-success, text=successfully'
  },

  users: {
    // single approver – can be overridden via settings.txt
    approver: s.approver || "Eder, Noelle"
  },

  timing: {
    // defaults match your old behavior when settings.txt is empty
    initialPageWait: num(s.initialPageWait, 0),
    waitBeforeSwitch: num(s.waitBeforeSwitch, 0),
    waitAfterSwitch: num(s.waitAfterSwitch, 600),
    waitAfterSearch: num(s.waitAfterSearch, 40000),
    afterApproveWait: num(s.afterApproveWait, 18000)
  },

  // NEW: read from settings.txt, fallback to your user id
  edgeProfileUser: s.edgeProfileUser || "2031146"
};
