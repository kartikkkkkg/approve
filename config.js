// config.js

export const cfg = {
  urls: {
    home: "https://<default-portal-url>"
  },

  sel: {
    switchLink: "text=Switch",
    switchConfirm: 'button:has-text("Switch")',
    searchInput: 'input[placeholder*="Search"]',
    searchBtn: "button:has(svg)",
  },

  users: {
    approver: "Eder, Noelle"
  },

  timing: {
    afterApproveWait: 18000   // <—— CHANGE THIS for slow/fast laptops
  }
};
