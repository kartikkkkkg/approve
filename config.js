// config.js – minimal base config (everything else is overridden by settings.txt)

export const cfg = {
  urls: {
    home: ""   // replaced by settings.txt → url=<...>
  },

  sel: {
    // SWITCH USER
    switchLink: "text=Switch",
    switchDialogTitle: "Switch View",
    switchOption: (who) => `text="${who}"`,
    switchConfirm: 'button:has-text("Switch")',

    // SEARCH INPUT
    searchInput: 'input[placeholder*="Search"]',
    searchBtn: 'button:has(svg)',

    // ROWS (not used but kept)
    rowById: (id) => `tr:has(a:has-text("${id}")), li:has-text("${id}")`,
    rowCheckbox: (id) =>
      `tr:has(a:has-text("${id}")) input[type="checkbox"], li:has-text("${id}") input[type="checkbox"]`,

    // APPROVE BUTTON (blue ✔)
    bulkApproveBtn: 'button:has-text("Approve")',
    approveConfirmBtn: 'button:has-text("Confirm")',
    successToast: 'div[role="status"], div.toast-success, text=successfully'
  },

  users: {
    approver: ""   // replaced by settings.txt → approver=<...>
  },

  timing: {
    afterApproveWait: 18000,
    afterSearchWait: 4000
  },

  edgeProfileUser: ""  // replaced by settings.txt → edgeProfileUser=<...>
};
