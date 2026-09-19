// ===== Auto Install Dependencies =====
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  const deps = Object.keys(pkg.dependencies || {});

  for (const dep of deps) {
    try {
      require.resolve(dep);
    } catch {
      console.log(`📦 جاري تثبيت ${dep}...`);
      try {
        execSync(`npm install ${dep}`, { stdio: 'inherit', cwd: __dirname });
        console.log(`✅ تم تثبيت ${dep}`);
      } catch (err) {
        console.error(`❌ فشل تثبيت ${dep}:`, err.message);
      }
    }
  }
} catch (err) {
  console.error('❌ خطأ في Auto Install:', err.message);
}
// ===== End Auto Install =====

const { Client, GatewayIntentBits, ActivityType, REST, Routes, Events } = require('discord.js');
const mongoose = require('mongoose');
const cron = require('node-cron');
const UserXP = require('./models/UserXP');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ================= MongoDB =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Error:', err));

// ================= تحميل أوامر السلاش (Map بالاسم مو بالملف) =================
client.commands = new Map();
try {
  const slashPath = path.join(__dirname, 'commands', 'slash');
  const slashFiles = fs.readdirSync(slashPath).filter(file => file.endsWith('.js'));

  for (const file of slashFiles) {
    try {
      const command = require(`./commands/slash/${file}`);
      if (command?.data?.name && command?.execute) {
        client.commands.set(command.data.name, command);
      } else {
        console.warn(`[COMMAND SKIP] ${file} - ناقص data.name أو execute`);
      }
    } catch (err) {
      console.error(`[COMMAND LOAD ERROR] ${file}:`, err.message);
    }
  }
  console.log(`✅ تم تحميل ${client.commands.size} أمر سلاش في الذاكرة`);
} catch (err) {
  console.error('❌ خطأ في تحميل أوامر السلاش:', err.message);
}

// ================= تحميل الأحداث =================
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  try {
    const event = require(`./events/${file}`);
    if (!event.name || !event.execute) {
      console.warn(`[EVENT SKIP] ${file} - missing name or execute`);
      continue;
    }
    console.log('[EVENT LOADED]', file, '=>', event.name);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  } catch (err) {
    console.error(`[EVENT ERROR] ${file}:`, err.message);
  }
}

// ================= Weekly Reset =================
cron.schedule('0 0 * * 0', async () => {
  try {
    await UserXP.updateMany({}, { $set: { weeklyTextXp: 0, weeklyVoiceXp: 0 } });
    console.log('Weekly XP Reset Done');
  } catch (err) {
    console.error('Weekly Reset Error:', err);
  }
});

// ================= Monthly Reset =================
cron.schedule('0 0 1 * *', async () => {
  try {
    await UserXP.updateMany({}, { $set: { monthlyTextXp: 0, monthlyVoiceXp: 0 } });
    console.log('Monthly XP Reset Done');
  } catch (err) {
    console.error('Monthly Reset Error:', err);
  }
});

// ================= Runtime Error Logs =================
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// ================= Ready + Auto Deploy =================
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  client.user.setPresence({
    status: 'dnd',
    activities: [{ name: 'Monitoring tickets', type: ActivityType.Watching }]
  });

  // 🔥 Auto Deploy Slash Commands
  try {
    console.log('🔄 جاري تسجيل أوامر السلاش تلقائيًا...');
    const commands = [];
    const slashPath = path.join(__dirname, 'commands', 'slash');

    if (!fs.existsSync(slashPath)) {
      console.error('❌ مجلد commands/slash غير موجود');
      return;
    }

    const slashFiles = fs.readdirSync(slashPath).filter(file => file.endsWith('.js'));

    for (const file of slashFiles) {
      try {
        const command = require(`./commands/slash/${file}`);
        if (command?.data?.toJSON) {
          commands.push(command.data.toJSON());
          console.log(`  ✅ حُمِّل: ${file}`);
        } else {
          console.warn(`  ⚠️ تخطي: ${file} - لا يوجد data.toJSON`);
        }
      } catch (err) {
        console.error(`  ❌ خطأ في تحميل ${file}:`, err.message);
      }
    }

    if (!commands.length) {
      console.warn('⚠️ لا توجد أوامر للتسجيل.');
      return;
    }

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    // سجّل الأوامر على السيرفر فقط
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log(`✅ تم تسجيل ${commands.length} أمر على السيرفر بنجاح!`);
  } catch (error) {
    console.error('❌ Auto Deploy Error:', error);
  }
});

client.login(process.env.TOKEN);
