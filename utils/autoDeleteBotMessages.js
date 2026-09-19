// حذف رسائل بوتات معيّنة. عبّي AUTO_DELETE_BOT_IDS (ids مفصولة بفاصلة) لتفعيله.
const ids = () => (process.env.AUTO_DELETE_BOT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

async function handleAutoDeleteBotMessages(message) {
  try {
    if (!message.author?.bot) return false;
    if (!ids().includes(message.author.id)) return false;
    await message.delete().catch(() => {});
    return true;
  } catch { return false; }
}

async function handleDeleteProBotReplyOnR() { return false; }

module.exports = { handleAutoDeleteBotMessages, handleDeleteProBotReplyOnR };
