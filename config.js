import { loadSettings } from "./utils.js";

const s = loadSettings();

export const cfg = {
  urls: {
    home: s.url || "https://<default-url>"
  },

  users: {
    approver: s.approver || "Eder, Noelle"
  },

  timing: {
    initialPageWait: Number(s.initialPageWait || 5000),
    waitBeforeSwitch: Number(s.waitBeforeSwitch || 2000),
    waitAfterSwitch: Number(s.waitAfterSwitch || 6000),
    waitAfterSearch: Number(s.waitAfterSearch || 2500),
    afterApproveWait: Number(s.afterApproveWait || 18000)
  },

  sel: {
    switchLink: "text=Switch",
    switchConfirm: 'button:has-text("Switch")',
    searchBtn: "button:has(svg)"
  },

  edgeProfileUser: "2031146"
};
