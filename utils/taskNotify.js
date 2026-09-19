const systemState = { active: 'old' };

async function notifyApproversTaskDone(guild, member, info = {}) {
  console.log(`[TASK DONE] ${member?.user?.tag} - ${info.taskName} (${info.gainedXp}/${info.requiredXp})`);
}

module.exports = { systemState, notifyApproversTaskDone };
