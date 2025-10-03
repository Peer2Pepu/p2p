const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = '8239985356:AAHkYqTI4TnO_Qf4vO_LrZLjohyZJVk7nYg';

async function getGroupId() {
  try {
    console.log('🔍 Getting group ID...');
    
    const bot = new TelegramBot(BOT_TOKEN, { polling: false });
    
    // Get updates
    const updates = await bot.getUpdates();
    
    console.log('📋 All updates:');
    console.log(JSON.stringify(updates, null, 2));
    
    // Find group chats
    const groupChats = updates.result.filter(update => 
      update.message && 
      update.message.chat && 
      update.message.chat.type === 'supergroup'
    );
    
    if (groupChats.length > 0) {
      console.log('\n🎯 Group chats found:');
      groupChats.forEach((update, index) => {
        const chat = update.message.chat;
        console.log(`${index + 1}. Group: "${chat.title}"`);
        console.log(`   ID: ${chat.id}`);
        console.log(`   Type: ${chat.type}`);
        console.log('');
      });
      
      // Get the most recent group
      const latestGroup = groupChats[groupChats.length - 1];
      console.log('✅ Latest group ID:', latestGroup.message.chat.id);
      
    } else {
      console.log('❌ No group chats found.');
      console.log('Make sure you:');
      console.log('1. Added the bot to your group');
      console.log('2. Sent a message in the group');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getGroupId();
